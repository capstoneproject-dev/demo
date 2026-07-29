(function () {
    'use strict';

    if (window.appDialog) return;

    const queue = [];
    let activeRequest = null;
    let elements = null;

    function inferType(message, requestedType) {
        if (requestedType) return requestedType;
        const text = String(message || '').toLowerCase();
        if (/(delete|remove|archive|clear|overwrite|cancel|logout)/.test(text)) return 'warning';
        if (/(error|failed|invalid|unable|cannot|could not|required|please select|please enter)/.test(text)) return 'error';
        if (/(success|saved|submitted|created|updated|approved|restored|imported|exported|sent)/.test(text)) return 'success';
        return 'info';
    }

    function injectStyles() {
        if (document.getElementById('app-dialog-styles')) return;
        const style = document.createElement('style');
        style.id = 'app-dialog-styles';
        style.textContent = `
            .app-dialog-overlay {
                position: fixed;
                inset: 0;
                z-index: 2147483646;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                background: rgba(15, 23, 42, .58);
                backdrop-filter: blur(5px);
                opacity: 0;
                visibility: hidden;
                transition: opacity .18s ease, visibility .18s ease;
            }
            .app-dialog-overlay.show { opacity: 1; visibility: visible; }
            .app-dialog-panel {
                width: min(100%, 460px);
                overflow: hidden;
                border: 1px solid rgba(148, 163, 184, .28);
                border-radius: 18px;
                background: var(--panel, #fff);
                color: var(--text, #172033);
                box-shadow: 0 24px 70px rgba(15, 23, 42, .3);
                transform: translateY(12px) scale(.985);
                transition: transform .18s ease;
            }
            .app-dialog-overlay.show .app-dialog-panel { transform: translateY(0) scale(1); }
            .app-dialog-body {
                display: grid;
                grid-template-columns: 48px minmax(0, 1fr);
                gap: 16px;
                padding: 24px 24px 18px;
            }
            .app-dialog-icon {
                display: grid;
                width: 48px;
                height: 48px;
                place-items: center;
                border-radius: 14px;
                font-size: 1.25rem;
            }
            .app-dialog-icon.info { background: #e0f2fe; color: #0369a1; }
            .app-dialog-icon.success { background: #dcfce7; color: #15803d; }
            .app-dialog-icon.warning { background: #fef3c7; color: #b45309; }
            .app-dialog-icon.error { background: #fee2e2; color: #b91c1c; }
            .app-dialog-copy h2 {
                margin: 1px 0 7px;
                color: inherit;
                font: 750 1.08rem/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            .app-dialog-copy p {
                margin: 0;
                color: var(--muted, #64748b);
                font: 400 .92rem/1.58 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                overflow-wrap: anywhere;
                white-space: pre-wrap;
            }
            .app-dialog-input {
                width: 100%;
                margin-top: 14px;
                padding: 10px 12px;
                border: 1px solid var(--border, #cbd5e1);
                border-radius: 9px;
                background: var(--panel-2, #f8fafc);
                color: inherit;
                font: inherit;
                outline: none;
            }
            .app-dialog-input:focus {
                border-color: var(--primary, #2563eb);
                box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary, #2563eb) 18%, transparent);
            }
            .app-dialog-actions {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                padding: 14px 24px 20px;
            }
            .app-dialog-button {
                min-width: 96px;
                padding: 10px 16px;
                border: 1px solid transparent;
                border-radius: 10px;
                font: 700 .86rem/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                cursor: pointer;
                transition: transform .12s ease, filter .12s ease, background .12s ease;
            }
            .app-dialog-button:hover { filter: brightness(.96); }
            .app-dialog-button:active { transform: translateY(1px); }
            .app-dialog-button.secondary {
                border-color: var(--border, #cbd5e1);
                background: transparent;
                color: var(--text, #334155);
            }
            .app-dialog-button.primary {
                background: var(--primary, #2563eb);
                color: #fff;
            }
            .app-dialog-button.danger { background: #dc2626; color: #fff; }
            @media (prefers-color-scheme: dark) {
                .app-dialog-panel { background: var(--panel, #172033); color: var(--text, #f8fafc); }
                .app-dialog-copy p { color: var(--muted, #cbd5e1); }
            }
            @media (max-width: 520px) {
                .app-dialog-body { grid-template-columns: 40px minmax(0, 1fr); padding: 20px 18px 14px; }
                .app-dialog-icon { width: 40px; height: 40px; border-radius: 12px; }
                .app-dialog-actions { padding: 12px 18px 18px; }
                .app-dialog-button { flex: 1; min-width: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureElements() {
        if (elements) return elements;
        injectStyles();
        const overlay = document.createElement('div');
        overlay.className = 'app-dialog-overlay';
        overlay.setAttribute('role', 'presentation');
        overlay.innerHTML = `
            <section class="app-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message">
                <div class="app-dialog-body">
                    <div class="app-dialog-icon info" aria-hidden="true"><span>i</span></div>
                    <div class="app-dialog-copy">
                        <h2 id="app-dialog-title">Notice</h2>
                        <p id="app-dialog-message"></p>
                        <input id="app-dialog-input" class="app-dialog-input" type="text" hidden>
                    </div>
                </div>
                <div class="app-dialog-actions">
                    <button type="button" class="app-dialog-button secondary" data-dialog-action="cancel">Cancel</button>
                    <button type="button" class="app-dialog-button primary" data-dialog-action="confirm">OK</button>
                </div>
            </section>
        `;
        document.body.appendChild(overlay);
        elements = {
            overlay,
            panel: overlay.querySelector('.app-dialog-panel'),
            icon: overlay.querySelector('.app-dialog-icon'),
            iconGlyph: overlay.querySelector('.app-dialog-icon span'),
            title: overlay.querySelector('#app-dialog-title'),
            message: overlay.querySelector('#app-dialog-message'),
            input: overlay.querySelector('#app-dialog-input'),
            cancel: overlay.querySelector('[data-dialog-action="cancel"]'),
            confirm: overlay.querySelector('[data-dialog-action="confirm"]')
        };
        elements.cancel.addEventListener('click', () => settle(false));
        elements.confirm.addEventListener('click', () => settle(true));
        overlay.addEventListener('click', event => {
            if (event.target === overlay) settle(false);
        });
        document.addEventListener('keydown', event => {
            if (!activeRequest) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                settle(false);
            } else if (event.key === 'Enter' && document.activeElement !== elements.cancel) {
                event.preventDefault();
                settle(true);
            }
        });
        return elements;
    }

    function iconFor(type) {
        return {
            success: '✓',
            warning: '!',
            error: '×',
            info: 'i'
        }[type] || 'i';
    }

    function defaultTitle(type, kind) {
        if (kind === 'confirm') return type === 'warning' ? 'Please confirm' : 'Confirmation';
        if (kind === 'prompt') return 'Information required';
        return {
            success: 'Success',
            warning: 'Attention',
            error: 'Something went wrong',
            info: 'Notice'
        }[type] || 'Notice';
    }

    function showNext() {
        if (activeRequest || !queue.length) return;
        activeRequest = queue.shift();
        const ui = ensureElements();
        const options = activeRequest.options;
        const type = inferType(activeRequest.message, options.type);
        ui.icon.className = `app-dialog-icon ${type}`;
        ui.iconGlyph.textContent = iconFor(type);
        ui.title.textContent = options.title || defaultTitle(type, activeRequest.kind);
        ui.message.textContent = String(activeRequest.message ?? '');
        ui.cancel.hidden = activeRequest.kind === 'alert';
        ui.cancel.textContent = options.cancelText || 'Cancel';
        ui.confirm.textContent = options.confirmText || (activeRequest.kind === 'confirm' ? 'Continue' : 'OK');
        ui.confirm.className = `app-dialog-button ${options.danger ? 'danger' : 'primary'}`;
        ui.input.hidden = activeRequest.kind !== 'prompt';
        ui.input.value = activeRequest.kind === 'prompt' ? String(options.defaultValue || '') : '';
        ui.overlay.classList.add('show');
        window.setTimeout(() => {
            if (activeRequest?.kind === 'prompt') {
                ui.input.focus();
                ui.input.select();
            } else {
                ui.confirm.focus();
            }
        }, 30);
    }

    function settle(confirmed) {
        if (!activeRequest || !elements) return;
        const request = activeRequest;
        const value = request.kind === 'prompt'
            ? (confirmed ? elements.input.value : null)
            : request.kind === 'confirm' ? Boolean(confirmed) : true;
        elements.overlay.classList.remove('show');
        activeRequest = null;
        window.setTimeout(() => {
            request.resolve(value);
            showNext();
        }, 150);
    }

    function enqueue(kind, message, options = {}) {
        return new Promise(resolve => {
            queue.push({ kind, message, options, resolve });
            if (document.body) {
                showNext();
            } else {
                document.addEventListener('DOMContentLoaded', showNext, { once: true });
            }
        });
    }

    window.appAlert = (message, options) => enqueue('alert', message, options);
    window.appConfirm = (message, options) => enqueue('confirm', message, options);
    window.appPrompt = (message, defaultValue = '', options = {}) => enqueue('prompt', message, { ...options, defaultValue });
    window.appDialog = {
        alert: window.appAlert,
        confirm: window.appConfirm,
        prompt: window.appPrompt
    };

    // Keep existing notification calls working while replacing browser-native localhost dialogs.
    window.alert = function (message) {
        void window.appAlert(message);
    };
})();
