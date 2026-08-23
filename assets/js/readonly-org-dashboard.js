(function () {
    'use strict';

    function readSession() {
        try {
            return JSON.parse(localStorage.getItem('naapAuthSession') || '{}') || {};
        } catch (_) {
            return {};
        }
    }

    function isReadOnly() {
        if (document.body && document.body.dataset.orgReadOnly === '1') return true;
        var session = readSession();
        return session.account_type === 'organization_adviser' || session.is_read_only === true;
    }

    var mutationPattern = /(add|create|edit|delete|save|submit|approve|reject|archive|restore|upload|publish|send|assign|release|mark.?paid|accept|reorder|update.?status|mock|generate.?insight|export|download|scan|check.?in|check.?out|rent|return)/i;
    var safePattern = /(close|cancel|refresh|reload|view|filter|search|navigate|theme|logout|toggle|apply.*filter|clear.*filter|reset.*filter)/i;

    function isPersonalSetting(element) {
        var identity = [element.id, element.name, element.getAttribute('onclick')]
            .filter(Boolean).join(' ');
        return /officerProfile|profile-photo|profile.update|update-password|password/i.test(identity);
    }

    function shouldHide(element) {
        if (element.closest('[data-readonly-allow]') || isPersonalSetting(element)) return false;
        var identity = [
            element.id,
            element.name,
            element.className,
            element.getAttribute('onclick'),
            element.getAttribute('action'),
            element.getAttribute('href'),
            element.textContent
        ].filter(function (value) { return typeof value === 'string'; }).join(' ');
        if (safePattern.test(identity) && !mutationPattern.test(identity)) return false;
        if (/api\/(documents\/download|printing\/file)\.php/i.test(identity)) return true;
        if (element.matches('button[type="submit"], input[type="submit"]')) return true;
        return mutationPattern.test(identity);
    }

    function apply(root) {
        var scope = root && root.querySelectorAll ? root : document;
        scope.querySelectorAll('button, a, input[type="button"], input[type="submit"]').forEach(function (element) {
            if (!shouldHide(element)) return;
            element.hidden = true;
            element.setAttribute('aria-hidden', 'true');
            element.setAttribute('data-readonly-hidden', '1');
        });
    }

    function addBanner() {
        if (document.getElementById('organizationAdviserReadOnlyBanner')) return;
        var banner = document.createElement('div');
        banner.id = 'organizationAdviserReadOnlyBanner';
        banner.className = 'organization-adviser-readonly-banner';
        banner.setAttribute('role', 'status');
        banner.innerHTML = '<i class="fa-solid fa-eye" aria-hidden="true"></i> Organization Adviser — View-only access';
        document.body.insertBefore(banner, document.body.firstChild);
    }

    function addStyles() {
        if (document.getElementById('organizationAdviserReadOnlyStyles')) return;
        var style = document.createElement('style');
        style.id = 'organizationAdviserReadOnlyStyles';
        style.textContent = '.organization-adviser-readonly-banner{position:sticky;top:0;z-index:10050;padding:9px 16px;text-align:center;background:#fff7d6;color:#714f00;border-bottom:1px solid #eed27a;font:600 14px/1.4 system-ui,sans-serif}.organization-adviser-readonly-banner i{margin-right:7px}[data-readonly-hidden="1"]{display:none!important}';
        document.head.appendChild(style);
    }

    function initialize() {
        if (!isReadOnly()) return;
        document.body.classList.add('org-read-only');
        addStyles();
        addBanner();
        apply(document);
        new MutationObserver(function (records) {
            records.forEach(function (record) {
                record.addedNodes.forEach(function (node) {
                    if (node.nodeType === 1) {
                        if (node.matches && node.matches('button, a, input[type="button"], input[type="submit"]') && shouldHide(node)) {
                            node.hidden = true;
                            node.setAttribute('data-readonly-hidden', '1');
                        }
                        apply(node);
                    }
                });
            });
        }).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
    else initialize();
}());
