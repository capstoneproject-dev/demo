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
    <title>IGP Rental - Import</title>
    <link href="../../systems/IGPRentalSystem/lib/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../../systems/IGPRentalSystem/lib/styles.css">
</head>
<body>
<nav class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top custom-navbar">
    <div class="container">
        <a class="navbar-brand d-flex align-items-center" href="#"></a>
        <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="mainNav">
            <ul class="navbar-nav ms-auto mb-2 mb-lg-0 nav-pills-custom">
                <li class="nav-item"><a class="nav-link" href="index.php">Rental</a></li>
                <li class="nav-item"><a class="nav-link" href="rental-history.php">History</a></li>
                <li class="nav-item"><a class="nav-link" href="inventory.php">Inventory</a></li>
                <li class="nav-item"><a class="nav-link" href="financial-summary.php">Financial Summary</a></li>
                <li class="nav-item"><a class="nav-link" href="generate-inventory-barcodes.php">Inventory Barcodes</a></li>
                <li class="nav-item"><a class="nav-link active" href="import.php">Import</a></li>
            </ul>
        </div>
    </div>
</nav>
<div class="container main-content">

    <div class="card mb-3">
        <div class="card-body">
            <button id="import_from_local" class="btn btn-primary">Import From Browser localStorage</button>
        </div>
    </div>
    <div class="card mb-3">
        <div class="card-header">Or paste JSON payload</div>
        <div class="card-body">
            <textarea id="import_json" class="form-control" rows="10" placeholder='{"inventoryItems":[],"rentalRecords":[]}'></textarea>
            <button id="import_from_json" class="btn btn-success mt-2">Import JSON</button>
        </div>
    </div>

    <div id="import_msg" class="small text-danger mb-2"></div>
    <pre id="import_result" class="bg-dark text-light p-3 small rounded"></pre>
</div>
<script src="../../systems/IGPRentalSystem/lib/bootstrap.bundle.min.js"></script>
<script src="../../assets/js/igp-api.js"></script>
<script src="../../assets/js/igp-import.js"></script>
</body>
</html>
