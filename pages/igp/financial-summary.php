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
    <title>IGP Rental - Financial Summary</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
<div class="container py-4">
    <h1 class="h4">Financial Summary</h1>
    <nav class="mb-3">
        <a class="btn btn-sm btn-outline-primary" href="index.php">Rental</a>
        <a class="btn btn-sm btn-outline-primary" href="inventory.php">Inventory</a>
        <a class="btn btn-sm btn-outline-primary" href="rental-history.php">History</a>
        <a class="btn btn-sm btn-primary" href="financial-summary.php">Financial</a>
        <a class="btn btn-sm btn-outline-primary" href="generate-inventory-barcodes.php">Barcodes</a>
        <a class="btn btn-sm btn-outline-secondary" href="import.php">Import</a>
    </nav>

    <div class="card mb-3">
        <div class="card-body row g-2">
            <div class="col-md-3"><input id="fs_q" class="form-control" placeholder="Search"></div>
            <div class="col-md-2">
                <select id="fs_payment" class="form-select">
                    <option value="">All Payment</option>
                    <option value="paid">paid</option>
                    <option value="unpaid">unpaid</option>
                </select>
            </div>
            <div class="col-md-2"><input id="fs_date_from" type="date" class="form-control"></div>
            <div class="col-md-2"><input id="fs_date_to" type="date" class="form-control"></div>
        </div>
    </div>

    <div class="row g-2 mb-3">
        <div class="col-md-2"><div class="card"><div class="card-body"><div class="small text-muted">Transactions</div><div id="fs_total_transactions" class="h5 mb-0">0</div></div></div></div>
        <div class="col-md-2"><div class="card"><div class="card-body"><div class="small text-muted">Paid</div><div id="fs_paid_transactions" class="h5 mb-0">0</div></div></div></div>
        <div class="col-md-2"><div class="card"><div class="card-body"><div class="small text-muted">Unpaid</div><div id="fs_unpaid_transactions" class="h5 mb-0">0</div></div></div></div>
        <div class="col-md-3"><div class="card"><div class="card-body"><div class="small text-muted">Revenue</div><div id="fs_total_revenue" class="h5 mb-0">0.00</div></div></div></div>
        <div class="col-md-3"><div class="card"><div class="card-body"><div class="small text-muted">Outstanding</div><div id="fs_total_unpaid" class="h5 mb-0">0.00</div></div></div></div>
    </div>

    <div id="fs_msg" class="small text-danger mb-2"></div>
    <div class="card">
        <div class="table-responsive">
            <table class="table table-sm table-striped mb-0">
                <thead><tr><th>ID</th><th>Items</th><th>Renter</th><th>Date</th><th>Total</th><th>Payment</th></tr></thead>
                <tbody id="fs_rows"></tbody>
            </table>
        </div>
    </div>
</div>
<script src="../../assets/js/igp-api.js"></script>
<script src="../../assets/js/igp-financial-summary.js"></script>
</body>
</html>
