<?php
require_once __DIR__ . '/../../includes/auth.php';
$session = guardSession('../login.html');
if (($session['login_role'] ?? '') !== 'org' || empty($session['active_org_id'])) {
    header('Location: ../login.html');
    exit;
}
$databaseContext = trim((string)($_GET['context'] ?? ''));
$isExplicitQrAttendanceContext = $databaseContext === 'qr-attendance';
$defaultReturnTo = $isExplicitQrAttendanceContext
    ? '../qr-attendance/events.php'
    : '../officerDashboard.html';
$returnTo = trim((string)($_GET['return'] ?? $defaultReturnTo));
if ($returnTo === '' || strpos($returnTo, '..') !== 0) {
    $returnTo = $defaultReturnTo;
}
$isQrAttendanceContext = $isExplicitQrAttendanceContext
    || strpos($returnTo, '../qr-attendance/') === 0;
$databaseReturnUrl = '../shared/student-database.php?context=' . rawurlencode(
    $isQrAttendanceContext ? 'qr-attendance' : 'services-tracker'
) . '&return=' . rawurlencode($returnTo);
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <script src="../../assets/js/app-dialog.js?v=20260807-security-1"></script>
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
                    <?php if ($isQrAttendanceContext): ?>
                    <li class="nav-item">
                        <a class="nav-link" href="../qr-attendance/events.php">Events</a>
                    </li>

                    <li class="nav-item">
                        <a class="nav-link active" href="<?php echo htmlspecialchars($databaseReturnUrl, ENT_QUOTES, 'UTF-8'); ?>">Database</a>
                    </li>
                    <?php else: ?>
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
                    <?php endif; ?>
                </ul>
            </div>
        </div>
    </nav>
    <div class="container main-content">
        <div class="d-flex justify-content-between align-items-center mb-3">
            <a href="<?php echo htmlspecialchars($returnTo, ENT_QUOTES, 'UTF-8'); ?>" class="btn btn-secondary">&larr; Back</a>
            <button type="button" id="downloadAllStudentBarcodes" class="btn btn-primary me-2" disabled>Download All Barcodes</button>
        </div>
        <h1 class="mb-4">Student Barcode Database</h1>
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

    <script src="../../systems/IGPRentalSystem/lib/bootstrap.bundle.min.js"></script>
    <script src="../../systems/IGPRentalSystem/lib/JsBarcode.all.min.js"></script>
    <script src="../../systems/QR-Attendance/lib/jszip.min.js"></script>
    <script src="../../systems/IGPRentalSystem/lib/xlsx.full.min.js"></script>
    <script src="../../systems/IGPRentalSystem/lib/encoder.js"></script>
    <script src="../../assets/js/igp-api.js?v=20260227e"></script>
    <script src="../../assets/js/barcode-download.js?v=20260821-compact-white-background"></script>
    <script src="../../assets/js/igp-students-exact.js?v=20260821-readonly-compact"></script>
    <script src="../../assets/js/readonly-org-dashboard.js?v=20260823-single-banner-3"></script>
</body>

</html>
