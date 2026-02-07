
// --- OFFICER ANALYTICS (Chart.js) ---

function renderAnalyticsCharts() {
    // 1. Revenue Chart (Matching ₱12.5k)
    const revenueCtx = document.getElementById('revenueChart');
    if (revenueCtx) {
        new Chart(revenueCtx, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [{
                    label: 'Revenue (₱)',
                    data: [2500, 4200, 3100, 2700], // Sums to ~12.5k
                    borderColor: '#002147',
                    backgroundColor: 'rgba(0, 33, 71, 0.05)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { display: false } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // 2. Participation Chart (Matching +12% growth)
    const partCtx = document.getElementById('participationChart');
    if (partCtx) {
        new Chart(partCtx, {
            type: 'bar',
            data: {
                labels: ['Nov Event', 'Dec Event', 'Jan GA', 'Feb Summit'],
                datasets: [{
                    label: 'Attendees',
                    data: [85, 110, 134, 150], // Shows growth trend
                    backgroundColor: ['#e2e8f0', '#e2e8f0', '#94a3b8', '#059669'],
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { display: false }, x: { grid: { display: false } } }
            }
        });
    }

    // 3. Rentals Chart (Matching 14 active, etc.)
    const rentCtx = document.getElementById('rentalsChart');
    if (rentCtx) {
        new Chart(rentCtx, {
            type: 'doughnut',
            data: {
                labels: ['Active', 'Pending', 'Overdue'],
                datasets: [{
                    data: [14, 4, 2], // Matches dashboard stat
                    backgroundColor: ['#002147', '#d97706', '#dc2626'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                cutout: '70%'
            }
        });
    }

    // 4. Docs Chart (Matching 15/2/1)
    const docCtx = document.getElementById('docsChart');
    if (docCtx) {
        new Chart(docCtx, {
            type: 'pie',
            data: {
                labels: ['Accepted', 'Pending', 'Rejected'],
                datasets: [{
                    data: [15, 2, 1], // Matches dashboard stat
                    backgroundColor: ['#059669', '#d97706', '#dc2626'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }
}

// Initialize Charts on Load
document.addEventListener('DOMContentLoaded', () => {
    // We can call this immediately, or wait for the tab to be active.
    // Calling it immediately is fine as Chart.js handles hidden canvases well enough usually,
    // but resizing might be needed when the tab becomes visible (handled in officerDashboard.js).
    renderAnalyticsCharts();

    // NEW: Set default value for month filter to current month
    const filterMonth = document.getElementById('filter-month');
    if (filterMonth) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        filterMonth.value = `${year}-${month}`;
    }
});
