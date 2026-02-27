// =====================================================
// Shared constants (mirrors DB tables / seed data)
// Previously defined in local-storage-service.js
// =====================================================
const INSTITUTE_PROGRAMS = {
    'Institute of Computer Studies':       ['BSAIT', 'BSAIS'],
    'Institute of Engineering Technology': ['BSAET', 'BSAT', 'BSAMT', 'BSAeE', 'BAT-AET'],
    'Institute of Liberal Arts and Sciences': ['AvComm', 'AvLog', 'AvSSm', 'AvTour']
};

const PROGRAM_INSTITUTE_MAP = Object.entries(INSTITUTE_PROGRAMS).reduce((map, [inst, programs]) => {
    programs.forEach(p => { map[p.toUpperCase()] = inst; });
    return map;
}, {});

const INSTITUTE_ORGS = {
    'Institute of Computer Studies':       ['AISERS'],
    'Institute of Engineering Technology': ['ELITECH', 'AERO-ATSO', 'AETSO', 'AMTSO'],
    'Institute of Liberal Arts and Sciences': ['ILASSO']
};

const COLLEGE_WIDE_ORGS = ['Supreme Student Council', 'RCYC', 'CYC', "Scholar's Guild", 'Aeronautica'];

const ORG_ROLES = ['officer', 'auditor', 'member'];

/**
 * AccountsPhpApiService
 * Drop-in async replacement for AccountsLocalStorageService.
 * All data is persisted in MySQL via PHP REST endpoints.
 *
 * Loaded by systems/Accounts/index.html and student-numbers.html
 * Base API path: ../../api/accounts   (relative to systems/Accounts/)
 */
