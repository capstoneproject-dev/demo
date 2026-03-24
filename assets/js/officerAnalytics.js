// --- OFFICER ANALYTICS (live, filter-aware, export-ready) ---

const officerAnalyticsState = {
    charts: {
        revenue: null,
        participation: null,
        rentals: null,
        docs: null,
    },
    snapshot: null,
    liveEvents: [],
    mockData: null, // Temporary mock data for testing
};

function parseOfficerAnalyticsDate(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) return direct;

    let cleaned = String(value).replace(/\./g, '').trim();
    if (/^[A-Za-z]{3,9}\s+\d{1,2}$/.test(cleaned)) {
        cleaned = `${cleaned}, ${new Date().getFullYear()}`;
    }
    const fallback = new Date(cleaned);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function getOfficerAnalyticsAcademicYearRange(academicYear) {
    const match = String(academicYear || '').match(/^(\d{4})-(\d{4})$/);
    if (!match) return { start: null, end: null };

    const startYear = Number(match[1]);
    const endYear = Number(match[2]);
    return {
        start: new Date(startYear, 7, 1, 0, 0, 0, 0),
        end: new Date(endYear, 6, 31, 23, 59, 59, 999),
    };
}

function getOfficerAnalyticsDefaultAcademicYear() {
    const now = new Date();
    const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return `${year}-${year + 1}`;
}

function getOfficerAnalyticsDateMode() {
    const dateInput = document.getElementById('analytics-date')?.value || '';
    const monthInput = document.getElementById('filter-month')?.value || '';
    if (dateInput) return { type: 'day', value: dateInput };
    if (monthInput) return { type: 'month', value: monthInput };
    return { type: 'all', value: '' };
}

function isOfficerAnalyticsDateMatch(date, filters) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;

    if (filters.yearRange.start && date < filters.yearRange.start) return false;
    if (filters.yearRange.end && date > filters.yearRange.end) return false;

    if (filters.exportRange && (filters.exportRange.startDate || filters.exportRange.endDate)) {
        if (filters.exportRange.startDate) {
            const start = new Date(`${filters.exportRange.startDate}T00:00:00`);
            if (date < start) return false;
        }
        if (filters.exportRange.endDate) {
            const end = new Date(`${filters.exportRange.endDate}T23:59:59.999`);
            if (date > end) return false;
        }
        return true;
    }

    if (filters.mode.type === 'day') {
        const dayKey = typeof formatLocalDateKey === 'function'
            ? formatLocalDateKey(date)
            : [
                date.getFullYear(),
                String(date.getMonth() + 1).padStart(2, '0'),
                String(date.getDate()).padStart(2, '0'),
            ].join('-');
        return dayKey === filters.mode.value;
    }

    if (filters.mode.type === 'month') {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return monthKey === filters.mode.value;
    }

    return true;
}

function getOfficerAnalyticsFilters(overrides = {}) {
    const academicYear = overrides.academicYear
        || document.getElementById('filter-year')?.value
        || getOfficerAnalyticsDefaultAcademicYear();
    const exportRange = overrides.exportRange || null;
    return {
        academicYear,
        yearRange: exportRange
            ? { start: null, end: null }
            : getOfficerAnalyticsAcademicYearRange(academicYear),
        mode: getOfficerAnalyticsDateMode(),
        exportRange,
    };
}

function getOfficerAnalyticsFinancialRows() {
    if (typeof getOfficerFinancialSummaryRows === 'function') {
        return getOfficerFinancialSummaryRows();
    }
    return [];
}

function getOfficerAnalyticsLiveRentals() {
    if (typeof getOfficerScopedRentals !== 'function') return [];
    return getOfficerScopedRentals().filter((item) => {
        return Boolean(item && (item.rental_id || item.id || item.dueAt));
    });
}

function getOfficerAnalyticsLiveDocs() {
    if (typeof getOfficerScopedDocs !== 'function') return [];
    return getOfficerScopedDocs().filter((item) => {
        return Boolean(item && (item.submission_id || item.id || item.submittedAt));
    });
}

