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
    <title>IGP Rental - Inventory</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
<div class="container py-4">
    <h1 class="h4">Inventory</h1>
    <nav class="mb-3">
        <a class="btn btn-sm btn-outline-primary" href="index.php">Rental</a>
        <a class="btn btn-sm btn-primary" href="inventory.php">Inventory</a>
        <a class="btn btn-sm btn-outline-primary" href="rental-history.php">History</a>
        <a class="btn btn-sm btn-outline-primary" href="financial-summary.php">Financial</a>
        <a class="btn btn-sm btn-outline-primary" href="generate-inventory-barcodes.php">Barcodes</a>
        <a class="btn btn-sm btn-outline-secondary" href="import.php">Import</a>
    </nav>

    <div class="card mb-3">
        <div class="card-header">Item Form</div>
        <div class="card-body">
            <form id="inventory_form" class="row g-2">
                <input type="hidden" id="item_id">
                <div class="col-md-3"><input id="item_name" class="form-control" placeholder="Item name" required></div>
                <div class="col-md-2"><input id="barcode" class="form-control" placeholder="Barcode" required></div>
                <div class="col-md-2"><input id="category_name" class="form-control" placeholder="Category"></div>
                <div class="col-md-1"><input id="stock_quantity" type="number" min="0" value="1" class="form-control"></div>
                <div class="col-md-1"><input id="hourly_rate" type="number" min="0" step="0.01" value="0" class="form-control"></div>
                <div class="col-md-1"><input id="overtime_interval_minutes" type="number" min="1" class="form-control" placeholder="OT min"></div>
                <div class="col-md-1"><input id="overtime_rate_per_block" type="number" min="0" step="0.01" class="form-control" placeholder="OT rate"></div>
                <div class="col-md-1">
                    <select id="status" class="form-select">
                        <option value="available">available</option>
                        <option value="rented">rented</option>
                        <option value="maintenance">maintenance</option>
                    </select>
                </div>
                <div class="col-12">
                    <button type="submit" class="btn btn-success">Save</button>
                    <button id="clear_form" type="button" class="btn btn-secondary">Clear</button>
                </div>
            </form>
            <div id="inv_msg" class="small text-danger mt-2"></div>
        </div>
    </div>

    <div class="card">
        <div class="card-header d-flex gap-2 align-items-center">
            <span>Items</span>
            <input id="inv_q" class="form-control form-control-sm" placeholder="Search..." style="max-width: 280px;">
        </div>
        <div class="table-responsive">
            <table class="table table-sm table-striped mb-0">
                <thead>
                <tr>
                    <th>ID</th><th>Name</th><th>Barcode</th><th>Category</th><th>Avail/Stock</th><th>Rate</th><th>Status</th><th>Action</th>
                </tr>
                </thead>
                <tbody id="inventory_rows"></tbody>
            </table>
        </div>
    </div>
</div>
<script src="../../assets/js/igp-api.js"></script>
<script src="../../assets/js/igp-inventory.js"></script>
</body>
</html>
