/**
 * Data Loader Abstraction
 * Loads mock data from JSON files for static demo
 */

class DataLoader {
    /**
     * Get dashboard statistics
     */
    async getStats() {
        try {
            const response = await fetch('../data/users.json');
            const data = await response.json();
            return data.stats;
        } catch (error) {
            console.error('Error loading stats:', error);
            return {
                totalUsers: 0,
                activeSessions: 0,
                totalRecords: 0,
                growthRate: 0,
                activeUsers: 0,
                pending: 0
            };
        }
    }

    /**
     * Get recent users (for dashboard)
     */
    async getRecentUsers(limit = 10) {
        try {
            const response = await fetch('../data/users.json');
            const data = await response.json();
            return data.recentUsers.slice(0, limit);
        } catch (error) {
            console.error('Error loading recent users:', error);
            return [];
        }
    }

    /**
     * Get all users (for admin panel)
     */
    async getAllUsers() {
        try {
            const response = await fetch('../data/users.json');
            const data = await response.json();
            return data.allUsers || data.recentUsers;
        } catch (error) {
            console.error('Error loading all users:', error);
            return [];
        }
    }

    /**
     * Get user by ID
     */
    async getUserById(id) {
        try {
            const response = await fetch('../data/users.json');
            const data = await response.json();
            const allUsers = data.allUsers || data.recentUsers;
            return allUsers.find(user => user.id === parseInt(id));
        } catch (error) {
            console.error('Error loading user:', error);
            return null;
        }
    }
}

// Create global instance
const dataLoader = new DataLoader();
