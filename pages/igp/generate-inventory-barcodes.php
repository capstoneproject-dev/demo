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
    <title>IGP Rental - Barcodes</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
<div class="container py-4">
    <h1 class="h4">Inventory Barcodes</h1>
    <nav class="mb-3">
        <a class="btn btn-sm btn-outline-primary" href="index.php">Rental</a>
        <a class="btn btn-sm btn-outline-primary" href="inventory.php">Inventory</a>
        <a class="btn btn-sm btn-outline-primary" href="rental-history.php">History</a>
        <a class="btn btn-sm btn-outline-primary" href="financial-summary.php">Financial</a>
        <a class="btn btn-sm btn-primary" href="generate-inventory-barcodes.php">Barcodes</a>
        <a class="btn btn-sm btn-outline-secondary" href="import.php">Import</a>
    </nav>

    <div id="bc_msg" class="small text-danger mb-2"></div>
    <div id="barcode_cards" class="d-grid gap-2"></div>
</div>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<script src="../../assets/js/igp-api.js"></script>
<script src="../../assets/js/igp-barcodes.js"></script>
</body>
</html>
