(function () {
    'use strict';

    let refreshQueued = false;

    function getColumnLabels(table) {
        return Array.from(table.querySelectorAll('thead th')).map((header, index, headers) => {
            const label = header.textContent.replace(/\s+/g, ' ').trim();
            return label || (index === headers.length - 1 ? 'Details' : `Column ${index + 1}`);
        });
    }

    function labelTable(table) {
        if (!(table instanceof HTMLTableElement) || table.dataset.mobileTable === 'scroll') return;
        const labels = getColumnLabels(table);
        if (!labels.length) return;

        table.classList.add('responsive-card-table');
        table.querySelectorAll('tbody tr').forEach((row) => {
            Array.from(row.cells).forEach((cell, index) => {
                if (cell.colSpan > 1 || cell.dataset.label) return;
                cell.dataset.label = labels[index] || `Column ${index + 1}`;
                if (/^actions?$/i.test(cell.dataset.label)) wrapActionCell(cell);
            });
        });
    }

    function wrapActionCell(cell) {
        if (cell.querySelector(':scope > .responsive-table-actions')) return;
        const strip = document.createElement('div');
        strip.className = 'responsive-table-actions';
        while (cell.firstChild) strip.appendChild(cell.firstChild);
        cell.appendChild(strip);
    }

    function refreshResponsiveTables(root = document) {
        if (root instanceof HTMLTableElement) labelTable(root);
        root.querySelectorAll?.('table').forEach(labelTable);
    }

    function queueRefresh() {
        if (refreshQueued) return;
        refreshQueued = true;
        window.requestAnimationFrame(() => {
            refreshQueued = false;
            refreshResponsiveTables();
        });
    }

    function initialize() {
        refreshResponsiveTables();
        new MutationObserver(queueRefresh).observe(document.body, { childList: true, subtree: true });
    }

    window.NAAPResponsiveTables = { refresh: refreshResponsiveTables };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
})();
