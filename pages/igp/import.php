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
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
<div class="container py-4">
    <h1 class="h4">Legacy localStorage Import</h1>
    <nav class="mb-3">
        <a class="btn btn-sm btn-outline-primary" href="index.php">Rental</a>
        <a class="btn btn-sm btn-outline-primary" href="inventory.php">Inventory</a>
        <a class="btn btn-sm btn-outline-primary" href="rental-history.php">History</a>
        <a class="btn btn-sm btn-outline-primary" href="financial-summary.php">Financial</a>
        <a class="btn btn-sm btn-outline-primary" href="generate-inventory-barcodes.php">Barcodes</a>
        <a class="btn btn-sm btn-primary" href="import.php">Import</a>
    </nav>

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
<script src="../../assets/js/igp-api.js"></script>
<script src="../../assets/js/igp-import.js"></script>
</body>
</html>