function getOfficerAnalyticsSourceData() {
    // Return mock data if available (temporary for testing)
    if (officerAnalyticsState.mockData) {
        return officerAnalyticsState.mockData;
    }

    const rentals = getOfficerAnalyticsLiveRentals();
    const docs = getOfficerAnalyticsLiveDocs();
    const financial = getOfficerAnalyticsFinancialRows();
    const events = Array.isArray(officerAnalyticsState.liveEvents) ? officerAnalyticsState.liveEvents : [];

    return { rentals, docs, financial, events };
}

async function loadOfficerAnalyticsEvents() {
    try {
        const res = await fetch('../api/qr-attendance/events/list.php', { credentials: 'same-origin' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
            throw new Error(data.error || `Request failed (${res.status})`);
        }

        officerAnalyticsState.liveEvents = Array.isArray(data.items)
            ? data.items.map((item) => ({
                id: item.event_id,
                title: item.event_name || 'Event',
                date: item.event_datetime || item.event_date || item.created_at || '',
                venue: item.location || 'TBA',
                participants: Number(item.attendance_count || 0),
                status: Number(item.is_published || 0) ? 'published' : 'draft',
            }))
            : [];
    } catch (error) {
        console.error('loadOfficerAnalyticsEvents failed', error);
        officerAnalyticsState.liveEvents = [];
    }

    if (typeof initializeOfficerAnalyticsYearOptions === 'function') {
        initializeOfficerAnalyticsYearOptions();
    }
    refreshAnalyticsCharts();
}

function groupOfficerAnalyticsFinancialRows(rows, modeType) {
    const buckets = new Map();
    const formatter = new Intl.DateTimeFormat('en-US',
        modeType === 'day'
            ? { month: 'short', day: 'numeric', year: 'numeric' }
            : (modeType === 'month'
                ? { month: 'short', day: 'numeric' }
                : { month: 'short', year: 'numeric' })
    );

    rows.forEach((item) => {
        const date = parseOfficerAnalyticsDate(
            item?.transaction_date || item?.transaction_datetime || item?.submitted_at
        );
        if (!date) return;

        const key = modeType === 'day'
            ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
            : (modeType === 'month'
                ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);

        if (!buckets.has(key)) {
            buckets.set(key, {
                label: formatter.format(date),
                total: 0,
            });
        }

        if (String(item.payment_status || '').toLowerCase() === 'paid') {
            buckets.get(key).total += Number(item.total_cost || 0);
        }
    });

    return Array.from(buckets.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, value]) => value);
}

function getOfficerAnalyticsComparisonRevenue(financialRows, filters) {
    let currentStart = filters.yearRange.start;
    let currentEnd = filters.yearRange.end;

    if (filters.mode.type === 'day' && filters.mode.value) {
        currentStart = new Date(`${filters.mode.value}T00:00:00`);
        currentEnd = new Date(`${filters.mode.value}T23:59:59.999`);
    } else if (filters.mode.type === 'month' && filters.mode.value) {
        const [year, month] = filters.mode.value.split('-').map(Number);
        currentStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
        currentEnd = new Date(year, month, 0, 23, 59, 59, 999);
    }

    if (!(currentStart instanceof Date) || Number.isNaN(currentStart.getTime())
        || !(currentEnd instanceof Date) || Number.isNaN(currentEnd.getTime())) {
        return { total: 0, label: 'No previous period data' };
    }

    let previousStart;
    let previousEnd;

    if (filters.mode.type === 'day') {
        previousStart = new Date(currentStart);
        previousStart.setDate(previousStart.getDate() - 1);
        previousEnd = new Date(currentEnd);
        previousEnd.setDate(previousEnd.getDate() - 1);
    } else if (filters.mode.type === 'month') {
        previousStart = new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1, 0, 0, 0, 0);
        previousEnd = new Date(currentStart.getFullYear(), currentStart.getMonth(), 0, 23, 59, 59, 999);
    } else {
        previousStart = new Date(currentStart.getFullYear() - 1, 7, 1, 0, 0, 0, 0);
        previousEnd = new Date(currentEnd.getFullYear() - 1, 6, 31, 23, 59, 59, 999);
    }

    const total = financialRows.reduce((sum, item) => {
        const date = parseOfficerAnalyticsDate(
            item?.transaction_date || item?.transaction_datetime || item?.submitted_at
        );
        if (!date || date < previousStart || date > previousEnd) return sum;
        if (String(item.payment_status || '').toLowerCase() !== 'paid') return sum;
        return sum + Number(item.total_cost || 0);
    }, 0);

    const label = filters.mode.type === 'day'
        ? 'vs previous day'
        : (filters.mode.type === 'month' ? 'vs previous month' : 'vs previous academic year');

    return { total, label };
}

