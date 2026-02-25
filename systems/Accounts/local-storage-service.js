// localStorage Service for Accounts System
// This service handles all localStorage operations for the Accounts system

// =====================================================
// Institute → Program mapping (mirrors academic_programs + program_org_mappings in DB)
// =====================================================
const INSTITUTE_PROGRAMS = {
    'Institute of Computer Studies': ['BSAIT', 'BSAIS'],
    'Institute of Engineering Technology': ['BSAET', 'BSAT', 'BSAMT', 'BSAeE', 'BAT-AET'],
    'Institute of Liberal Arts and Sciences': ['AvComm', 'AvLog', 'AvSSm', 'AvTour']
};

// Program code → institute name lookup
const PROGRAM_INSTITUTE_MAP = Object.entries(INSTITUTE_PROGRAMS).reduce((map, [inst, programs]) => {
    programs.forEach(p => { map[p.toUpperCase()] = inst; });
    return map;
}, {});

// Institute → Organizations mapping (mirrors program_org_mappings + organizations in DB)
const INSTITUTE_ORGS = {
    'Institute of Computer Studies': ['AISERS'],
    'Institute of Engineering Technology': ['ELITECH', 'AERO-ATSO', 'AETSO', 'AMTSO'],
    'Institute of Liberal Arts and Sciences': ['ILASSO']
};

// College-wide organizations (not tied to a single institute)
const COLLEGE_WIDE_ORGS = ['Supreme Student Council', 'RCYC', 'CYC', "Scholar's Guild", 'Aeronautica'];

// All org roles (mirrors org_roles in DB)
const ORG_ROLES = ['officer', 'auditor', 'member'];

class AccountsLocalStorageService {
    constructor() {
        this.parentCollection = 'AccountsSystem';
        this.studentNumbersKey  = `${this.parentCollection}_studentNumbers`;
        this.pendingRequestsKey = `${this.parentCollection}_pendingRequests`;
        this.studentAccountsKey = `${this.parentCollection}_studentAccounts`;
        this.officersKey        = `${this.parentCollection}_officers`;

        // Initialize storage if needed
        this.initializeStorage();
    }

    // Initialize storage with default values if empty
    initializeStorage() {
        if (!localStorage.getItem(this.studentNumbersKey)) {
            localStorage.setItem(this.studentNumbersKey, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.pendingRequestsKey)) {
            localStorage.setItem(this.pendingRequestsKey, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.studentAccountsKey)) {
            localStorage.setItem(this.studentAccountsKey, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.officersKey)) {
            localStorage.setItem(this.officersKey, JSON.stringify([]));
        }
    }

    // Helper to generate unique IDs
    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Helper to convert dates to ISO strings for consistency
    toISOString(date) {
        if (!date) return new Date().toISOString();
        if (date instanceof Date) return date.toISOString();
        if (typeof date === 'string') return date;
        return new Date().toISOString();
    }

    // ===== STUDENT NUMBERS DATABASE OPERATIONS =====
    
