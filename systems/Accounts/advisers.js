(function () {
    'use strict';
    const headers = ['employeeNumber', 'firstName', 'lastName', 'email', 'phone', 'isActive', 'orgCode', 'orgName', 'joinedAt', 'membershipActive'];
    let rows = [];
    const text = value => String(value == null ? '' : value);
    const escape = value => text(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
    const active = value => ['1', 'true', 'yes', 'active'].includes(text(value).toLowerCase());

    function render() {
        const target = document.getElementById('adviserRecords');
        if (!target) return;
        const query = text(document.getElementById('adviserSearch')?.value).toLowerCase();
        const filtered = rows.filter(row => headers.some(key => text(row[key]).toLowerCase().includes(query)));
        target.innerHTML = filtered.map(row => '<tr>' + [row.employeeNumber, row.firstName + ' ' + row.lastName,
            row.email, row.phone, row.orgName || row.orgCode || 'Unassigned', row.joinedAt,
            active(row.isActive) ? 'Active' : 'Inactive', row.orgCode ? (active(row.membershipActive) ? 'Active' : 'Inactive') : '—']
            .map(value => '<td>' + escape(value) + '</td>').join('') + '</tr>').join('') || '<tr><td colspan="8" class="text-center text-muted">No advisers found</td></tr>';
        const badge = document.getElementById('advisersTotalBadge');
        if (badge) badge.textContent = new Set(rows.map(row => row.employeeNumber)).size;
    }

    async function load() {
        const response = await fetch('../../api/accounts/advisers/list.php', {credentials: 'include', cache: 'no-store'});
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'Could not load advisers.');
        rows = result.items || [];
        render();
        return rows;
    }

    async function appendSheet(workbook) {
        const data = await load();
        const exported = data.map(row => Object.fromEntries(headers.map(key => [key,
            ['isActive', 'membershipActive'].includes(key) ? (active(row[key]) ? 'true' : 'false') : text(row[key])])));
        const sheet = XLSX.utils.json_to_sheet(exported, {header: headers});
        Object.keys(sheet).filter(key => !key.startsWith('!')).forEach(key => {
            sheet[key].v = text(sheet[key].v); sheet[key].t = 's'; sheet[key].z = '@'; delete sheet[key].w;
        });
        sheet['!cols'] = headers.map(key => ({wch: key === 'email' || key === 'orgName' ? 32 : 20}));
        XLSX.utils.book_append_sheet(workbook, sheet, 'Advisers');
    }

    function parse(workbook) {
        const name = workbook.SheetNames.find(name => name.trim().toLowerCase() === 'advisers');
        if (!name) return [];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[name], {header: 1, defval: '', blankrows: false});
        if (data.length < 2) return [];
        const keys = data[0].map(value => text(value).toLowerCase().replace(/[\s_-]/g, ''));
        for (const key of ['employeeNumber', 'firstName', 'lastName', 'email']) {
            if (!keys.includes(key.toLowerCase())) throw new Error('Advisers sheet is missing ' + key + '.');
        }
        return data.slice(1).filter(row => row.some(value => text(value).trim())).map(row => Object.fromEntries(headers.map(key => {
            const index = keys.indexOf(key.toLowerCase());
            return [key, index < 0 ? (['isActive', 'membershipActive'].includes(key) ? 'true' : '') : text(row[index]).trim()];
        })));
    }

    function describe(records, targetId) {
        if (!records.length) return;
        const target = document.getElementById(targetId);
        const message = document.createElement('p');
        message.className = 'mt-3';
        message.textContent = 'Advisers: ' + records.length + ' account/organization rows will be matched by employee number and organization. Existing accounts are updated; new accounts can set their password through Forgot password. Advisers absent from this sheet are retained.';
        target?.appendChild(message);
    }

    function isAdviserOnly(workbook) {
        if (!workbook.SheetNames.some(name => name.trim().toLowerCase() === 'advisers')) return false;
        const name = workbook.SheetNames.find(name => ['students', 'student numbers'].includes(name.trim().toLowerCase()));
        return !name || XLSX.utils.sheet_to_json(workbook.Sheets[name], {blankrows: false}).length === 0;
    }

    document.addEventListener('DOMContentLoaded', () => {
        for (const id of ['advisers-tab', 'users-advisers-tab']) {
            document.getElementById(id)?.addEventListener('shown.bs.tab', () => load().catch(error => window.appAlert(error.message)));
        }
        document.getElementById('adviserSearch')?.addEventListener('input', render);
        document.getElementById('refreshData')?.addEventListener('click', () => load().catch(error => window.appAlert(error.message)));
        load().catch(error => {
            const target = document.getElementById('adviserRecords');
            if (target) target.innerHTML = '<tr><td colspan="8">' + escape(error.message) + '</td></tr>';
        });
    });
    function stamp(workbook, kind) {
        const sheet = XLSX.utils.aoa_to_sheet([['application', 'exportType', 'version'], ['CAPSTONE', kind, '1']]);
        XLSX.utils.book_append_sheet(workbook, sheet, '_ExportInfo');
        XLSX.utils.book_set_sheet_visibility(workbook, '_ExportInfo', 1);
    }

    function validateType(workbook, expected) {
        const info = workbook.Sheets._ExportInfo;
        const row = info ? XLSX.utils.sheet_to_json(info, {header: 1})[1] : null;
        const page = expected === 'active_users' ? 'Account Management' : 'Users';
        if (!row || row[0] !== 'CAPSTONE' || String(row[2]) !== '1') {
            throw new Error('This file has no supported export identifier. Download a new XLSX export from the ' + page + ' page and use that file.');
        }
        if (row[1] !== expected) {
            throw new Error('Wrong file type. The ' + page + ' page only accepts ' + expected + ' exports. Import this file on its original page.');
        }
    }

    window.AdviserWorkbook = {load, appendSheet, parse, describe, isAdviserOnly, stamp, validateType};
})();
