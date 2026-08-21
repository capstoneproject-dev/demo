<?php
require_once __DIR__ . '/../../includes/auth.php';
$session = guardSession('../login.html');
if (($session['login_role'] ?? '') !== 'org' || empty($session['active_org_id'])) {
    header('Location: ../login.html');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <script src="../../assets/js/app-dialog.js?v=20260821-white-panel"></script>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Events - QR Attendance System</title>
    <link href="../../systems/QR-Attendance/lib/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../../systems/QR-Attendance/lib/styles.css?v=20260821-archive-reset-compact">
</head>

<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top custom-navbar">
        <div class="container">
            <a class="navbar-brand d-flex align-items-center" href="../homepage/index.html">
            </a>

            <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav">
                <span class="navbar-toggler-icon"></span>
            </button>

            <div class="collapse navbar-collapse" id="mainNav">

                <ul class="navbar-nav ms-auto mb-2 mb-lg-0 nav-pills-custom">
                    <li class="nav-item">
                        <a class="nav-link" href="../shared/student-database.php?context=qr-attendance&amp;return=..%2Fqr-attendance%2Fevents.php">Database</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <div class="container main-content">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1 class="mb-0">Events Overview</h1>
            <div>
                <button type="button" class="btn btn-primary me-2" id="openCreateEventModal">Create New Event</button>
                <a href="index.php" class="btn btn-warning">Back to Scanner</a>
            </div>
        </div>

        <div class="event-view-tabs sub-view-nav mb-3" role="tablist" aria-label="Event views">
            <button type="button" class="sub-nav-btn active" id="activeEventsTab" data-event-view="active">
                <i class="fa-solid fa-calendar-check"></i> Active Events
            </button>
            <button type="button" class="sub-nav-btn" id="archivedEventsTab" data-event-view="archived">
                <i class="fa-solid fa-box-archive"></i> Archived Events
            </button>
        </div>

        <!-- Events List -->
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h2 class="h5 mb-0" id="eventsListTitle">Active Events</h2>
                <div>
                    <input type="text" id="eventSearchInput" class="form-control form-control-sm me-2"
                        placeholder="Search events..." style="display:inline-block; width:auto; min-width:200px;">
                    <button id="exportAllEvents" class="btn btn-success btn-sm me-2">Export All Events</button>
                    <button id="importEvents" class="btn btn-primary btn-sm">Import Events</button>
                    <input type="file" id="importFile" accept=".xlsx" style="display: none;">
                </div>
            </div>
            <div id="archiveEventFilterBar" class="repo-filter-bar" style="display:none;">
                <div class="repo-filter-group">
                    <label for="archiveSemesterFilter">Semester:</label>
                    <select id="archiveSemesterFilter" onchange="setArchiveTermFilter('semester', this.value)">
                        <option value="1st">1st Semester</option>
                        <option value="2nd">2nd Semester</option>
                    </select>
                </div>

                <div class="repo-filter-group">
                    <label for="archivePeriodFilter">Term:</label>
                    <select id="archivePeriodFilter" onchange="setArchiveTermFilter('grading_period', this.value)">
                        <option value="prelim">Prelim</option>
                        <option value="midterm">Midterm</option>
                        <option value="finals">Finals</option>
                    </select>
                </div>

                <div class="repo-filter-group">
                    <label for="archiveAcademicYearFilter">School Year:</label>
                    <select id="archiveAcademicYearFilter" onchange="setArchiveTermFilter('academic_year', this.value)">
                    </select>
                </div>

                <button type="button" class="date-range-btn" id="archiveDateRangeBtn" onclick="openArchiveDatePicker()">
                    <i class="fa-solid fa-calendar-days"></i>
                    <span id="archiveDateRangeLabel">Select Date Range</span>
                </button>

                <button type="button" class="btn btn-sm btn-outline-primary" onclick="resetArchiveEventFilters()">
                    <i class="fa-solid fa-rotate-left"></i> Reset
                </button>
            </div>

            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Event Name</th>
                                <th>Total Attendance</th>
                                <th>Pre Registered</th>
                                <th>First Record</th>
                                <th>Last Record</th>
                                <th class="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="eventsList">
                            <!-- Events will be populated here -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Archived Events Date Picker Modal -->
        <div id="archive-date-picker-modal" class="date-picker-modal" role="dialog" aria-modal="true" aria-labelledby="archive-date-picker-title">
            <div class="date-picker-content">
                <div class="date-picker-header">
                    <h3 id="archive-date-picker-title">Select Date Range</h3>
                    <button type="button" class="close-modal" onclick="closeArchiveDatePicker()" aria-label="Close">&times;</button>
                </div>
                <div class="date-picker-body">
                    <div class="calendar-nav">
                        <button type="button" onclick="changeArchiveCalendarMonth(-1)" aria-label="Previous month"><i class="fa-solid fa-chevron-left"></i></button>
                        <span class="calendar-month-year" id="archive-calendar-month-year"></span>
                        <button type="button" onclick="changeArchiveCalendarMonth(1)" aria-label="Next month"><i class="fa-solid fa-chevron-right"></i></button>
                    </div>

                    <div class="calendar-grid">
                        <div class="calendar-weekdays">
                            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                        </div>
                        <div class="calendar-dates" id="archive-calendar-grid"></div>
                    </div>

                    <div class="date-range-display">
                        <div class="date-range-item">
                            <label>From</label>
                            <span id="archive-date-from-display">Select Date</span>
                        </div>
                        <div class="date-range-item">
                            <label>To</label>
                            <span id="archive-date-to-display">Select Date</span>
                        </div>
                    </div>
                </div>
                <div class="date-picker-footer">
                    <button type="button" class="btn btn-outline-primary" onclick="clearArchiveDateRangeSelection()">Clear</button>
                    <button type="button" class="btn btn-primary" onclick="applyArchiveDateRange()">Apply</button>
                </div>
            </div>
        </div>

        <!-- Event Details Modal -->
        <div class="modal fade" id="eventDetailsModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Event Details</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <div>
                                    <h6 id="modalEventName" class="mb-1"></h6>
                                    <span class="badge text-dark" id="modalPreRegisteredCount" style="background-color: #bfe9ff;">Pre Registered: 0</span>
                                </div>
                                <button class="btn btn-primary btn-sm" id="startEventAttendance">Start
                                    Attendance</button>
                            </div>
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Student#</th>
                                            <th>Name</th>
                                            <th>Section</th>
                                            <th>Date</th>
                                            <th>Time-in</th>
                                            <th>Time-out</th>
                                        </tr>
                                    </thead>
                                    <tbody id="modalEventRecords">
                                        <!-- Event records will be populated here -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" id="importEventDetails">Import Event Data</button>
                        <button type="button" class="btn btn-success" id="exportEventDetails">Export Event Data</button>
                        <input type="file" id="importEventFile" accept=".xlsx" style="display:none;">
                    </div>
                </div>
            </div>
        </div>

        <!-- Create Event Modal -->
        <div class="modal fade" id="createEventModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <form id="createEventForm">
                        <div class="modal-header">
                            <h5 class="modal-title">Create New Event</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label for="newEventNameInput" class="form-label">Event Name</label>
                                <input type="text" class="form-control" id="newEventNameInput" maxlength="100"
                                    placeholder="Enter event name" required>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="submit" class="btn btn-primary">Create Event</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script src="../../systems/QR-Attendance/lib/bootstrap.bundle.min.js"></script>
    <script src="../../systems/QR-Attendance/lib/xlsx.full.min.js"></script>
    <script>
        // Hybrid source: events from PHP API, attendance still localStorage (temporary)
        const QR_API_BASE = '../../api/qr-attendance';
        let attendanceRecords = [];
        let events = [];
        let archivedEvents = [];
        let currentEventDetails = null;
        let currentEventsView = 'active';
        let activeAcademicTerm = {
            academic_year: '2026-2027',
            semester: '1st',
            grading_period: 'prelim'
        };
        let archiveEventTermFilter = { ...activeAcademicTerm };
        let archiveEventDateFilter = { from: null, to: null };
        let archiveSelectedFromDate = null;
        let archiveSelectedToDate = null;
        let archiveCalendarCurrentMonth = new Date().getMonth();
        let archiveCalendarCurrentYear = new Date().getFullYear();

        // Helper function to normalize event names for consistent matching
        function normalizeEventName(name) {
            if (!name) return '';
            return String(name).trim();
        }

        function mapApiEvent(row) {
            return {
                id: row.event_id,
                name: row.event_name,
                description: row.description || '',
                status: row.archived_at ? 'archived' : 'active',
                createdAt: row.created_at || '',
                eventDateTime: row.event_datetime || '',
                academicYear: row.academic_year || '',
                semester: row.semester || '',
                gradingPeriod: row.grading_period || '',
                firstDate: row.first_record_date || null,
                lastDate: row.last_record_date || null,
                archiveStartDate: row.archive_start_date || row.event_datetime || null,
                archiveEndDate: row.archive_end_date || row.event_datetime || null,
                archivedAt: row.archived_at || null,
                archivedByUserId: row.archived_by_user_id || null,
                attendanceCount: Number(row.attended_count ?? row.attendance_count ?? 0),
                preRegisteredCount: Number(row.pre_registered_count || 0),
                records: []
            };
        }

        function isPreRegisteredRecord(record) {
            const status = String(record.status || record.attendance_status || '').trim();
            return Boolean(record.isRegistered) || status === 'registered' || (!record.timeIn && !record.timeOut);
        }

        function getEventPreRegisteredCount(eventName, records = []) {
            const normalizedTargetName = normalizeEventName(eventName);
            const apiEvent = [...events, ...archivedEvents].find(event => normalizeEventName(event.name || event.event_name) === normalizedTargetName);
            if (apiEvent) {
                return Number(apiEvent.preRegisteredCount ?? apiEvent.pre_registered_count ?? 0);
            }
            return records.filter(isPreRegisteredRecord).length;
        }

        async function qrApiRequest(path, options = {}) {
            const response = await fetch(QR_API_BASE + path, {
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                ...options
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.ok) {
                throw new Error(payload.error || `Request failed (${response.status})`);
            }
            return payload;
        }

        async function loadEventsFromApi() {
            // Load sequentially so the active request can safely apply the one-time
            // archive schema migration before the archived query runs.
            const activePayload = await qrApiRequest('/events/list.php?state=active', { method: 'GET' });
            const archivedPayload = await qrApiRequest('/events/list.php?state=archived', { method: 'GET' });
            events = (activePayload.items || []).map(mapApiEvent);
            archivedEvents = (archivedPayload.items || []).map(mapApiEvent);
            return [...events, ...archivedEvents];
        }

        async function loadActiveAcademicTerm() {
            const response = await fetch('../../api/settings/academic-term.php', {
                method: 'GET',
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json' }
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.ok || !payload.term) {
                throw new Error(payload.error || 'Unable to load the active academic term.');
            }
            activeAcademicTerm = {
                academic_year: String(payload.term.academic_year || activeAcademicTerm.academic_year),
                semester: String(payload.term.semester || activeAcademicTerm.semester),
                grading_period: String(payload.term.grading_period || activeAcademicTerm.grading_period).toLowerCase()
            };
            archiveEventTermFilter = { ...activeAcademicTerm };
        }

        // Initialize data
        async function initializeLocalData() {
            attendanceRecords = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
            try {
                await loadActiveAcademicTerm();
            } catch (error) {
                console.warn('Unable to load the OSA academic term; using the configured fallback.', error);
            }
            try {
                await loadEventsFromApi();
            } catch (error) {
                console.warn('Unable to load events from API, falling back to localStorage.', error);
                const localEvents = JSON.parse(localStorage.getItem('events')) || [];
                const mappedLocalEvents = localEvents.map(event => ({
                    id: event.id || null,
                    name: event.name || event.eventName || '',
                    description: event.description || '',
                    status: event.status || 'active',
                    createdAt: event.createdAt || '',
                    firstDate: event.firstDate || null,
                    lastDate: event.lastDate || null,
                    eventDateTime: event.eventDateTime || event.event_datetime || event.createdAt || '',
                    academicYear: event.academicYear || event.academic_year || activeAcademicTerm.academic_year,
                    semester: event.semester || activeAcademicTerm.semester,
                    gradingPeriod: event.gradingPeriod || event.grading_period || activeAcademicTerm.grading_period,
                    archiveStartDate: event.firstDate || event.eventDateTime || event.createdAt || null,
                    archiveEndDate: event.lastDate || event.eventDateTime || event.createdAt || null,
                    archivedAt: event.archivedAt || event.archived_at || null,
                    records: []
                }));
                events = mappedLocalEvents.filter(event => !event.archivedAt && event.status !== 'archived');
                archivedEvents = mappedLocalEvents.filter(event => event.archivedAt || event.status === 'archived');
            }
        }

        // Update offline status indicator (make it globally accessible)
        window.updateOfflineStatus = function () {
            const offlineStatusEl = document.getElementById('offlineStatus');
            const pendingSyncCountEl = document.getElementById('pendingSyncCount');

            if (!offlineStatusEl || !window.offlineSync) return;

            const isOnline = window.offlineSync.isOnline;
            const pendingCount = window.offlineSync.getPendingSyncCount();

            if (!isOnline) {
                offlineStatusEl.textContent = 'Ã¢â€”Â Offline';
                offlineStatusEl.className = 'badge bg-danger me-2';
                offlineStatusEl.style.display = 'inline-block';
            } else {
                offlineStatusEl.textContent = 'Ã¢â€”Â Online';
                offlineStatusEl.className = 'badge bg-success me-2';
                offlineStatusEl.style.display = 'inline-block';
            }

            if (pendingCount > 0) {
                pendingSyncCountEl.textContent = `${pendingCount} pending`;
                pendingSyncCountEl.style.display = 'inline-block';
            } else {
                pendingSyncCountEl.style.display = 'none';
            }
        };

        // Listen for offline status changes
        window.addEventListener('offlineStatusChanged', function (event) {
            if (typeof updateOfflineStatus === 'function') {
                updateOfflineStatus();
            }
        });

        // Initialize the page
        document.addEventListener('DOMContentLoaded', async function () {
            await initializeLocalData();
            attendanceRecords = JSON.parse(localStorage.getItem('attendanceRecords')) || [];

            // Update offline status indicator
            updateOfflineStatus();
            // Update every 5 seconds
            setInterval(updateOfflineStatus, 5000);

            updateEventsList();
            // Add search functionality
            document.getElementById('eventSearchInput').addEventListener('input', function () {
                updateEventsList();
            });
            document.querySelectorAll('[data-event-view]').forEach(button => {
                button.addEventListener('click', () => switchEventsView(button.dataset.eventView));
            });
            document.getElementById('archive-date-picker-modal')?.addEventListener('click', event => {
                if (event.target.id === 'archive-date-picker-modal') closeArchiveDatePicker();
            });
        });

        // Update events list
        function escapeEventHtml(value) {
            const div = document.createElement('div');
            div.textContent = String(value ?? '');
            return div.innerHTML;
        }

        function eventSortTimestamp(value) {
            const timestamp = new Date(value || 0).getTime();
            return Number.isNaN(timestamp) ? 0 : timestamp;
        }

        function parseArchiveEventDate(value) {
            const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (!match) return null;
            const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
            return Number.isNaN(date.getTime()) ? null : date;
        }

        function getArchiveEventFilterDate(event) {
            return parseArchiveEventDate(event.firstDate || event.archiveStartDate || event.eventDateTime);
        }

        function renderArchiveEventFilters(sourceEvents) {
            const filterBar = document.getElementById('archiveEventFilterBar');
            const semesterSelect = document.getElementById('archiveSemesterFilter');
            const periodSelect = document.getElementById('archivePeriodFilter');
            const yearSelect = document.getElementById('archiveAcademicYearFilter');
            if (!filterBar || !semesterSelect || !periodSelect || !yearSelect) return;
            if (currentEventsView !== 'archived') {
                filterBar.style.display = 'none';
                return;
            }

            const years = Array.from(new Set([
                activeAcademicTerm.academic_year,
                ...sourceEvents.map(event => event.academicYear).filter(Boolean)
            ])).sort().reverse();
            filterBar.style.display = 'flex';
            yearSelect.innerHTML = years
                .map(year => `<option value="${escapeEventHtml(year)}">${escapeEventHtml(year)}</option>`)
                .join('');
            semesterSelect.value = archiveEventTermFilter.semester;
            periodSelect.value = archiveEventTermFilter.grading_period;
            yearSelect.value = archiveEventTermFilter.academic_year;
            syncArchiveDateRangeButton();
        }

        function setArchiveTermFilter(field, value) {
            if (!['academic_year', 'semester', 'grading_period'].includes(field)) return;
            archiveEventTermFilter[field] = String(value || '').trim();
            updateEventsList();
        }

        function openArchiveDatePicker() {
            archiveSelectedFromDate = archiveEventDateFilter.from
                ? new Date(archiveEventDateFilter.from.getTime())
                : null;
            archiveSelectedToDate = archiveEventDateFilter.to
                ? new Date(archiveEventDateFilter.to.getTime())
                : null;
            const calendarAnchor = archiveSelectedFromDate || new Date();
            archiveCalendarCurrentMonth = calendarAnchor.getMonth();
            archiveCalendarCurrentYear = calendarAnchor.getFullYear();
            updateArchiveDateRangeDisplay();
            renderArchiveCalendar(archiveCalendarCurrentMonth, archiveCalendarCurrentYear);
            document.getElementById('archive-date-picker-modal')?.classList.add('active');
        }

        function closeArchiveDatePicker() {
            document.getElementById('archive-date-picker-modal')?.classList.remove('active');
        }

        function renderArchiveCalendar(month, year) {
            const grid = document.getElementById('archive-calendar-grid');
            const heading = document.getElementById('archive-calendar-month-year');
            if (!grid || !heading) return;
            grid.innerHTML = '';
            heading.textContent = new Date(year, month, 1).toLocaleDateString('en-US', {
                month: 'long', year: 'numeric'
            });

            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            for (let index = 0; index < firstDay; index++) grid.appendChild(document.createElement('div'));

            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day);
                const dateCell = document.createElement('button');
                dateCell.type = 'button';
                dateCell.className = 'calendar-date';
                dateCell.textContent = day;
                dateCell.setAttribute('aria-label', date.toLocaleDateString());
                dateCell.addEventListener('click', () => selectArchiveDate(date));
                if (date.getTime() === today.getTime()) dateCell.classList.add('today');
                if (archiveSelectedFromDate && date.getTime() === archiveSelectedFromDate.getTime()) dateCell.classList.add('selected');
                if (archiveSelectedToDate && date.getTime() === archiveSelectedToDate.getTime()) dateCell.classList.add('selected');
                if (archiveSelectedFromDate && archiveSelectedToDate && date > archiveSelectedFromDate && date < archiveSelectedToDate) {
                    dateCell.classList.add('in-range');
                }
                grid.appendChild(dateCell);
            }
        }

        function changeArchiveCalendarMonth(step) {
            archiveCalendarCurrentMonth += step;
            if (archiveCalendarCurrentMonth > 11) {
                archiveCalendarCurrentMonth = 0;
                archiveCalendarCurrentYear++;
            } else if (archiveCalendarCurrentMonth < 0) {
                archiveCalendarCurrentMonth = 11;
                archiveCalendarCurrentYear--;
            }
            renderArchiveCalendar(archiveCalendarCurrentMonth, archiveCalendarCurrentYear);
        }

        function selectArchiveDate(date) {
            if (!archiveSelectedFromDate || archiveSelectedToDate) {
                archiveSelectedFromDate = date;
                archiveSelectedToDate = null;
            } else if (date < archiveSelectedFromDate) {
                archiveSelectedToDate = archiveSelectedFromDate;
                archiveSelectedFromDate = date;
            } else {
                archiveSelectedToDate = date;
            }
            updateArchiveDateRangeDisplay();
            renderArchiveCalendar(archiveCalendarCurrentMonth, archiveCalendarCurrentYear);
        }

        function updateArchiveDateRangeDisplay() {
            const fromDisplay = document.getElementById('archive-date-from-display');
            const toDisplay = document.getElementById('archive-date-to-display');
            if (fromDisplay) fromDisplay.textContent = archiveSelectedFromDate ? archiveSelectedFromDate.toLocaleDateString() : 'Select Date';
            if (toDisplay) toDisplay.textContent = archiveSelectedToDate ? archiveSelectedToDate.toLocaleDateString() : 'Select Date';
        }

        function clearArchiveDateRangeSelection() {
            archiveSelectedFromDate = null;
            archiveSelectedToDate = null;
            updateArchiveDateRangeDisplay();
            renderArchiveCalendar(archiveCalendarCurrentMonth, archiveCalendarCurrentYear);
        }

        function syncArchiveDateRangeButton() {
            const button = document.getElementById('archiveDateRangeBtn');
            const label = document.getElementById('archiveDateRangeLabel');
            const hasRange = archiveEventDateFilter.from && archiveEventDateFilter.to;
            if (label) {
                label.textContent = hasRange
                    ? `${archiveEventDateFilter.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${archiveEventDateFilter.to.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : 'Select Date Range';
            }
            button?.classList.toggle('active', Boolean(hasRange));
        }

        function applyArchiveDateRange() {
            if (!archiveSelectedFromDate || !archiveSelectedToDate) {
                alert('Please select both a start date and an end date.');
                return;
            }
            archiveEventDateFilter = {
                from: new Date(archiveSelectedFromDate.getTime()),
                to: new Date(archiveSelectedToDate.getTime())
            };
            syncArchiveDateRangeButton();
            closeArchiveDatePicker();
            updateEventsList();
        }

        function resetArchiveEventFilters() {
            archiveEventTermFilter = { ...activeAcademicTerm };
            archiveEventDateFilter = { from: null, to: null };
            archiveSelectedFromDate = null;
            archiveSelectedToDate = null;
            syncArchiveDateRangeButton();
            updateEventsList();
        }

        async function setEventArchiveState(eventId, eventName, action) {
            const isArchive = action === 'archive';
            const confirmed = await appConfirm(
                `${isArchive ? 'Archive' : 'Restore'} "${eventName}"?${isArchive ? ' Attendance history will be preserved.' : ''}`,
                {
                    title: isArchive ? 'Archive event' : 'Restore event',
                    confirmText: isArchive ? 'Archive' : 'Restore',
                    cancelText: 'Cancel'
                }
            );
            if (!confirmed) return;

            try {
                await qrApiRequest('/events/archive.php', {
                    method: 'POST',
                    body: JSON.stringify({ event_id: Number(eventId), action })
                });
                await loadEventsFromApi();
                updateEventsList();
            } catch (error) {
                alert(`Unable to ${action} event: ${error.message}`);
            }
        }

        function switchEventsView(view) {
            currentEventsView = view === 'archived' ? 'archived' : 'active';
            document.getElementById('eventsListTitle').textContent = currentEventsView === 'archived' ? 'Archived Events' : 'Active Events';
            document.querySelectorAll('[data-event-view]').forEach(button => {
                const active = button.dataset.eventView === currentEventsView;
                button.classList.toggle('active', active);
            });
            updateEventsList();
        }

        function updateEventsList() {
            const eventsList = document.getElementById('eventsList');
            const eventsMap = new Map();
            const searchTerm = (document.getElementById('eventSearchInput')?.value || '').trim().toLowerCase();
            const sourceEvents = currentEventsView === 'archived' ? archivedEvents : events;
            const archivedEventNames = new Set(
                archivedEvents
                    .map(event => normalizeEventName(event.name || event.event_name).toLocaleLowerCase())
                    .filter(Boolean)
            );

            sourceEvents.forEach(event => {
                const normalizedName = normalizeEventName(event.name || event.event_name);
                if (!normalizedName) return;
                const key = Number(event.id || 0) > 0 ? `id:${event.id}` : `name:${normalizedName}`;
                eventsMap.set(key, {
                    ...event,
                    id: event.id || event.event_id || null,
                    name: normalizedName,
                    records: [],
                    firstDate: event.firstDate || event.first_record_date || null,
                    lastDate: event.lastDate || event.last_record_date || null,
                    attendanceCount: Number(event.attendanceCount ?? event.attended_count ?? event.attendance_count ?? 0),
                    preRegisteredCount: Number(event.preRegisteredCount ?? event.pre_registered_count ?? 0),
                    hasApiCounts: Boolean(event.id || event.event_id)
                });
            });

            attendanceRecords.forEach(record => {
                const normalizedEventName = normalizeEventName(record.event);
                if (!normalizedEventName) return;
                let target = Array.from(eventsMap.values()).find(event => event.name === normalizedEventName);
                if (!target && currentEventsView === 'active' && archivedEventNames.has(normalizedEventName.toLocaleLowerCase())) {
                    return;
                }
                if (!target && currentEventsView === 'active') {
                    target = {
                        id: null,
                        name: normalizedEventName,
                        description: 'Event created from attendance records',
                        status: 'active',
                        createdAt: record.date || '',
                        eventDateTime: record.date || '',
                        archiveStartDate: record.date || null,
                        archiveEndDate: record.date || null,
                        records: [],
                        firstDate: record.date || null,
                        lastDate: record.date || null,
                        attendanceCount: 0,
                        preRegisteredCount: 0,
                        hasApiCounts: false
                    };
                    eventsMap.set(`name:${normalizedEventName}`, target);
                }
                if (!target) return;

                target.records.push(record);
                if (!target.hasApiCounts) {
                    isPreRegisteredRecord(record) ? target.preRegisteredCount++ : target.attendanceCount++;
                }
                if (record.date && (!target.firstDate || eventSortTimestamp(record.date) < eventSortTimestamp(target.firstDate))) {
                    target.firstDate = record.date;
                }
                if (record.date && (!target.lastDate || eventSortTimestamp(record.date) > eventSortTimestamp(target.lastDate))) {
                    target.lastDate = record.date;
                }
            });

            const unfilteredEvents = Array.from(eventsMap.values());
            renderArchiveEventFilters(unfilteredEvents);

            let sortedEvents = unfilteredEvents.sort((a, b) => {
                const startDifference = eventSortTimestamp(b.firstDate || b.archiveStartDate || b.eventDateTime)
                    - eventSortTimestamp(a.firstDate || a.archiveStartDate || a.eventDateTime);
                if (startDifference !== 0) return startDifference;
                const endDifference = eventSortTimestamp(b.lastDate || b.archiveEndDate || b.eventDateTime)
                    - eventSortTimestamp(a.lastDate || a.archiveEndDate || a.eventDateTime);
                return endDifference !== 0 ? endDifference : Number(b.id || 0) - Number(a.id || 0);
            });

            if (currentEventsView === 'archived') {
                sortedEvents = sortedEvents.filter(event =>
                    String(event.academicYear || '') === archiveEventTermFilter.academic_year
                    && String(event.semester || '') === archiveEventTermFilter.semester
                    && String(event.gradingPeriod || '').toLowerCase() === archiveEventTermFilter.grading_period
                );
            }
            if (currentEventsView === 'archived' && archiveEventDateFilter.from && archiveEventDateFilter.to) {
                sortedEvents = sortedEvents.filter(event => {
                    const eventDate = getArchiveEventFilterDate(event);
                    return eventDate && eventDate >= archiveEventDateFilter.from && eventDate <= archiveEventDateFilter.to;
                });
            }
            if (searchTerm) {
                sortedEvents = sortedEvents.filter(event => {
                    const sections = new Set(event.records.map(record => record.section).filter(Boolean));
                    return event.name.toLowerCase().includes(searchTerm)
                        || String(event.description || '').toLowerCase().includes(searchTerm)
                        || Array.from(sections).some(section => String(section).toLowerCase().includes(searchTerm))
                        || String(event.firstDate || '').toLowerCase().includes(searchTerm)
                        || String(event.lastDate || '').toLowerCase().includes(searchTerm);
                });
            }

            eventsList.innerHTML = '';
            if (!sortedEvents.length) {
                eventsList.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No ${currentEventsView} events found.</td></tr>`;
                return;
            }

            sortedEvents.forEach(event => {
                const row = document.createElement('tr');
                const safeName = escapeEventHtml(event.name || 'Unknown Event');
                const hasDatabaseId = Number(event.id || 0) > 0;
                const stateAction = currentEventsView === 'archived'
                    ? `<button class="btn btn-sm btn-outline-primary restore-event" ${hasDatabaseId ? '' : 'disabled title="Database connection required"'}>Restore</button>`
                    : `<button class="btn btn-sm btn-warning archive-event" ${hasDatabaseId ? '' : 'disabled title="Database connection required"'}>Archive</button>`;
                const startAction = currentEventsView === 'active'
                    ? `<button class="btn btn-sm btn-primary start-event">Start Attendance</button>`
                    : '';
                row.innerHTML = `
                    <td>${safeName}</td>
                    <td>${event.attendanceCount}</td>
                    <td>${event.preRegisteredCount}</td>
                    <td>${escapeEventHtml(event.firstDate || 'N/A')}</td>
                    <td>${escapeEventHtml(event.lastDate || 'N/A')}</td>
                    <td class="text-end"><div class="d-inline-flex gap-2">${stateAction}<button class="btn btn-sm btn-info view-event">View Details</button>${startAction}</div></td>
                `;
                row.querySelector('.view-event').addEventListener('click', () => showEventDetails(event.name, event.id, currentEventsView === 'archived'));
                row.querySelector('.archive-event')?.addEventListener('click', () => setEventArchiveState(event.id, event.name, 'archive'));
                row.querySelector('.restore-event')?.addEventListener('click', () => setEventArchiveState(event.id, event.name, 'restore'));
                row.querySelector('.start-event')?.addEventListener('click', () => startEventAttendance(event.name));
                eventsList.appendChild(row);
            });
        }

        // Function to start attendance for an event
        async function startEventAttendance(eventName) {
            localStorage.removeItem('currentEvent');
            window.location.href = `index.php?event=${encodeURIComponent(eventName || '')}`;
        }

        // Show event details in modal
        async function showEventDetails(eventName, eventId = null, isArchived = false) {
            let eventRecords = attendanceRecords.filter(record => normalizeEventName(record.event) === normalizeEventName(eventName));
            if (Number(eventId || 0) > 0) {
                try {
                    const payload = await qrApiRequest(`/attendance/list.php?event_id=${encodeURIComponent(eventId)}&limit=10000`, { method: 'GET' });
                    eventRecords = (payload.items || []).map(record => ({
                        studentId: record.student_number || '',
                        studentName: record.student_name || '',
                        section: record.section || '',
                        event: record.event_name || eventName,
                        date: record.attendance_date || String(record.time_in || record.created_at || '').slice(0, 10),
                        timeIn: record.time_in ? String(record.time_in).slice(11, 19) : '',
                        timeOut: record.time_out ? String(record.time_out).slice(11, 19) : '',
                        status: record.attendance_status || ''
                    }));
                } catch (error) {
                    console.warn('Unable to load event attendance from the API; using the local cache.', error);
                }
            }
            currentEventDetails = {
                name: eventName,
                id: Number(eventId || 0) || null,
                archived: Boolean(isArchived),
                records: eventRecords
            };

            document.getElementById('modalEventName').textContent = eventName;
            document.getElementById('modalPreRegisteredCount').textContent = `Pre Registered: ${getEventPreRegisteredCount(eventName, eventRecords)}`;
            document.getElementById('startEventAttendance').style.display = isArchived ? 'none' : '';
            document.getElementById('importEventDetails').style.display = isArchived ? 'none' : '';
            const modalRecords = document.getElementById('modalEventRecords');
            modalRecords.innerHTML = '';

            // Get unique records (one per student per day)
            const uniqueRecords = new Map();
            eventRecords.forEach(record => {
                const key = `${record.studentId}-${record.date}`;
                if (!uniqueRecords.has(key)) {
                    uniqueRecords.set(key, record);
                }
            });

            Array.from(uniqueRecords.values()).forEach((record, idx) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${idx + 1}</td>
                    <td>${escapeEventHtml(record.studentId)}</td>
                    <td>${escapeEventHtml(record.studentName)}</td>
                    <td>${escapeEventHtml(record.section)}</td>
                    <td>${escapeEventHtml(record.date)}</td>
                    <td>${escapeEventHtml(record.timeIn || '')}</td>
                    <td>${escapeEventHtml(record.timeOut || '')}</td>
                `;
                modalRecords.appendChild(row);
            });

            if (!uniqueRecords.size) {
                modalRecords.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">No attendance records found.</td></tr>';
            }

            const modal = new bootstrap.Modal(document.getElementById('eventDetailsModal'));
            modal.show();
        }

        // Add event listener for modal start attendance button
        document.getElementById('startEventAttendance').addEventListener('click', function () {
            if (currentEventDetails && !currentEventDetails.archived) {
                startEventAttendance(currentEventDetails.name);
            }
        });

        // Export all events
        document.getElementById('exportAllEvents').addEventListener('click', function () {
            const events = new Map();
            attendanceRecords.forEach(record => {
                if (!record.event) return;
                if (!events.has(record.event)) {
                    events.set(record.event, []);
                }
                events.get(record.event).push(record);
            });

            const wb = XLSX.utils.book_new();

            // Create a summary sheet
            const summaryData = [];
            events.forEach((records, eventName) => {
                const uniqueStudents = new Set(records.map(r => r.studentId));
                const sections = new Set(records.map(r => r.section).filter(Boolean));
                const dates = new Set(records.map(r => r.date));

                summaryData.push({
                    'Event Name': eventName,
                    'Total Records': records.length,
                    'Unique Students': uniqueStudents.size,
                    'Sections': sections.size,
                    'Date Range': `${Math.min(...dates)} to ${Math.max(...dates)}`,
                    'First Record': records[0].date,
                    'Last Record': records[records.length - 1].date
                });
            });
            const summaryWs = XLSX.utils.json_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

            // Create a sheet for each event
            events.forEach((records, eventName) => {
                // Sort records by date and time
                records.sort((a, b) => {
                    const dateCompare = new Date(a.date) - new Date(b.date);
                    if (dateCompare !== 0) return dateCompare;
                    return (a.timeIn || '').localeCompare(b.timeIn || '');
                });

                // Attendance sheet
                const exportData = records.map((record, idx) => ({
                    '#': idx + 1,
                    'Student#': record.studentId,
                    'Name': record.studentName,
                    'Section': record.section,
                    'Date': record.date,
                    'Time-in': record.timeIn || '',
                    'Time-out': record.timeOut || '',
                    'Duration': record.timeOut ? calculateDuration(record.timeIn, record.timeOut) : ''
                }));

                // Add summary row
                const uniqueStudents = new Set(records.map(r => r.studentId));
                exportData.push({
                    '#': '',
                    'Student#': 'Summary',
                    'Name': `Total Records: ${records.length}`,
                    'Section': `Unique Students: ${uniqueStudents.size}`,
                    'Date': `Date Range: ${Math.min(...records.map(r => r.date))} to ${Math.max(...records.map(r => r.date))}`,
                    'Time-in': '',
                    'Time-out': '',
                    'Duration': ''
                });

                const ws = XLSX.utils.json_to_sheet(exportData);
                XLSX.utils.book_append_sheet(wb, ws, eventName.substring(0, 31));

                // Per-section sheet
                const studentsBySection = {};
                records.forEach(record => {
                    if (!record.section) return;
                    if (!studentsBySection[record.section]) studentsBySection[record.section] = {};
                    const key = record.studentId + '|' + record.studentName;
                    if (!studentsBySection[record.section][key]) {
                        studentsBySection[record.section][key] = {
                            'Student#': record.studentId,
                            'Name': record.studentName,
                            'Time-in': record.timeIn || '',
                            'Time-out': record.timeOut || '',
                            'Duration': record.timeOut ? calculateDuration(record.timeIn, record.timeOut) : ''
                        };
                    } else {
                        // Update with latest time-out if exists
                        if (record.timeOut) {
                            studentsBySection[record.section][key]['Time-out'] = record.timeOut;
                            studentsBySection[record.section][key]['Duration'] = calculateDuration(
                                studentsBySection[record.section][key]['Time-in'],
                                record.timeOut
                            );
                        }
                    }
                });

                let exportStudents = [];
                Object.keys(studentsBySection).sort().forEach(section => {
                    exportStudents.push({ 'Section': section });
                    const sectionStudents = Object.values(studentsBySection[section]);
                    sectionStudents.sort((a, b) => a['Student#'].localeCompare(b['Student#']));
                    exportStudents.push(...sectionStudents);
                    exportStudents.push({
                        'Student#': 'Section Total',
                        'Name': `Students: ${sectionStudents.length}`,
                        'Time-in': '',
                        'Time-out': '',
                        'Duration': ''
                    });
                    exportStudents.push({});
                });

                const ws2 = XLSX.utils.json_to_sheet(exportStudents);
                XLSX.utils.book_append_sheet(wb, ws2, (eventName.substring(0, 23) + '_Sections').substring(0, 31));
            });

            // Use UTC+8 (Philippines) date for filename
            const now = new Date();
            const utc8 = new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60000);
            const yyyy = utc8.getFullYear();
            const mm = String(utc8.getMonth() + 1).padStart(2, '0');
            const dd = String(utc8.getDate()).padStart(2, '0');
            const fileName = 'Attendance_Report_' + yyyy + '-' + mm + '-' + dd + '.xlsx';
            XLSX.writeFile(wb, fileName);
        });

        // Export single event details
        document.getElementById('exportEventDetails').addEventListener('click', function () {
            if (!currentEventDetails) return;

            const wb = XLSX.utils.book_new();
            const records = currentEventDetails.records;

            // Sort records by date and time
            records.sort((a, b) => {
                const dateCompare = new Date(a.date) - new Date(b.date);
                if (dateCompare !== 0) return dateCompare;
                return (a.timeIn || '').localeCompare(b.timeIn || '');
            });

            // Attendance sheet
            const exportData = records.map((record, idx) => ({
                '#': idx + 1,
                'Student#': record.studentId,
                'Name': record.studentName,
                'Section': record.section,
                'Date': record.date,
                'Time-in': record.timeIn || '',
                'Time-out': record.timeOut || '',
                'Duration': record.timeOut ? calculateDuration(record.timeIn, record.timeOut) : ''
            }));

            // Add summary row
            const uniqueStudents = new Set(records.map(r => r.studentId));
            exportData.push({
                '#': '',
                'Student#': 'Summary',
                'Name': `Total Records: ${records.length}`,
                'Section': `Unique Students: ${uniqueStudents.size}`,
                'Date': `Date Range: ${Math.min(...records.map(r => r.date))} to ${Math.max(...records.map(r => r.date))}`,
                'Time-in': '',
                'Time-out': '',
                'Duration': ''
            });

            const ws = XLSX.utils.json_to_sheet(exportData);
            XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

            // Per-section sheet
            const studentsBySection = {};
            records.forEach(record => {
                if (!record.section) return;
                if (!studentsBySection[record.section]) studentsBySection[record.section] = {};
                const key = record.studentId + '|' + record.studentName;
                if (!studentsBySection[record.section][key]) {
                    studentsBySection[record.section][key] = {
                        'Student#': record.studentId,
                        'Name': record.studentName,
                        'Time-in': record.timeIn || '',
                        'Time-out': record.timeOut || '',
                        'Duration': record.timeOut ? calculateDuration(record.timeIn, record.timeOut) : ''
                    };
                } else {
                    // Update with latest time-out if exists
                    if (record.timeOut) {
                        studentsBySection[record.section][key]['Time-out'] = record.timeOut;
                        studentsBySection[record.section][key]['Duration'] = calculateDuration(
                            studentsBySection[record.section][key]['Time-in'],
                            record.timeOut
                        );
                    }
                }
            });

            let exportStudents = [];
            Object.keys(studentsBySection).sort().forEach(section => {
                exportStudents.push({ 'Section': section });
                const sectionStudents = Object.values(studentsBySection[section]);
                sectionStudents.sort((a, b) => a['Student#'].localeCompare(b['Student#']));
                exportStudents.push(...sectionStudents);
                exportStudents.push({
                    'Student#': 'Section Total',
                    'Name': `Students: ${sectionStudents.length}`,
                    'Time-in': '',
                    'Time-out': '',
                    'Duration': ''
                });
                exportStudents.push({});
            });

            const ws2 = XLSX.utils.json_to_sheet(exportStudents);
            XLSX.utils.book_append_sheet(wb, ws2, 'Sections');

            // Use UTC+8 (Philippines) date for filename
            const now = new Date();
            const utc8 = new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60000);
            const yyyy = utc8.getFullYear();
            const mm = String(utc8.getMonth() + 1).padStart(2, '0');
            const dd = String(utc8.getDate()).padStart(2, '0');
            const fileName = currentEventDetails.name.replace(/[^a-z0-9]/gi, '_') + '_' + yyyy + '-' + mm + '-' + dd + '.xlsx';
            XLSX.writeFile(wb, fileName);
        });

        // Import single event details (replace or upsert records for the event)
        document.getElementById('importEventDetails').addEventListener('click', function () {
            document.getElementById('importEventFile').click();
        });

        document.getElementById('importEventFile').addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;
            if (!currentEventDetails) {
                alert('Open an event using View Details first.');
                e.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function (ev) {
                try {
                    const data = new Uint8Array(ev.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // Prefer sheet named 'Attendance' if present, else first sheet
                    let sheetName = workbook.SheetNames.includes('Attendance') ? 'Attendance' : workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json(sheet);

                    // Build new records for this event
                    const newEventRecords = [];
                    rows.forEach(r => {
                        if (r['Student#'] === 'Summary' || r['Student#'] === 'Section Total') return;
                        if (!r['Student#']) return;
                        newEventRecords.push({
                            studentId: String(r['Student#']).trim(),
                            studentName: (r['Name'] || '').trim(),
                            section: (r['Section'] || '').trim(),
                            event: currentEventDetails.name,
                            date: (r['Date'] || '').trim(),
                            timeIn: (r['Time-in'] || '').trim(),
                            timeOut: (r['Time-out'] || '').trim(),
                            checkInMs: Date.now()
                        });
                    });

                    // Load all records, remove existing ones for this event, then merge new unique ones
                    let all = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
                    all = all.filter(r => r.event !== currentEventDetails.name);

                    const uniqueMap = new Map();
                    [...all, ...newEventRecords].forEach(rec => {
                        const key = `${rec.studentId}-${rec.section}-${rec.event}-${rec.date}`;
                        if (!uniqueMap.has(key)) uniqueMap.set(key, rec);
                    });

                    localStorage.setItem('attendanceRecords', JSON.stringify(Array.from(uniqueMap.values())));
                    alert('Event data imported successfully.');
                    location.reload();
                } catch (err) {
                    alert('Error importing event data: ' + err.message);
                }
            };
            reader.readAsArrayBuffer(file);
            e.target.value = '';
        });

        // Helper function to calculate duration between time-in and time-out
        function calculateDuration(timeIn, timeOut) {
            if (!timeIn || !timeOut) return '';
            const [inHours, inMinutes] = timeIn.split(':').map(Number);
            const [outHours, outMinutes] = timeOut.split(':').map(Number);
            const duration = (outHours * 60 + outMinutes) - (inHours * 60 + inMinutes);
            const hours = Math.floor(duration / 60);
            const minutes = duration % 60;
            return `${hours}h ${minutes}m`;
        }

        // Import Events functionality
        document.getElementById('importEvents').addEventListener('click', function () {
            document.getElementById('importFile').click();
        });

        document.getElementById('importFile').addEventListener('change', async function (e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async function (e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // Get the first sheet (Summary sheet)
                    const summarySheet = workbook.Sheets[workbook.SheetNames[0]];
                    const summaryData = XLSX.utils.sheet_to_json(summarySheet);

                    // Process each event sheet
                    const importedRecords = [];
                    workbook.SheetNames.forEach(sheetName => {
                        // Skip the summary sheet and section sheets
                        if (sheetName === 'Summary' || sheetName.endsWith('_Sections')) return;

                        const sheet = workbook.Sheets[sheetName];
                        const records = XLSX.utils.sheet_to_json(sheet);

                        // Process each record
                        records.forEach(record => {
                            // Skip summary rows
                            if (record['Student#'] === 'Summary' || record['Student#'] === 'Section Total') return;

                            // Create attendance record
                            const attendanceRecord = {
                                studentId: record['Student#'],
                                studentName: record['Name'],
                                section: record['Section'],
                                event: sheetName,
                                date: record['Date'],
                                timeIn: record['Time-in'],
                                timeOut: record['Time-out'],
                                checkInMs: Date.now() // Set current timestamp for sorting
                            };
                            importedRecords.push(attendanceRecord);
                        });
                    });

                    // Merge with existing records
                    const existingRecords = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
                    const mergedRecords = [...existingRecords, ...importedRecords];

                    // Remove duplicates (keep existing records if there's a conflict)
                    const uniqueRecords = new Map();
                    mergedRecords.forEach(record => {
                        const key = `${record.studentId}-${record.section}-${record.event}-${record.date}`;
                        if (!uniqueRecords.has(key)) {
                            uniqueRecords.set(key, record);
                        }
                    });

                    localStorage.setItem('attendanceRecords', JSON.stringify(Array.from(uniqueRecords.values())));

                    // Refresh the page
                    location.reload();
                } catch (error) {
                    alert('Error importing events: ' + error.message);
                }
            };
            reader.readAsArrayBuffer(file);

            // Clear the file input
            e.target.value = '';
        });

        // Create New Event modal and submit flow
        const createEventModalEl = document.getElementById('createEventModal');
        const createEventModal = createEventModalEl ? new bootstrap.Modal(createEventModalEl) : null;
        const openCreateEventModalBtn = document.getElementById('openCreateEventModal');
        const createEventForm = document.getElementById('createEventForm');
        const newEventNameInput = document.getElementById('newEventNameInput');

        if (openCreateEventModalBtn && createEventModal) {
            openCreateEventModalBtn.addEventListener('click', function () {
                if (newEventNameInput) {
                    newEventNameInput.value = '';
                }
                createEventModal.show();
                setTimeout(function () {
                    if (newEventNameInput) newEventNameInput.focus();
                }, 120);
            });
        }

        if (createEventForm) {
            createEventForm.addEventListener('submit', async function (e) {
                e.preventDefault();

                const rawEventName = (newEventNameInput?.value || '').trim();
                if (!rawEventName) {
                    alert('Please enter an event name.');
                    return;
                }

                const normalizedEventName = normalizeEventName(rawEventName);
                try {
                    await qrApiRequest('/events/save.php', {
                        method: 'POST',
                        body: JSON.stringify({
                            event_name: normalizedEventName,
                            description: '',
                            location: null,
                            event_datetime: null,
                            is_published: 1
                        })
                    });
                    await loadEventsFromApi();
                    updateEventsList();
                    if (createEventModal) createEventModal.hide();
                } catch (error) {
                    alert('Error creating event: ' + error.message);
                }
            });
        }
    </script>
    <script>
        window.addEventListener('message', async function (event) {
            if (event.origin !== window.location.origin || event.source !== window.parent) {
                return;
            }

            if (event.data && event.data.type === 'OPEN_EVENT_DETAILS') {
                const eventId = Number(event.data.eventId || 0);
                const eventName = normalizeEventName(event.data.eventName || '');
                try {
                    await loadEventsFromApi();
                    if (typeof updateEventsList === 'function') updateEventsList();
                    const matchedEvent = [...events, ...archivedEvents].find((item) =>
                        (eventId > 0 && Number(item.id || 0) === eventId)
                        || (eventName && normalizeEventName(item.name) === eventName)
                    );
                    if (!matchedEvent) {
                        window.parent.postMessage({
                            type: 'OFFICER_NAVIGATION_TARGET_MISSING',
                            category: 'event',
                            entityId: eventId
                        }, window.location.origin);
                        return;
                    }
                    const matchedIsArchived = Boolean(matchedEvent.archivedAt);
                    if (matchedIsArchived) switchEventsView('archived');
                    showEventDetails(matchedEvent.name, matchedEvent.id, matchedIsArchived);
                } catch (_error) {
                    window.parent.postMessage({
                        type: 'OFFICER_NAVIGATION_TARGET_MISSING',
                        category: 'event',
                        entityId: eventId
                    }, window.location.origin);
                }
                return;
            }

            // Only act if the message type is CREATE_EVENT
            if (event.data && event.data.type === 'CREATE_EVENT') {
                console.log("Received Cross-Post Request (Events Tab):", event.data);

                try {
                    // Build a proper datetime using the start time (if provided)
                    const timeRangeRaw = String(event.data.time || '').trim();
                    const startTime = timeRangeRaw.includes('-')
                        ? timeRangeRaw.split('-')[0].trim()
                        : timeRangeRaw;
                    let eventDateTime = String(event.data.date || '').trim();
                    if (eventDateTime) {
                        eventDateTime = startTime
                            ? `${eventDateTime} ${startTime}`
                            : `${eventDateTime} 00:00`;
                    }
                    await qrApiRequest('/events/save.php', {
                        method: 'POST',
                        body: JSON.stringify({
                            event_name: normalizeEventName(event.data.eventName || ''),
                            description: String(event.data.description || ''),
                            event_datetime: eventDateTime,
                            location: event.data.location || 'TBA',
                            photo: event.data.photo || '',
                            photos: Array.isArray(event.data.photos) ? event.data.photos : [],
                            time_range: timeRangeRaw,
                            is_published: 1
                        })
                    });
                    await loadEventsFromApi();
                    if (typeof updateEventsList === 'function') updateEventsList();
                } catch (error) {
                    console.error('Failed to sync event to API:', error);
                }
            }
        });
    </script>
</body>

</html>

