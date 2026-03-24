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
    liveAttendance: [],
    mockRetentionProfile: null,
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
    const range = typeof analyticsDateFilters !== 'undefined' ? analyticsDateFilters : { startDate: null, endDate: null };
    if (range.startDate || range.endDate) {
        return {
            type: 'range',
            startDate: range.startDate || null,
            endDate: range.endDate || null,
        };
    }
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

    if (filters.mode.type === 'range') {
        if (filters.mode.startDate) {
            const start = new Date(`${filters.mode.startDate}T00:00:00`);
            if (date < start) return false;
        }
        if (filters.mode.endDate) {
            const end = new Date(`${filters.mode.endDate}T23:59:59.999`);
            if (date > end) return false;
        }
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
        const [eventsRes, attendanceRes] = await Promise.all([
            fetch('../api/qr-attendance/events/list.php', { credentials: 'same-origin' }),
            fetch('../api/qr-attendance/attendance/list.php?limit=10000', { credentials: 'same-origin' }),
        ]);
        const eventsData = await eventsRes.json().catch(() => ({}));
        const attendanceData = await attendanceRes.json().catch(() => ({}));
        if (!eventsRes.ok || !eventsData.ok) {
            throw new Error(eventsData.error || `Events request failed (${eventsRes.status})`);
        }
        if (!attendanceRes.ok || !attendanceData.ok) {
            throw new Error(attendanceData.error || `Attendance request failed (${attendanceRes.status})`);
        }

        officerAnalyticsState.liveAttendance = Array.isArray(attendanceData.items)
            ? attendanceData.items.map((item) => ({
                record_id: item.record_id,
                event_id: item.event_id,
                event_name: item.event_name || '',
                student_number: String(item.student_number || '').trim(),
                student_name: String(item.student_name || '').trim(),
                attendance_date: item.attendance_date || item.time_in || '',
            }))
            : [];

        const attendeesByEventId = new Map();
        officerAnalyticsState.liveAttendance.forEach((record) => {
            const key = Number(record.event_id || 0);
            if (!key) return;
            if (!attendeesByEventId.has(key)) attendeesByEventId.set(key, []);
            attendeesByEventId.get(key).push(record);
        });

        officerAnalyticsState.liveEvents = Array.isArray(data.items)
            ? eventsData.items.map((item) => ({
                id: item.event_id,
                title: item.event_name || 'Event',
                date: item.event_datetime || item.event_date || item.created_at || '',
                venue: item.location || 'TBA',
                participants: Number(item.attendance_count || 0),
                status: Number(item.is_published || 0) ? 'published' : 'draft',
                attendees: attendeesByEventId.get(Number(item.event_id || 0)) || [],
            }))
            : [];
    } catch (error) {
        console.error('loadOfficerAnalyticsEvents failed', error);
        officerAnalyticsState.liveEvents = [];
        officerAnalyticsState.liveAttendance = [];
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

function getOfficerAnalyticsRevenueGrowthBreakdown(financialRows, filters) {
    const scopedRows = financialRows.filter((item) => {
        const date = parseOfficerAnalyticsDate(
            item?.transaction_date || item?.transaction_datetime || item?.submitted_at
        );
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;

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

        if (filters.yearRange.start && date < filters.yearRange.start) return false;
        if (filters.yearRange.end && date > filters.yearRange.end) return false;
        return true;
    });

    const paidRows = scopedRows.filter((item) => String(item.payment_status || '').toLowerCase() === 'paid');
    const latestDate = paidRows.reduce((latest, item) => {
        const date = parseOfficerAnalyticsDate(
            item?.transaction_date || item?.transaction_datetime || item?.submitted_at
        );
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return latest;
        return !latest || date > latest ? date : latest;
    }, null);

    const anchorDate = latestDate || new Date();
    anchorDate.setHours(23, 59, 59, 999);

    const sumRange = (start, end) => paidRows.reduce((sum, item) => {
        const date = parseOfficerAnalyticsDate(
            item?.transaction_date || item?.transaction_datetime || item?.submitted_at
        );
        if (!date || date < start || date > end) return sum;
        return sum + Number(item.total_cost || 0);
    }, 0);

    const buildGrowth = (days, label) => {
        const currentEnd = new Date(anchorDate);
        const currentStart = new Date(anchorDate);
        currentStart.setDate(currentStart.getDate() - (days - 1));
        currentStart.setHours(0, 0, 0, 0);

        const previousEnd = new Date(currentStart);
        previousEnd.setMilliseconds(-1);
        const previousStart = new Date(previousEnd);
        previousStart.setDate(previousStart.getDate() - (days - 1));
        previousStart.setHours(0, 0, 0, 0);

        const currentTotal = sumRange(currentStart, currentEnd);
        const previousTotal = sumRange(previousStart, previousEnd);
        const delta = previousTotal > 0
            ? ((currentTotal - previousTotal) / previousTotal) * 100
            : (currentTotal > 0 ? 100 : 0);

        return {
            label,
            value: delta,
            currentTotal,
            previousTotal,
        };
    };

    return [
        buildGrowth(7, 'vs last week'),
        buildGrowth(30, 'vs last month'),
        buildGrowth(365, 'vs last year'),
    ];
}

function formatOfficerAnalyticsRevenueTrend(growthBreakdown) {
    return (growthBreakdown || []).map((item) => {
        const sign = item.value > 0 ? '+' : '';
        return `${sign}${item.value.toFixed(1)}% ${item.label}`;
    }).join(' | ');
}

function getOfficerAnalyticsRetentionLevel(events) {
    if (!Array.isArray(events) || !events.length) return 'Low';

    const chronological = events
        .slice()
        .sort((a, b) => (parseOfficerAnalyticsDate(a.date)?.getTime() || 0) - (parseOfficerAnalyticsDate(b.date)?.getTime() || 0))
        .map((event) => {
            const attendeeKeys = Array.isArray(event.attendees)
                ? event.attendees
                    .map((attendee) => String(attendee.student_number || attendee.student_id || attendee.user_id || attendee.student_name || '').trim())
                    .filter(Boolean)
                : [];
            return {
                ...event,
                attendeeKeys: Array.from(new Set(attendeeKeys)),
            };
        })
        .filter((event) => event.attendeeKeys.length > 0);

    if (chronological.length < 2) return 'Low';

    let overlapSum = 0;
    let overlapCount = 0;
    for (let index = 1; index < chronological.length; index += 1) {
        const previous = new Set(chronological[index - 1].attendeeKeys);
        const current = chronological[index].attendeeKeys;
        if (!previous.size || !current.length) continue;
        const repeatedCount = current.filter((key) => previous.has(key)).length;
        overlapSum += repeatedCount / Math.max(previous.size, 1);
        overlapCount += 1;
    }

    const attendeeFrequency = new Map();
    chronological.forEach((event) => {
        event.attendeeKeys.forEach((key) => {
            attendeeFrequency.set(key, (attendeeFrequency.get(key) || 0) + 1);
        });
    });

    const uniqueAttendees = attendeeFrequency.size;
    const repeatingAttendees = Array.from(attendeeFrequency.values()).filter((count) => count >= 2).length;
    const repeatRate = uniqueAttendees > 0 ? repeatingAttendees / uniqueAttendees : 0;
    const averageOverlap = overlapCount > 0 ? overlapSum / overlapCount : 0;

    if (repeatRate >= 0.72 && averageOverlap >= 0.58) return 'High';
    if (repeatRate >= 0.38 && averageOverlap >= 0.3) return 'Medium';
    return 'Low';
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

    const revenueGrowthBreakdown = getOfficerAnalyticsRevenueGrowthBreakdown(source.financial, filters);
    const revenueTrend = formatOfficerAnalyticsRevenueTrend(revenueGrowthBreakdown);

    const participationTotal = filteredEvents.reduce((sum, event) => sum + Number(event.participants || 0), 0);
    const participationAverage = filteredEvents.length ? Math.round(participationTotal / filteredEvents.length) : 0;

    const retentionLevel = getOfficerAnalyticsRetentionLevel(filteredEvents);

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
        if (filters.mode.type === 'range') {
            if (filters.mode.startDate && !filters.mode.endDate) {
                return `Showing analytics for ${new Date(`${filters.mode.startDate}T00:00:00`).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                })} (${filters.academicYear}).`;
            }
            const start = filters.mode.startDate
                ? new Date(`${filters.mode.startDate}T00:00:00`).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                })
                : '...';
            const end = filters.mode.endDate
                ? new Date(`${filters.mode.endDate}T00:00:00`).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                })
                : '...';
            return `Showing analytics from ${start} to ${end} (${filters.academicYear}).`;
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
            revenueGrowthBreakdown,
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
            const growthItems = Array.isArray(snapshot.summaries.revenueGrowthBreakdown)
                ? snapshot.summaries.revenueGrowthBreakdown
                : [];
            statValues[1].className = 'stat-value';
            statValues[1].innerHTML = growthItems.map((item) => {
                const icon = item.value >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
                const color = item.value >= 0 ? '#059669' : '#dc2626';
                const sign = item.value > 0 ? '+' : '';
                return `
                    <div style="display:flex; flex-direction:column; align-items:center; line-height:1.15; margin-bottom:6px;">
                        <span style="color:${color}; font-weight:700;"><i class="fa-solid ${icon}"></i> ${sign}${item.value.toFixed(1)}%</span>
                        <span style="font-size:0.72rem; font-weight:500; color:var(--muted); margin-top:4px;">
                            ${item.label}
                        </span>
                    </div>
                `;
            }).join('');
        }
    }

    // Update Participation Trends Card
    const participationFooter = document.querySelector('.card-participation .analytics-stats-footer');
    if (participationFooter) {
        const statValues = participationFooter.querySelectorAll('.stat-value');
        if (statValues[0]) {
            statValues[0].innerHTML = `<i class="fa-solid fa-users"></i> ${snapshot.totals.participationAverage}`;
        }
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
    const studentFirstNames = ['Aira', 'Miguel', 'Sofia', 'Liam', 'Nicole', 'Daniel', 'Kyla', 'Ethan', 'Pat', 'Rica', 'Paolo', 'Andrea'];
    const studentLastNames = ['Santos', 'Reyes', 'Cruz', 'Garcia', 'Mendoza', 'Flores', 'Castro', 'Torres', 'Navarro', 'Gonzales'];
    const orgNames = ['Computer Society', 'Junior Finance Execs', 'Aviation Circle', 'Debate Guild', 'Media Arts Club'];
    const serviceTypes = ['printing', 'lamination', 'document_request', 'event_registration'];
    const printingItems = ['Poster Printing', 'Certificate Printing', 'ID Reprint', 'Flyer Batch'];
    const docTypes = ['Budget Proposal', 'Activity Report', 'Permit Request', 'Equipment Request'];
    const eventConfigs = [
        { title: 'General Assembly', base: 125 },
        { title: 'Leadership Workshop', base: 92 },
        { title: 'Org Seminar', base: 76 },
        { title: 'Volunteer Drive', base: 58 },
        { title: 'Fundraising Booth', base: 49 },
        { title: 'Career Fair', base: 101 },
        { title: 'Team Building', base: 68 },
        { title: 'Sports Fest', base: 140 },
        { title: 'Cultural Night', base: 155 },
    ];
    const venues = ['Auditorium', 'Gymnasium', 'Quadrangle', 'Room 101', 'Covered Court', 'Innovation Hub'];
    const rentalItems = [
        { item: 'Projector', category: 'AV Equipment' },
        { item: 'Sound System', category: 'AV Equipment' },
        { item: 'Folding Tables', category: 'Furniture' },
        { item: 'Plastic Chairs', category: 'Furniture' },
        { item: 'Laptop', category: 'IT Equipment' },
        { item: 'Microphone Set', category: 'AV Equipment' },
        { item: 'Extension Cords', category: 'Utilities' },
        { item: 'Backdrop Stand', category: 'Event Setup' },
    ];

    const pad = (value) => String(value).padStart(2, '0');
    const toIsoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const toIsoDateTime = (date, hour = 9, minute = 0) => {
        const dt = new Date(date);
        dt.setHours(hour, minute, 0, 0);
        return `${toIsoDate(dt)}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`;
    };
    const pick = (values) => values[Math.floor(Math.random() * values.length)];
    const randomName = () => `${pick(studentFirstNames)} ${pick(studentLastNames)}`;
    const randomStudentId = (index) => `202${Math.floor(Math.random() * 4) + 2}-${pad((index % 90) + 10)}${pad(Math.floor(Math.random() * 90) + 10)}`;
    const randomPhone = () => `09${Math.floor(100000000 + Math.random() * 900000000)}`;
    const retentionProfiles = [
        { label: 'Low', carryMin: 0.04, carryMax: 0.18 },
        { label: 'Medium', carryMin: 0.22, carryMax: 0.42 },
        { label: 'High', carryMin: 0.5, carryMax: 0.78 },
    ];
    const mockRetentionProfile = pick(retentionProfiles);
    const mockStudents = Array.from({ length: 180 }, (_, index) => {
        const name = randomName();
        return {
            user_id: 5000 + index,
            student_number: `202${Math.floor(index / 45) + 2}-${pad((index % 90) + 10)}${pad((index * 3) % 90 + 10)}`,
            student_name: name,
            section: `BSIT-${1 + (index % 4)}${String.fromCharCode(65 + (index % 3))}`,
        };
    });

    // Helper to generate random date in current academic year
    const randomDate = (monthsBack = 6) => {
        const date = new Date(academicYear, 7 + Math.floor(Math.random() * monthsBack), Math.floor(Math.random() * 28) + 1);
        return date.toISOString().split('T')[0];
    };

    const randomDateObject = (monthsBack = 6) => new Date(`${randomDate(monthsBack)}T00:00:00`);

    // Generate 20-30 financial transactions
    const transactionCount = 20 + Math.floor(Math.random() * 11);
    const financial = [];
    for (let i = 0; i < transactionCount; i++) {
        const amount = 50 + Math.floor(Math.random() * 950); // 50-1000
        const isPaid = Math.random() > 0.2; // 80% paid
        const serviceType = pick(serviceTypes);
        const customerName = randomName();
        const transactionDate = randomDateObject(8);
        const quantity = 1 + Math.floor(Math.random() * 5);
        const itemLabel = serviceType === 'printing'
            ? pick(printingItems)
            : (serviceType === 'lamination'
                ? `Document Lamination ${String.fromCharCode(65 + (i % 3))}`
                : (serviceType === 'document_request'
                    ? pick(docTypes)
                    : `Event Ticket Batch ${1 + (i % 4)}`));
        financial.push({
            transaction_id: `mock-txn-${i}`,
            transaction_date: toIsoDate(transactionDate),
            transaction_datetime: toIsoDateTime(transactionDate, 8 + (i % 8), (i * 7) % 60),
            submitted_at: toIsoDateTime(transactionDate, 8 + (i % 8), (i * 7) % 60),
            total_cost: amount,
            payment_status: isPaid ? 'paid' : 'pending',
            service_type: serviceType,
            service_name: serviceType.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
            item_label: itemLabel,
            customer_name: customerName,
            customer_identifier: randomStudentId(i),
            quantity,
            unit_price: Number((amount / quantity).toFixed(2)),
            reference_no: `OR-${academicYear}-${1000 + i}`,
            notes: isPaid ? 'Paid at cashier' : 'Awaiting payment verification',
            org_name: pick(orgNames),
        });
    }

    // Generate 8-12 events
    const eventCount = 8 + Math.floor(Math.random() * 5);
    const events = [];
    let eventAttendanceBase = 55 + Math.floor(Math.random() * 45);
    let previousEventAttendees = [];
    for (let i = 0; i < eventCount; i++) {
        const config = eventConfigs[i % eventConfigs.length];
        const eventDate = randomDateObject(8);
        const attendanceDrift = Math.floor((Math.random() - 0.5) * 40);
        const participationSeed = config.base + attendanceDrift + Math.floor((eventAttendanceBase - config.base) * 0.35);
        const participants = Math.max(18, Math.min(220, participationSeed));
        eventAttendanceBase = Math.round((eventAttendanceBase * 0.55) + (participants * 0.45));
        const title = `${config.title} ${Math.floor(i / eventConfigs.length) + 1}`;
        const carryOverRatio = mockRetentionProfile.carryMin
            + Math.random() * (mockRetentionProfile.carryMax - mockRetentionProfile.carryMin);
        const retainedCount = Math.min(previousEventAttendees.length, Math.round(participants * carryOverRatio));
        const retainedStudents = previousEventAttendees
            .slice()
            .sort(() => Math.random() - 0.5)
            .slice(0, retainedCount);
        const retainedKeys = new Set(retainedStudents.map((student) => student.student_number));
        const freshStudents = mockStudents
            .filter((student) => !retainedKeys.has(student.student_number))
            .slice()
            .sort(() => Math.random() - 0.5)
            .slice(0, Math.max(0, participants - retainedStudents.length));
        const eventAttendees = retainedStudents.concat(freshStudents).slice(0, participants);
        previousEventAttendees = eventAttendees;
        events.push({
            id: `mock-event-${i}`,
            event_id: `mock-event-${i}`,
            title,
            event_name: title,
            date: toIsoDate(eventDate),
            event_datetime: toIsoDateTime(eventDate, 9 + (i % 6), 0),
            venue: pick(venues),
            location: pick(venues),
            participants,
            attendance_count: participants,
            status: 'published',
            is_published: 1,
            description: `${title} mock event for analytics simulation.`,
            attendees: eventAttendees.map((student, attendeeIndex) => ({
                record_id: `mock-att-${i}-${attendeeIndex}`,
                event_id: `mock-event-${i}`,
                event_name: title,
                user_id: student.user_id,
                student_number: student.student_number,
                student_name: student.student_name,
                section: student.section,
                time_in: toIsoDateTime(eventDate, 8 + (attendeeIndex % 4), attendeeIndex % 60),
                attendance_date: toIsoDate(eventDate),
            })),
        });
    }

    // Generate 10-20 documents
    const docCount = 10 + Math.floor(Math.random() * 11);
    const docs = [];
    for (let i = 0; i < docCount; i++) {
        const statuses = ['approved', 'pending', 'pending', 'rejected']; // More pending
        const submitter = randomName();
        const docDate = randomDateObject(6);
        const docType = pick(docTypes);
        const title = `${docType} ${i + 1}`;
        docs.push({
            submission_id: `mock-doc-${i}`,
            id: `mock-doc-${i}`,
            title,
            type: docType,
            document_type: docType,
            recipient: Math.random() > 0.5 ? 'OSA' : 'SSC',
            submittedAt: toIsoDateTime(docDate, 10 + (i % 5), 15),
            submitted_at: toIsoDateTime(docDate, 10 + (i % 5), 15),
            date: toIsoDate(docDate),
            status: pick(statuses),
            description: `${title} generated for mock workflow simulation.`,
            submitted_by: submitter,
            sender: submitter,
            academic_year: `${academicYear}-${academicYear + 1}`,
            semester: docDate.getMonth() >= 7 && docDate.getMonth() <= 11 ? '1st' : '2nd',
        });
    }

    // Generate 15-25 rentals
    const rentalCount = 15 + Math.floor(Math.random() * 11);
    const rentals = [];
    for (let i = 0; i < rentalCount; i++) {
        const statuses = ['active', 'active', 'pending', 'overdue']; // More active
        const rentalConfig = pick(rentalItems);
        const borrowerName = randomName();
        const borrowDate = randomDateObject(2);
        const dueDate = new Date(borrowDate);
        dueDate.setDate(dueDate.getDate() + 2 + Math.floor(Math.random() * 12));
        const status = pick(statuses);
        rentals.push({
            rental_id: `mock-rental-${i}`,
            id: `mock-rental-${i}`,
            item: rentalConfig.item,
            item_name: rentalConfig.item,
            renter: borrowerName,
            renter_name: borrowerName,
            borrower_name: borrowerName,
            borrower_id: randomStudentId(i),
            borrower_contact: randomPhone(),
            category: rentalConfig.category,
            quantity: 1 + Math.floor(Math.random() * 3),
            dateBorrowed: toIsoDate(borrowDate),
            borrowed_at: toIsoDateTime(borrowDate, 9 + (i % 4), 30),
            due: toIsoDate(dueDate),
            dueAt: toIsoDateTime(dueDate, 17, 0),
            expected_return_time: toIsoDateTime(dueDate, 17, 0),
            status,
            condition: status === 'overdue' ? 'Needs follow-up' : 'Good',
            notes: status === 'pending' ? 'Awaiting approval from custodian' : 'Mock rental record',
        });
    }

    // Store mock data and refresh
    officerAnalyticsState.mockData = { financial, events, docs, rentals };
    officerAnalyticsState.mockRetentionProfile = mockRetentionProfile.label;

    // Toggle buttons
    const mockBtn = document.getElementById('mock-data-btn');
    const clearBtn = document.getElementById('clear-mock-btn');
    if (mockBtn) mockBtn.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'inline-flex';

    // Show notification
    if (typeof showToast === 'function') {
        showToast(`Mock data generated (${mockRetentionProfile.label} retention profile)! ${transactionCount} transactions, ${eventCount} events. Click "Clear Mock" to remove.`, 'success');
    } else {
        alert('Mock data generated successfully!\n\n' +
              `Retention profile: ${mockRetentionProfile.label}\n` +
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
    officerAnalyticsState.mockRetentionProfile = null;

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
