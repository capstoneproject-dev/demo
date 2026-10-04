// Mock previews are available only when browsing a local development server.
(function () {
    'use strict';

    const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
    const isLocalDevelopment = localHosts.has(window.location.hostname.toLowerCase());
    window.AppEnvironment = Object.freeze({ isLocalDevelopment });

    if (isLocalDevelopment) {
        document.documentElement.classList.add('local-development');
    }
})();
