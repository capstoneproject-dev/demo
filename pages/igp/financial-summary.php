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
    <title>Financial Summary</title>
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
                                <a class="dropdown-item" href="../shared/student-database.php?return=../igp/financial-summary.php">
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
            <h1 class="mb-0">Financial Summary</h1>
            <div>
                <a href="index.php" class="btn btn-outline-secondary me-2">Back to Rental System</a>
                <a href="rental-history.php" class="btn btn-outline-info">Rental History</a>
            </div>
        </div>

        <!-- Filters Section -->
        <div class="card mb-4">
            <div class="card-body">
                <div class="row g-3">
                    <div class="col-md-3">
                        <label for="fsItemFilter" class="form-label">Filter by Item:</label>
                        <select id="fsItemFilter" class="form-select"></select>
                    </div>
                    <div class="col-md-3">
                        <label for="fsStartDate" class="form-label">Start Date:</label>
                        <input type="date" id="fsStartDate" class="form-control">
                    </div>
                    <div class="col-md-3">
                        <label for="fsEndDate" class="form-label">End Date:</label>
                        <input type="date" id="fsEndDate" class="form-control">
                    </div>
                    <div class="col-md-3">
                        <label for="fsPaymentStatus" class="form-label">Payment Status:</label>
                        <select id="fsPaymentStatus" class="form-select">
                            <option value="">All</option>
                            <option value="paid">Paid</option>
                            <option value="unpaid">Unpaid</option>
                        </select>
                    </div>
                </div>
                <div class="row mt-3">
                    <div class="col-12">
                        <button id="fsClearFilters" class="btn btn-secondary">Clear Filters</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Summary Cards -->
        <div class="row mb-4">
            <div class="col-md-3 mb-3">
                <div class="card text-white bg-success h-100">
                    <div class="card-body">
                        <h5 class="card-title">Total Profit</h5>
                        <h3 id="fsTotalProfit">₱0</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card text-white bg-danger h-100">
                    <div class="card-body">
                        <h5 class="card-title">Total Unpaid</h5>
                        <h3 id="fsTotalUnpaid">₱0</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card text-white bg-primary h-100">
                    <div class="card-body">
                        <h5 class="card-title">Total Transactions</h5>
                        <h3 id="fsTotalTransactions">0</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card text-white bg-info h-100">
                    <div class="card-body">
                        <h5 class="card-title">Paid Transactions</h5>
                        <h3 id="fsPaidTransactions">0</h3>
                    </div>
                </div>
            </div>
        </div>

        <!-- Additional Metrics -->
        <div class="row mb-4">
            <div class="col-md-3 mb-3">
                <div class="card text-white bg-warning h-100">
                    <div class="card-body">
                        <h5 class="card-title">Unpaid Transactions</h5>
                        <h3 id="fsUnpaidTransactions">0</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card text-white bg-secondary h-100">
                    <div class="card-body">
                        <h5 class="card-title">Average Transaction Value</h5>
                        <h3 id="fsAvgPaid">₱0</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card text-white bg-dark h-100">
                    <div class="card-body">
                        <h5 class="card-title">Highest Transaction</h5>
                        <h3 id="fsHighest">₱0</h3>
                        <div id="fsHighestStudent" style="font-size: 0.95em;"></div>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card text-white bg-dark h-100">
                    <div class="card-body">
                        <h5 class="card-title">Lowest Transaction</h5>
                        <h3 id="fsLowest">₱0</h3>
                        <div id="fsLowestStudent" style="font-size: 0.95em;"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Date Range Summary -->
        <div class="card mb-4">
            <div class="card-body">
                <h5>Date Range Summary</h5>
                <p id="fsDateRange" class="mb-0">-</p>
            </div>
        </div>

        <!-- All Transactions Table -->
        <div class="card mb-4">
            <div class="card-body">
                <h5>All Transactions</h5>
                <div class="table-responsive">
                    <table class="table table-striped table-hover">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Item</th>
                                <th>Rented By</th>
                                <th>Section</th>
                                <th>Processed By</th>
                                <th>Returned By</th>
                                <th>Base Cost</th>
                                <th>Overtime</th>
                                <th>Total Cost</th>
                                <th>Status</th>
                                <th>Payment</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="fsAllTransactions"></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Breakdown Tabs -->
        <div class="card">
            <div class="card-body">
                <ul class="nav nav-tabs mb-3" id="fsBreakdownTabs" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" id="monthly-tab" data-bs-toggle="tab" data-bs-target="#monthly"
                            type="button" role="tab">Monthly Breakdown</button>
                    </li>
                </ul>
                <div class="tab-content">
                    <div class="tab-pane fade show active" id="monthly" role="tabpanel">
                        <div class="table-responsive">
                            <table class="table table-bordered">
                                <thead>
                                    <tr>
                                        <th>Month</th>
                                        <th>Total Profit</th>
                                        <th>Total Unpaid</th>
                                        <th>Transactions</th>
                                        <th>Paid Transactions</th>
                                        <th>Unpaid Transactions</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="fsMonthlyBreakdown"></tbody>
                            </table>
                        </div>
                        <div id="monthlyDetails" class="mt-4"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script src="../../systems/IGPRentalSystem/lib/bootstrap.bundle.min.js"></script>
    <script src="../../assets/js/igp-api.js"></script>
    <script src="../../assets/js/igp-financial-summary-exact.js"></script>
</body>

</html>


