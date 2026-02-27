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
    <title>IGP Rental - Dashboard</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
<div class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h1 class="h4 mb-0">IGP Rental Panel</h1>
        <div class="small text-muted">
            <?= htmlspecialchars($session['active_org_name'] ?? 'Organization', ENT_QUOTES, 'UTF-8') ?>
        </div>
    </div>

    <nav class="mb-3">
        <a class="btn btn-sm btn-primary" href="index.php">Rental</a>
        <a class="btn btn-sm btn-outline-primary" href="inventory.php">Inventory</a>
        <a class="btn btn-sm btn-outline-primary" href="rental-history.php">History</a>
        <a class="btn btn-sm btn-outline-primary" href="financial-summary.php">Financial</a>
        <a class="btn btn-sm btn-outline-primary" href="generate-inventory-barcodes.php">Barcodes</a>
        <a class="btn btn-sm btn-outline-secondary" href="import.php">Import</a>
    </nav>

    <div class="card mb-3">
        <div class="card-header">Create Rental</div>
        <div class="card-body">
            <form id="rent_form" class="row g-2">
                <div class="col-md-4">
                    <label class="form-label">Item</label>
                    <select id="rent_item_id" class="form-select" required></select>
                </div>
                <div class="col-md-3">
                    <label class="form-label">Renter Identifier</label>
                    <input id="rent_renter_identifier" class="form-control" placeholder="Student # / Email" required>
                </div>
                <div class="col-md-3">
                    <label class="form-label">Officer Identifier (optional)</label>
                    <input id="rent_officer_identifier" class="form-control" placeholder="Student # / Employee #">
                </div>
                <div class="col-md-2">
                    <label class="form-label">Hours</label>
                    <input id="rent_hours" type="number" min="1" value="1" class="form-control" required>
                </div>
                <div class="col-12">
                    <label class="form-label">Notes</label>
                    <input id="rent_notes" class="form-control" placeholder="Optional">
                </div>
                <div class="col-12">
                    <button class="btn btn-success" type="submit">Rent Item</button>
                </div>
            </form>
            <div id="rent_msg" class="small text-danger mt-2"></div>
        </div>
    </div>

    <div class="card">
        <div class="card-header">Current Rentals</div>
        <div class="table-responsive">
            <table class="table table-sm table-striped mb-0">
                <thead>
                <tr>
                    <th>ID</th>
                    <th>Item(s)</th>
                    <th>Renter</th>
                    <th>Rent Time</th>
                    <th>Expected Return</th>
                    <th>Action</th>
                </tr>
                </thead>
                <tbody id="current_rentals"></tbody>
            </table>
        </div>
    </div>
</div>

<script src="../../assets/js/igp-api.js"></script>
<script src="../../assets/js/igp-index.js"></script>
</body>
</html>