function getOfficerAnalyticsSnapshot(overrides = {}) {
    const filters = getOfficerAnalyticsFilters(overrides);
    const source = getOfficerAnalyticsSourceData();

    const filteredFinancial = source.financial.filter((item) => {
        const date = parseOfficerAnalyticsDate(
            item?.transaction_date || item?.transaction_datetime || item?.submitted_at
        );
        return isOfficerAnalyticsDateMatch(date, filters);
    });

    const filteredDocs = source.docs.filter((item) => {
        const date = parseOfficerAnalyticsDate(item.submittedAt || item.date);
        return isOfficerAnalyticsDateMatch(date, filters);
    });

    const filteredRentals = source.rentals.filter((item) => {
        const date = parseOfficerAnalyticsDate(item.dueAt || item.due);
        return isOfficerAnalyticsDateMatch(date, filters);
    });

    const filteredEvents = source.events.filter((item) => {
        const date = parseOfficerAnalyticsDate(item.date);
        return isOfficerAnalyticsDateMatch(date, filters);
    });

    const totalRevenue = filteredFinancial.reduce((sum, item) => {
        if (String(item.payment_status || '').toLowerCase() !== 'paid') return sum;
        return sum + Number(item.total_cost || 0);
    }, 0);

    const comparison = getOfficerAnalyticsComparisonRevenue(source.financial, filters);
    let revenueTrend = 'No previous period data';
    if (comparison.total > 0) {
        const delta = ((totalRevenue - comparison.total) / comparison.total) * 100;
        const icon = delta >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
        const color = delta >= 0 ? '#059669' : '#dc2626';
        revenueTrend = `<span style="color: ${color};"><i class="fa-solid ${icon}"></i> ${Math.abs(delta).toFixed(1)}% ${comparison.label}</span>`;
    } else if (totalRevenue > 0) {
        revenueTrend = `<span style="color: #059669;"><i class="fa-solid fa-arrow-up"></i> New revenue recorded</span>`;
    }

    const participationTotal = filteredEvents.reduce((sum, event) => sum + Number(event.participants || 0), 0);
    const participationAverage = filteredEvents.length ? Math.round(participationTotal / filteredEvents.length) : 0;

    // Calculate retention level based on average participation and consistency
    let retentionLevel = 'Low';
    if (filteredEvents.length > 0) {
        // Calculate consistency (how close events are to the average)
        const variance = filteredEvents.reduce((sum, event) => {
            const diff = Number(event.participants || 0) - participationAverage;
            return sum + (diff * diff);
        }, 0) / filteredEvents.length;
        const standardDeviation = Math.sqrt(variance);
        const consistencyRatio = participationAverage > 0 ? standardDeviation / participationAverage : 1;

        // Determine retention level
        if (participationAverage >= 100 && consistencyRatio < 0.5) {
            retentionLevel = 'High';
        } else if (participationAverage >= 80 || (participationAverage >= 50 && consistencyRatio < 0.6)) {
            retentionLevel = 'High';
        } else if (participationAverage >= 50 || (participationAverage >= 30 && consistencyRatio < 0.7)) {
            retentionLevel = 'Medium';
        } else if (participationAverage >= 30) {
            retentionLevel = 'Medium';
        } else {
            retentionLevel = 'Low';
        }
    }

    const rentalCounts = { active: 0, pending: 0, overdue: 0 };
    filteredRentals.forEach((item) => {
        const status = String(item.status || '').toLowerCase();
        if (status.includes('overdue')) rentalCounts.overdue += 1;
        else if (status.includes('reserved') || status.includes('pending')) rentalCounts.pending += 1;
        else rentalCounts.active += 1;
    });

    const docCounts = { approved: 0, pending: 0, rejected: 0 };
    filteredDocs.forEach((item) => {
        const status = String(item.status || '').toLowerCase();
        if (status.includes('reject')) docCounts.rejected += 1;
        else if (status === 'approved') docCounts.approved += 1;
        else docCounts.pending += 1;
    });

    const revenueSeries = groupOfficerAnalyticsFinancialRows(
        filteredFinancial,
        filters.mode.type === 'day' ? 'day' : (filters.mode.type === 'month' ? 'month' : 'all')
    );

    // If we have too few data points after grouping, show individual transactions
    let revenueLabels = revenueSeries.map((item) => item.label);
    let revenueValues = revenueSeries.map((item) => Number(item.total.toFixed(2)));

    // If less than 3 grouped points and we have transactions, show individual transactions
    if (revenueLabels.length < 3 && filteredFinancial.length > 0 && filteredFinancial.length <= 10) {
        const individualSeries = filteredFinancial
            .filter(item => String(item.payment_status || '').toLowerCase() === 'paid')
            .map(item => {
                const date = parseOfficerAnalyticsDate(
                    item?.transaction_date || item?.transaction_datetime || item?.submitted_at
                );
                return {
                    date: date,
                    label: date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Unknown',
                    value: Number(item.total_cost || 0)
                };
            })
            .sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));

        if (individualSeries.length >= 2) {
            revenueLabels = individualSeries.map(item => item.label);
            revenueValues = individualSeries.map(item => item.value);
        }
    }

    const participationSeries = filteredEvents
        .slice()
        .sort((a, b) => {
            const aTime = parseOfficerAnalyticsDate(a.date)?.getTime() || 0;
            const bTime = parseOfficerAnalyticsDate(b.date)?.getTime() || 0;
            return aTime - bTime;
        })
        .map((event) => ({
            label: event.title || 'Event',
            value: Number(event.participants || 0),
        }));

    const filterSummary = (() => {
        if (filters.mode.type === 'day') {
            return `Showing analytics for ${new Date(`${filters.mode.value}T00:00:00`).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
            })} (${filters.academicYear}).`;
        }
        if (filters.mode.type === 'month') {
            const monthDate = new Date(`${filters.mode.value}-01T00:00:00`);
            return `Showing analytics for ${monthDate.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
            })} (${filters.academicYear}).`;
        }
        return `Showing all available analytics for academic year ${filters.academicYear}.`;
    })();

    return {
        filters,
        source,
        financial: filteredFinancial,
        docs: filteredDocs,
        rentals: filteredRentals,
        events: filteredEvents,
        totals: {
            revenue: totalRevenue,
            participationAverage,
            participationTotal,
        },
        summaries: {
            revenueTrend,
            participation: retentionLevel,
            filterSummary,
        },
        counts: {
            rentals: rentalCounts,
            docs: docCounts,
        },
        charts: {
            revenue: {
                labels: revenueLabels.length ? revenueLabels : ['No revenue data'],
                values: revenueValues.length ? revenueValues : [0],
            },
            participation: {
                labels: participationSeries.length ? participationSeries.map((item) => item.label) : ['No events'],
                values: participationSeries.length ? participationSeries.map((item) => item.value) : [0],
            },
            rentals: {
                labels: ['Active', 'Pending', 'Overdue'],
                values: [rentalCounts.active, rentalCounts.pending, rentalCounts.overdue],
            },
            docs: {
                labels: ['Approved', 'Pending', 'Rejected'],
                values: [docCounts.approved, docCounts.pending, docCounts.rejected],
            },
        },
    };
}

