// localStorage Service for Accounts System
// This service handles all localStorage operations for the Accounts system
// Replaces Firebase functionality with browser localStorage

class AccountsLocalStorageService {
    constructor() {
        this.parentCollection = 'AccountsSystem';
        this.studentNumbersKey = `${this.parentCollection}_studentNumbers`;
        this.pendingRequestsKey = `${this.parentCollection}_pendingRequests`;
        this.studentAccountsKey = `${this.parentCollection}_studentAccounts`;
        
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
            const newStudent = {
                id: this.generateId(),
                studentId: studentData.studentId,
                studentName: studentData.studentName,
                section: studentData.section || '',
                course: studentData.course || '',
                yearSection: studentData.yearSection || '',
                email: studentData.email || '',
                phone: studentData.phone || '',
                addedAt: this.toISOString(new Date()),
                addedBy: studentData.addedBy || 'Admin',
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

            students[index] = {
                ...students[index],
                studentId: studentData.studentId,
                studentName: studentData.studentName,
                section: studentData.section || '',
                course: studentData.course || '',
                yearSection: studentData.yearSection || '',
                email: studentData.email || '',
                phone: studentData.phone || '',
                updatedAt: this.toISOString(new Date()),
                updatedBy: studentData.updatedBy || 'Admin'
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
            this.notifyListeners('pendingRequests', requests);
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
            this.notifyListeners('pendingRequests', requests);
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
            this.notifyListeners('pendingRequests', filtered);
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
            const newAccount = {
                id: this.generateId(),
                studentId: accountData.studentId,
                studentName: accountData.studentName,
                section: accountData.section,
                email: accountData.email,
                password: accountData.password,
                createdAt: this.toISOString(accountData.createdAt || new Date()),
                approvedBy: accountData.approvedBy || 'Admin',
                approvedAt: this.toISOString(accountData.approvedAt || new Date()),
                updatedAt: this.toISOString(new Date()),
                course: accountData.course || '',
                yearSection: accountData.yearSection || '',
                requestedRole: accountData.requestedRole || 'student',
                requestedOrg: accountData.requestedOrg || ''
            };
            accounts.push(newAccount);
            localStorage.setItem(this.studentAccountsKey, JSON.stringify(accounts));
            this.notifyListeners('studentAccounts', accounts);
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
            this.notifyListeners('studentAccounts', accounts);
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
            this.notifyListeners('studentAccounts', filtered);
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

    // ===== REAL-TIME LISTENERS (Simulated) =====
    
    // Storage for listener callbacks
    listeners = {
        studentNumbers: [],
        pendingRequests: [],
        studentAccounts: []
    };

    // Notify all registered listeners
    notifyListeners(type, data) {
        if (this.listeners[type]) {
            this.listeners[type].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${type} listener:`, error);
                }
            });
        }
    }

    listenToStudentNumbers(callback) {
        this.listeners.studentNumbers.push(callback);
        // Immediately call with current data
        this.getStudentNumbers().then(data => callback(data));
        
        // Return unsubscribe function
        return () => {
            const index = this.listeners.studentNumbers.indexOf(callback);
            if (index > -1) {
                this.listeners.studentNumbers.splice(index, 1);
            }
        };
    }

    listenToPendingRequests(callback) {
        this.listeners.pendingRequests.push(callback);
        // Immediately call with current data
        this.getPendingRequests().then(data => callback(data));
        
        // Return unsubscribe function
        return () => {
            const index = this.listeners.pendingRequests.indexOf(callback);
            if (index > -1) {
                this.listeners.pendingRequests.splice(index, 1);
            }
        };
    }

    listenToStudentAccounts(callback) {
        this.listeners.studentAccounts.push(callback);
        // Immediately call with current data
        this.getStudentAccounts().then(data => callback(data));
        
        // Return unsubscribe function
        return () => {
            const index = this.listeners.studentAccounts.indexOf(callback);
            if (index > -1) {
                this.listeners.studentAccounts.splice(index, 1);
            }
        };
    }

    // ===== UTILITY METHODS =====
    
    async clearAllData() {
        try {
            localStorage.setItem(this.studentNumbersKey, JSON.stringify([]));
            localStorage.setItem(this.pendingRequestsKey, JSON.stringify([]));
            localStorage.setItem(this.studentAccountsKey, JSON.stringify([]));
            
            // Notify listeners
            this.notifyListeners('studentNumbers', []);
            this.notifyListeners('pendingRequests', []);
            this.notifyListeners('studentAccounts', []);
            
            return true;
        } catch (error) {
            console.error('Error clearing all data:', error);
            throw error;
        }
    }

    async getCollectionStats() {
        try {
            const [studentNumbers, pendingRequests, studentAccounts] = await Promise.all([
                this.getStudentNumbers(),
                this.getPendingRequests(),
                this.getStudentAccounts()
            ]);

            return {
                studentNumbers: studentNumbers.length,
                pendingRequests: pendingRequests.length,
                studentAccounts: studentAccounts.length,
                pendingCount: pendingRequests.filter(r => r.status === 'pending').length,
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

// Export for compatibility (using same name as Firebase service for easier migration)
window.accountsFirebaseService = accountsLocalStorageService;
