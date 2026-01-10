/**
 * Dashboard JavaScript
 * Populates dashboard with mock data
 */

// Load dashboard data when page loads
document.addEventListener('DOMContentLoaded', async function() {
    await loadDashboardData();
});

async function loadDashboardData() {
    try {
        // Load stats and users
        const stats = await dataLoader.getStats();
        const users = await dataLoader.getRecentUsers(10);
        
        // Populate stats
        populateStats(stats);
        
        // Populate users table
        populateUsersTable(users);
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Failed to load dashboard data');
    }
}

function populateStats(stats) {
    const statsHTML = `
        <div class="stat-card stat-primary">
            <div class="stat-content">
                <div class="stat-info">
                    <p class="stat-label">Total Users</p>
                    <h3 class="stat-value">${stats.totalUsers}</h3>
                </div>
                <div class="stat-icon-wrapper">
                    <div class="stat-icon">👥</div>
                </div>
            </div>
            <div class="stat-footer">
                <span class="stat-change positive">+12% from last month</span>
            </div>
        </div>
        <div class="stat-card stat-success">
            <div class="stat-content">
                <div class="stat-info">
                    <p class="stat-label">Active Sessions</p>
                    <h3 class="stat-value">${stats.activeSessions}</h3>
                </div>
                <div class="stat-icon-wrapper">
                    <div class="stat-icon">🟢</div>
                </div>
            </div>
            <div class="stat-footer">
                <span class="stat-change">Currently active</span>
            </div>
        </div>
        <div class="stat-card stat-warning">
            <div class="stat-content">
                <div class="stat-info">
                    <p class="stat-label">Total Records</p>
                    <h3 class="stat-value">${stats.totalRecords}</h3>
                </div>
                <div class="stat-icon-wrapper">
                    <div class="stat-icon">📝</div>
                </div>
            </div>
            <div class="stat-footer">
                <span class="stat-change">All time records</span>
            </div>
        </div>
        <div class="stat-card stat-info">
            <div class="stat-content">
                <div class="stat-info">
                    <p class="stat-label">Growth Rate</p>
                    <h3 class="stat-value">${stats.growthRate}%</h3>
                </div>
                <div class="stat-icon-wrapper">
                    <div class="stat-icon">📈</div>
                </div>
            </div>
            <div class="stat-footer">
                <span class="stat-change positive">+5% this week</span>
            </div>
        </div>
    `;
    
    const statsContainer = document.getElementById('statsContainer');
    if (statsContainer) {
        statsContainer.innerHTML = statsHTML;
    }
}

function populateUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="no-data">
                    <div class="empty-state">
                        <span class="empty-icon">📭</span>
                        <p>No users found</p>
                        <small>Users will appear here once registered</small>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = users.map(user => {
        const initial = user.username.charAt(0).toUpperCase();
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/A';
        const date = formatDate(user.created_at);
        
        return `
            <tr>
                <td><span class="badge">#${user.id}</span></td>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar-small">${initial}</div>
                        <span>${escapeHtml(user.username)}</span>
                    </div>
                </td>
                <td>${escapeHtml(user.email)}</td>
                <td>${escapeHtml(fullName)}</td>
                <td>${date}</td>
                <td><span class="status-badge status-active">Active</span></td>
            </tr>
        `;
    }).join('');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
        contentArea.innerHTML = `
            <div class="alert alert-error">
                <span class="alert-icon">⚠️</span>
                <span>${escapeHtml(message)}</span>
            </div>
        `;
    }
}
