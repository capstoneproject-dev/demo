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
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Events - QR Attendance System</title>
    <link href="../../systems/QR-Attendance/lib/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../../systems/QR-Attendance/lib/styles.css">
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
                        <a class="nav-link" href="events.php">Events</a>
                    </li>

                    <li class="nav-item">
                        <a class="nav-link" href="generate-qr.php">Generate Barcodes</a>
                    </li>

                    <li class="nav-item">
                        <a class="nav-link" href="../shared/student-database.php?return=../qr-attendance/index.php">Database</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="index.php">Home</a>
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

        <!-- Events List -->
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h2 class="h5 mb-0">All Events</h2>
                <div>
                    <input type="text" id="eventSearchInput" class="form-control form-control-sm me-2"
                        placeholder="Search events..." style="display:inline-block; width:auto; min-width:200px;">
                    <button id="deleteAllEvents" class="btn btn-danger btn-sm me-2">Delete All Events</button>
                    <button id="exportAllEvents" class="btn btn-success btn-sm me-2">Export All Events</button>
                    <button id="importEvents" class="btn btn-primary btn-sm">Import Events</button>
                    <input type="file" id="importFile" accept=".xlsx" style="display: none;">
                </div>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Event Name</th>
                                <th>Total Attendance</th>
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
                                <h6 id="modalEventName" class="mb-0"></h6>
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

        <!-- Delete Event Confirmation Modal -->
        <div class="modal fade" id="deleteEventModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Delete Event</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-danger">Warning: This action cannot be undone. The event and all its attendance
                            records will be permanently deleted.</p>
                        <p><strong>Event Name:</strong> <span id="deleteEventName"></span></p>
                        <p>To confirm, please type "Delete" in the box below:</p>
                        <input type="text" class="form-control" id="deleteEventConfirmation"
                            placeholder="Type 'Delete' to confirm">
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-danger" id="confirmDeleteEvent" disabled>Delete
                            Event</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Delete All Confirmation Modal -->
        <div class="modal fade" id="deleteAllModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Delete All Events</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-danger">Warning: This action cannot be undone. All events and their attendance
                            records will be permanently deleted.</p>
                        <p>To confirm, please type "Delete" in the box below:</p>
                        <input type="text" class="form-control" id="deleteConfirmation"
                            placeholder="Type 'Delete' to confirm">
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-danger" id="confirmDeleteAll" disabled>Delete All
                            Events</button>
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
        let currentEventDetails = null;

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
                status: row.status || 'active',
                createdAt: row.created_at || '',
                firstDate: row.first_record_date || null,
                lastDate: row.last_record_date || null,
                records: []
            };
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
            const payload = await qrApiRequest('/events/list.php', { method: 'GET' });
            events = (payload.items || []).map(mapApiEvent);
            return events;
        }

        // Initialize data
        async function initializeLocalData() {
            attendanceRecords = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
            try {
                await loadEventsFromApi();
            } catch (error) {
                console.warn('Unable to load events from API, falling back to localStorage.', error);
                const localEvents = JSON.parse(localStorage.getItem('events')) || [];
                events = localEvents.map(event => ({
                    id: event.id || null,
                    name: event.name || event.eventName || '',
                    description: event.description || '',
                    status: event.status || 'active',
                    createdAt: event.createdAt || '',
                    firstDate: event.firstDate || null,
                    lastDate: event.lastDate || null,
                    records: []
                }));
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
        });

        // Update events list
        function updateEventsList() {
            const eventsList = document.getElementById('eventsList');
            const eventsMap = new Map();
            const searchTerm = (document.getElementById('eventSearchInput')?.value || '').toLowerCase();

            // First, add all API events (normalize names to avoid duplicates)
            events.forEach(event => {
                const normalizedName = normalizeEventName(event.name || event.event_name);
                if (!normalizedName) return; // Skip events with empty names

                // Only add if not already in map (avoid duplicates)
                if (!eventsMap.has(normalizedName)) {
                    eventsMap.set(normalizedName, {
                        id: event.id || event.event_id || null,
                        name: normalizedName,
                        description: event.description || '',
                        status: event.status || '',
                        createdAt: event.createdAt || event.created_at || '',
                        records: [],
                        firstDate: event.firstDate || event.first_record_date || null,
                        lastDate: event.lastDate || event.last_record_date || null
                    });
                }
            });

            // Then, add attendance records to their respective events
            attendanceRecords.forEach(record => {
                if (!record.event) return;
                const normalizedEventName = normalizeEventName(record.event);
                if (!normalizedEventName) return;

                if (!eventsMap.has(normalizedEventName)) {
                    // Create event from attendance record if it doesn't exist in Cloud
                    eventsMap.set(normalizedEventName, {
                        id: null,
                        name: normalizedEventName,
                        description: 'Event created from attendance records',
                        status: 'active',
                        createdAt: new Date(),
                        records: [],
                        firstDate: record.date,
                        lastDate: record.date
                    });
                }
                const event = eventsMap.get(normalizedEventName);
                if (event) {
                    event.records.push(record);
                    // Update first and last dates
                    if (!event.firstDate || new Date(record.date) < new Date(event.firstDate)) {
                        event.firstDate = record.date;
                    }
                    if (!event.lastDate || new Date(record.date) > new Date(event.lastDate)) {
                        event.lastDate = record.date;
                    }
                }
            });

            // Sort events by last date (most recent first)
            let sortedEvents = Array.from(eventsMap.values()).sort((a, b) => {
                if (!a.lastDate && !b.lastDate) return 0;
                if (!a.lastDate) return 1;
                if (!b.lastDate) return -1;
                return new Date(b.lastDate) - new Date(a.lastDate);
            });

            // Filter by search term
            if (searchTerm) {
                sortedEvents = sortedEvents.filter(event => {
                    // Gather all sections in this event
                    const sections = new Set(event.records.map(r => r.section).filter(Boolean));
                    // Check if search term matches event name, description, any section, first date, or last date
                    return (
                        event.name.toLowerCase().includes(searchTerm) ||
                        (event.description && event.description.toLowerCase().includes(searchTerm)) ||
                        Array.from(sections).some(section => section.toLowerCase().includes(searchTerm)) ||
                        (event.firstDate && event.firstDate.toLowerCase().includes(searchTerm)) ||
                        (event.lastDate && event.lastDate.toLowerCase().includes(searchTerm))
                    );
                });
            }

            // Populate the table
            eventsList.innerHTML = '';
            sortedEvents.forEach(event => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${event.name}</td>
                    <td>${event.records.length}</td>
                    <td>${event.firstDate || 'N/A'}</td>
                    <td>${event.lastDate || 'N/A'}</td>
                    <td class="text-end">
                        <div class="d-inline-flex gap-2">
                            <button class="btn btn-sm btn-danger delete-event" data-event="${event.name || 'Unknown Event'}" data-event-id="${event.id || ''}">Delete</button>
                            <button class="btn btn-sm btn-info view-event" data-event="${event.name || 'Unknown Event'}">View Details</button>
                            <button class="btn btn-sm btn-primary start-event" data-event="${event.name || 'Unknown Event'}">Start Attendance</button>
                        </div>
                    </td>
                `;
                eventsList.appendChild(row);
            });

            // Add event listeners to view buttons
            document.querySelectorAll('.view-event').forEach(button => {
                button.addEventListener('click', function () {
                    const eventName = this.getAttribute('data-event');
                    showEventDetails(eventName);
                });
            });

            // Add event listeners to start attendance buttons
            document.querySelectorAll('.start-event').forEach(button => {
                button.addEventListener('click', function () {
                    const eventName = this.getAttribute('data-event');
                    startEventAttendance(eventName);
                });
            });

            // Add event listeners to delete buttons
            document.querySelectorAll('.delete-event').forEach(button => {
                button.addEventListener('click', function () {
                    const eventName = this.getAttribute('data-event');
                    const eventId = this.getAttribute('data-event-id');

                    // Validate eventName
                    if (!eventName || eventName === 'undefined' || eventName === 'null') {
                        alert('Error: Event name is not valid. Cannot delete event.');
                        return;
                    }

                    // Store the event to delete globally
                    window.eventToDelete = {
                        eventName: eventName,
                        eventId: eventId
                    };

                    // Populate modal with event details
                    document.getElementById('deleteEventName').textContent = eventName;
                    const deleteEventConfirmationInput = document.getElementById('deleteEventConfirmation');
                    if (deleteEventConfirmationInput) {
                        deleteEventConfirmationInput.value = '';
                    }
                    document.getElementById('confirmDeleteEvent').disabled = true;

                    // Show the modal
                    deleteEventModal.show();
                });
            });
        }

        // Function to start attendance for an event
        async function startEventAttendance(eventName) {
            localStorage.removeItem('currentEvent');
            window.location.href = `index.php?event=${encodeURIComponent(eventName || '')}`;
        }

        // Show event details in modal
        function showEventDetails(eventName) {
            const eventRecords = attendanceRecords.filter(r => r.event === eventName);
            currentEventDetails = {
                name: eventName,
                records: eventRecords
            };

            document.getElementById('modalEventName').textContent = eventName;
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
                    <td>${record.studentId}</td>
                    <td>${record.studentName}</td>
                    <td>${record.section}</td>
                    <td>${record.date}</td>
                    <td>${record.timeIn || ''}</td>
                    <td>${record.timeOut || ''}</td>
                `;
                modalRecords.appendChild(row);
            });

            const modal = new bootstrap.Modal(document.getElementById('eventDetailsModal'));
            modal.show();
        }

        // Add event listener for modal start attendance button
        document.getElementById('startEventAttendance').addEventListener('click', function () {
            if (currentEventDetails) {
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

        // Delete Event functionality
        const deleteEventModal = new bootstrap.Modal(document.getElementById('deleteEventModal'));
        const deleteEventConfirmation = document.getElementById('deleteEventConfirmation');
        const confirmDeleteEvent = document.getElementById('confirmDeleteEvent');
        let eventToDelete = null;

        deleteEventConfirmation.addEventListener('input', function () {
            confirmDeleteEvent.disabled = this.value !== 'Delete';
        });

        // Allow pressing Enter to confirm deletion when the confirmation text is correct
        deleteEventConfirmation.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (deleteEventConfirmation.value === 'Delete' && !confirmDeleteEvent.disabled) {
                    confirmDeleteEvent.click();
                }
            }
        });

        confirmDeleteEvent.addEventListener('click', async function () {
            if (deleteEventConfirmation.value === 'Delete' && window.eventToDelete) {
                const { eventName, eventId } = window.eventToDelete;
                const normalizedTargetName = normalizeEventName(eventName);
                const numericEventId = Number(eventId || 0);

                try {
                    if (numericEventId > 0) {
                        await qrApiRequest('/events/delete.php', {
                            method: 'POST',
                            body: JSON.stringify({ event_id: numericEventId })
                        });
                    }

                    // Keep temporary local attendance in sync with UI behavior
                    attendanceRecords = attendanceRecords.filter(record => normalizeEventName(record.event) !== normalizedTargetName);
                    localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecords));
                    await loadEventsFromApi();

                    // Hide modal and reset
                    deleteEventModal.hide();
                    window.eventToDelete = null;

                    updateEventsList();
                    alert(`Event "${eventName}" has been deleted successfully.`);
                } catch (error) {
                    console.error('Error deleting event:', error);
                    alert('Error deleting event: ' + error.message);
                }
            }
        });

        // Delete All Events functionality
        const deleteAllModal = new bootstrap.Modal(document.getElementById('deleteAllModal'));
        const deleteConfirmation = document.getElementById('deleteConfirmation');
        const confirmDeleteAll = document.getElementById('confirmDeleteAll');

        document.getElementById('deleteAllEvents').addEventListener('click', function () {
            deleteConfirmation.value = '';
            confirmDeleteAll.disabled = true;
            deleteAllModal.show();
        });

        deleteConfirmation.addEventListener('input', function () {
            confirmDeleteAll.disabled = this.value !== 'Delete';
        });

        // Allow pressing Enter to confirm deletion when the confirmation text is correct
        deleteConfirmation.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (deleteConfirmation.value === 'Delete' && !confirmDeleteAll.disabled) {
                    confirmDeleteAll.click();
                }
            }
        });

        confirmDeleteAll.addEventListener('click', async function () {
            if (deleteConfirmation.value === 'Delete') {
                try {
                    // Delete all API events for this org
                    await loadEventsFromApi();
                    for (const event of events) {
                        const eventId = Number(event.id || 0);
                        if (eventId > 0) {
                            await qrApiRequest('/events/delete.php', {
                                method: 'POST',
                                body: JSON.stringify({ event_id: eventId })
                            });
                        }
                    }

                    // Clear temporary local attendance cache to match current UI expectation
                    localStorage.removeItem('attendanceRecords');
                    attendanceRecords = [];
                    await loadEventsFromApi();

                    deleteAllModal.hide();
                    updateEventsList();
                    alert('All events have been deleted successfully.');
                } catch (error) {
                    console.error('Error clearing all events:', error);
                    alert('Error clearing all events. Please try again.');
                }
            }
        });

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
                            location: 'TBA',
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
            // Only act if the message type is CREATE_EVENT
            if (event.data && event.data.type === 'CREATE_EVENT') {
                console.log("Received Cross-Post Request (Events Tab):", event.data);

                try {
                    await qrApiRequest('/events/save.php', {
                        method: 'POST',
                        body: JSON.stringify({
                            event_name: normalizeEventName(event.data.eventName || ''),
                            description: String(event.data.description || ''),
                            event_date: String(event.data.date || ''),
                            location: 'TBA',
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

