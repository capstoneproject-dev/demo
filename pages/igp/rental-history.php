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
    <title>IGP Rental - History</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
<div class="container py-4">
    <h1 class="h4">Rental History</h1>
    <nav class="mb-3">
        <a class="btn btn-sm btn-outline-primary" href="index.php">Rental</a>
        <a class="btn btn-sm btn-outline-primary" href="inventory.php">Inventory</a>
        <a class="btn btn-sm btn-primary" href="rental-history.php">History</a>
        <a class="btn btn-sm btn-outline-primary" href="financial-summary.php">Financial</a>
        <a class="btn btn-sm btn-outline-primary" href="generate-inventory-barcodes.php">Barcodes</a>
        <a class="btn btn-sm btn-outline-secondary" href="import.php">Import</a>
    </nav>

    <div class="card mb-3">
        <div class="card-body row g-2">
            <div class="col-md-3"><input id="rh_q" class="form-control" placeholder="Search"></div>
            <div class="col-md-2">
                <select id="rh_status" class="form-select">
                    <option value="">All Status</option>
                    <option value="active">active</option>
                    <option value="returned">returned</option>
                    <option value="overdue">overdue</option>
                    <option value="cancelled">cancelled</option>
                </select>
            </div>
            <div class="col-md-2">
                <select id="rh_payment" class="form-select">
                    <option value="">All Payment</option>
                    <option value="paid">paid</option>
                    <option value="unpaid">unpaid</option>
                </select>
            </div>
            <div class="col-md-2"><input id="rh_date_from" type="date" class="form-control"></div>
            <div class="col-md-2"><input id="rh_date_to" type="date" class="form-control"></div>
        </div>
    </div>

    <div id="rh_msg" class="small text-danger mb-2"></div>
    <div class="card">
        <div class="table-responsive">
            <table class="table table-sm table-striped mb-0">
                <thead>
                <tr>
                    <th>ID</th><th>Items</th><th>Renter</th><th>Rent</th><th>Returned</th><th>Total</th><th>Status</th><th>Payment</th><th>Action</th>
                </tr>
                </thead>
                <tbody id="rh_rows"></tbody>
            </table>
        </div>
    </div>
</div>
<script src="../../assets/js/igp-api.js"></script>
<script src="../../assets/js/igp-rental-history.js"></script>
</body>
</html>
