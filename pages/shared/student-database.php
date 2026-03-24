<?php
require_once __DIR__ . '/../../includes/auth.php';
$session = guardSession('../login.html');
if (($session['login_role'] ?? '') !== 'org' || empty($session['active_org_id'])) {
    header('Location: ../login.html');
    exit;
}
$returnTo = trim((string)($_GET['return'] ?? '../officerDashboard.html'));
if ($returnTo === '' || strpos($returnTo, '..') !== 0) {
    $returnTo = '../officerDashboard.html';
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Barcode Student Database</title>
    <link href="../../systems/IGPRentalSystem/lib/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../../systems/IGPRentalSystem/lib/styles.css">
    <style>
        .barcode-img {
            margin: 0 10px 10px 0;
        }

        .student-card {
            border: 1px solid #ccc;
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 12px;
            background: #f8f9fa;
        }

        .section-title {
            margin-top: 32px;
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
                        <a class="nav-link" href="../igp/rental-history.php">History</a>
                    </li>

                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" id="inventoryDropdown" role="button"
                            data-bs-toggle="dropdown" aria-expanded="false">
                            Inventory
                        </a>
                        <ul class="dropdown-menu mega-menu shadow-lg border-0" aria-labelledby="inventoryDropdown">
                            <li>
                                <a class="dropdown-item" href="../igp/inventory.php">
                                    <div class="fw-bold text-dark">Manage Inventory</div>
                                    <small class="text-muted d-block">Update stocks & availability</small>
                                </a>
                            </li>
                            <li>
                                <a class="dropdown-item mt-2" href="../igp/generate-inventory-barcodes.php">
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
                                <a class="dropdown-item" href="../shared/student-database.php?return=../igp/index.php">
                                    <div class="fw-bold text-dark">Student Database</div>
                                    <small class="text-muted d-block">Manage customer records</small>
                                </a>
                            </li>
                            <li>
                                <a class="dropdown-item mt-2" href="../igp/admin.php">
                                    <div class="fw-bold text-dark">Officer Database</div>
                                    <small class="text-muted d-block">Manage authorized personnel</small>
                                </a>
                            </li>
                        </ul>
                    </li>

                    <li class="nav-item">
                        <a class="nav-link" href="<?php echo htmlspecialchars($returnTo, ENT_QUOTES, 'UTF-8'); ?>">Home</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>
    <div class="container main-content">
        <div class="d-flex justify-content-between align-items-center mb-3">
            <a href="<?php echo htmlspecialchars($returnTo, ENT_QUOTES, 'UTF-8'); ?>" class="btn btn-secondary">&larr; Back</a>
            <div>
                <button id="clearAll" class="btn btn-danger me-2">Clear All</button>
                <button id="exportExcel" class="btn btn-success">Export to Excel</button>
            </div>
        </div>
        <h1 class="mb-4">Student Barcode Database</h1>
        <div class="mb-3">
            <label for="excelInput" class="form-label">Import Excel File (.xlsx):</label>
            <input type="file" id="excelInput" accept=".xlsx" class="form-control" />
        </div>
        <div class="row g-2 mb-3">
            <div class="col-md-4">
                <select id="programFilter" class="form-select">
                    <option value="__ORG__">Organization Programs</option>
                    <option value="__ALL__">All Programs</option>
                </select>
            </div>
            <div class="col-md-8">
                <div class="input-group">
                    <input type="text" id="searchInput" class="form-control"
                        placeholder="Search by ID, name, or section...">
                    <button class="btn btn-outline-secondary" type="button" id="clearSearch">Clear</button>
                </div>
            </div>
        </div>
        <div id="database"></div>
    </div>

    <!-- Clear All Confirmation Modal -->
    <div class="modal fade" id="clearAllModal" tabindex="-1" aria-labelledby="clearAllModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="clearAllModalLabel">Delete All Students</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-danger" role="alert">
                        <strong>Warning:</strong> This action cannot be undone. All students will be permanently
                        deleted.
                    </div>
                    <p>To confirm, please type <strong>"Delete"</strong> in the box below:</p>
                    <input type="text" id="deleteConfirmInput" class="form-control"
                        placeholder="Type 'Delete' to confirm">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-danger" id="confirmDeleteAll" disabled>Delete All
                        Students</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Delete Single Student Confirmation Modal -->
    <div class="modal fade" id="deleteStudentModal" tabindex="-1" aria-labelledby="deleteStudentModalLabel"
        aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="deleteStudentModalLabel">Delete Student</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-danger" role="alert">
                        <strong>Warning:</strong> This action cannot be undone. This student will be permanently
                        deleted.
                    </div>
                    <p>To confirm, please type <strong>"Delete"</strong> in the box below:</p>
                    <input type="text" id="deleteStudentConfirmInput" class="form-control"
                        placeholder="Type 'Delete' to confirm">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-danger" id="confirmDeleteStudent" disabled>Delete
                        Student</button>
                </div>
            </div>
        </div>
    </div>

    <script src="../../systems/IGPRentalSystem/lib/bootstrap.bundle.min.js"></script>
    <script src="../../systems/IGPRentalSystem/lib/JsBarcode.all.min.js"></script>
    <script src="../../systems/IGPRentalSystem/lib/xlsx.full.min.js"></script>
    <script src="../../systems/IGPRentalSystem/lib/encoder.js"></script>
    <script src="../../assets/js/igp-api.js?v=20260227e"></script>
    <script src="../../assets/js/igp-students-exact.js?v=20260227e"></script>
</body>

</html>