function updateOfficerAnalyticsCardText(snapshot) {
    // Update Financial Performance Card
    const financialFooter = document.querySelector('.card-financial .analytics-stats-footer');
    if (financialFooter) {
        const statValues = financialFooter.querySelectorAll('.stat-value');
        if (statValues[0]) {
            statValues[0].innerHTML = typeof formatOfficerPeso === 'function'
                ? formatOfficerPeso(snapshot.totals.revenue)
                : `₱${snapshot.totals.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        if (statValues[1]) {
            // Parse growth from summary like "+8.5% Growth"
            const growthMatch = snapshot.summaries.revenueTrend.match(/([\+\-]?\d+\.?\d*)%/);
            if (growthMatch) {
                const growthValue = parseFloat(growthMatch[1]);
                const icon = growthValue >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
                const colorClass = growthValue >= 0 ? 'stat-positive' : 'stat-negative';
                statValues[1].className = `stat-value ${colorClass}`;
                statValues[1].innerHTML = `<i class="fa-solid ${icon}"></i> ${growthMatch[1]}%`;
            } else {
                statValues[1].innerHTML = snapshot.summaries.revenueTrend;
            }
        }
    }

    // Update Participation Trends Card
    const participationFooter = document.querySelector('.card-participation .analytics-stats-footer');
    if (participationFooter) {
        const statValues = participationFooter.querySelectorAll('.stat-value');
        if (statValues[0]) {
            statValues[0].innerHTML = `<i class="fa-solid fa-users"></i> ${snapshot.totals.participationAverage}`;
        }
        if (statValues[1]) {
            const retentionBadge = participationFooter.querySelector('.stat-badge');
            if (retentionBadge) {
                retentionBadge.textContent = snapshot.summaries.participation;
                // Update badge class based on retention level
                const retentionLower = snapshot.summaries.participation.toLowerCase();
                retentionBadge.className = 'stat-badge';
                if (retentionLower.includes('high')) {
                    retentionBadge.classList.add('stat-badge-high');
                } else if (retentionLower.includes('medium') || retentionLower.includes('moderate')) {
                    retentionBadge.classList.add('stat-badge-medium');
                } else if (retentionLower.includes('low')) {
                    retentionBadge.classList.add('stat-badge-low');
                }
            }
        }
    }

    const activeFilter = document.getElementById('analytics-active-filter');
    if (activeFilter) {
        let filterText = snapshot.summaries.filterSummary;
        // Add mock data indicator
        if (officerAnalyticsState.mockData) {
            filterText = '<span style="background: #059669; color: white; padding: 4px 8px; border-radius: 4px; font-weight: 600; margin-right: 8px;"><i class="fa-solid fa-flask"></i> MOCK DATA</span> ' + filterText;
        }
        activeFilter.innerHTML = filterText;
    }

    const rentalsLegend = document.getElementById('analytics-rentals-legend');
    if (rentalsLegend) {
        const total = snapshot.counts.rentals.active + snapshot.counts.rentals.pending + snapshot.counts.rentals.overdue;
        const activePercent = total > 0 ? (snapshot.counts.rentals.active / total) * 100 : 0;
        const pendingPercent = total > 0 ? (snapshot.counts.rentals.pending / total) * 100 : 0;
        const overduePercent = total > 0 ? (snapshot.counts.rentals.overdue / total) * 100 : 0;

        rentalsLegend.innerHTML = `
            <div class="legend-item legend-active">
                <div class="legend-info">
                    <span class="legend-label">Active</span>
                    <span class="legend-value">${snapshot.counts.rentals.active}</span>
                </div>
                <div class="legend-bar">
                    <div class="legend-bar-fill" style="width: ${activePercent}%; background: #059669;"></div>
                </div>
            </div>
            <div class="legend-item legend-pending">
                <div class="legend-info">
                    <span class="legend-label">Pending</span>
                    <span class="legend-value">${snapshot.counts.rentals.pending}</span>
                </div>
                <div class="legend-bar">
                    <div class="legend-bar-fill" style="width: ${pendingPercent}%; background: #d97706;"></div>
                </div>
            </div>
            <div class="legend-item legend-overdue">
                <div class="legend-info">
                    <span class="legend-label">Overdue</span>
                    <span class="legend-value">${snapshot.counts.rentals.overdue}</span>
                </div>
                <div class="legend-bar">
                    <div class="legend-bar-fill" style="width: ${overduePercent}%; background: #dc2626;"></div>
                </div>
            </div>
        `;
    }

    const docsLegend = document.getElementById('analytics-docs-legend');
    if (docsLegend) {
        const total = snapshot.counts.docs.approved + snapshot.counts.docs.pending + snapshot.counts.docs.rejected;
        const approvedPercent = total > 0 ? (snapshot.counts.docs.approved / total) * 100 : 0;
        const pendingPercent = total > 0 ? (snapshot.counts.docs.pending / total) * 100 : 0;
        const rejectedPercent = total > 0 ? (snapshot.counts.docs.rejected / total) * 100 : 0;

        docsLegend.innerHTML = `
            <div class="legend-item legend-approved">
                <div class="legend-info">
                    <span class="legend-label">Approved</span>
                    <span class="legend-value">${snapshot.counts.docs.approved}</span>
                </div>
                <div class="legend-progress">
                    <div class="legend-progress-bar" style="width: ${approvedPercent}%; background: #059669;"></div>
                </div>
            </div>
            <div class="legend-item legend-pending">
                <div class="legend-info">
                    <span class="legend-label">Pending</span>
                    <span class="legend-value">${snapshot.counts.docs.pending}</span>
                </div>
                <div class="legend-progress">
                    <div class="legend-progress-bar" style="width: ${pendingPercent}%; background: #d97706;"></div>
                </div>
            </div>
            <div class="legend-item legend-rejected">
                <div class="legend-info">
                    <span class="legend-label">Rejected</span>
                    <span class="legend-value">${snapshot.counts.docs.rejected}</span>
                </div>
                <div class="legend-progress">
                    <div class="legend-progress-bar" style="width: ${rejectedPercent}%; background: #dc2626;"></div>
                </div>
            </div>
        `;
    }
}

function upsertOfficerAnalyticsChart(key, elementId, config) {
    const canvas = document.getElementById(elementId);
    if (!canvas || typeof Chart === 'undefined') {
        return;
    }

    // Destroy existing chart and recreate it to ensure proper rendering
    if (officerAnalyticsState.charts[key]) {
        officerAnalyticsState.charts[key].destroy();
        delete officerAnalyticsState.charts[key];
    }

    officerAnalyticsState.charts[key] = new Chart(canvas, config);
}

function renderOfficerAnalyticsCharts(snapshot) {
    // Determine chart type based on number of data points
    const revenueDataPoints = snapshot.charts.revenue.values.length;
    const useBarChart = revenueDataPoints <= 2;

    upsertOfficerAnalyticsChart('revenue', 'revenueChart', {
        type: useBarChart ? 'bar' : 'line',
        data: {
            labels: snapshot.charts.revenue.labels,
            datasets: [{
                label: 'Revenue',
                data: snapshot.charts.revenue.values,
                borderColor: '#002147',
                backgroundColor: useBarChart ? '#002147' : 'rgba(0, 33, 71, 0.08)',
                fill: !useBarChart,
                tension: 0.35,
                borderWidth: useBarChart ? 0 : 3,
                pointRadius: useBarChart ? 0 : 6,
                pointHoverRadius: useBarChart ? 0 : 8,
                pointBackgroundColor: '#002147',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                borderRadius: useBarChart ? 6 : 0,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function(context) {
                            return 'Revenue: ₱' + context.parsed.y.toLocaleString();
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: {
                        callback: function(value) {
                            return '₱' + value.toLocaleString();
                        }
                    }
                },
                x: { grid: { display: false } },
            },
        },
    });

    upsertOfficerAnalyticsChart('participation', 'participationChart', {
        type: 'bar',
        data: {
            labels: snapshot.charts.participation.labels,
            datasets: [{
                label: 'Participants',
                data: snapshot.charts.participation.values,
                backgroundColor: snapshot.charts.participation.values.map((value, index, arr) => {
                    if (!arr.length) return '#94a3b8';
                    const max = Math.max(...arr);
                    return value === max ? '#059669' : '#cbd5e1';
                }),
                borderRadius: 6,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } },
            },
        },
    });

    upsertOfficerAnalyticsChart('rentals', 'rentalsChart', {
        type: 'doughnut',
        data: {
            labels: snapshot.charts.rentals.labels,
            datasets: [{
                data: snapshot.charts.rentals.values,
                backgroundColor: ['#002147', '#d97706', '#dc2626'],
                borderWidth: 0,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            cutout: '70%',
        },
    });

    upsertOfficerAnalyticsChart('docs', 'docsChart', {
        type: 'pie',
        data: {
            labels: snapshot.charts.docs.labels,
            datasets: [{
                data: snapshot.charts.docs.values,
                backgroundColor: ['#059669', '#d97706', '#dc2626'],
                borderWidth: 0,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
        },
    });
}

function refreshAnalyticsCharts() {
    const snapshot = getOfficerAnalyticsSnapshot();
    officerAnalyticsState.snapshot = snapshot;
    updateOfficerAnalyticsCardText(snapshot);
    renderOfficerAnalyticsCharts(snapshot);
}

function getOfficerAnalyticsReportData(overrides = {}) {
    if (overrides && Object.keys(overrides).length > 0) {
        return getOfficerAnalyticsSnapshot(overrides);
    }
    if (!officerAnalyticsState.snapshot) {
        refreshAnalyticsCharts();
    }
    return officerAnalyticsState.snapshot;
}

function initializeOfficerAnalyticsYearOptions() {
    const select = document.getElementById('filter-year');
    if (!select) return;

    const source = getOfficerAnalyticsSourceData();
    const yearSet = new Set([getOfficerAnalyticsDefaultAcademicYear()]);

    const pushDate = (value) => {
        const parsed = parseOfficerAnalyticsDate(value);
        if (!parsed) return;
        const startYear = parsed.getMonth() >= 7 ? parsed.getFullYear() : parsed.getFullYear() - 1;
        yearSet.add(`${startYear}-${startYear + 1}`);
    };

    source.financial.forEach((item) => pushDate(item?.transaction_date || item?.transaction_datetime || item?.submitted_at));
    source.docs.forEach((item) => pushDate(item.submittedAt || item.date));
    source.rentals.forEach((item) => pushDate(item.dueAt || item.due));
    source.events.forEach((item) => pushDate(item.date));

    const years = Array.from(yearSet).sort((a, b) => b.localeCompare(a));
    const current = years.includes(select.value) ? select.value : getOfficerAnalyticsDefaultAcademicYear();
    select.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join('');
    select.value = current;
}

// --- MOCK DATA GENERATOR (for testing only - temporary) ---
function generateMockAnalyticsData() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const academicYear = now.getMonth() >= 7 ? currentYear : currentYear - 1;

    // Helper to generate random date in current academic year
    const randomDate = (monthsBack = 6) => {
        const date = new Date(academicYear, 7 + Math.floor(Math.random() * monthsBack), Math.floor(Math.random() * 28) + 1);
        return date.toISOString().split('T')[0];
    };

    // Generate 20-30 financial transactions
    const transactionCount = 20 + Math.floor(Math.random() * 11);
    const financial = [];
    for (let i = 0; i < transactionCount; i++) {
        const amount = 50 + Math.floor(Math.random() * 950); // 50-1000
        const isPaid = Math.random() > 0.2; // 80% paid
        financial.push({
            transaction_id: `mock-txn-${i}`,
            transaction_date: randomDate(8),
            total_cost: amount,
            payment_status: isPaid ? 'paid' : 'pending',
            service_name: ['Printing', 'Lamination', 'Document Request', 'Event Registration'][Math.floor(Math.random() * 4)]
        });
    }

    // Generate 8-12 events
    const eventCount = 8 + Math.floor(Math.random() * 5);
    const eventNames = ['General Assembly', 'Workshop', 'Seminar', 'Team Building', 'Fundraising', 'Sports Fest', 'Cultural Night', 'Career Fair'];
    const events = [];
    for (let i = 0; i < eventCount; i++) {
        events.push({
            id: `mock-event-${i}`,
            title: eventNames[i % eventNames.length] + ` ${Math.floor(i / eventNames.length) + 1}`,
            date: randomDate(8),
            venue: ['Auditorium', 'Gym', 'Quadrangle', 'Room 101'][Math.floor(Math.random() * 4)],
            participants: 20 + Math.floor(Math.random() * 180), // 20-200 participants
            status: 'published'
        });
    }

    // Generate 10-20 documents
    const docCount = 10 + Math.floor(Math.random() * 11);
    const docTypes = ['Budget Proposal', 'Activity Report', 'Permit Request', 'Equipment Request'];
    const docs = [];
    for (let i = 0; i < docCount; i++) {
        const statuses = ['approved', 'pending', 'pending', 'rejected']; // More pending
        docs.push({
            submission_id: `mock-doc-${i}`,
            document_type: docTypes[Math.floor(Math.random() * docTypes.length)],
            submittedAt: randomDate(6),
            status: statuses[Math.floor(Math.random() * statuses.length)]
        });
    }

    // Generate 15-25 rentals
    const rentalCount = 15 + Math.floor(Math.random() * 11);
    const rentalItems = ['Projector', 'Sound System', 'Tables', 'Chairs', 'Laptop', 'Microphone'];
    const rentals = [];
    for (let i = 0; i < rentalCount; i++) {
        const statuses = ['active', 'active', 'pending', 'overdue']; // More active
        rentals.push({
            rental_id: `mock-rental-${i}`,
            item_name: rentalItems[Math.floor(Math.random() * rentalItems.length)],
            dueAt: randomDate(2),
            status: statuses[Math.floor(Math.random() * statuses.length)]
        });
    }

    // Store mock data and refresh
    officerAnalyticsState.mockData = { financial, events, docs, rentals };

    // Toggle buttons
    const mockBtn = document.getElementById('mock-data-btn');
    const clearBtn = document.getElementById('clear-mock-btn');
    if (mockBtn) mockBtn.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'inline-flex';

    // Show notification
    if (typeof showToast === 'function') {
        showToast('Mock data generated! ' + transactionCount + ' transactions, ' + eventCount + ' events. Click "Clear Mock" to remove.', 'success');
    } else {
        alert('Mock data generated successfully!\n\n' +
              `${transactionCount} financial transactions\n` +
              `${eventCount} events\n` +
              `${docCount} documents\n` +
              `${rentalCount} rentals\n\n` +
              'Click "Clear Mock" button to remove mock data.');
    }

    // Refresh charts
    refreshAnalyticsCharts();
}

function clearMockAnalyticsData() {
    // Clear mock data
    officerAnalyticsState.mockData = null;

    // Toggle buttons
    const mockBtn = document.getElementById('mock-data-btn');
    const clearBtn = document.getElementById('clear-mock-btn');
    if (mockBtn) mockBtn.style.display = 'inline-flex';
    if (clearBtn) clearBtn.style.display = 'none';

    // Show notification
    if (typeof showToast === 'function') {
        showToast('Mock data cleared. Showing real data.', 'info');
    }

    // Refresh charts with real data
    refreshAnalyticsCharts();
}

document.addEventListener('DOMContentLoaded', () => {
    initializeOfficerAnalyticsYearOptions();
    refreshAnalyticsCharts();
    loadOfficerAnalyticsEvents();
});
