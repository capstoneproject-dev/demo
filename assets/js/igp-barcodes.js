(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);

    async function refresh() {
        const { items } = await window.igpApi.getInventory({});
        const root = $('barcode_cards');
        root.innerHTML = '';
        items.forEach((it) => {
            const card = document.createElement('div');
            card.className = 'card p-3';
            card.innerHTML = `
                <div class="fw-bold mb-1">${it.item_name}</div>
                <div class="small text-muted mb-2">${it.barcode}</div>
                <svg id="bc_${it.item_id}"></svg>
            `;
            root.appendChild(card);
            if (window.JsBarcode) {
                window.JsBarcode(`#bc_${it.item_id}`, it.barcode, { width: 2, height: 50, displayValue: true });
            }
        });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        try {
            await refresh();
        } catch (err) {
            $('bc_msg').textContent = err.message;
        }
    });
})();