(function () {
    'use strict';

    const BASE = '../../api/accounts';

    /* ── helpers ─────────────────────────────────────────────────────── */

    async function get(path) {
        const res = await fetch(BASE + path, { credentials: 'include' });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Server error');
        return json;
    }

    async function post(path, body) {
        const res = await fetch(BASE + path, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Server error');
        return json;
    }

    /* ── AccountsPhpApiService ───────────────────────────────────────── */

    class AccountsPhpApiService {

        // ── STUDENT NUMBERS ──────────────────────────────────────────

        async getStudentNumbers() {
            try {
                const data = await get('/student-numbers/list.php');
                return data.items || [];
            } catch (e) {
                console.error('getStudentNumbers:', e);
                return [];
            }
        }

        async addStudentNumber(studentData) {
            const payload = {
                studentId:   studentData.studentId,
                studentName: studentData.studentName,
                programCode: studentData.programCode || studentData.course || '',
                institute:   studentData.institute   || '',
                yearSection: studentData.yearSection || '',
                email:       studentData.email       || '',
                phone:       studentData.phone       || '',
                hasUnpaidDebt: studentData.hasUnpaidDebt || false,
                isActive:      studentData.isActive !== undefined ? studentData.isActive : true,
                origStudentId: ''   // empty = INSERT
            };
            const data = await post('/student-numbers/save.php', payload);
            return data.sn_id || null;
        }

        async updateStudentNumber(studentId, studentData) {
            await post('/student-numbers/save.php', {
                origStudentId: studentId,
                studentId:   studentData.studentId   || studentId,
                studentName: studentData.studentName,
                programCode: studentData.programCode || studentData.course || '',
                institute:   studentData.institute   || '',
                yearSection: studentData.yearSection || '',
                email:       studentData.email       || '',
                phone:       studentData.phone       || '',
                hasUnpaidDebt: studentData.hasUnpaidDebt !== undefined ? studentData.hasUnpaidDebt : false,
                isActive:      studentData.isActive      !== undefined ? studentData.isActive      : true,
            });
            return true;
        }

        async deleteStudentNumber(studentId) {
            await post('/student-numbers/delete.php', { studentId });
            return true;
        }

        async findStudentNumber(studentId) {
            const list = await this.getStudentNumbers();
            return list.find(s => s.studentId === studentId) || null;
        }

        // ── PENDING REQUESTS ─────────────────────────────────────────

        async getPendingRequests() {
            try {
                const data = await get('/requests/list.php');
                return data.items || [];
            } catch (e) {
                console.error('getPendingRequests:', e);
                return [];
            }
        }

        /**
         * addPendingRequest – used when a student self-registers.
         * Maps to the public submit.php endpoint.
         */
        async addPendingRequest(requestData) {
            const payload = {
                studentId:    requestData.studentId,
                name:         requestData.name || requestData.studentName || '',
                email:        requestData.email || '',
                password:     requestData.password || '',
                course:       requestData.course || requestData.programCode || '',
                yearSection:  requestData.yearSection || requestData.section || '',
                requestedRole: requestData.requestedRole || 'student',
                requestedOrg:  requestData.requestedOrg || ''
            };
            const data = await post('/requests/submit.php', payload);
            return data.reg_id || null;
        }

        /**
         * updatePendingRequest – used by admin to approve/reject/reopen.
         * Infers action from updateData.status.
         */
        async updatePendingRequest(requestId, updateData) {
            const actionMap = { approved: 'approve', rejected: 'reject', pending: 'reopen' };
            const action = actionMap[updateData.status];
            if (!action) throw new Error('Unknown request status: ' + updateData.status);
            await post('/requests/action.php', {
                requestId,
                action,
                reviewerNotes: updateData.reviewerNotes || ''
            });
            return true;
        }

        async deletePendingRequest(requestId) {
            // No hard-delete exposed; mark as rejected instead
            await post('/requests/action.php', { requestId, action: 'reject', reviewerNotes: 'Deleted by admin' });
            return true;
        }

        // ── STUDENT ACCOUNTS ─────────────────────────────────────────

        async getStudentAccounts() {
            try {
                const data = await get('/students/list.php');
                return data.items || [];
            } catch (e) {
                console.error('getStudentAccounts:', e);
                return [];
            }
        }

        async addStudentAccount(accountData) {
            const payload = {
                studentId:   accountData.studentId,
                studentName: accountData.studentName,
                programCode: accountData.programCode || accountData.course || '',
                institute:   accountData.institute   || '',
                yearSection: accountData.yearSection || '',
                email:       accountData.email       || '',
                phone:       accountData.phone       || '',
                hasUnpaidDebt: accountData.hasUnpaidDebt || false,
                isActive:      accountData.isActive !== undefined ? accountData.isActive : true,
                userId:        0,  // 0 = INSERT
                origStudentId: ''
            };
            const data = await post('/students/save.php', payload);
            return data.user_id || null;
        }

        async updateStudentAccount(internalId, accountData) {
            // internalId = user_id (integer) when fetched from DB
            await post('/students/save.php', {
                userId:      internalId,
                origStudentId: '',
                studentId:   accountData.studentId,
                studentName: accountData.studentName,
                programCode: accountData.programCode || accountData.course || '',
                institute:   accountData.institute   || '',
                yearSection: accountData.yearSection || '',
                email:       accountData.email       || '',
                phone:       accountData.phone       || '',
                hasUnpaidDebt: accountData.hasUnpaidDebt !== undefined ? accountData.hasUnpaidDebt : false,
                isActive:      accountData.isActive      !== undefined ? accountData.isActive      : true,
            });
            return true;
        }

        async deleteStudentAccount(internalId) {
            // internalId = user_id when fetched from DB
            await post('/students/delete.php', { userId: internalId });
            return true;
        }

        async findStudentAccount(studentId) {
            const list = await this.getStudentAccounts();
            return list.find(a => a.studentId === studentId) || null;
        }

        // ── OFFICERS ─────────────────────────────────────────────────

        async getOfficers() {
            try {
                const data = await get('/officers/list.php');
                return data.items || [];
            } catch (e) {
                console.error('getOfficers:', e);
                return [];
            }
        }

        async addOfficer(officerData) {
            const payload = {
                id:          0,   // 0 = INSERT
                studentId:   officerData.studentId,
                orgCode:     officerData.orgCode,
                roleName:    officerData.roleName || 'Officer',
                joinedAt:    officerData.joinedAt || new Date().toISOString().slice(0, 10),
                isActive:    officerData.isActive !== undefined ? officerData.isActive : true
            };
            const data = await post('/officers/save.php', payload);
            return data.membership_id || null;
        }

        async updateOfficer(officerId, officerData) {
            await post('/officers/save.php', {
                id:        officerId,  // membership_id
                studentId: officerData.studentId,
                orgCode:   officerData.orgCode,
                roleName:  officerData.roleName || 'Officer',
                joinedAt:  officerData.joinedAt || new Date().toISOString().slice(0, 10),
                isActive:  officerData.isActive !== undefined ? officerData.isActive : true
            });
            return true;
        }

        async deleteOfficer(officerId) {
            await post('/officers/delete.php', { id: officerId });
            return true;
        }

        async findOfficersByStudent(studentId) {
            const list = await this.getOfficers();
            return list.filter(o => o.studentId === studentId);
        }

        // ── BULK IMPORT ──────────────────────────────────────────────

        async bulkImportStudentNumbers(records) {
            return await post('/student-numbers/import.php', { records });
        }

        // ── STATS ────────────────────────────────────────────────────

        async getCollectionStats() {
            try {
                const [sn, pr, sa, of_] = await Promise.all([
                    this.getStudentNumbers(),
                    this.getPendingRequests(),
                    this.getStudentAccounts(),
                    this.getOfficers()
                ]);
                return {
                    studentNumbers:  sn.length,
                    pendingRequests: pr.length,
                    studentAccounts: sa.length,
                    officers:        of_.length,
                    pendingCount:  pr.filter(r => r.status === 'pending').length,
                    approvedCount: pr.filter(r => r.status === 'approved').length,
                    rejectedCount: pr.filter(r => r.status === 'rejected').length
                };
            } catch (e) { return null; }
        }
    }

    /* ── Initialize & expose globally ───────────────────────────────── */
    const svc = new AccountsPhpApiService();
    window.accountsLocalStorageService = svc;   // drop-in replacement name
    window.accountsPhpApiService       = svc;   // also available under its own name
    console.log('Accounts PHP API Service initialized');
})();
