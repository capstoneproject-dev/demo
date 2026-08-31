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
    <link rel="manifest" href="../../manifest.webmanifest">
    <script src="../../assets/js/app-dialog.js?v=20260807-security-1"></script>
    <script src="../../assets/js/offline-store.js?v=20260829-7"></script>
    <script src="../../assets/js/offline-client.js?v=20260831-29"></script>
    <meta charset="UTF-8">
    <link rel="icon" type="image/png" href="../../assets/favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rental History</title>
    <link href="../../systems/IGPRentalSystem/lib/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="../../assets/vendor/fontawesome/css/all.min.css">
    <link rel="stylesheet" href="../../systems/IGPRentalSystem/lib/styles.css?v=20260819-paid-button-2">
    <style>
        #rentalHistoryRecords tr.naap-queued-rental > td {
            background: #fff8e6;
            border-top: 2px solid #f59e0b;
            border-bottom: 2px solid #f59e0b;
        }

        #rentalHistoryRecords tr.naap-queued-rental > td:first-child {
            border-left: 4px solid #f59e0b;
        }

        #rentalHistoryRecords tr.naap-queued-rental > td:last-child {
            border-right: 2px solid #f59e0b;
        }

        #rentalHistoryRecords tr.naap-queued-rental[data-offline-status="attention"] > td {
            background: #fff1f1;
            border-color: #dc3545;
        }

        .rental-history-page {
            width: 100%;
            max-width: none;
            padding-inline: clamp(.75rem, 2vw, 2rem);
        }

        .rental-history-card {
            width: 100%;
            max-width: none;
            container-type: inline-size;
        }

        .rental-history-card .card-body {
            padding: clamp(.75rem, 1.25vw, 1.25rem);
        }

        .rental-history-card .table {
            width: 100%;
            margin-bottom: 0;
            font-size: clamp(.72rem, .72vw, .88rem);
        }

        .rental-history-card .table > :not(caption) > * > * {
            padding: .45rem .35rem;
            vertical-align: middle;
            white-space: normal;
            overflow-wrap: anywhere;
        }

        .rental-history-card .table th {
            line-height: 1.2;
            font-size: clamp(.62rem, .68vw, .82rem);
            white-space: normal;
            overflow-wrap: normal;
            word-break: normal;
            hyphens: none;
            text-wrap: balance;
        }

        .rental-history-card .table td:nth-child(2),
        .rental-history-card .table td:nth-child(3) {
            min-width: 7rem;
        }

        .rental-history-card .table .btn {
            padding: .3rem .45rem;
            font-size: inherit;
            white-space: nowrap;
        }

        .rental-column-menu {
            width: min(22rem, calc(100vw - 2rem));
            max-height: min(70vh, 32rem);
            overflow-y: auto;
            padding: .75rem;
        }

        .rental-column-options {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: .35rem .75rem;
        }

        .rental-column-option {
            display: flex;
            align-items: flex-start;
            gap: .45rem;
            min-width: 0;
            font-size: .82rem;
            line-height: 1.25;
            cursor: pointer;
        }

        .rental-column-option input {
            flex: 0 0 auto;
            margin-top: .12rem;
        }

        .rental-history-card .card-body > .mb-3 > h5 {
            margin-bottom: 0;
        }

        @container (max-width: 1400px) {
            .rental-history-card .table th {
                font-size: .68rem;
                padding-inline: .25rem;
            }
        }

        @container (max-width: 1150px) {
            .rental-history-card .table th {
                font-size: .6rem;
                padding-inline: .18rem;
                letter-spacing: -.01em;
            }
        }

        @media (max-width: 991.98px) {
            .rental-history-card .table {
                min-width: 1120px;
            }

            .rental-history-card .table th {
                font-size: .65rem;
            }

            .rental-column-options {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>

<body data-org-read-only="<?= !empty($session['is_read_only']) ? '1' : '0' ?>">
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
                        <a class="nav-link" href="rental-history.php">History</a>
                    </li>

                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" id="inventoryDropdown" role="button"
                            data-bs-toggle="dropdown" aria-expanded="false">
                            Inventory
                        </a>
                        <ul class="dropdown-menu mega-menu shadow-lg border-0" aria-labelledby="inventoryDropdown">
                            <li>
                                <a class="dropdown-item" href="inventory.php">
                                    <div class="fw-bold text-dark">Manage Inventory</div>
                                    <small class="text-muted d-block">Update stocks & availability</small>
                                </a>
                            </li>
                            <li>
                                <a class="dropdown-item mt-2" href="generate-inventory-barcodes.php">
                                    <div class="fw-bold text-dark">Inventory Barcodes</div>
                                    <small class="text-muted d-block">Create equipment labels</small>
                                </a>
                            </li>
                        </ul>
                    </li>

                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" id="databaseDropdown" role="button"
                            data-bs-toggle="dropdown" aria-expanded="false">
                            Database
                        </a>
                        <ul class="dropdown-menu mega-menu shadow-lg border-0" aria-labelledby="databaseDropdown">
                            <li>
                                <a class="dropdown-item" href="../shared/student-database.php?return=../igp/rental-history.php">
                                    <div class="fw-bold text-dark">Student Database</div>
                                    <small class="text-muted d-block">Manage customer records</small>
                                </a>
                            </li>
                            <li>
                                <a class="dropdown-item mt-2" href="admin.php">
                                    <div class="fw-bold text-dark">Officer Database</div>
                                    <small class="text-muted d-block">Manage authorized personnel</small>
                                </a>
                            </li>
                        </ul>
                    <li class="nav-item">
                        <a class="nav-link" href="index.php">Home</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>
    <div class="container-fluid main-content rental-history-page">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1 class="mb-0">Rental History</h1>
            <div>
                <a href="index.php" class="btn btn-outline-secondary me-2">Back to Rental System</a>
                <a id="financialSummaryBtn" href="financial-summary.php" target="_top"
                    class="btn btn-outline-secondary me-2">Financial Summary</a>
                <button id="exportExcel" class="btn btn-success me-2">Export to Excel</button>
                <input type="file" id="importExcel" accept=".xlsx" class="form-control form-control-sm" hidden />
            </div>
        </div>
        <div class="card rental-history-card">
            <div class="card-header">
                <div class="d-flex align-items-center flex-wrap gap-2">
                    <div class="d-flex align-items-center">
                        <label for="historyFilterBtn" class="form-label mb-0 me-2">Filter by Date / Month:</label>
                        <button id="historyFilterBtn" class="rental-history-filter-btn" type="button">
                            <span id="historyFilterLabel">All Dates</span>
                            <i class="fa-solid fa-chevron-down"></i>
                        </button>
                    </div>
                    <button id="showAllDatesBtn" class="btn btn-info btn-sm">Show All Dates</button>
                </div>
            </div>
            <div class="card-body">
                <div class="mb-3 d-flex align-items-center flex-wrap gap-2">
                    <h5>Total Profit: <span id="totalProfit">₱0</span></h5>
                    <button id="payAllBtn" class="btn btn-warning btn-sm ms-3" style="display:none;">Mark All as
                        Paid</button>
                    <div class="dropdown ms-auto">
                        <button id="rentalColumnsButton" class="btn btn-outline-secondary btn-sm dropdown-toggle"
                            type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                            <i class="fa-solid fa-filter me-1" aria-hidden="true"></i>
                            <span id="rentalColumnsButtonLabel">Columns</span>
                        </button>
                        <div class="dropdown-menu dropdown-menu-end rental-column-menu" aria-labelledby="rentalColumnsButton">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <strong class="small">Visible columns</strong>
                                <button id="showAllRentalColumns" class="btn btn-link btn-sm p-0" type="button">Show all</button>
                            </div>
                            <div id="rentalColumnOptions" class="rental-column-options"></div>
                        </div>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Order No.</th>
                                <th>Name</th>
                                <th>Rented By</th>
                                <th>Section</th>
                                <th>Rental Date</th>
                                <th>Time Rented</th>
                                <th>Expected Return</th>
                                <th>Time Returned</th>
                                <th>Overdue Time</th>
                                <th>Status</th>
                                <th>Processed By</th>
                                <th>Returned By</th>
                                <th>Price</th>
                                <th>Payment Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody id="rentalHistoryRecords">
                        </tbody>
                    </table>
                </div>
                <div class="text-end mt-2">
                    <small>Total Unpaid: <span id="totalUnpaid">₱0</span></small>
                </div>
            </div>
        </div>
    </div>

    <!-- Return Confirmation Modal -->
    <div class="modal fade" id="returnRentalModal" tabindex="-1" aria-labelledby="returnRentalModalLabel"
        aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="returnRentalModalLabel">Confirm Return</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p id="returnRentalSummary" class="mb-3"></p>
                    <label for="returnOfficerBarcode" class="form-label">Scan Officer Barcode</label>
                    <input type="text" class="form-control" id="returnOfficerBarcode"
                        placeholder="Scan officer barcode here..." autocomplete="off">
                    <div id="returnOfficerFeedback" class="form-text">
                        A valid active officer for this organization must verify the return.
                    </div>
                    <div id="returnRentalError" class="text-danger mt-2" role="alert" style="display:none;"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-warning" id="returnRentalConfirmBtn" disabled>Return Item</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Payment Confirmation Modal -->
    <div class="modal fade" id="paymentConfirmModal" tabindex="-1" aria-labelledby="paymentConfirmModalLabel"
        aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="paymentConfirmModalLabel">Confirm Payment</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p id="paymentConfirmSummary" class="mb-3"></p>
                    <p class="mb-2">Type <strong>Confirm</strong> to mark the balance as paid.</p>
                    <input type="text" class="form-control mb-3" id="paymentConfirmInput"
                        placeholder="Type 'Confirm' to continue" autocomplete="off">
                    <div class="mb-3">
                        <label for="paymentOfficerBarcode" class="form-label">Scan Officer Barcode</label>
                        <input type="text" class="form-control" id="paymentOfficerBarcode"
                            placeholder="Scan officer barcode here..." autocomplete="off">
                        <div id="paymentOfficerBarcodeFeedback" class="form-text">
                            A valid active officer for this organization must verify the payment.
                        </div>
                    </div>
                    <div id="paymentConfirmError" class="text-danger mt-2" role="alert" style="display:none;"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-success" id="paymentConfirmBtn" disabled>Mark as Paid</button>
                </div>
            </div>
        </div>
    </div>

    <div id="rentalHistoryFilterModal" class="igp-filter-modal-overlay">
        <div class="igp-filter-modal-content">
            <div class="igp-filter-modal-header">
                <h5>Filter Rental History</h5>
                <button id="rentalHistoryFilterCloseBtn" class="igp-filter-close-btn" type="button">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="igp-filter-modal-body">
                <div id="rentalHistoryDateFilterSection">
                    <div class="igp-date-filter-presets">
                        <button id="rentalHistoryDatePresetTodayBtn" class="igp-preset-btn" type="button">Today</button>
                        <button id="rentalHistoryDatePresetWeekBtn" class="igp-preset-btn" type="button">This Week</button>
                        <button id="rentalHistoryDatePresetMonthBtn" class="igp-preset-btn" type="button">This Month</button>
                        <button id="rentalHistoryDatePresetAllBtn" class="igp-preset-btn" type="button">All Time</button>
                    </div>

                    <div class="igp-calendar-picker-container">
                        <div class="igp-calendar-header">
                            <button id="rentalHistoryCalendarPrevBtn" class="igp-calendar-nav-btn" type="button">
                                <i class="fa-solid fa-chevron-left"></i>
                            </button>
                            <div class="igp-calendar-header-picker-group">
                                <select
                                    id="rentalHistoryCalendarMonthSelect"
                                    class="igp-calendar-header-select"
                                    aria-label="Select month">
                                </select>
                                <select
                                    id="rentalHistoryCalendarYearSelect"
                                    class="igp-calendar-header-select igp-calendar-header-year-select"
                                    aria-label="Select year">
                                </select>
                            </div>
                            <button id="rentalHistoryCalendarNextBtn" class="igp-calendar-nav-btn" type="button">
                                <i class="fa-solid fa-chevron-right"></i>
                            </button>
                        </div>

                        <div class="igp-calendar-weekdays">
                            <div>Sun</div>
                            <div>Mon</div>
                            <div>Tue</div>
                            <div>Wed</div>
                            <div>Thu</div>
                            <div>Fri</div>
                            <div>Sat</div>
                        </div>

                        <div class="igp-calendar-days" id="rentalHistoryCalendarDays"></div>

                        <div class="igp-calendar-selected-range">
                            <div class="igp-selected-date-display">
                                <strong>From:</strong> <span id="rentalHistorySelectedStartDate">Not selected</span>
                            </div>
                            <div class="igp-selected-date-display">
                                <strong>To:</strong> <span id="rentalHistorySelectedEndDate">Not selected</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="igp-filter-modal-footer">
                <button id="rentalHistoryFilterCancelBtn" type="button" class="igp-btn-cancel">Cancel</button>
                <button id="rentalHistoryFilterApplyBtn" type="button" class="igp-btn-submit">Apply Filter</button>
            </div>
        </div>
    </div>

    <!-- Officer Verification Modal (copied from welcome.html for security) -->
    <div class="modal fade" id="officerVerifyModal" tabindex="-1" aria-labelledby="officerVerifyModalLabel"
        aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="officerVerifyModalLabel">Officer Verification</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label">Scan Officer Barcode</label>
                        <div id="scannedBarcodeDisplay" class="form-control bg-light"
                            style="height:38px; line-height:38px; font-size:1.1em; user-select:all;">Waiting for scan...
                        </div>
                    </div>
                    <div class="text-center mb-2">or</div>
                    <div class="mb-3">
                        <label for="officerPasswordInput" class="form-label">Enter Password</label>
                        <input type="password" class="form-control" id="officerPasswordInput"
                            placeholder="Enter password...">
                    </div>
                    <div id="officerVerifyError" class="text-danger mb-2" style="display:none;"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="officerVerifyBtn">Verify</button>
                </div>
            </div>
        </div>
    </div>
    <script src="../../systems/IGPRentalSystem/lib/bootstrap.bundle.min.js"></script>
    <script src="../../systems/IGPRentalSystem/lib/xlsx.full.min.js"></script>
    <audio id="beepSound" src="../../systems/IGPRentalSystem/lib/Barcode scanner beep sound (sound effect).mp3" preload="auto"></audio>
    <script src="../../assets/js/igp-api.js?v=20260819-payment-officer-1"></script>
    <script src="../../assets/js/igp-rental-history-exact.js?v=20260830-order-number-2"></script>
    <script src="../../assets/js/readonly-org-dashboard.js?v=20260823-single-banner-3"></script>
</body>

</html>


