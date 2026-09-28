(function () {
    'use strict';
    const headers = ['employeeNumber', 'firstName', 'lastName', 'email', 'phone', 'isActive', 'orgCode', 'orgName', 'joinedAt', 'membershipActive'];
    let rows = [];
    let exportRows = [];
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
        exportRows = result.exportItems || rows;
        render();
        return rows;
    }

    async function appendSheet(workbook) {
        await load();
        const exported = exportRows.map(row => Object.fromEntries(headers.map(key => [key,
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

    function describe(records, targetId, omissions) {
        const target = document.getElementById(targetId);
        const message = document.createElement('p');
        const accountCount = omissions?.accounts?.length || 0;
        const membershipCount = omissions?.memberships?.length || 0;
        message.className = accountCount || membershipCount ? 'alert alert-warning mt-3' : 'mt-3';
        message.textContent = 'Advisers: ' + records.length + ' account/organization rows will be matched by employee number and organization. Existing accounts are updated; new accounts can set their password through Forgot password. ' + accountCount + ' active adviser account(s) absent from this sheet and ' + membershipCount + ' active organization membership(s) will be deactivated. Inactive records are not counted as changes and remain in the database for history.';
        target?.appendChild(message);
    }

    function hasSheet(workbook) {
        return workbook.SheetNames.some(name => name.trim().toLowerCase() === 'advisers');
    }

    function deactivationSections(result) {
        const changes = result.changes || {};
        const omissions = result.adviserOmissions || {};
        const students = (changes.deactivated || []).map(row =>
            text(row.studentId) + ' — ' + text(row.studentName));
        const officers = (changes.officersAffected || []).map(row =>
            text(row.studentId) + ' — ' + text(row.studentName) + (row.officerRoles ? ' — ' + text(row.officerRoles) : ''));
        const advisersByEmployee = new Map();
        for (const row of omissions.accounts || []) {
            advisersByEmployee.set(text(row.employeeNumber).toLowerCase(), {
                employeeNumber: text(row.employeeNumber), name: text(row.name), account: true, orgs: []
            });
        }
        for (const row of omissions.memberships || []) {
            const key = text(row.employeeNumber).toLowerCase();
            if (!advisersByEmployee.has(key)) advisersByEmployee.set(key, {
                employeeNumber: text(row.employeeNumber), name: text(row.name), account: false, orgs: []
            });
            advisersByEmployee.get(key).orgs.push(text(row.orgCode));
        }
        const advisers = [...advisersByEmployee.values()].map(row =>
            row.employeeNumber + ' — ' + row.name + ' — ' +
            (row.account ? 'Account deactivated' : 'Organization membership deactivated') +
            (row.orgs.length ? ' (' + row.orgs.join(', ') + ')' : ''));
        return {Students: students, Officers: officers, Advisers: advisers};
    }

    function deactivationBreakdown(result) {
        const sections = deactivationSections(result);
        return {students: sections.Students.length, officers: sections.Officers.length, advisers: sections.Advisers.length};
    }

    function deactivationCount(result) {
        const counts = deactivationBreakdown(result);
        return counts.students + counts.officers + counts.advisers;
    }

    function categoryCell(entry, index, tone) {
        const tint = entry[1] > 0 && tone ? 'background:rgba(' + (tone === 'red' ? '220,53,69' : '25,135,84') + ',.12);' : '';
        return '<div class="flex-fill' + (index ? ' border-start' : '') + '" style="font-size:.72rem;' + tint + '"><strong>' +
            entry[1] + '</strong><br>' + entry[0] + '</div>';
    }

    function deactivationCard(result) {
        const counts = deactivationBreakdown(result);
        const total = counts.students + counts.officers + counts.advisers;
        return '<div class="col-6"><div class="border rounded p-2 text-center h-100">' +
            '<div class="fs-4 fw-bold text-danger">' + total + '</div><div class="text-muted">Deactivate</div>' +
            '<div class="d-flex border-top mt-2 pt-2">' +
            [['Students', counts.students], ['Officers', counts.officers], ['Advisers', counts.advisers]].map((entry, index) =>
                categoryCell(entry, index, 'red')).join('') + '</div></div></div>';
    }

    function changeCard(result, key, label, color) {
        const students = (result.summary || {})[key] || 0;
        const officers = ((result.officerChanges || {})[key] || []).length;
        const advisers = ((result.adviserChanges || {})[key] || []).length;
        return '<div class="col-6"><div class="border rounded p-2 text-center h-100">' +
            '<div class="fs-4 fw-bold ' + color + '">' + (students + officers + advisers) + '</div>' +
            '<div class="text-muted">' + label + '</div>' +
            '<div class="d-flex border-top mt-2 pt-2">' +
            [['Students', students], ['Officers', officers], ['Advisers', advisers]].map((entry, index) =>
                categoryCell(entry, index, key === 'unchanged' ? null : 'green')).join('') +
            '</div></div></div>';
    }

    function appendChangeDetails(result, targetId) {
        const target = document.getElementById(targetId);
        if (!target) return;
        const officerChanges = result.officerChanges || {};
        for (const [key, title] of [['new', 'New officers'], ['updated', 'Updated officers'], ['reactivated', 'Reactivated officers']]) {
            const rows = officerChanges[key] || [];
            if (!rows.length) continue;
            const section = document.createElement('div');
            section.className = 'mt-2';
            const heading = document.createElement('strong');
            heading.textContent = title + ' (' + rows.length + ')';
            section.appendChild(heading);
            const list = document.createElement('ul');
            list.className = 'mb-0';
            for (const row of rows) {
                const item = document.createElement('li');
                item.textContent = text(row.studentId) + ' — ' + text(row.name) + ' — ' +
                    text(row.orgCode) + ' (' + text(row.roleName) + ')';
                list.appendChild(item);
            }
            section.appendChild(list);
            target.appendChild(section);
        }
        const changes = result.adviserChanges || {};
        for (const [key, title] of [['new', 'New advisers'], ['updated', 'Updated advisers'], ['reactivated', 'Reactivated advisers']]) {
            const rows = changes[key] || [];
            if (!rows.length) continue;
            const section = document.createElement('div');
            section.className = 'mt-2';
            const heading = document.createElement('strong');
            heading.textContent = title + ' (' + rows.length + ')';
            section.appendChild(heading);
            const list = document.createElement('ul');
            list.className = 'mb-0';
            for (const row of rows) {
                const item = document.createElement('li');
                item.textContent = text(row.employeeNumber) + ' — ' + text(row.name) +
                    (row.orgCodes?.length ? ' — ' + row.orgCodes.join(', ') : '');
                list.appendChild(item);
            }
            section.appendChild(list);
            target.appendChild(section);
        }
    }

    function appendDeactivationDetails(result, targetId) {
        const target = document.getElementById(targetId);
        if (!target) return;
        const sections = deactivationSections(result);
        const total = deactivationCount(result);
        if (!total) return;
        const limit = total >= 11 ? 10 : Infinity;
        const container = document.createElement('div');
        container.className = 'mt-3';
        for (const [title, lines] of Object.entries(sections)) {
            if (!lines.length) continue;
            const heading = document.createElement('strong');
            heading.textContent = title + ' affected (' + lines.length + ')';
            container.appendChild(heading);
            const list = document.createElement('ul');
            list.className = 'mb-2';
            for (const line of lines.slice(0, limit)) {
                const item = document.createElement('li');
                item.textContent = line;
                list.appendChild(item);
            }
            container.appendChild(list);
        }
        if (total >= 11) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn btn-outline-secondary btn-sm mt-2';
            button.textContent = 'Show full list (.txt)';
            button.addEventListener('click', () => {
                const content = Object.entries(sections).map(([title, lines]) =>
                    title + ' (' + lines.length + ')\r\n' + (lines.length ? lines.join('\r\n') : 'None')).join('\r\n\r\n');
                const url = URL.createObjectURL(new Blob(['\uFEFF' + content + '\r\n'], {type: 'text/plain;charset=utf-8'}));
                const link = document.createElement('a');
                link.href = url;
                link.download = 'roster_deactivation_list_' + new Date().toISOString().slice(0, 10) + '.txt';
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 60000);
            });
            container.appendChild(button);
        }
        target.appendChild(container);
    }

    function isAdviserOnly(workbook) {
        if (!hasSheet(workbook)) return false;
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

    window.AdviserWorkbook = {load, appendSheet, parse, describe, hasSheet, isAdviserOnly, stamp, validateType, changeCard, appendChangeDetails, deactivationBreakdown, deactivationCount, deactivationCard, appendDeactivationDetails};
})();
