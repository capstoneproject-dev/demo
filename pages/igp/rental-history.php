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
    <title>Rental History</title>
    <link href="../../systems/IGPRentalSystem/lib/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../../systems/IGPRentalSystem/lib/styles.css">
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

                    <li class="nav-item">
                        <a class="nav-link" href="financial-summary.php">Financial Summary</a>
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
    <div class="container main-content">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1 class="mb-0">Rental History</h1>
            <div>
                <a href="index.php" class="btn btn-outline-secondary me-2">Back to Rental System</a>
                <button class="btn btn-outline-success nav-secure-btn me-2"
                    data-target="financial-summary.html">Financial Summary</button>
                <button id="clearHistory" class="btn btn-danger me-2">Clear History</button>
                <button id="exportExcel" class="btn btn-success me-2">Export to Excel</button>
                <input type="file" id="importExcel" accept=".xlsx" style="display:inline-block; width:auto;"
                    class="form-control form-control-sm" />
            </div>
        </div>
        <div class="card">
            <div class="card-header">
                <div class="d-flex align-items-center flex-wrap gap-2">
                    <div class="d-flex align-items-center">
                        <label for="historyDateFilter" class="form-label mb-0 me-2">Filter by Date:</label>
                        <input type="date" id="historyDateFilter" class="form-control form-control-sm"
                            style="max-width:200px;display:inline-block;">
                    </div>
                    <div class="d-flex align-items-center">
                        <label for="historyMonthFilter" class="form-label mb-0 me-2">Filter by Month:</label>
                        <input type="month" id="historyMonthFilter" class="form-control form-control-sm"
                            style="max-width:200px;display:inline-block;">
                    </div>
                    <button id="showAllDatesBtn" class="btn btn-info btn-sm">Show All Dates</button>
                </div>
            </div>
            <div class="card-body">
                <div class="mb-3">
                    <h5>Total Profit: <span id="totalProfit">₱0</span></h5>
                    <button id="payAllBtn" class="btn btn-warning btn-sm ms-3" style="display:none;">Mark All as
                        Paid</button>
                </div>
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Item ID</th>
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
                                <th>Delete</th> <!-- New column for delete button -->
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
    <!-- Delete Confirmation Modal -->
    <div class="modal fade" id="deleteConfirmModal" tabindex="-1" aria-labelledby="deleteConfirmModalLabel"
        aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="deleteConfirmModalLabel">Confirm Delete</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p>Type <strong>Delete</strong> to confirm clearing all rental history. This cannot be undone.</p>
                    <input type="text" class="form-control" id="deleteConfirmInput"
                        placeholder="Type 'Delete' to confirm">
                    <div id="deleteConfirmError" class="text-danger mt-2" style="display:none;"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-danger" id="deleteConfirmBtn">Delete</button>
                </div>
            </div>
        </div>
    </div>
    <!-- Individual Delete Confirmation Modal -->
    <div class="modal fade" id="deleteRecordModal" tabindex="-1" aria-labelledby="deleteRecordModalLabel"
        aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="deleteRecordModalLabel">Confirm Delete Record</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p>Type <strong>Delete</strong> to confirm deleting this rental record. This cannot be undone.</p>
                    <input type="text" class="form-control" id="deleteRecordConfirmInput"
                        placeholder="Type 'Delete' to confirm">
                    <div id="deleteRecordConfirmError" class="text-danger mt-2" style="display:none;"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-danger" id="deleteRecordConfirmBtn">Delete</button>
                </div>
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
    <script src="../../assets/js/igp-api.js"></script>
    <script src="../../assets/js/igp-rental-history-exact.js"></script>
</body>

</html>


