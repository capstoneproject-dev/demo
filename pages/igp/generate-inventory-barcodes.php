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
    <title>Generate Inventory Barcodes</title>
    <link href="../../systems/IGPRentalSystem/lib/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../../systems/IGPRentalSystem/lib/styles.css">
    <style>
        .barcode-img {
            margin: 0 10px 10px 0;
        }

        .item-card {
            border: 1px solid #ccc;
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 12px;
            background: #f8f9fa;
        }

        .category-title {
            margin-top: 32px;
        }

        .barcode-container {
            text-align: center;
            margin-bottom: 10px;
        }

        .barcode-container svg {
            max-width: 100%;
            height: auto;
        }

        .download-btn {
            margin-top: 10px;
        }

        /* Subtle floating group pricing card */
        .group-pricing-card {
            background: #ffffff;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            box-shadow: 0 6px 18px rgba(16,24,40,0.04);
            padding: 8px;
            margin-bottom: 14px;
        }

        .group-pricing-card .form-control {
            background: transparent;
        }

        .inventory-image-preview {
            width: 100%;
            height: 100%;
            object-fit: contain;
            padding: 16px;
            display: none;
            background: #f8f9fa;
        }

        .inventory-thumb {
            width: 72px;
            height: 72px;
            object-fit: cover;
            border-radius: 8px;
            border: 1px solid #dee2e6;
            background: #fff;
        }

        .inventory-media-panel {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            background: #ffffff;
            padding: 12px;
            height: 100%;
        }

        .inventory-media-label {
            display: block;
            font-size: 0.82rem;
            font-weight: 500;
            color: #374151;
            margin-bottom: 8px;
        }

        .inventory-image-stage {
            position: relative;
            height: 280px;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            background: #f9fafb;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-top: 10px;
        }

        .inventory-image-preview.is-visible {
            display: block;
        }

        .inventory-image-placeholder {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            color: #6b7280;
            text-align: center;
            padding: 16px;
        }

        .inventory-image-placeholder i {
            font-size: 1.25rem;
            color: #9ca3af;
        }

        .inventory-image-placeholder.hidden {
            display: none;
        }

        .inventory-image-helper {
            margin-top: 8px;
            font-size: 0.76rem;
            color: #6b7280;
        }

        .inventory-settings-stack {
            display: flex;
            flex-direction: column;
            gap: 12px;
            height: 100%;
        }

        .inventory-settings-note {
            flex: 1;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            background: #f9fafb;
            padding: 14px 16px;
            color: #6b7280;
            font-size: 0.82rem;
            line-height: 1.5;
            display: flex;
            align-items: flex-start;
        }

        @media (max-width: 767.98px) {
            .inventory-settings-note {
                min-height: 0;
            }
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
                                <a class="dropdown-item" href="../shared/student-database.php?return=../igp/generate-inventory-barcodes.php">
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
        <div class="d-flex justify-content-between align-items-center mb-3">
            <a href="welcome.html" class="btn btn-secondary">← Back</a>
            <div>
                <button id="downloadAll" class="btn btn-primary me-2">Download All Barcodes</button>
                <button id="importExcel" class="btn btn-info me-2">Import Excel</button>
                <button id="exportExcel" class="btn btn-success me-2">Export to Excel</button>
                <button id="deleteAll" class="btn btn-danger">Delete All</button>
            </div>
        </div>
        <h1 class="mb-4">Inventory Barcode Generator</h1>

        <!-- Add New Item -->
        <div class="card mb-4">
            <div class="card-header">
                <h2 class="h5 mb-0">Add New Item</h2>
            </div>
            <div class="card-body">
                <form id="addItemForm" class="row g-2">
                    <div class="col-md-2">
                        <select class="form-select" id="itemType">
                            <option value="">Item Type</option>
                            <option value="__add_new__">+ Add new type...</option>
                        </select>
                        <input type="text" class="form-control d-none" id="itemTypeCustom"
                            placeholder="Item Type">
                    </div>
                    <div class="col-md-3">
                        <select class="form-select" id="itemName" required>
                            <option value="">Item Name</option>
                            <option value="__add_new__">+ Add new item name...</option>
                        </select>
                        <input type="text" class="form-control d-none" id="itemNameCustom" placeholder="Item Name">
                    </div>
                    <div class="col-md-3">
                        <input type="text" class="form-control" id="barcode" placeholder="Barcode" required>
                    </div>
                    <div class="col-md-2">
                        <input type="number" class="form-control" id="pricePerHour" placeholder="Price/Hour (PHP)" min="0"
                            step="0.01" required>
                    </div>
                    <div class="col-md-2 d-flex gap-2">
                        <button type="submit" class="btn btn-primary flex-fill" id="saveItemButton">Add Item</button>
                        <button type="button" class="btn btn-outline-secondary d-none" id="cancelEditButton">Cancel</button>
                    </div>
                    <div class="col-md-6">
                        <div class="inventory-media-panel">
                            <label for="itemImage" class="inventory-media-label">Item Image</label>
                            <input type="file" class="form-control" id="itemImage" accept="image/png,image/jpeg,image/webp" required>
                            <div class="inventory-image-stage">
                                <img id="itemImagePreview" class="inventory-image-preview" alt="Item preview">
                                <div id="itemImagePlaceholder" class="inventory-image-placeholder">
                                    <i class="fa-regular fa-image"></i>
                                    <div>No image selected yet</div>
                                </div>
                            </div>
                            <div class="inventory-image-helper">Upload a clear photo or product shot for the student services catalog.</div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="inventory-settings-stack">
                            <input type="number" class="form-control" id="overtimeInterval" placeholder="Overtime every (mins)" min="1" step="1" required>
                            <input type="number" class="form-control" id="overtimeRate" placeholder="Overtime rate (PHP/block)" min="0" step="0.01" required>
                            <div class="inventory-settings-note">
                                Overtime is charged every set number of minutes after the due time.
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>

        <!-- Import Excel (Hidden) -->
        <input type="file" id="excelInput" accept=".xlsx" style="display: none;" />

        <!-- Search -->
        <div class="mb-3">
            <div class="input-group">
                <input type="text" id="searchInput" class="form-control"
                    placeholder="Search by ID, name, or barcode...">
                <button class="btn btn-outline-secondary" type="button" id="clearSearch">Clear</button>
            </div>
        </div>

        <!-- Barcode Display -->
        <div id="barcodeDisplay"></div>
    </div>

    <!-- Delete All Confirmation Modal -->
    <div class="modal fade" id="deleteAllModal" tabindex="-1" aria-labelledby="deleteAllModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="deleteAllModalLabel">Delete All Items</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p>Are you sure you want to delete all inventory items? This action cannot be undone.</p>
                    <p>Type <strong>"Delete"</strong> to confirm:</p>
                    <input type="text" class="form-control" id="deleteConfirmInput"
                        placeholder="Type Delete to confirm">
                    <div id="deleteConfirmError" class="text-danger mt-2" style="display: none;">
                        Please type "Delete" exactly to confirm.
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-danger" id="confirmDeleteAll" disabled>Delete All
                        Items</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Delete Item Confirmation Modal -->
    <div class="modal fade" id="deleteItemModal" tabindex="-1" aria-labelledby="deleteItemModalLabel"
        aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="deleteItemModalLabel">Delete Item</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p>Are you sure you want to delete this inventory item? This action cannot be undone.</p>
                    <p>Type <strong>"Delete"</strong> to confirm:</p>
                    <input type="text" class="form-control" id="deleteItemConfirmInput"
                        placeholder="Type Delete to confirm">
                    <div id="deleteItemConfirmError" class="text-danger mt-2" style="display: none;">
                        Please type "Delete" exactly to confirm.
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-danger" id="confirmDeleteItem" disabled>Delete Item</button>
                </div>
            </div>
        </div>
    </div>

    <script src="../../systems/IGPRentalSystem/lib/bootstrap.bundle.min.js"></script>
    <script src="../../systems/IGPRentalSystem/lib/JsBarcode.all.min.js"></script>
    <script src="../../systems/IGPRentalSystem/lib/xlsx.full.min.js"></script>
    <script src="../../assets/js/igp-api.js"></script>
    <script src="../../assets/js/igp-barcodes-exact.js"></script>
</body>

</html>


