/**
 * PDF Viewer Module - Google Drive Style Architecture
 * Uses native PDF.js TextLayer for accurate text selection
 * Annotations stored with page-relative coordinates
 */

// Initialize PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ============================================
// PDF VIEWER CONTROLLER
// ============================================
const PDFViewer = {
    // State
    pdfDoc: null,
    currentPage: 1,
    totalPages: 0,
    scale: 1.0,
    programmaticScrollTarget: null,
    programmaticScrollTimer: null,
    currentDocId: null,
    currentSubmissionId: null,
    isReadOnly: false,
    annotations: [],
    annotationFilter: 'all',
    annotationsLoadingStartedAt: 0,

    // Mode states
    highlightMode: false,
    commentMode: false,

    // Pending annotation data
    pendingHighlight: null,
    selectionDragStart: null,
    selectionDragActive: false,
    selectionDebugEnabled: false,
    selectionDebugAllPdfSelections: true,
    lastSelectionDebugAt: 0,
    lastSelectionMouse: null,
    renderRequestId: 0,

    // DOM references (set on init)
    elements: {},

    // Uploaded PDFs storage
    uploadedPdfs: {},
    // Remote PDFs storage (from DB file_url)
    remotePdfs: {},

    // ============================================
    // INITIALIZATION
    // ============================================
    init() {
        this.cacheElements();
        this.bindEvents();
        this.loadStoredPdfs();
        document.dispatchEvent(new CustomEvent('pdfviewer:ready'));
    },

    cacheElements() {
        this.elements = {
            modal: document.getElementById('pdf-modal'),
            docName: document.getElementById('pdf-doc-name'),
            viewerContainer: document.getElementById('pdf-viewer-container'),
            pageInfo: document.getElementById('pdf-page-info'),
            pageInput: document.getElementById('pdf-page-input'),
            totalPages: document.getElementById('pdf-total-pages'),
            zoomInfo: document.getElementById('pdf-zoom-info'),
            sidebar: document.getElementById('pdf-sidebar'),
            annotationFilter: document.getElementById('pdf-annotation-filter'),
            annotationsList: document.getElementById('pdf-annotations-list'),
            highlightBtn: document.getElementById('pdf-highlight-btn'),
            commentBtn: document.getElementById('pdf-comment-btn'),
            commentModal: document.getElementById('pdf-comment-modal'),
            commentTextarea: document.getElementById('pdf-comment-textarea'),
            selectedTextPreview: document.getElementById('pdf-selected-text-preview')
        };
    },

    bindEvents() {
        // Text selection for highlighting
        document.addEventListener('mousedown', (e) => this.rememberSelectionDragStart(e));
        document.addEventListener('mousemove', (e) => this.trackSelectionMouse(e));
        document.addEventListener('selectionchange', () => this.debugSelectionChange());
        document.addEventListener('mouseup', (e) => this.handleTextSelection(e));
        this.elements.annotationFilter?.addEventListener('change', (e) => {
            if (e.target?.name === 'pdf-annotation-filter') {
                this.setAnnotationFilter(e.target.value);
            }
        });
        this.elements.pageInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.goToPageFromInput();
            }
        });
        this.elements.pageInput?.addEventListener('change', () => this.goToPageFromInput());
        this.elements.viewerContainer?.addEventListener('scroll', () => this.updateCurrentPageFromScroll(), { passive: true });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!this.elements.modal?.classList.contains('active')) return;
            if (e.target === this.elements.pageInput) return;

            if (e.key === 'Escape') {
                if (this.elements.commentModal?.classList.contains('active')) {
                    this.closeCommentModal();
                } else {
                    this.close();
                }
            }
            if (e.key === 'ArrowLeft') this.prevPage();
            if (e.key === 'ArrowRight') this.nextPage();
        });
    },

    loadStoredPdfs() {
        const stored = localStorage.getItem('pdf_viewer_uploads');
        if (stored) {
            try {
                // Only load metadata, not actual PDF data
                const meta = JSON.parse(stored);
                Object.keys(meta).forEach(id => {
                    this.uploadedPdfs[id] = { ...meta[id], data: null };
                });
            } catch (e) {
                console.warn('Failed to load stored PDFs:', e);
            }
        }
    },

    saveStoredPdfs() {
        const meta = {};
        Object.keys(this.uploadedPdfs).forEach(id => {
            const { data, ...rest } = this.uploadedPdfs[id];
            meta[id] = rest;
        });
        localStorage.setItem('pdf_viewer_uploads', JSON.stringify(meta));
    },

    getUploadsMeta() {
        return Object.values(this.uploadedPdfs).map(({ id, name, uploadDate, size }) => ({
            id,
            name,
            uploadDate,
            size
        }));
    },

    registerRemote(docId, name, url, meta = {}) {
        if (!docId || !url) return;
        const cleaned = String(url).trim().replace(/\\/g, '/');
        const parts = cleaned.split('/');
        const fileName = parts[parts.length - 1];
        const candidates = [cleaned];

        if (!/^https?:\/\//i.test(cleaned)) {
            if (!cleaned.startsWith('/')) {
                candidates.push(`../${cleaned.replace(/^\.?\//, '')}`);
            }
            if (fileName) {
                candidates.push(`../uploads/documents/${fileName}`);
                candidates.push(`/CAPSTONE/demo/uploads/documents/${fileName}`);
            }
        }

        this.remotePdfs[docId] = {
            id: docId,
            name: name || 'Document',
            url: cleaned,
            candidates: Array.from(new Set(candidates)),
            submissionId: Number.isInteger(meta.submissionId) ? meta.submissionId : null
        };
    },

    // ============================================
    // PDF UPLOAD
    // ============================================
    handleUpload(file) {
        return new Promise((resolve, reject) => {
            if (!file || file.type !== 'application/pdf') {
                reject(new Error('Invalid PDF file'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const docId = 'pdf_' + Date.now();
                const pdfData = e.target.result;

                this.uploadedPdfs[docId] = {
                    id: docId,
                    name: file.name,
                    data: pdfData,
                    uploadDate: new Date().toISOString(),
                    size: file.size
                };

                this.saveStoredPdfs();
                resolve({ docId, name: file.name });
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    },

    // ============================================
    // OPEN / CLOSE
    // ============================================
    async open(docId, readonly = false) {
        this.currentDocId = docId;
        this.currentSubmissionId = this.resolveSubmissionId(docId);
        this.isReadOnly = readonly;
        this.currentPage = 1;
        this.scale = 1.0;
        this.annotations = [];
        this.annotationFilter = 'all';
        const allFilterInput = this.elements.annotationFilter?.querySelector('input[value="all"]');
        if (allFilterInput) allFilterInput.checked = true;

        const modal = this.elements.modal;
        if (!modal) return;

        modal.classList.add('active');
        if (readonly) modal.classList.add('readonly');
        document.body.style.overflow = 'hidden';

        // Get PDF data
        const localDoc = this.uploadedPdfs[docId];
        const remoteDoc = this.remotePdfs[docId];

        if (!localDoc?.data && !remoteDoc?.url) {
            this.showLoading('No PDF data available');
            return;
        }

        this.elements.docName.textContent = localDoc?.name || remoteDoc?.name || 'Document';
        this.showLoading('Loading PDF...');
        this.showAnnotationsLoading();

        try {
            if (localDoc?.data) {
                await this.loadDocument(localDoc.data);
            } else {
                let loaded = false;
                const tries = remoteDoc.candidates || [remoteDoc.url];
                for (const candidate of tries) {
                    try {
                        await this.loadDocument(candidate);
                        loaded = true;
                        break;
                    } catch (_err) {
                        // try next candidate path
                    }
                }
                if (!loaded) {
                    throw new Error('MissingPDFException');
                }
            }
        } catch (error) {
            console.error('Failed to load PDF:', error);
            this.showLoading('Failed to load PDF');
        }
    },

    close() {
        const modal = this.elements.modal;
        if (!modal) return;

        this.renderRequestId++;
        modal.classList.remove('active', 'readonly');
        document.body.style.overflow = '';

        // Reset state
        this.pdfDoc = null;
        this.currentDocId = null;
        this.currentSubmissionId = null;
        this.currentPage = 1;
        this.highlightMode = false;
        this.commentMode = false;
        this.pendingHighlight = null;
        this.annotations = [];

        // Clear viewer
        if (this.elements.viewerContainer) {
            this.elements.viewerContainer.innerHTML = '';
        }

        // Reset button states
        this.elements.highlightBtn?.classList.remove('active');
        this.elements.commentBtn?.classList.remove('active');
    },

    showLoading(message) {
        this.renderRequestId++;
        if (this.elements.viewerContainer) {
            this.elements.viewerContainer.innerHTML = `
                <div class="pdf-loading">
                    <i class="fa-solid fa-spinner"></i>
                    <p>${message}</p>
                </div>
            `;
        }
    },

    // ============================================
    // PDF LOADING & RENDERING
    // ============================================
    async loadDocument(pdfData) {
        this.showAnnotationsLoading();
        const loadingTask = pdfjsLib.getDocument(pdfData);
        this.pdfDoc = await loadingTask.promise;
        this.totalPages = this.pdfDoc.numPages;

        this.updatePageInfo();
        await this.renderAllPages();
        await this.loadAnnotations();
    },

    async renderAllPages() {
        const container = this.elements.viewerContainer;
        if (!container || !this.pdfDoc) return;

        const renderRequestId = ++this.renderRequestId;
        container.innerHTML = '';

        for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
            if (renderRequestId !== this.renderRequestId) return;
            await this.renderPage(pageNum, container, renderRequestId);
        }
    },

    async renderPage(pageNum, container, renderRequestId = this.renderRequestId) {
        const page = await this.pdfDoc.getPage(pageNum);
        if (renderRequestId !== this.renderRequestId) return;

        const viewport = page.getViewport({ scale: this.scale });
        const viewportWidth = viewport.width;
        const viewportHeight = viewport.height;

        const existingPage = container.querySelector(
            `.pdf-page-container[data-page-number="${pageNum}"]`
        );
        existingPage?.remove();

        // Create page container
        const pageContainer = document.createElement('div');
        pageContainer.className = 'pdf-page-container';
        pageContainer.dataset.pageNumber = pageNum;
        pageContainer.style.width = viewportWidth + 'px';
        pageContainer.style.height = viewportHeight + 'px';

        // Create canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewportWidth;
        canvas.height = viewportHeight;
        pageContainer.appendChild(canvas);

        // Render PDF page to canvas
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        if (renderRequestId !== this.renderRequestId) return;

        container.appendChild(pageContainer);

        // Create and render text layer (Native PDF.js)
        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        textLayerDiv.style.width = viewportWidth + 'px';
        textLayerDiv.style.height = viewportHeight + 'px';
        textLayerDiv.style.setProperty('--scale-factor', this.scale);
        pageContainer.appendChild(textLayerDiv);

        const textContent = await page.getTextContent();

        // Use PDF.js renderTextLayer
        await pdfjsLib.renderTextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport,
            textDivs: []
        }).promise;
        if (renderRequestId !== this.renderRequestId || !pageContainer.isConnected) return;

        const selectionPreviewLayer = document.createElement('div');
        selectionPreviewLayer.className = 'pdf-selection-preview-layer';
        selectionPreviewLayer.dataset.pageNumber = pageNum;
        pageContainer.appendChild(selectionPreviewLayer);

        // Create annotation layer
        const annotationLayer = document.createElement('div');
        annotationLayer.className = 'pdf-annotation-layer';
        annotationLayer.dataset.pageNumber = pageNum;
        annotationLayer.style.width = viewportWidth + 'px';
        annotationLayer.style.height = viewportHeight + 'px';
        pageContainer.appendChild(annotationLayer);

        // Render annotations for this page
        this.renderPageAnnotations(pageNum);
    },

    updatePageInfo() {
        if (this.elements.pageInput) {
            this.elements.pageInput.max = this.totalPages || 1;
            this.elements.pageInput.value = this.currentPage || 1;
        }
        if (this.elements.totalPages) {
            this.elements.totalPages.textContent = this.totalPages || 0;
        }
        if (this.elements.zoomInfo) {
            this.elements.zoomInfo.textContent = `${Math.round(this.scale * 100)}%`;
        }
    },

    // ============================================
    // NAVIGATION
    // ============================================
    prevPage() {
        this.scrollToPage(Math.max(1, this.currentPage - 1));
    },

    nextPage() {
        this.scrollToPage(Math.min(this.totalPages, this.currentPage + 1));
    },

    scrollToPage(pageNum) {
        const targetPage = Math.min(Math.max(parseInt(pageNum, 10) || 1, 1), this.totalPages || 1);
        const pageContainer = this.elements.viewerContainer?.querySelector(
            `.pdf-page-container[data-page-number="${targetPage}"]`
        );
        if (pageContainer) {
            this.programmaticScrollTarget = targetPage;
            if (this.programmaticScrollTimer) {
                clearTimeout(this.programmaticScrollTimer);
            }
            this.programmaticScrollTimer = setTimeout(() => {
                this.programmaticScrollTarget = null;
                this.programmaticScrollTimer = null;
            }, 800);

            this.currentPage = targetPage;
            this.updatePageInfo();
            pageContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    },

    goToPageFromInput() {
        const value = parseInt(this.elements.pageInput?.value, 10);
        const targetPage = Math.min(Math.max(value || 1, 1), this.totalPages || 1);

        if (this.elements.pageInput) {
            this.elements.pageInput.value = targetPage;
        }
        this.scrollToPage(targetPage);
    },

    updateCurrentPageFromScroll() {
        if (!this.elements.viewerContainer || !this.totalPages) return;

        const containerRect = this.elements.viewerContainer.getBoundingClientRect();
        const pages = Array.from(this.elements.viewerContainer.querySelectorAll('.pdf-page-container'));
        let closestPage = this.currentPage;
        let closestDistance = Infinity;

        pages.forEach(page => {
            const rect = page.getBoundingClientRect();
            const distance = Math.abs(rect.top - containerRect.top - 20);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestPage = parseInt(page.dataset.pageNumber, 10) || closestPage;
            }
        });

        if (this.programmaticScrollTarget) {
            if (closestPage !== this.programmaticScrollTarget) return;
            this.programmaticScrollTarget = null;
            if (this.programmaticScrollTimer) {
                clearTimeout(this.programmaticScrollTimer);
                this.programmaticScrollTimer = null;
            }
        }

        if (closestPage !== this.currentPage) {
            this.currentPage = closestPage;
            this.updatePageInfo();
        }
    },

    // ============================================
    // ZOOM
    // ============================================
    async zoomIn() {
        if (this.scale < 3.0) {
            this.scale += 0.25;
            await this.rerender();
        }
    },

    async zoomOut() {
        if (this.scale > 0.5) {
            this.scale -= 0.25;
            await this.rerender();
        }
    },

    async rerender() {
        if (!this.pdfDoc) return;

        const scrollTop = this.elements.viewerContainer?.scrollTop || 0;
        await this.renderAllPages();
        this.renderAllAnnotations();
        this.updatePageInfo();

        // Restore scroll position (approximate)
        if (this.elements.viewerContainer) {
            this.elements.viewerContainer.scrollTop = scrollTop * (this.scale / (this.scale - 0.25 || 1));
        }
    },

    // ============================================
    // ANNOTATION MODES
    // ============================================
    async toggleHighlightMode() {
        if (this.pendingHighlight?.rects?.length) {
            const highlightData = this.pendingHighlight;
            this.highlightMode = false;
            this.commentMode = false;
            this.elements.highlightBtn?.classList.remove('active');
            this.elements.commentBtn?.classList.remove('active');

            try {
                await this.createAnnotation(highlightData, '');
                this.pendingHighlight = null;
                this.selectionDragStart = null;
                this.selectionDragActive = false;
                window.getSelection()?.removeAllRanges();
                this.clearSelectionPreview();
            } catch (error) {
                console.error('Failed to save annotation:', error);
                if (typeof showToast === 'function') showToast(error.message || 'Failed to save annotation', 'error');
            }
            return;
        }

        this.highlightMode = false;
        this.commentMode = false;

        this.elements.highlightBtn?.classList.remove('active');
        this.elements.commentBtn?.classList.remove('active');

        if (typeof showToast === 'function') {
            showToast('Select text first, then click highlight', 'info');
        }
    },

    toggleCommentMode() {
        if (this.pendingHighlight?.rects?.length) {
            this.commentMode = false;
            this.highlightMode = false;
            this.elements.commentBtn?.classList.remove('active');
            this.elements.highlightBtn?.classList.remove('active');
            this.openCommentModal(this.pendingHighlight.text);
            return;
        }

        this.commentMode = false;
        this.highlightMode = false;

        this.elements.commentBtn?.classList.remove('active');
        this.elements.highlightBtn?.classList.remove('active');

        if (typeof showToast === 'function') {
            showToast('Select text first, then click comment', 'info');
        }
    },

    // ============================================
    // TEXT SELECTION HANDLING
    // ============================================
    rememberSelectionDragStart(e) {
        this.selectionDragStart = null;
        this.selectionDragActive = false;
        this.lastSelectionMouse = { clientX: e.clientX, clientY: e.clientY };

        if (!this.elements.modal?.classList.contains('active')) return;

        const target = e.target instanceof Element ? e.target : null;
        const textLayer = target?.closest('.textLayer') ||
            target?.closest('.pdf-page-container')?.querySelector('.textLayer');
        if (!textLayer) return;

        this.selectionDragStart = {
            clientX: e.clientX,
            clientY: e.clientY,
            textLayer
        };
        this.selectionDragActive = true;

        this.clearSelectionPreview();
        this.logSelectionDebug('drag-start', e);
    },

    clearSelectionPreview(pageNum = null) {
        const selector = pageNum
            ? `.pdf-selection-preview-layer[data-page-number="${pageNum}"]`
            : '.pdf-selection-preview-layer';

        this.elements.viewerContainer
            ?.querySelectorAll(selector)
            .forEach(layer => {
                layer.innerHTML = '';
            });
    },

    updateSelectionPreview(event = null) {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.rangeCount) {
            this.clearSelectionPreview();
            return;
        }

        const range = selection.getRangeAt(0);
        const textLayer = this.getSelectionTextLayer(range);
        if (!textLayer) {
            this.clearSelectionPreview();
            return;
        }

        const pageContainer = textLayer.closest('.pdf-page-container');
        const pageNum = pageContainer?.dataset.pageNumber;
        const previewLayer = pageContainer?.querySelector('.pdf-selection-preview-layer');
        if (!pageNum || !previewLayer) return;

        const dragBounds = this.getSelectionDragBounds(textLayer, event || this.lastSelectionMouse);
        const rects = this.getSelectionHighlightRects(range, textLayer, dragBounds);
        const layerRect = previewLayer.getBoundingClientRect();
        const pageWidth = layerRect.width || previewLayer.offsetWidth || pageContainer.offsetWidth;
        const pageHeight = layerRect.height || previewLayer.offsetHeight || pageContainer.offsetHeight;

        this.clearSelectionPreview();
        rects.forEach(rect => {
            const previewRect = document.createElement('div');
            previewRect.className = 'pdf-selection-preview-rect';
            previewRect.style.left = (rect.x / 100 * pageWidth) + 'px';
            previewRect.style.top = (rect.y / 100 * pageHeight) + 'px';
            previewRect.style.width = (rect.width / 100 * pageWidth) + 'px';
            previewRect.style.height = (rect.height / 100 * pageHeight) + 'px';
            previewLayer.appendChild(previewRect);
        });
    },

    trackSelectionMouse(e) {
        this.lastSelectionMouse = { clientX: e.clientX, clientY: e.clientY };
        if (this.selectionDragStart && this.selectionDragActive && e.buttons === 1) {
            this.updateSelectionPreview(e);
        } else if (this.selectionDragStart && e.buttons !== 1) {
            this.selectionDragActive = false;
        }
    },

    debugSelectionChange() {
        if (!this.selectionDebugEnabled) return;
        if (!this.elements.modal?.classList.contains('active')) return;
        if (this.selectionDragStart && this.selectionDragActive) {
            this.updateSelectionPreview();
        }

        const now = performance.now();
        if (now - this.lastSelectionDebugAt < 250) return;

        const snapshot = this.getSelectionDebugSnapshot();
        if (!this.selectionDragStart && !snapshot.textLayerPage && !snapshot.selectedTextLength) return;
        if (!this.selectionDebugAllPdfSelections && !this.highlightMode && !this.commentMode) return;

        this.lastSelectionDebugAt = now;
        this.logSelectionDebug('selectionchange', null, snapshot);
    },

    logSelectionDebug(label, event = null, existingSnapshot = null) {
        if (!this.selectionDebugEnabled) return;
        if (typeof console === 'undefined' || typeof console.groupCollapsed !== 'function') return;

        const snapshot = existingSnapshot || this.getSelectionDebugSnapshot(event);
        console.warn('[PDFViewer selection debug]', label, {
            mode: snapshot.mode,
            text: snapshot.selectedTextLength,
            rects: snapshot.nativeRectCount,
            largest: snapshot.largestNativeRect,
            hitElement: snapshot.hitElement,
            textLayerPage: snapshot.textLayerPage
        });
        console.groupCollapsed(
            `[PDFViewer selection debug] ${label}`,
            `text=${snapshot.selectedTextLength}`,
            `rects=${snapshot.nativeRectCount}`,
            `largest=${snapshot.largestNativeRect?.width || 0}x${snapshot.largestNativeRect?.height || 0}`
        );
        console.log('summary', snapshot);
        if (snapshot.nativeRects.length) {
            console.table(snapshot.nativeRects.slice(0, 12));
        }
        if (snapshot.textSpanRects.length) {
            console.table(snapshot.textSpanRects.slice(0, 12));
        }
        console.groupEnd();
    },

    getSelectionDebugSnapshot(event = null) {
        const selection = window.getSelection();
        const range = selection && !selection.isCollapsed && selection.rangeCount
            ? selection.getRangeAt(0)
            : null;
        const textLayer = this.getSelectionTextLayer(range);
        const layerRect = textLayer?.getBoundingClientRect();
        const mouse = event
            ? { clientX: event.clientX, clientY: event.clientY }
            : this.lastSelectionMouse;
        const hitElement = mouse
            ? document.elementFromPoint(mouse.clientX, mouse.clientY)
            : null;
        const nativeRects = range
            ? Array.from(range.getClientRects()).map(rect => this.debugRect(rect, layerRect))
            : [];
        const textSpanRects = range && textLayer && layerRect
            ? this.getSelectedTextSpanRects(range, textLayer, layerRect)
                .map(rect => this.debugLocalRect(rect))
            : [];
        const largestNativeRect = nativeRects
            .slice()
            .sort((a, b) => (b.width * b.height) - (a.width * a.height))[0] || null;

        return {
            mode: this.highlightMode ? 'highlight' : (this.commentMode ? 'comment' : 'off'),
            selectedTextLength: selection?.toString().length || 0,
            selectedTextPreview: (selection?.toString() || '').replace(/\s+/g, ' ').trim().slice(0, 160),
            anchorNode: this.describeNode(selection?.anchorNode),
            focusNode: this.describeNode(selection?.focusNode),
            startNode: this.describeNode(range?.startContainer),
            endNode: this.describeNode(range?.endContainer),
            mouse,
            hitElement: this.describeNode(hitElement),
            dragStart: this.selectionDragStart
                ? {
                    clientX: this.selectionDragStart.clientX,
                    clientY: this.selectionDragStart.clientY,
                    page: this.selectionDragStart.textLayer?.closest('.pdf-page-container')?.dataset.pageNumber || null
                }
                : null,
            textLayerPage: textLayer?.closest('.pdf-page-container')?.dataset.pageNumber || null,
            textLayerBounds: layerRect ? this.debugRect(layerRect) : null,
            nativeRectCount: nativeRects.length,
            largestNativeRect,
            nativeRects,
            textSpanRectCount: textSpanRects.length,
            textSpanRects
        };
    },

    getSelectionTextLayer(range) {
        if (!range) return null;

        const startNode = range.startContainer?.nodeType === Node.ELEMENT_NODE
            ? range.startContainer
            : range.startContainer?.parentElement;
        const focusNode = window.getSelection()?.focusNode;
        const focusElement = focusNode?.nodeType === Node.ELEMENT_NODE
            ? focusNode
            : focusNode?.parentElement;

        return startNode?.closest?.('.textLayer') || focusElement?.closest?.('.textLayer') || null;
    },

    describeNode(node) {
        if (!node) return null;
        if (node.nodeType === Node.TEXT_NODE) {
            return {
                type: 'text',
                text: node.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) || ''
            };
        }

        if (!(node instanceof Element)) {
            return { type: `node-${node.nodeType}` };
        }

        return {
            type: node.tagName.toLowerCase(),
            id: node.id || '',
            className: node.className || '',
            page: node.closest('.pdf-page-container')?.dataset.pageNumber || null,
            text: node.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) || ''
        };
    },

    debugRect(rect, layerRect = null) {
        const result = {
            left: Math.round(rect.left * 100) / 100,
            top: Math.round(rect.top * 100) / 100,
            width: Math.round(rect.width * 100) / 100,
            height: Math.round(rect.height * 100) / 100
        };

        if (layerRect) {
            result.localLeft = Math.round((rect.left - layerRect.left) * 100) / 100;
            result.localTop = Math.round((rect.top - layerRect.top) * 100) / 100;
        }

        return result;
    },

    debugLocalRect(rect) {
        return {
            left: Math.round(rect.left * 100) / 100,
            top: Math.round(rect.top * 100) / 100,
            width: Math.round(rect.width * 100) / 100,
            height: Math.round(rect.height * 100) / 100
        };
    },

    async handleTextSelection(e) {
        this.selectionDragActive = false;

        if (this.isReadOnly) {
            this.selectionDragStart = null;
            this.clearSelectionPreview();
            return;
        }

        if (!this.elements.modal?.classList.contains('active')) {
            this.selectionDragStart = null;
            this.clearSelectionPreview();
            return;
        }

        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
            this.selectionDragStart = null;
            this.clearSelectionPreview();
            return;
        }

        const selectedText = selection.toString().trim();
        if (!selectedText) {
            this.selectionDragStart = null;
            this.clearSelectionPreview();
            return;
        }

        // Get the range and find which page it's on
        const range = selection.getRangeAt(0);
        const startNode = range.startContainer.nodeType === Node.ELEMENT_NODE
            ? range.startContainer
            : range.startContainer.parentElement;
        const textLayer = startNode?.closest('.textLayer');
        if (!textLayer) {
            this.selectionDragStart = null;
            this.clearSelectionPreview();
            return;
        }

        const pageContainer = textLayer.closest('.pdf-page-container');
        if (!pageContainer) {
            this.selectionDragStart = null;
            this.clearSelectionPreview();
            return;
        }

        const pageNum = parseInt(pageContainer.dataset.pageNumber);
        const dragBounds = this.getSelectionDragBounds(textLayer, e);
        const rects = this.getSelectionHighlightRects(range, textLayer, dragBounds);
        this.logSelectionDebug('drag-end-before-save', e);

        if (rects.length === 0) {
            this.selectionDragStart = null;
            this.selectionDragActive = false;
            this.clearSelectionPreview();
            return;
        }

        // Store pending highlight data so toolbar actions can apply it after selection.
        this.pendingHighlight = {
            page: pageNum,
            text: selectedText,
            rects: rects
        };

        if (!this.highlightMode && !this.commentMode) {
            this.selectionDragStart = null;
            this.selectionDragActive = false;
            return;
        }

        if (this.commentMode) {
            // Open comment modal
            this.openCommentModal(selectedText);
        } else if (this.highlightMode) {
            // Create highlight immediately (no comment)
            try {
                await this.createAnnotation(this.pendingHighlight, '');
                selection.removeAllRanges();
                this.pendingHighlight = null;
            } catch (error) {
                console.error('Failed to save annotation:', error);
                if (typeof showToast === 'function') showToast(error.message || 'Failed to save annotation', 'error');
                this.selectionDragStart = null;
                this.selectionDragActive = false;
                this.clearSelectionPreview();
                return;
            }
        }

        this.selectionDragStart = null;
        this.selectionDragActive = false;
        if (this.highlightMode) {
            this.clearSelectionPreview();
        }
    },

    getSelectionDragBounds(textLayer, e) {
        if (!this.selectionDragStart || this.selectionDragStart.textLayer !== textLayer) {
            return null;
        }

        const layerRect = textLayer.getBoundingClientRect();
        if (!layerRect.width || !layerRect.height) return null;

        const startY = this.selectionDragStart.clientY - layerRect.top;
        const endY = e.clientY - layerRect.top;
        const padding = 10;

        return {
            left: 0,
            top: Math.max(0, Math.min(startY, endY) - padding),
            right: layerRect.width,
            bottom: Math.min(layerRect.height, Math.max(startY, endY) + padding),
            width: layerRect.width,
            height: Math.min(layerRect.height, Math.max(startY, endY) + padding) -
                Math.max(0, Math.min(startY, endY) - padding)
        };
    },

    getSelectionHighlightRects(range, textLayer, dragBounds = null) {
        const layerRect = textLayer.getBoundingClientRect();
        if (!layerRect.width || !layerRect.height) return [];

        const textRects = this.getSelectedTextSpanRects(range, textLayer, layerRect);
        if (textRects.length === 0) return [];

        const selectionRects = Array.from(range.getClientRects())
            .map(rect => this.clipRectToBounds(rect, layerRect))
            .filter(Boolean)
            .map(rect => ({
                left: rect.left - layerRect.left,
                top: rect.top - layerRect.top,
                right: rect.right - layerRect.left,
                bottom: rect.bottom - layerRect.top,
                width: rect.right - rect.left,
                height: rect.bottom - rect.top
            }))
            .filter(rect => rect.width >= 1 && rect.height >= 1);

        const boundedSelectionRects = dragBounds
            ? selectionRects
                .map(rect => this.clipLocalRectToBounds(rect, dragBounds))
                .filter(Boolean)
            : selectionRects;
        const boundedTextRects = dragBounds
            ? textRects
                .map(rect => this.clipLocalRectToBounds(rect, dragBounds))
                .filter(Boolean)
            : textRects;

        const clippedRects = this.intersectSelectionWithTextRects(boundedSelectionRects, boundedTextRects);
        if (clippedRects.length === 0) return [];

        const mergedRects = this.mergeSelectionRectsByLine(clippedRects);

        return mergedRects
            .map(rect => ({
                x: this.roundPercent((rect.left / layerRect.width) * 100),
                y: this.roundPercent((rect.top / layerRect.height) * 100),
                width: this.roundPercent((rect.width / layerRect.width) * 100),
                height: this.roundPercent((rect.height / layerRect.height) * 100)
            }))
            .filter(rect => rect.width > 0 && rect.height > 0);
    },

    getSelectedTextSpanRects(range, textLayer, layerRect) {
        return Array.from(textLayer.querySelectorAll('span'))
            .filter(span => span.textContent && span.textContent.trim())
            .filter(span => {
                try {
                    return range.intersectsNode(span);
                } catch (_err) {
                    return false;
                }
            })
            .flatMap(span => Array.from(span.getClientRects()))
            .map(rect => this.clipRectToBounds(rect, layerRect))
            .filter(Boolean)
            .map(rect => ({
                left: rect.left - layerRect.left,
                top: rect.top - layerRect.top,
                right: rect.right - layerRect.left,
                bottom: rect.bottom - layerRect.top,
                width: rect.right - rect.left,
                height: rect.bottom - rect.top
            }))
            .filter(rect => rect.width >= 1 && rect.height >= 1);
    },

    intersectSelectionWithTextRects(selectionRects, textRects) {
        const intersections = [];

        selectionRects.forEach(selectionRect => {
            textRects.forEach(textRect => {
                const verticalOverlap = Math.min(selectionRect.bottom, textRect.bottom) -
                    Math.max(selectionRect.top, textRect.top);
                const minHeight = Math.min(selectionRect.height, textRect.height);

                if (verticalOverlap < minHeight * 0.35) return;

                const left = Math.max(selectionRect.left, textRect.left);
                const right = Math.min(selectionRect.right, textRect.right);
                const top = Math.max(selectionRect.top, textRect.top);
                const bottom = Math.min(selectionRect.bottom, textRect.bottom);

                if (right - left < 1 || bottom - top < 1) return;

                intersections.push({
                    left,
                    top,
                    right,
                    bottom,
                    width: right - left,
                    height: bottom - top
                });
            });
        });

        return intersections;
    },

    clipRectToBounds(rect, bounds) {
        const left = Math.max(rect.left, bounds.left);
        const top = Math.max(rect.top, bounds.top);
        const right = Math.min(rect.right, bounds.right);
        const bottom = Math.min(rect.bottom, bounds.bottom);

        if (right <= left || bottom <= top) return null;

        return { left, top, right, bottom };
    },

    clipLocalRectToBounds(rect, bounds) {
        const left = Math.max(rect.left, bounds.left);
        const top = Math.max(rect.top, bounds.top);
        const right = Math.min(rect.right, bounds.right);
        const bottom = Math.min(rect.bottom, bounds.bottom);

        if (right <= left || bottom <= top) return null;

        return {
            left,
            top,
            right,
            bottom,
            width: right - left,
            height: bottom - top
        };
    },

    mergeSelectionRectsByLine(rects) {
        const sortedRects = rects
            .slice()
            .sort((a, b) => (a.top - b.top) || (a.left - b.left));
        const lines = [];

        sortedRects.forEach(rect => {
            const rectCenter = rect.top + rect.height / 2;
            const line = lines.find(item => {
                const lineCenter = item.top + item.height / 2;
                const overlap = Math.min(item.bottom, rect.bottom) - Math.max(item.top, rect.top);
                return overlap > Math.min(item.height, rect.height) * 0.45 ||
                    Math.abs(rectCenter - lineCenter) <= Math.max(item.height, rect.height) * 0.5;
            });

            if (line) {
                line.fragments.push(rect);
                line.left = Math.min(line.left, rect.left);
                line.top = Math.min(line.top, rect.top);
                line.right = Math.max(line.right, rect.right);
                line.bottom = Math.max(line.bottom, rect.bottom);
                line.width = line.right - line.left;
                line.height = line.bottom - line.top;
            } else {
                lines.push({
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height,
                    fragments: [rect]
                });
            }
        });

        return lines
            .flatMap(line => this.mergeLineFragments(line.fragments))
            .sort((a, b) => (a.top - b.top) || (a.left - b.left));
    },

    mergeLineFragments(fragments) {
        const sortedFragments = fragments
            .slice()
            .sort((a, b) => a.left - b.left);
        const merged = [];

        sortedFragments.forEach(fragment => {
            const previous = merged[merged.length - 1];
            const gap = previous ? fragment.left - previous.right : Infinity;
            const mergeGap = Math.max(12, Math.max(fragment.height, previous?.height || 0) * 0.75);

            if (previous && gap <= mergeGap) {
                previous.left = Math.min(previous.left, fragment.left);
                previous.top = Math.min(previous.top, fragment.top);
                previous.right = Math.max(previous.right, fragment.right);
                previous.bottom = Math.max(previous.bottom, fragment.bottom);
                previous.width = previous.right - previous.left;
                previous.height = previous.bottom - previous.top;
            } else {
                merged.push({ ...fragment });
            }
        });

        return merged;
    },

    roundPercent(value) {
        return Math.round(Math.max(0, Math.min(100, value)) * 10000) / 10000;
    },

    // ============================================
    // COMMENT MODAL
    // ============================================
    openCommentModal(selectedText) {
        if (!this.elements.commentModal) return;

        this.elements.selectedTextPreview.textContent =
            selectedText.length > 100 ? selectedText.substring(0, 100) + '...' : selectedText;
        this.elements.commentTextarea.value = '';
        this.elements.commentModal.classList.add('active');
        this.elements.commentTextarea.focus();
    },

    closeCommentModal() {
        if (!this.elements.commentModal) return;

        this.elements.commentModal.classList.remove('active');
        this.elements.commentTextarea.value = '';
        window.getSelection()?.removeAllRanges();
        this.pendingHighlight = null;
        this.selectionDragStart = null;
        this.selectionDragActive = false;
        this.clearSelectionPreview();
    },

    async saveCommentFromModal() {
        const comment = this.elements.commentTextarea?.value.trim() || '';

        if (this.pendingHighlight) {
            try {
                await this.createAnnotation(this.pendingHighlight, comment);
                this.pendingHighlight = null;
            } catch (error) {
                console.error('Failed to save comment annotation:', error);
                if (typeof showToast === 'function') showToast(error.message || 'Failed to save comment', 'error');
                return;
            }
        }

        this.closeCommentModal();
        window.getSelection()?.removeAllRanges();
    },

    // ============================================
    // ANNOTATION STORAGE
    // ============================================
    getAnnotations() {
        return this.annotations || [];
    },

    async fetchAnnotationsFromApi() {
        if (!this.currentSubmissionId) return [];
        const res = await fetch(
            `../api/documents/annotations/list.php?submission_id=${encodeURIComponent(this.currentSubmissionId)}`,
            { credentials: 'same-origin' }
        );
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed to load annotations.');
        return (data.items || []).map(item => {
            let rects = [];
            try {
                rects = JSON.parse(item.rects_json || '[]');
            } catch (_e) {
                rects = [];
            }
            return {
                id: `ann_${item.annotation_id}`,
                dbId: item.annotation_id,
                submissionId: item.submission_id,
                page: item.page_number,
                text: item.selected_text || '',
                rects: Array.isArray(rects) ? rects : [],
                comment: item.comment_text || '',
                createdAt: item.created_at,
                createdByUserId: item.created_by_user_id,
                createdByName: [item.first_name, item.last_name].filter(Boolean).join(' ').trim()
            };
        });
    },

    async loadAnnotations() {
        this.showAnnotationsLoading();
        if (this.currentSubmissionId) {
            try {
                this.annotations = await this.fetchAnnotationsFromApi();
            } catch (e) {
                console.error('Failed to load annotations from API:', e);
                this.annotations = [];
            }
        } else {
            const stored = localStorage.getItem('document_annotations_' + this.currentDocId);
            if (stored) {
                try {
                    this.annotations = JSON.parse(stored);
                } catch (_e) {
                    this.annotations = [];
                }
            } else {
                this.annotations = [];
            }
        }
        await this.waitForMinimumAnnotationLoadingTime();
        this.renderAllAnnotations();
        this.renderAnnotationsSidebar();
    },

    showAnnotationsLoading() {
        const list = this.elements.annotationsList;
        if (!list) return;
        this.annotationsLoadingStartedAt = Date.now();

        const label = this.annotationFilter === 'comments'
            ? 'Loading comments...'
            : (this.annotationFilter === 'highlights' ? 'Loading highlights...' : 'Loading annotations...');

        list.innerHTML = `
            <div class="pdf-annotations-loading">
                <span class="pdf-annotations-spinner" aria-hidden="true"></span>
                <span>${label}</span>
            </div>
        `;
    },

    waitForMinimumAnnotationLoadingTime() {
        const elapsed = Date.now() - this.annotationsLoadingStartedAt;
        const remaining = Math.max(0, 300 - elapsed);
        return remaining ? new Promise(resolve => setTimeout(resolve, remaining)) : Promise.resolve();
    },

    async createAnnotation(highlightData, comment) {
        let annotation = null;
        if (this.currentSubmissionId) {
            const res = await fetch('../api/documents/annotations/create.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    submission_id: this.currentSubmissionId,
                    page: highlightData.page,
                    text: highlightData.text,
                    rects: highlightData.rects,
                    comment: comment
                })
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Failed to save annotation.');
            const item = data.item || {};
            let rects = [];
            try { rects = JSON.parse(item.rects_json || '[]'); } catch (_e) {}
            annotation = {
                id: `ann_${item.annotation_id}`,
                dbId: item.annotation_id,
                submissionId: item.submission_id,
                page: item.page_number,
                text: item.selected_text || '',
                rects: Array.isArray(rects) ? rects : [],
                comment: item.comment_text || '',
                createdAt: item.created_at
            };
            this.annotations.push(annotation);
        } else {
            annotation = {
                id: 'ann_' + Date.now(),
                page: highlightData.page,
                text: highlightData.text,
                rects: highlightData.rects,
                comment: comment,
                createdAt: new Date().toISOString()
            };
            this.annotations.push(annotation);
            localStorage.setItem('document_annotations_' + this.currentDocId, JSON.stringify(this.annotations));
        }

        this.renderPageAnnotations(annotation.page);
        this.renderAnnotationsSidebar();

        if (typeof showToast === 'function') {
            showToast(comment ? 'Comment added' : 'Highlight added', 'success');
        }
    },

    async deleteAnnotation(annotationId) {
        if (this.isReadOnly) return;

        const annotation = this.annotations.find(a => a.id === annotationId);
        if (!annotation) return;

        if (this.currentSubmissionId && annotation.dbId) {
            const res = await fetch('../api/documents/annotations/delete.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ annotation_id: annotation.dbId })
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Failed to delete annotation.');
        }

        this.annotations = this.annotations.filter(a => a.id !== annotationId);
        if (!this.currentSubmissionId) {
            localStorage.setItem('document_annotations_' + this.currentDocId, JSON.stringify(this.annotations));
        }

        if (annotation) {
            this.renderPageAnnotations(annotation.page);
        }
        this.renderAnnotationsSidebar();

        if (typeof showToast === 'function') {
            showToast('Annotation deleted', 'info');
        }
    },

    // ============================================
    // ANNOTATION RENDERING
    // ============================================
    renderAllAnnotations() {
        for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
            this.renderPageAnnotations(pageNum);
        }
    },

    setAnnotationFilter(filter) {
        const allowedFilters = ['all', 'highlights', 'comments'];
        this.annotationFilter = allowedFilters.includes(filter) ? filter : 'all';
        this.renderAllAnnotations();
        this.renderAnnotationsSidebar();
    },

    getFilteredAnnotations(annotations = this.getAnnotations()) {
        if (this.annotationFilter === 'highlights') {
            return annotations.filter(annotation => !annotation.comment);
        }

        if (this.annotationFilter === 'comments') {
            return annotations.filter(annotation => annotation.comment);
        }

        return annotations;
    },

    renderPageAnnotations(pageNum) {
        const annotationLayer = this.elements.viewerContainer?.querySelector(
            `.pdf-annotation-layer[data-page-number="${pageNum}"]`
        );
        if (!annotationLayer) return;

        const pageContainer = annotationLayer.closest('.pdf-page-container');
        if (!pageContainer) return;

        annotationLayer.innerHTML = '';

        const annotations = this.getFilteredAnnotations().filter(a => a.page === pageNum);
        const layerRect = annotationLayer.getBoundingClientRect();
        const pageWidth = layerRect.width || annotationLayer.offsetWidth || pageContainer.offsetWidth;
        const pageHeight = layerRect.height || annotationLayer.offsetHeight || pageContainer.offsetHeight;

        annotations.forEach(annotation => {
            // Render highlight rects
            annotation.rects.forEach((rect, i) => {
                if (!this.isValidStoredRect(rect)) return;

                const highlightEl = document.createElement('div');
                highlightEl.className = 'pdf-highlight-rect';
                highlightEl.dataset.annotationId = annotation.id;
                highlightEl.style.left = (rect.x / 100 * pageWidth) + 'px';
                highlightEl.style.top = (rect.y / 100 * pageHeight) + 'px';
                highlightEl.style.width = (rect.width / 100 * pageWidth) + 'px';
                highlightEl.style.height = (rect.height / 100 * pageHeight) + 'px';
                highlightEl.title = annotation.comment || annotation.text;
                highlightEl.onclick = () => this.scrollToSidebarItem(annotation.id);
                annotationLayer.appendChild(highlightEl);
            });

        });
    },

    isValidStoredRect(rect) {
        return rect &&
            Number.isFinite(rect.x) &&
            Number.isFinite(rect.y) &&
            Number.isFinite(rect.width) &&
            Number.isFinite(rect.height) &&
            rect.width > 0 &&
            rect.height > 0;
    },

    renderAnnotationsSidebar() {
        const list = this.elements.annotationsList;
        if (!list) return;

        const allAnnotations = this.getAnnotations();
        const annotations = this.getFilteredAnnotations(allAnnotations);

        if (allAnnotations.length === 0) {
            list.innerHTML = `
                <div class="pdf-no-annotations">
                    <i class="fa-solid fa-note-sticky"></i>
                    <p>No annotations yet<br><small>Select text to add highlights or comments</small></p>
                </div>
            `;
            return;
        }

        if (annotations.length === 0) {
            const label = this.annotationFilter === 'highlights' ? 'highlights' : 'comments';
            list.innerHTML = `
                <div class="pdf-no-annotations">
                    <i class="fa-solid fa-filter"></i>
                    <p>No ${label} to show<br><small>Switch filters to see other annotations</small></p>
                </div>
            `;
            return;
        }

        // Sort by page, then by position
        annotations.sort((a, b) => {
            if (a.page !== b.page) return a.page - b.page;
            return (a.rects[0]?.y || 0) - (b.rects[0]?.y || 0);
        });

        list.innerHTML = annotations.map(ann => `
            <div class="pdf-annotation-item ${ann.comment ? 'comment-type' : 'highlight-type'}" 
                 data-annotation-id="${ann.id}"
                 onclick="PDFViewer.scrollToAnnotation('${ann.id}')">
                <div class="pdf-annotation-item-header">
                    <div class="pdf-annotation-item-meta">
                        <i class="fa-solid ${ann.comment ? 'fa-comment' : 'fa-highlighter'}"></i>
                        <span>Page ${ann.page}</span>
                    </div>
                    <button class="pdf-annotation-delete" 
                            onclick="event.stopPropagation(); PDFViewer.deleteAnnotation('${ann.id}').catch(function(e){console.error(e);})"
                            title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                <div class="pdf-annotation-text">"${this.escapeHtml(ann.text.substring(0, 100))}${ann.text.length > 100 ? '...' : ''}"</div>
                ${ann.comment ? `<div class="pdf-annotation-comment">${this.escapeHtml(ann.comment)}</div>` : ''}
            </div>
        `).join('');
    },

    scrollToAnnotation(annotationId) {
        const annotations = this.getAnnotations();
        const annotation = annotations.find(a => a.id === annotationId);
        if (!annotation) return;

        // Scroll to page
        const pageContainer = this.elements.viewerContainer?.querySelector(
            `.pdf-page-container[data-page-number="${annotation.page}"]`
        );
        if (pageContainer) {
            pageContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Highlight the annotation briefly
        const rects = this.elements.viewerContainer?.querySelectorAll(
            `.pdf-highlight-rect[data-annotation-id="${annotationId}"]`
        );
        rects?.forEach(rect => {
            rect.classList.add('selected');
            setTimeout(() => rect.classList.remove('selected'), 2000);
        });
    },

    scrollToSidebarItem(annotationId) {
        const item = this.elements.annotationsList?.querySelector(
            `.pdf-annotation-item[data-annotation-id="${annotationId}"]`
        );
        if (item) {
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            item.style.background = 'var(--primary)';
            item.style.color = 'white';
            setTimeout(() => {
                item.style.background = '';
                item.style.color = '';
            }, 1000);
        }
    },

    // ============================================
    // SIDEBAR TOGGLE
    // ============================================
    toggleSidebar() {
        this.elements.sidebar?.classList.toggle('collapsed');
        if (this.elements.sidebar?.classList.contains('collapsed')) {
            this.elements.sidebar?.parentElement?.classList.add('sidebar-closed');
        } else {
            this.elements.sidebar?.parentElement?.classList.remove('sidebar-closed');
        }
    },

    // ============================================
    // UTILITIES
    // ============================================
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    resolveSubmissionId(docId) {
        const remote = this.remotePdfs[docId];
        if (remote && Number.isInteger(remote.submissionId) && remote.submissionId > 0) {
            return remote.submissionId;
        }
        const m = String(docId || '').match(/^submission_(\d+)$/);
        return m ? parseInt(m[1], 10) : null;
    }
};

window.PDFViewer = PDFViewer;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        PDFViewer.init();
    });
} else {
    PDFViewer.init();
}

// Global functions for onclick handlers
function openPdfViewer(docId, readonly = false) {
    PDFViewer.open(docId, readonly);
}

function closePdfViewer() {
    PDFViewer.close();
}

function pdfPrevPage() {
    PDFViewer.prevPage();
}

function pdfNextPage() {
    PDFViewer.nextPage();
}

function pdfZoomIn() {
    PDFViewer.zoomIn();
}

function pdfZoomOut() {
    PDFViewer.zoomOut();
}

function togglePdfHighlightMode() {
    PDFViewer.toggleHighlightMode();
}

function togglePdfCommentMode() {
    PDFViewer.toggleCommentMode();
}

function togglePdfSidebar() {
    PDFViewer.toggleSidebar();
}

function savePdfComment() {
    PDFViewer.saveCommentFromModal();
}

function cancelPdfComment() {
    PDFViewer.closeCommentModal();
}
