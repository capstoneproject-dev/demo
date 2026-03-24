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

function getOfficerAnalyticsFilters() {
    const academicYear = document.getElementById('filter-year')?.value || getOfficerAnalyticsDefaultAcademicYear();
    return {
        academicYear,
        yearRange: getOfficerAnalyticsAcademicYearRange(academicYear),
        mode: getOfficerAnalyticsDateMode(),
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

function getOfficerAnalyticsSnapshot() {
    const filters = getOfficerAnalyticsFilters();
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
    const topEvent = filteredEvents.reduce((best, event) => {
        if (!best || Number(event.participants || 0) > Number(best.participants || 0)) return event;
        return best;
    }, null);

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
    const revenueLabels = revenueSeries.map((item) => item.label);
    const revenueValues = revenueSeries.map((item) => Number(item.total.toFixed(2)));

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
            participation: topEvent
                ? `Top event: ${topEvent.title} (${Number(topEvent.participants || 0)} attendees)`
                : 'No event attendance data',
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
    const financialFooter = document.querySelector('.card-financial .mt-3');
    if (financialFooter) {
        const spans = financialFooter.querySelectorAll('span');
        if (spans[0]) {
            spans[0].innerHTML = `Total Revenue: <strong>${typeof formatOfficerPeso === 'function'
                ? formatOfficerPeso(snapshot.totals.revenue)
                : `PHP ${snapshot.totals.revenue.toFixed(2)}`}</strong>`;
        }
        if (spans[1]) {
            spans[1].innerHTML = snapshot.summaries.revenueTrend;
        }
    }

    const participationFooter = document.querySelector('.card-participation .mt-3');
    if (participationFooter) {
        const spans = participationFooter.querySelectorAll('span');
        if (spans[0]) {
            spans[0].innerHTML = `Avg Attendance: <strong>${snapshot.totals.participationAverage}</strong>`;
        }
        if (spans[1]) {
            spans[1].textContent = snapshot.summaries.participation;
        }
    }

    const activeFilter = document.getElementById('analytics-active-filter');
    if (activeFilter) activeFilter.textContent = snapshot.summaries.filterSummary;

    const rentalsLegend = document.getElementById('analytics-rentals-legend');
    if (rentalsLegend) {
        rentalsLegend.innerHTML = `
            <div style="margin-bottom: 8px;"><strong>${snapshot.counts.rentals.active}</strong> Active</div>
            <div style="margin-bottom: 8px; color: #d97706;"><strong>${snapshot.counts.rentals.pending}</strong> Pending</div>
            <div style="color: #dc2626;"><strong>${snapshot.counts.rentals.overdue}</strong> Overdue</div>
        `;
    }

    const docsLegend = document.getElementById('analytics-docs-legend');
    if (docsLegend) {
        docsLegend.innerHTML = `
            <ul style="list-style: none;">
                <li style="margin-bottom: 8px; display: flex; align-items: center;"><span
                        style="width: 10px; height: 10px; background: #059669; border-radius: 50%; margin-right: 8px;"></span>
                    Approved (${snapshot.counts.docs.approved})</li>
                <li style="margin-bottom: 8px; display: flex; align-items: center;"><span
                        style="width: 10px; height: 10px; background: #d97706; border-radius: 50%; margin-right: 8px;"></span>
                    Pending (${snapshot.counts.docs.pending})</li>
                <li style="display: flex; align-items: center;"><span
                        style="width: 10px; height: 10px; background: #dc2626; border-radius: 50%; margin-right: 8px;"></span>
                    Rejected (${snapshot.counts.docs.rejected})</li>
            </ul>
        `;
    }
}

function upsertOfficerAnalyticsChart(key, elementId, config) {
    const canvas = document.getElementById(elementId);
    if (!canvas || typeof Chart === 'undefined') return;

    if (officerAnalyticsState.charts[key]) {
        officerAnalyticsState.charts[key].data = config.data;
        officerAnalyticsState.charts[key].options = config.options;
        officerAnalyticsState.charts[key].update();
        return;
    }

    officerAnalyticsState.charts[key] = new Chart(canvas, config);
}

function renderOfficerAnalyticsCharts(snapshot) {
    upsertOfficerAnalyticsChart('revenue', 'revenueChart', {
        type: 'line',
        data: {
            labels: snapshot.charts.revenue.labels,
            datasets: [{
                label: 'Revenue',
                data: snapshot.charts.revenue.values,
                borderColor: '#002147',
                backgroundColor: 'rgba(0, 33, 71, 0.08)',
                fill: true,
                tension: 0.35,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { display: false },
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

function getOfficerAnalyticsReportData() {
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

document.addEventListener('DOMContentLoaded', () => {
    initializeOfficerAnalyticsYearOptions();
    refreshAnalyticsCharts();
    loadOfficerAnalyticsEvents();
});
