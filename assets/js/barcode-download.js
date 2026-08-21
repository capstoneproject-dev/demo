(function () {
    'use strict';

    function safeFilePart(value, fallback) {
        const cleaned = String(value || '')
            .trim()
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
            .replace(/\s+/g, '_')
            .replace(/[. ]+$/g, '');
        return cleaned || fallback;
    }

    function saveBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    async function renderBarcodePng(value) {
        if (typeof window.JsBarcode !== 'function') {
            throw new Error('The barcode generator is unavailable. Please reload the page.');
        }

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        window.JsBarcode(svg, String(value || ''), {
            format: 'CODE128',
            width: 2,
            height: 70,
            displayValue: true,
            fontSize: 14,
            margin: 0,
            marginTop: 4,
            marginRight: 20,
            marginBottom: 4,
            marginLeft: 20,
            lineColor: '#000000',
            background: '#ffffff'
        });

        const svgMarkup = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const image = new Image();

        try {
            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = () => reject(new Error('The barcode image could not be created.'));
                image.src = svgUrl;
            });

            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(image.naturalWidth || image.width);
            canvas.height = Math.ceil(image.naturalHeight || image.height);
            const context = canvas.getContext('2d');
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0);

            return await new Promise((resolve, reject) => {
                canvas.toBlob(blob => {
                    if (blob) resolve(blob);
                    else reject(new Error('The barcode PNG could not be created.'));
                }, 'image/png');
            });
        } finally {
            URL.revokeObjectURL(svgUrl);
        }
    }

    function getBarcodeFileName(record) {
        const type = safeFilePart(record.type, 'Barcode');
        const id = safeFilePart(record.id, 'Unknown');
        const name = safeFilePart(record.name, 'Record');
        return `${type}_Barcode_${id}_${name}.png`;
    }

    async function downloadOne(record) {
        const blob = await renderBarcodePng(record.value);
        saveBlob(blob, getBarcodeFileName(record));
    }

    async function downloadBulk(records, zipName) {
        if (typeof window.JSZip !== 'function') {
            throw new Error('The ZIP downloader is unavailable. Please reload the page.');
        }
        if (!Array.isArray(records) || records.length === 0) {
            throw new Error('There are no displayed barcodes to download.');
        }

        const zip = new window.JSZip();
        for (const record of records) {
            const blob = await renderBarcodePng(record.value);
            zip.file(getBarcodeFileName(record), blob);
        }

        const content = await zip.generateAsync({ type: 'blob' });
        saveBlob(content, `${safeFilePart(zipName, 'Barcodes')}.zip`);
    }

    window.barcodeDownload = {
        downloadOne,
        downloadBulk
    };
})();
