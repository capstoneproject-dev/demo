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
    <title>Inventory Management - Equipment Rental System</title>
    <link href="../../systems/IGPRentalSystem/lib/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../../systems/IGPRentalSystem/lib/styles.css">
    <style>
        .group-pricing-card {
            background: #ffffff;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            box-shadow: 0 6px 18px rgba(16,24,40,0.04);
            padding: 16px;
            margin-bottom: 8px;
        }

        .group-pricing-card .form-control {
            background: transparent;
        }

        .group-header {
            background: #f8f9fa;
        }

        #inventoryList .group-header strong {
            font-size: 1.02rem;
        }

        #inventoryList .group-items table {
            border: 1px solid #dee2e6;
        }

        #inventoryList .group-items thead th {
            background: #f8f9fa;
            font-weight: 600;
            white-space: nowrap;
        }

        #inventoryList .inventory-actions .btn {
            min-width: 92px;
            padding: 0.25rem 0.6rem;
        }
    </style>
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
                    <li class="nav-item">
                        <a class="nav-link" href="index.php">Home</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>
    <div class="container main-content">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1 class="mb-0">Inventory Management</h1>
            <div>
                <a href="welcome.html" class="btn btn-outline-secondary me-2">Home</a>
                <a href="index.php" class="btn btn-outline-primary">Rental System</a>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h2 class="h5 mb-0">Current Inventory</h2>
            </div>
            <div class="card-body">
                <div class="table-responsive mb-4">
                    <table class="table table-bordered mb-0">
                        <thead>
                            <tr>
                                <th>Item ID</th>
                                <th>Number of Items</th>
                                <th>Items Available</th>
                                <th>Items Rented</th>
                                <th>Items Reserved</th>
                            </tr>
                        </thead>
                        <tbody id="inventorySummary">
                        </tbody>
                    </table>
                </div>
                <div class="table-responsive">
                    <table class="table">
                        <tbody id="inventoryList">
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="deleteItemModal" tabindex="-1" aria-labelledby="deleteItemModalLabel"
        aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="deleteItemModalLabel">Confirm Delete</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p>Type <strong>Delete</strong> to confirm deleting this inventory item. This cannot be undone.</p>
                    <input type="text" class="form-control" id="deleteItemConfirmInput"
                        placeholder="Type 'Delete' to confirm">
                    <div id="deleteItemConfirmError" class="text-danger mt-2" style="display:none;"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-danger" id="deleteItemConfirmBtn">Delete</button>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="priceEditModal" tabindex="-1" aria-labelledby="priceEditModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="priceEditModalLabel">Edit Item Pricing</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p id="priceEditItemLabel" class="mb-3 text-muted"></p>
                    <div class="mb-3">
                        <label for="priceModalHourlyRate" class="form-label">Price Per Hour (PHP)</label>
                        <input type="number" class="form-control" id="priceModalHourlyRate" min="0" step="0.01" required>
                    </div>
                    <div class="mb-3">
                        <label for="priceModalOvertimeInterval" class="form-label">Overtime Every (mins)</label>
                        <input type="number" class="form-control" id="priceModalOvertimeInterval" min="1" step="1" placeholder="Leave blank to disable">
                    </div>
                    <div class="mb-3">
                        <label for="priceModalOvertimeRate" class="form-label">Overtime Rate (PHP/block)</label>
                        <input type="number" class="form-control" id="priceModalOvertimeRate" min="0" step="0.01" placeholder="Leave blank to disable">
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="priceModalApplyAll">
                        <label class="form-check-label" for="priceModalApplyAll">
                            Apply to all items in this category
                        </label>
                    </div>
                    <div id="priceModalError" class="text-danger mt-2" style="display:none;"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="priceModalSaveBtn">Save Changes</button>
                </div>
            </div>
        </div>
    </div>

    <script src="../../systems/IGPRentalSystem/lib/bootstrap.bundle.min.js"></script>
    <script src="../../assets/js/igp-api.js?v=20260227c"></script>
    <script src="../../assets/js/igp-inventory-exact.js?v=20260227c"></script>
</body>

</html>
