(function () {
    'use strict';

    const scriptUrl = document.currentScript?.src || new URL('../assets/js/organizationFavicon.js', window.location.href).href;
    const faviconDirectory = new URL('../favicons/organizations/', scriptUrl);
    const assetVersion = '20260827-1';

    function normalizeOrganization(value) {
        return String(value || '')
            .normalize('NFKD')
            .replace(/[’‘`]/g, "'")
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, ' ')
            .trim();
    }

    const faviconByOrganization = new Map();

    function register(fileName, aliases) {
        aliases.forEach((alias) => {
            faviconByOrganization.set(normalizeOrganization(alias), fileName);
        });
    }

    register('ssc.png', ['SSC', 'Supreme Student Council']);
    register('aisers.png', ['AISERS', 'Alliance in Information System Empowered Responsive Students']);
    register('elitech.png', ['ELITECH', 'Elite Technologist Society', 'ELITECH Organization']);
    register('ilasso.png', ['ILASSO', 'Institute of Liberal Arts and Sciences Student Organization']);
    register('aero-atso.png', ['AERO-ATSO', 'AEROATSO', 'Aeronautical Engineering Organization']);
    register('aetso.png', ['AET', 'AETSO', 'Aviation Electronics Technology Student Organization']);
    register('amtso.png', ['AMT', 'AMTSO', 'Aircraft Maintenance Technology Student Organization']);
    register('rcyc.png', ['RCYC', 'Red Cross Youth Council']);
    register('cyc.png', ['CYC', 'College Youth Club']);
    register('scholars.png', ['PSG', 'SCHOLARS', "Scholar's Guild", 'Scholars Guild']);
    register('aeronautica.png', ['AERONAUTICA', 'Aeronautica']);

    function resolveFileName(values) {
        for (const value of values) {
            const fileName = faviconByOrganization.get(normalizeOrganization(value));
            if (fileName) return fileName;
        }
        return '';
    }

    function apply(options = {}) {
        const fileName = resolveFileName([
            options.code,
            options.name,
            options.organization
        ]);
        if (!fileName) return false;

        let link = document.querySelector('link[rel~="icon"]');
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }

        link.type = 'image/png';
        link.sizes = '256x256';
        link.href = `${new URL(fileName, faviconDirectory).href}?v=${assetVersion}`;
        return true;
    }

    window.OrganizationFavicon = Object.freeze({ apply });
})();
