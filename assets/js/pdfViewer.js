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
    currentDocId: null,
    isReadOnly: false,

    // Mode states
    highlightMode: false,
    commentMode: false,

    // Pending annotation data
    pendingHighlight: null,

    // DOM references (set on init)
    elements: {},

    // Uploaded PDFs storage
    uploadedPdfs: {},

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
            zoomInfo: document.getElementById('pdf-zoom-info'),
            sidebar: document.getElementById('pdf-sidebar'),
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
        document.addEventListener('mouseup', (e) => this.handleTextSelection(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!this.elements.modal?.classList.contains('active')) return;

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
        this.isReadOnly = readonly;
        this.currentPage = 1;
        this.scale = 1.0;

        const modal = this.elements.modal;
        if (!modal) return;

        modal.classList.add('active');
        if (readonly) modal.classList.add('readonly');
        document.body.style.overflow = 'hidden';

        // Get PDF data
        const doc = this.uploadedPdfs[docId];
        if (!doc || !doc.data) {
            this.showLoading('No PDF data available');
            return;
        }

        this.elements.docName.textContent = doc.name;
        this.showLoading('Loading PDF...');

        try {
            await this.loadDocument(doc.data);
        } catch (error) {
            console.error('Failed to load PDF:', error);
            this.showLoading('Failed to load PDF');
        }
    },

    close() {
        const modal = this.elements.modal;
        if (!modal) return;

        modal.classList.remove('active', 'readonly');
        document.body.style.overflow = '';

        // Reset state
        this.pdfDoc = null;
        this.currentDocId = null;
        this.currentPage = 1;
        this.highlightMode = false;
        this.commentMode = false;
        this.pendingHighlight = null;

        // Clear viewer
        if (this.elements.viewerContainer) {
            this.elements.viewerContainer.innerHTML = '';
        }

        // Reset button states
        this.elements.highlightBtn?.classList.remove('active');
        this.elements.commentBtn?.classList.remove('active');
    },

    showLoading(message) {
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
        const loadingTask = pdfjsLib.getDocument(pdfData);
        this.pdfDoc = await loadingTask.promise;
        this.totalPages = this.pdfDoc.numPages;

        this.updatePageInfo();
        await this.renderAllPages();
        this.loadAnnotations();
    },

    async renderAllPages() {
        const container = this.elements.viewerContainer;
        container.innerHTML = '';

        for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
            await this.renderPage(pageNum, container);
        }
    },

    async renderPage(pageNum, container) {
        const page = await this.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: this.scale });

        // Create page container
        const pageContainer = document.createElement('div');
        pageContainer.className = 'pdf-page-container';
        pageContainer.dataset.pageNumber = pageNum;
        pageContainer.style.width = viewport.width + 'px';
        pageContainer.style.height = viewport.height + 'px';

        // Create canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        pageContainer.appendChild(canvas);

        // Render PDF page to canvas
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        // Create and render text layer (Native PDF.js)
        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        pageContainer.appendChild(textLayerDiv);

        const textContent = await page.getTextContent();

        // Use PDF.js renderTextLayer
        await pdfjsLib.renderTextLayer({
            textContent: textContent,
            container: textLayerDiv,
            viewport: viewport,
            textDivs: []
        }).promise;

        // Create annotation layer
        const annotationLayer = document.createElement('div');
        annotationLayer.className = 'pdf-annotation-layer';
        annotationLayer.dataset.pageNumber = pageNum;
        pageContainer.appendChild(annotationLayer);

        container.appendChild(pageContainer);

        // Render annotations for this page
        this.renderPageAnnotations(pageNum);
    },

    updatePageInfo() {
        if (this.elements.pageInfo) {
            this.elements.pageInfo.textContent = `${this.totalPages} pages`;
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
        const pageContainer = this.elements.viewerContainer?.querySelector(
            `.pdf-page-container[data-page-number="${pageNum}"]`
        );
        if (pageContainer) {
            pageContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            this.currentPage = pageNum;
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
    toggleHighlightMode() {
        this.highlightMode = !this.highlightMode;
        this.commentMode = false;

        this.elements.highlightBtn?.classList.toggle('active', this.highlightMode);
        this.elements.commentBtn?.classList.remove('active');

        if (this.highlightMode && typeof showToast === 'function') {
            showToast('Select text to highlight', 'info');
        }
    },

    toggleCommentMode() {
        this.commentMode = !this.commentMode;
        this.highlightMode = false;

        this.elements.commentBtn?.classList.toggle('active', this.commentMode);
        this.elements.highlightBtn?.classList.remove('active');

        if (this.commentMode && typeof showToast === 'function') {
            showToast('Select text to add a comment', 'info');
        }
    },

    // ============================================
    // TEXT SELECTION HANDLING
    // ============================================
    handleTextSelection(e) {
        if (this.isReadOnly) return;
        if (!this.highlightMode && !this.commentMode) return;
        if (!this.elements.modal?.classList.contains('active')) return;

        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;

        const selectedText = selection.toString().trim();
        if (!selectedText) return;

        // Get the range and find which page it's on
        const range = selection.getRangeAt(0);
        const textLayer = range.startContainer.parentElement?.closest('.textLayer');
        if (!textLayer) return;

        const pageContainer = textLayer.closest('.pdf-page-container');
        if (!pageContainer) return;

        const pageNum = parseInt(pageContainer.dataset.pageNumber);
        const pageRect = pageContainer.getBoundingClientRect();

        // Get all client rects for the selection
        const rects = Array.from(range.getClientRects()).map(rect => ({
            x: ((rect.left - pageRect.left) / pageRect.width) * 100,
            y: ((rect.top - pageRect.top) / pageRect.height) * 100,
            width: (rect.width / pageRect.width) * 100,
            height: (rect.height / pageRect.height) * 100
        }));

        if (rects.length === 0) return;

        // Store pending highlight data
        this.pendingHighlight = {
            page: pageNum,
            text: selectedText,
            rects: rects
        };

        if (this.commentMode) {
            // Open comment modal
            this.openCommentModal(selectedText);
        } else if (this.highlightMode) {
            // Create highlight immediately (no comment)
            this.createAnnotation(this.pendingHighlight, '');
            selection.removeAllRanges();
            this.pendingHighlight = null;
        }
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
    },

    saveCommentFromModal() {
        const comment = this.elements.commentTextarea?.value.trim() || '';

        if (this.pendingHighlight) {
            this.createAnnotation(this.pendingHighlight, comment);
            this.pendingHighlight = null;
        }

        this.closeCommentModal();
        window.getSelection()?.removeAllRanges();
    },

    // ============================================
    // ANNOTATION STORAGE
    // ============================================
    getAnnotations() {
        const stored = localStorage.getItem('pdf_annotations_' + this.currentDocId);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                return [];
            }
        }
        return [];
    },

    saveAnnotations(annotations) {
        localStorage.setItem('pdf_annotations_' + this.currentDocId, JSON.stringify(annotations));
    },

    loadAnnotations() {
        this.renderAllAnnotations();
        this.renderAnnotationsSidebar();
    },

    createAnnotation(highlightData, comment) {
        const annotations = this.getAnnotations();

        const annotation = {
            id: 'ann_' + Date.now(),
            page: highlightData.page,
            text: highlightData.text,
            rects: highlightData.rects,
            comment: comment,
            createdAt: new Date().toISOString()
        };

        annotations.push(annotation);
        this.saveAnnotations(annotations);

        this.renderPageAnnotations(annotation.page);
        this.renderAnnotationsSidebar();

        if (typeof showToast === 'function') {
            showToast(comment ? 'Comment added' : 'Highlight added', 'success');
        }
    },

    deleteAnnotation(annotationId) {
        if (this.isReadOnly) return;

        let annotations = this.getAnnotations();
        const annotation = annotations.find(a => a.id === annotationId);

        annotations = annotations.filter(a => a.id !== annotationId);
        this.saveAnnotations(annotations);

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

    renderPageAnnotations(pageNum) {
        const annotationLayer = this.elements.viewerContainer?.querySelector(
            `.pdf-annotation-layer[data-page-number="${pageNum}"]`
        );
        if (!annotationLayer) return;

        const pageContainer = annotationLayer.closest('.pdf-page-container');
        if (!pageContainer) return;

        annotationLayer.innerHTML = '';

        const annotations = this.getAnnotations().filter(a => a.page === pageNum);
        const pageWidth = pageContainer.offsetWidth;
        const pageHeight = pageContainer.offsetHeight;

        annotations.forEach(annotation => {
            // Render highlight rects
            annotation.rects.forEach((rect, i) => {
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

            // Add comment marker if there's a comment
            if (annotation.comment && annotation.rects.length > 0) {
                const firstRect = annotation.rects[0];
                const marker = document.createElement('div');
                marker.className = 'pdf-comment-marker';
                marker.dataset.annotationId = annotation.id;
                marker.style.left = (firstRect.x / 100 * pageWidth - 12) + 'px';
                marker.style.top = (firstRect.y / 100 * pageHeight - 12) + 'px';
                marker.innerHTML = '<i class="fa-solid fa-comment"></i>';
                marker.title = annotation.comment;
                marker.onclick = () => this.scrollToSidebarItem(annotation.id);
                annotationLayer.appendChild(marker);
            }
        });
    },

    renderAnnotationsSidebar() {
        const list = this.elements.annotationsList;
        if (!list) return;

        const annotations = this.getAnnotations();

        if (annotations.length === 0) {
            list.innerHTML = `
                <div class="pdf-no-annotations">
                    <i class="fa-solid fa-note-sticky"></i>
                    <p>No annotations yet<br><small>Select text to add highlights or comments</small></p>
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
                            onclick="event.stopPropagation(); PDFViewer.deleteAnnotation('${ann.id}')"
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
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    PDFViewer.init();
});

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
