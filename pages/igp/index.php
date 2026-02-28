<?php
require_once __DIR__ . '/../../includes/auth.php';
$session = guardSession('../login.html');
if (($session['login_role'] ?? '') !== 'org' || empty($session['active_org_id'])) {
    header('Location: ../login.html');
    exit;
}
?><!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Equipment Rental System</title>
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
                                <a class="dropdown-item" href="student-database.php">
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
                    </li>
                </ul>


            </div>
        </div>
    </nav>

    <div class="container main-content">

        <!-- Rental Panel -->
        <div class="card">
            <div class="card-header">
                <h2 class="h5 mb-0">Rental Panel</h2>
            </div>
            <div class="card-body">
                <div class="mb-3">
                    <div class="mb-3">
                        <div class="btn-group" role="group">
                            <input type="radio" class="btn-check" name="inputMode" id="scanMode" checked>
                            <label class="btn btn-outline-primary" for="scanMode">Barcode Scan</label>
                            <input type="radio" class="btn-check" name="inputMode" id="manualMode">
                            <label class="btn btn-outline-primary" for="manualMode">Manual Input</label>
                        </div>
                    </div>
                    <div class="mb-2">
                        <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio" name="scanMode" id="rentMode" value="rent" checked>
                            <label class="form-check-label" for="rentMode">Rent Item</label>
                        </div>
                        <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio" name="scanMode" id="returnMode" value="return">
                            <label class="form-check-label" for="returnMode">Return Item</label>
                        </div>
                    </div>
                    <!-- Barcode Input -->
                    <div id="barcodeInputSection">
                        <label for="barcodeInput" class="form-label">Scan Barcode</label>
                        <input type="text" class="form-control" id="barcodeInput" autofocus autocomplete="off"
                            placeholder="Scan barcode here...">
                        <small class="form-text text-muted" id="scanInstructions">In Rent mode: First scan student ID,
                            then scan officer ID to verify, then scan item. <br>In Return mode: First scan officer ID,
                            then scan item.</small>
                    </div>
                    <!-- Manual Input -->
                    <div id="manualInputSection" style="display: none;">
                        <div id="manualStudentInputs">
                            <div class="mb-3">
                                <label for="studentName" class="form-label">Student Name</label>
                                <input type="text" class="form-control" id="studentName"
                                    placeholder="Enter student name">
                            </div>
                            <div class="mb-3">
                                <label for="studentId" class="form-label">Student ID</label>
                                <input type="text" class="form-control" id="studentId" placeholder="Enter student ID">
                            </div>
                            <div class="mb-3">
                                <label for="studentSection" class="form-label">Section</label>
                                <input type="text" class="form-control" id="studentSection" placeholder="Enter section">
                            </div>
                        </div>
                        <div class="mb-3">
                            <label for="itemSelect" class="form-label">Select Item</label>
                            <select class="form-select" id="itemSelect">
                                <option value="">Choose an item...</option>
                            </select>
                            <div class="mt-2">
                                <label for="barcodeInputItemManual" class="form-label">Scan Item Barcode
                                    (optional)</label>
                                <input type="text" class="form-control" id="barcodeInputItemManual"
                                    placeholder="Scan item barcode here...">
                                <small class="form-text text-muted">Scanning here will auto-select the matching
                                    item</small>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label for="barcodeInputOfficer" class="form-label">Scan Officer Barcode</label>
                            <input type="text" class="form-control" id="barcodeInputOfficer"
                                placeholder="Scan officer barcode here...">
                            <small class="form-text text-muted">Scan officer's barcode to verify and process the
                                transaction</small>
                        </div>

                    </div>
                    <br><button id="cancelTransaction" class="btn btn-warning btn-sm mt-2" type="button">Cancel
                        Transaction</button>
                </div>
                <div class="result-box mb-3">
                    <h3 class="h6">Last Scan Result:</h3>
                    <div id="scanResult">No barcode scanned yet</div>
                </div>
            </div>
        </div>

        <!-- Rental Records -->
        <div id="rental-records" class="card mt-4">
            <div class="card-header">
                <h2 class="h5 mb-0">Rental Records</h2>
            </div>
            <div class="card-body">
                <div class="row">
                    <!-- Left: Available Items -->
                    <div class="col-md-6">
                        <h3 class="h6">Available Items</h3>
                        <div class="mb-2">
                            <label for="itemFilter" class="form-label mb-0 me-2">Filter by Category:</label>
                            <select id="itemFilter" class="form-select form-select-sm w-auto d-inline-block">
                                <option value="all">All</option>
                            </select>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-bordered">
                                <thead>
                                    <tr>
                                        <th>Item ID</th>
                                        <th>Name</th>
                                        <th>Status</th>
                                        <th>Reserved/Rented By</th>
                                        <th>Rental Start Time</th>
                                        <th>Rental End Time</th>
                                    </tr>
                                </thead>
                                <tbody id="availableItems">
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <!-- Right: Current Rentals -->
                    <div class="col-md-6">
                        <h3 class="h6">Current Rentals</h3>
                        <div class="mb-3">
                            <input type="text" class="form-control" id="rentalSearch"
                                placeholder="Search rentals by ID, name, or renter...">
                        </div>
                        <div class="table-responsive" style="max-height: 1000px; overflow-y: auto;">
                            <table class="table">
                                <thead style="position: sticky; top: 0; background: white; z-index: 1;">
                                    <tr>
                                        <th>Action</th>
                                        <th>Name/Item ID</th>
                                        <th>Rented By</th>
                                        <th>Section</th>
                                        <th>Time Rented</th>
                                        <th>Expected Return</th>
                                        <th>Time Remaining</th>
                                        <th>Price</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody id="rentalRecords">
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Rental Duration Modal -->
    <div class="modal fade" id="rentalHoursModal" tabindex="-1" aria-labelledby="rentalHoursModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="rentalHoursModalLabel">Enter Rental Duration</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p id="rentalHoursItemText" class="mb-2"></p>
                    <div class="mb-2">
                        <label for="rentalHoursInput" class="form-label">Number of Hours</label>
                        <input type="number" class="form-control" id="rentalHoursInput" min="1" value="1">
                    </div>
                    <div class="alert alert-info mb-0 mt-2 d-none" id="rentalHoursDetails"></div>
                    <small class="text-muted" id="rentalHoursRateText"></small>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="confirmRentalHoursBtn">Confirm Rental</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Confirm Return Modal -->
    <div class="modal fade" id="confirmReturnModal" tabindex="-1" aria-labelledby="confirmReturnModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="confirmReturnModalLabel">Confirm Return</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p id="confirmReturnText" class="mb-2"></p>
                    <ul class="mb-0">
                        <li id="confirmReturnRenter"></li>
                    </ul>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="confirmReturnBtn">Confirm Return</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Officer Verification Modal -->
    <div class="modal fade" id="officerVerificationModal" tabindex="-1" aria-labelledby="officerVerificationModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="officerVerificationModalLabel">Officer Verification</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p id="officerVerificationText"></p>
                    <div class="mb-3">
                        <label for="officerVerificationInput" class="form-label">Officer Barcode</label>
                        <input type="text" class="form-control" id="officerVerificationInput" 
                            placeholder="Scan officer barcode here..." autocomplete="off">
                    </div>
                    <div id="officerVerificationMessage" class="small text-danger"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="verifyOfficerBtn">Verify and Return</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Return Payment Modal -->
    <div class="modal fade" id="returnPaymentModal" tabindex="-1" aria-labelledby="returnPaymentModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="returnPaymentModalLabel">Rental Payment</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p class="mb-1">Base Cost: <strong id="paymentBaseCost">₱0.00</strong></p>
                    <p class="mb-1">Overtime Cost: <strong id="paymentOvertimeCost">₱0.00</strong></p>
                    <p class="mb-0">Total Cost: <strong id="paymentTotalCost">₱0.00</strong></p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Keep as Unpaid</button>
                    <button type="button" class="btn btn-success" id="markReturnPaidBtn">Mark as Paid</button>
                </div>
            </div>
        </div>
    </div>

    <script src="../../systems/IGPRentalSystem/lib/bootstrap.bundle.min.js"></script>
    <script src="../../assets/js/igp-api.js?v=20260227n"></script>
    <script src="../../assets/js/igp-index-exact.js?v=20260227n"></script>
</body>

</html>