    async getStudentNumbers() {
        try {
            const data = localStorage.getItem(this.studentNumbersKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error getting student numbers:', error);
            return [];
        }
    }

    async addStudentNumber(studentData) {
        try {
            const students = await this.getStudentNumbers();
            const programCode = studentData.programCode || studentData.course || '';
            const institute = studentData.institute ||
                PROGRAM_INSTITUTE_MAP[programCode.toUpperCase()] || '';
            const newStudent = {
                id: this.generateId(),
                studentId:   studentData.studentId,
                studentName: studentData.studentName,
                institute,
                programCode,
                yearSection: studentData.yearSection || '',
                email:       studentData.email || '',
                phone:       studentData.phone || '',
                hasUnpaidDebt: studentData.hasUnpaidDebt || false,
                isActive:      studentData.isActive !== undefined ? studentData.isActive : true,
                addedAt:  this.toISOString(new Date()),
                addedBy:  studentData.addedBy || 'Admin',
                updatedAt: this.toISOString(new Date())
            };
            students.push(newStudent);
            localStorage.setItem(this.studentNumbersKey, JSON.stringify(students));
            return newStudent.id;
        } catch (error) {
            console.error('Error adding student number:', error);
            throw error;
        }
    }

    async updateStudentNumber(studentId, studentData) {
        try {
            const students = await this.getStudentNumbers();
            const index = students.findIndex(s => s.studentId === studentId);
            if (index === -1) {
                throw new Error('Student number not found');
            }
            const programCode = studentData.programCode || studentData.course || students[index].programCode || '';
            const institute = studentData.institute ||
                PROGRAM_INSTITUTE_MAP[programCode.toUpperCase()] ||
                students[index].institute || '';
            students[index] = {
                ...students[index],
                studentId:   studentData.studentId,
                studentName: studentData.studentName,
                institute,
                programCode,
                yearSection: studentData.yearSection || '',
                email:       studentData.email || '',
                phone:       studentData.phone || '',
                hasUnpaidDebt: studentData.hasUnpaidDebt !== undefined ? studentData.hasUnpaidDebt : students[index].hasUnpaidDebt,
                isActive:      studentData.isActive      !== undefined ? studentData.isActive      : students[index].isActive,
                updatedAt:  this.toISOString(new Date()),
                updatedBy:  studentData.updatedBy || 'Admin'
            };
            localStorage.setItem(this.studentNumbersKey, JSON.stringify(students));
            return true;
        } catch (error) {
            console.error('Error updating student number:', error);
            throw error;
        }
    }

    async deleteStudentNumber(studentId) {
        try {
            const students = await this.getStudentNumbers();
            const filtered = students.filter(s => s.studentId !== studentId);
            if (filtered.length === students.length) {
                throw new Error('Student number not found');
            }
            localStorage.setItem(this.studentNumbersKey, JSON.stringify(filtered));
            return true;
        } catch (error) {
            console.error('Error deleting student number:', error);
            throw error;
        }
    }

    async findStudentNumber(studentId) {
        try {
            const students = await this.getStudentNumbers();
            return students.find(s => s.studentId === studentId) || null;
        } catch (error) {
            console.error('Error finding student number:', error);
            return null;
        }
    }

    // ===== PENDING REQUESTS OPERATIONS =====
    
    async getPendingRequests() {
        try {
            const data = localStorage.getItem(this.pendingRequestsKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error getting pending requests:', error);
            return [];
        }
    }

    async addPendingRequest(requestData) {
        try {
            const requests = await this.getPendingRequests();
            const newRequest = {
                id: this.generateId(),
                studentId: requestData.studentId,
                name: requestData.name,
                email: requestData.email,
                password: requestData.password,
                status: requestData.status || 'pending',
                requestTime: this.toISOString(requestData.requestTime || new Date()),
                approvedAt: null,
                rejectedAt: null,
                approvedBy: null,
                rejectedBy: null,
                course: requestData.course || '',
                yearSection: requestData.yearSection || '',
                section: requestData.section || '',
                requestedRole: requestData.requestedRole || 'student',
                requestedOrg: requestData.requestedOrg || ''
            };
            requests.push(newRequest);
            localStorage.setItem(this.pendingRequestsKey, JSON.stringify(requests));
            return newRequest.id;
        } catch (error) {
            console.error('Error adding pending request:', error);
            throw error;
        }
    }

    async updatePendingRequest(requestId, updateData) {
        try {
            const requests = await this.getPendingRequests();
            const index = requests.findIndex(r => r.id === requestId);
            if (index === -1) {
                throw new Error('Request not found');
            }

            requests[index] = {
                ...requests[index],
                ...updateData,
                updatedAt: this.toISOString(new Date())
            };
            localStorage.setItem(this.pendingRequestsKey, JSON.stringify(requests));
            return true;
        } catch (error) {
            console.error('Error updating pending request:', error);
            throw error;
        }
    }

    async deletePendingRequest(requestId) {
        try {
            const requests = await this.getPendingRequests();
            const filtered = requests.filter(r => r.id !== requestId);
            if (filtered.length === requests.length) {
                throw new Error('Request not found');
            }
            localStorage.setItem(this.pendingRequestsKey, JSON.stringify(filtered));
            return true;
        } catch (error) {
            console.error('Error deleting pending request:', error);
            throw error;
        }
    }

    // ===== STUDENT ACCOUNTS OPERATIONS =====
    
    async getStudentAccounts() {
        try {
            const data = localStorage.getItem(this.studentAccountsKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error getting student accounts:', error);
            return [];
        }
    }

    async addStudentAccount(accountData) {
        try {
            const accounts = await this.getStudentAccounts();
            const programCode = accountData.programCode || accountData.course || '';
            const institute = accountData.institute ||
                PROGRAM_INSTITUTE_MAP[programCode.toUpperCase()] || '';
            const newAccount = {
                id: this.generateId(),
                studentId:   accountData.studentId,
                studentName: accountData.studentName,
                institute,
                programCode,
                yearSection:   accountData.yearSection || '',
                email:         accountData.email || '',
                password:      accountData.password || '',
                hasUnpaidDebt: accountData.hasUnpaidDebt || false,
                isActive:      accountData.isActive !== undefined ? accountData.isActive : true,
                requestedRole: accountData.requestedRole || 'student',
                requestedOrg:  accountData.requestedOrg || '',
                approvedBy: accountData.approvedBy || 'Admin',
                approvedAt: this.toISOString(accountData.approvedAt || new Date()),
                createdAt:  this.toISOString(accountData.createdAt  || new Date()),
                updatedAt:  this.toISOString(new Date())
            };
            accounts.push(newAccount);
            localStorage.setItem(this.studentAccountsKey, JSON.stringify(accounts));
            return newAccount.id;
        } catch (error) {
            console.error('Error adding student account:', error);
            throw error;
        }
    }

    async updateStudentAccount(accountId, accountData) {
        try {
            const accounts = await this.getStudentAccounts();
            const index = accounts.findIndex(a => a.id === accountId);
            if (index === -1) {
                throw new Error('Account not found');
            }

            accounts[index] = {
                ...accounts[index],
                ...accountData,
                updatedAt: this.toISOString(new Date())
            };
            localStorage.setItem(this.studentAccountsKey, JSON.stringify(accounts));
            return true;
        } catch (error) {
            console.error('Error updating student account:', error);
            throw error;
        }
    }

    async deleteStudentAccount(accountId) {
        try {
            const accounts = await this.getStudentAccounts();
            const filtered = accounts.filter(a => a.id !== accountId);
            if (filtered.length === accounts.length) {
                throw new Error('Account not found');
            }
            localStorage.setItem(this.studentAccountsKey, JSON.stringify(filtered));
            return true;
        } catch (error) {
            console.error('Error deleting student account:', error);
            throw error;
        }
    }

    async findStudentAccount(studentId) {
        try {
            const accounts = await this.getStudentAccounts();
            return accounts.find(a => a.studentId === studentId) || null;
        } catch (error) {
            console.error('Error finding student account:', error);
            return null;
        }
    }

    // ===== OFFICERS OPERATIONS =====
    // Mirrors organization_members joined with users + organizations + org_roles in DB

    async getOfficers() {
        try {
            const data = localStorage.getItem(this.officersKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error getting officers:', error);
            return [];
        }
    }

    async addOfficer(officerData) {
        try {
            const officers = await this.getOfficers();
            const newOfficer = {
                id:          this.generateId(),
                studentId:   officerData.studentId,
                studentName: officerData.studentName,
                institute:   officerData.institute || '',
                orgCode:     officerData.orgCode || '',
                orgName:     officerData.orgName || officerData.orgCode || '',
                roleName:    officerData.roleName || 'officer',
                joinedAt:    officerData.joinedAt || new Date().toISOString().split('T')[0],
                isActive:    officerData.isActive !== undefined ? officerData.isActive : true,
                addedAt:     this.toISOString(new Date()),
                addedBy:     officerData.addedBy || 'Admin'
            };
            officers.push(newOfficer);
            localStorage.setItem(this.officersKey, JSON.stringify(officers));
            return newOfficer.id;
        } catch (error) {
            console.error('Error adding officer:', error);
            throw error;
        }
    }

    async updateOfficer(officerId, officerData) {
        try {
            const officers = await this.getOfficers();
            const index = officers.findIndex(o => o.id === officerId);
            if (index === -1) throw new Error('Officer not found');
            officers[index] = {
                ...officers[index],
                studentId:   officerData.studentId   || officers[index].studentId,
                studentName: officerData.studentName || officers[index].studentName,
                institute:   officerData.institute   || officers[index].institute,
                orgCode:     officerData.orgCode     || officers[index].orgCode,
                orgName:     officerData.orgName     || officerData.orgCode || officers[index].orgName,
                roleName:    officerData.roleName    || officers[index].roleName,
                joinedAt:    officerData.joinedAt    || officers[index].joinedAt,
                isActive:    officerData.isActive    !== undefined ? officerData.isActive : officers[index].isActive,
                updatedAt:   this.toISOString(new Date()),
                updatedBy:   officerData.updatedBy || 'Admin'
            };
            localStorage.setItem(this.officersKey, JSON.stringify(officers));
            return true;
        } catch (error) {
            console.error('Error updating officer:', error);
            throw error;
        }
    }

    async deleteOfficer(officerId) {
        try {
            const officers = await this.getOfficers();
            const filtered = officers.filter(o => o.id !== officerId);
            if (filtered.length === officers.length) throw new Error('Officer not found');
            localStorage.setItem(this.officersKey, JSON.stringify(filtered));
            return true;
        } catch (error) {
            console.error('Error deleting officer:', error);
            throw error;
        }
    }

    async findOfficersByStudent(studentId) {
        try {
            const officers = await this.getOfficers();
            return officers.filter(o => o.studentId === studentId);
        } catch (error) {
            console.error('Error finding officers by student:', error);
            return [];
        }
    }

    // ===== UTILITY METHODS =====
    
    async clearAllData() {
        try {
            localStorage.setItem(this.studentNumbersKey,  JSON.stringify([]));
            localStorage.setItem(this.pendingRequestsKey, JSON.stringify([]));
            localStorage.setItem(this.studentAccountsKey, JSON.stringify([]));
            localStorage.setItem(this.officersKey,        JSON.stringify([]));
            return true;
        } catch (error) {
            console.error('Error clearing all data:', error);
            throw error;
        }
    }

    async getCollectionStats() {
        try {
            const [studentNumbers, pendingRequests, studentAccounts, officers] = await Promise.all([
                this.getStudentNumbers(),
                this.getPendingRequests(),
                this.getStudentAccounts(),
                this.getOfficers()
            ]);
            return {
                studentNumbers:  studentNumbers.length,
                pendingRequests: pendingRequests.length,
                studentAccounts: studentAccounts.length,
                officers:        officers.length,
                pendingCount:  pendingRequests.filter(r => r.status === 'pending').length,
                approvedCount: pendingRequests.filter(r => r.status === 'approved').length,
                rejectedCount: pendingRequests.filter(r => r.status === 'rejected').length
            };
        } catch (error) {
            console.error('Error getting collection stats:', error);
            return null;
        }
    }
}

// Initialize and export the service
let accountsLocalStorageService = null;

function initializeAccountsLocalStorageService() {
    accountsLocalStorageService = new AccountsLocalStorageService();
    window.accountsLocalStorageService = accountsLocalStorageService;
    console.log('Accounts LocalStorage Service initialized successfully');
    return true;
}

// Initialize immediately
initializeAccountsLocalStorageService();
