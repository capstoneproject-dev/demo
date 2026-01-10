/**
 * Admin Panel JavaScript
 * Populates admin panel with mock data
 */

// Load admin data when page loads
document.addEventListener('DOMContentLoaded', async function() {
    await loadAdminData();
    
    // Add search functionality
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
});

async function loadAdminData() {
    try {
        // Load stats and all users
        const stats = await dataLoader.getStats();
        const users = await dataLoader.getAllUsers();
        
        // Populate stats
        populateAdminStats(stats);
        
        // Populate users table
        populateAdminUsersTable(users);
        
    } catch (error) {
        console.error('Error loading admin data:', error);
        showError('Failed to load admin data');
    }
}

function populateAdminStats(stats) {
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
        </div>
        <div class="stat-card stat-success">
            <div class="stat-content">
                <div class="stat-info">
                    <p class="stat-label">Active Users</p>
                    <h3 class="stat-value">${stats.activeUsers}</h3>
                </div>
                <div class="stat-icon-wrapper">
                    <div class="stat-icon">✅</div>
                </div>
            </div>
        </div>
        <div class="stat-card stat-warning">
            <div class="stat-content">
                <div class="stat-info">
                    <p class="stat-label">Pending</p>
                    <h3 class="stat-value">${stats.pending}</h3>
                </div>
                <div class="stat-icon-wrapper">
                    <div class="stat-icon">⏳</div>
                </div>
            </div>
        </div>
    `;
    
    const statsGrid = document.querySelector('.stats-grid');
    if (statsGrid) {
        statsGrid.innerHTML = statsHTML;
    }
}

function populateAdminUsersTable(users) {
    const tbody = document.getElementById('adminUsersTableBody');
    if (!tbody) return;
    
    // Store users globally for search
    window.allUsers = users;
    
    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="no-data">
                    <div class="empty-state">
                        <span class="empty-icon">📭</span>
                        <p>No users found in database</p>
                        <small>Users will appear here once registered</small>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    renderUsersTable(users);
}

function renderUsersTable(users) {
    const tbody = document.getElementById('adminUsersTableBody');
    if (!tbody) return;
    
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
                        <div>
                            <div class="user-name-cell">${escapeHtml(user.username)}</div>
                            <div class="user-email-cell">${escapeHtml(user.email)}</div>
                        </div>
                    </div>
                </td>
                <td>${escapeHtml(user.email)}</td>
                <td>${escapeHtml(fullName)}</td>
                <td>${date}</td>
                <td><span class="status-badge status-active">Active</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon btn-edit" title="Edit" onclick="handleEdit(${user.id})">
                            <span>✏️</span>
                        </button>
                        <button class="btn-icon btn-delete" title="Delete" onclick="handleDelete(${user.id})">
                            <span>🗑️</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const users = window.allUsers || [];
    
    if (!searchTerm) {
        renderUsersTable(users);
        return;
    }
    
    const filteredUsers = users.filter(user => 
        user.username.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm) ||
        (user.first_name && user.first_name.toLowerCase().includes(searchTerm)) ||
        (user.last_name && user.last_name.toLowerCase().includes(searchTerm))
    );
    
    renderUsersTable(filteredUsers);
}

function handleEdit(userId) {
    alert(`Edit user #${userId} (Demo mode - no action taken)`);
}

function handleDelete(userId) {
    if (confirm(`Are you sure you want to delete user #${userId}?`)) {
        alert(`User #${userId} deleted (Demo mode - no action taken)`);
    }
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
