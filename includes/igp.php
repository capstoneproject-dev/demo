<?php
/**
 * IGP Rental System domain services.
 * All functions are org-scoped and meant to be called by API endpoints.
 */

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/services_tracker.php';

class IgpValidationException extends RuntimeException {}
class IgpAuthorizationException extends RuntimeException {}

function igpColumnExists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare(
        "SELECT COUNT(*)
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name
           AND COLUMN_NAME = :column_name"
    );
    $stmt->execute([
        ':table_name' => $table,
        ':column_name' => $column,
    ]);
    return ((int)$stmt->fetchColumn() > 0);
}

function igpRequireOfficerOrgContext(): array
{
    $session = getPhpSession();
    if (!isLoggedIn()) {
        throw new IgpAuthorizationException('Not authenticated.');
    }
    if (($session['login_role'] ?? null) !== 'org') {
        throw new IgpAuthorizationException('Officer organization context required.');
    }
    $orgId = (int)($session['active_org_id'] ?? 0);
    if ($orgId <= 0) {
        throw new IgpAuthorizationException('No active organization selected.');
    }

    return [
        'session' => $session,
        'org_id' => $orgId,
        'user_id' => (int)($session['user_id'] ?? 0),
    ];
}

function igpResolveCategoryId(PDO $pdo, int $orgId, ?int $categoryId, ?string $categoryName): int
{
    $resolvedName = trim((string)$categoryName);

    if ($categoryId) {
        $stmt = $pdo->prepare(
            "SELECT category_id, category_name, org_id
             FROM inventory_categories
             WHERE category_id = :cid AND is_active = 1
             LIMIT 1"
        );
        $stmt->execute([':cid' => $categoryId]);
        $row = $stmt->fetch();
        if ($row) {
            if ((int)$row['org_id'] === $orgId) {
                return (int)$row['category_id'];
            }
            if ($resolvedName === '') {
                $resolvedName = trim((string)$row['category_name']);
            }
        }
    }

    $name = $resolvedName;
    if ($name === '') {
        $name = 'General';
    }

    $find = $pdo->prepare(
        "SELECT category_id
         FROM inventory_categories
         WHERE org_id = :org
           AND is_active = 1
           AND LOWER(TRIM(category_name)) = LOWER(TRIM(:name))
         ORDER BY category_id ASC
         LIMIT 1"
    );
    $find->execute([':org' => $orgId, ':name' => $name]);
    $existing = $find->fetch();
    if ($existing) {
        return (int)$existing['category_id'];
    }

    $ins = $pdo->prepare(
        "INSERT INTO inventory_categories (org_id, category_name, is_active)
         VALUES (:org, :name, 1)"
    );
    $ins->execute([':org' => $orgId, ':name' => $name]);
    return (int)$pdo->lastInsertId();
}

function igpGetInventoryCategories(PDO $pdo): array
{
    $stmt = $pdo->query(
        "SELECT LOWER(TRIM(category_name)) AS category_key,
                MIN(category_id) AS category_id,
                MIN(category_name) AS category_name
         FROM inventory_categories
         WHERE is_active = 1
           AND TRIM(category_name) <> ''
         GROUP BY LOWER(TRIM(category_name))
         ORDER BY category_name ASC"
    );

    $rows = $stmt->fetchAll();
    return array_map(static function (array $row): array {
        return [
            'category_id' => (int)$row['category_id'],
            'category_name' => trim((string)$row['category_name']),
        ];
    }, $rows);
}

function igpResolveSharedItemName(PDO $pdo, string $itemName, ?string $categoryName = null): string
{
    $trimmed = trim($itemName);
    if ($trimmed === '') {
        return '';
    }

    $params = [':name' => $trimmed];
    $where = ["LOWER(TRIM(i.item_name)) = LOWER(TRIM(:name))"];

    $category = trim((string)$categoryName);
    if ($category !== '') {
        $where[] = "LOWER(TRIM(c.category_name)) = LOWER(TRIM(:category_name))";
        $params[':category_name'] = $category;
    }

    $stmt = $pdo->prepare(
        "SELECT i.item_name
         FROM inventory_items i
         JOIN inventory_categories c ON c.category_id = i.category_id
         WHERE " . implode(' AND ', $where) . "
         ORDER BY i.item_id ASC
         LIMIT 1"
    );
    $stmt->execute($params);
    $existing = $stmt->fetchColumn();
    return $existing !== false ? trim((string)$existing) : $trimmed;
}

function igpResolveSharedItemImagePath(PDO $pdo, string $itemName, ?string $categoryName = null): string
{
    if (!igpColumnExists($pdo, 'inventory_items', 'image_path')) {
        return '';
    }

    $trimmed = trim($itemName);
    if ($trimmed === '') {
        return '';
    }

    $params = [':name' => $trimmed];
    $where = [
        "LOWER(TRIM(i.item_name)) = LOWER(TRIM(:name))",
        "TRIM(COALESCE(i.image_path, '')) <> ''",
        "c.is_active = 1",
        "o.status = 'active'",
    ];

    $category = trim((string)$categoryName);
    if ($category !== '') {
        $where[] = "LOWER(TRIM(c.category_name)) = LOWER(TRIM(:category_name))";
        $params[':category_name'] = $category;
    }

    $stmt = $pdo->prepare(
        "SELECT i.image_path
         FROM inventory_items i
         JOIN inventory_categories c ON c.category_id = i.category_id
         JOIN organizations o ON o.org_id = i.org_id
         WHERE " . implode(' AND ', $where) . "
         ORDER BY i.item_id ASC
         LIMIT 1"
    );
    $stmt->execute($params);
    $existing = $stmt->fetchColumn();
    return $existing !== false ? trim((string)$existing) : '';
}

function igpGetInventoryItemNames(PDO $pdo, ?string $categoryName = null): array
{
    $params = [];
    $where = [
        "TRIM(i.item_name) <> ''",
        "c.is_active = 1",
        "o.status = 'active'",
        "i.status IN ('available', 'reserved', 'rented', 'maintenance')",
    ];

    $category = trim((string)$categoryName);
    if ($category !== '') {
        $where[] = "LOWER(TRIM(c.category_name)) = LOWER(TRIM(:category_name))";
        $params[':category_name'] = $category;
    }

    $stmt = $pdo->prepare(
        "SELECT LOWER(TRIM(i.item_name)) AS item_key,
                MIN(i.item_id) AS item_id,
                MIN(i.item_name) AS item_name,
                MIN(c.category_name) AS category_name,
                MIN(NULLIF(TRIM(COALESCE(i.image_path, '')), '')) AS image_path
         FROM inventory_items i
         JOIN inventory_categories c ON c.category_id = i.category_id
         JOIN organizations o ON o.org_id = i.org_id
         WHERE " . implode(' AND ', $where) . "
         GROUP BY LOWER(TRIM(i.item_name)), LOWER(TRIM(c.category_name))
         ORDER BY category_name ASC, item_name ASC"
    );
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    return array_map(static function (array $row): array {
        return [
            'item_id' => (int)$row['item_id'],
            'item_name' => trim((string)$row['item_name']),
            'category_name' => trim((string)$row['category_name']),
            'image_path' => trim((string)($row['image_path'] ?? '')),
        ];
    }, $rows);
}

function igpDeleteUnusedCategory(PDO $pdo, int $orgId, int $categoryId): void
{
    if ($orgId <= 0 || $categoryId <= 0) {
        return;
    }

    $check = $pdo->prepare(
        "SELECT 1
         FROM inventory_items
         WHERE org_id = :org AND category_id = :cid
         LIMIT 1"
    );
    $check->execute([
        ':org' => $orgId,
        ':cid' => $categoryId,
    ]);
    if ($check->fetch()) {
        return;
    }

    $delete = $pdo->prepare(
        "DELETE FROM inventory_categories
         WHERE org_id = :org AND category_id = :cid
         LIMIT 1"
    );
    $delete->execute([
        ':org' => $orgId,
        ':cid' => $categoryId,
    ]);
}

function igpNormalizeInventoryDisplayName(string $itemName, string $categoryName = ''): string
{
    $trimmed = trim($itemName);
    if ($trimmed === '') return '';

    $upper = strtoupper($trimmed);
    if (preg_match('/^LOCKER(\s+UNIT)?(\s+\d+)?$/i', $trimmed)) return 'Lockers';

    $aliases = [
        'SCIENTIFIC CALCULATOR' => 'Scientific Calculator',
        'SCI CAL' => 'Scientific Calculator',
        'BUSINESS CALCULATOR' => 'Business Calculator',
        'SHOE' => 'Shoe Rag',
        'SHOE COVER' => 'Shoe Rag',
        'SHOE COVERS' => 'Shoe Rag',
        'SHOE RAG' => 'Shoe Rag',
        'PRINTING' => 'Printing',
        'PRINTING (PER PAGE)' => 'Printing',
        'PRINTER (PER PAGE)' => 'Printing',
        'NETWORK CRIMPING TOOL' => 'Network Crimping Tool',
        'NETWORK CABLE TESTER' => 'Network Cable Tester',
        'MINI FAN' => 'Mini Fan',
        'T-SQUARE' => 'T-Square',
        'TRIANGLE RULER' => 'Triangle Ruler',
        'PROTRACTOR' => 'Protractor',
        'RULER' => 'Rulers',
        'RULERS' => 'Rulers',
        'ARNIS' => 'Arnis',
        '1X1 PHOTO PROCESSING' => '1x1 Photo Processing',
    ];

    if (isset($aliases[$upper])) {
        return $aliases[$upper];
    }

    return $trimmed;
}

function igpGetDefaultInventoryImagePath(string $displayName): string
{
    $map = [
        'Shoe Rag' => 'assets/photos/studentDashboard/Services/shoerag.png',
        'Business Calculator' => 'assets/photos/studentDashboard/Services/businesscalculator.png',
        'Scientific Calculator' => 'assets/photos/studentDashboard/Services/scical.png',
        'Arnis' => 'assets/photos/studentDashboard/Services/arnis.png',
        'Network Crimping Tool' => 'assets/photos/studentDashboard/Services/crimpingtool.png',
        'Mini Fan' => 'assets/photos/studentDashboard/Services/minifan.png',
        'Network Cable Tester' => 'assets/photos/studentDashboard/Services/tester.png',
        'T-Square' => 'assets/photos/studentDashboard/Services/tsquare.png',
        'Triangle Ruler' => 'assets/photos/studentDashboard/Services/triangle.png',
        'Protractor' => 'assets/photos/studentDashboard/Services/protractor.png',
        'Rulers' => 'assets/photos/studentDashboard/Services/rulerbackground.png',
        'Lockers' => 'assets/photos/studentDashboard/Services/locker.png',
    ];

    return $map[$displayName] ?? '';
}

function igpGetInventory(PDO $pdo, int $orgId, array $filters = []): array
{
    $hasImagePath = igpColumnExists($pdo, 'inventory_items', 'image_path');
    $imageSelectExpr = $hasImagePath ? 'i.image_path' : 'NULL AS image_path';
    $where = [
        "i.org_id = :org",
        "LOWER(TRIM(c.category_name)) <> 'locker'",
    ];
    $params = [':org' => $orgId];

    $q = trim((string)($filters['q'] ?? ''));
    if ($q !== '') {
        $where[] = "(i.item_name LIKE :q_name OR i.barcode LIKE :q_barcode OR c.category_name LIKE :q_category)";
        $qLike = '%' . $q . '%';
        $params[':q_name'] = $qLike;
        $params[':q_barcode'] = $qLike;
        $params[':q_category'] = $qLike;
    }

    $status = trim((string)($filters['status'] ?? ''));
    if ($status !== '') {
        $where[] = "i.status = :status";
        $params[':status'] = $status;
    }

    $sql = "
        SELECT i.item_id,
               i.org_id,
               i.item_name,
               i.barcode,
               {$imageSelectExpr},
               i.category_id,
               c.category_name,
               i.hourly_rate,
               i.overtime_interval_minutes,
               i.overtime_rate_per_block,
               i.status,
               i.created_at,
               i.updated_at
        FROM inventory_items i
        JOIN inventory_categories c ON c.category_id = i.category_id
        WHERE " . implode(' AND ', $where) . "
        ORDER BY i.item_name ASC, i.item_id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$r) {
        $r['item_id'] = (int)$r['item_id'];
        $r['category_id'] = (int)$r['category_id'];
        $r['hourly_rate'] = (float)$r['hourly_rate'];
        $r['overtime_interval_minutes'] = $r['overtime_interval_minutes'] !== null ? (int)$r['overtime_interval_minutes'] : null;
        $r['overtime_rate_per_block'] = $r['overtime_rate_per_block'] !== null ? (float)$r['overtime_rate_per_block'] : null;
    }
    return $rows;
}

function igpSaveInventoryItem(PDO $pdo, int $orgId, array $data): int
{
    $hasImagePath = igpColumnExists($pdo, 'inventory_items', 'image_path');
    $itemId = isset($data['item_id']) ? (int)$data['item_id'] : 0;
    $itemName = trim((string)($data['item_name'] ?? ''));
    $barcode = trim((string)($data['barcode'] ?? ''));
    $imagePath = trim((string)($data['image_path'] ?? ''));
    $hourlyRate = (float)($data['hourly_rate'] ?? 0);
    $status = trim((string)($data['status'] ?? 'available'));
    $categoryId = isset($data['category_id']) ? (int)$data['category_id'] : null;
    $categoryName = isset($data['category_name']) ? (string)$data['category_name'] : null;
    $overtimeInterval = ($data['overtime_interval_minutes'] ?? null);
    $overtimeRate = ($data['overtime_rate_per_block'] ?? null);

    if ($itemName === '' || $barcode === '') {
        throw new IgpValidationException('Item name and barcode are required.');
    }
    if (!$categoryId && trim((string)$categoryName) === '') {
        throw new IgpValidationException('Item category is required.');
    }
    if ($hourlyRate < 0) {
        throw new IgpValidationException('Hourly rate must be non-negative.');
    }
    if (!in_array($status, ['available', 'reserved', 'rented', 'maintenance'], true)) {
        throw new IgpValidationException('Invalid inventory status.');
    }
    if ($overtimeInterval !== null && $overtimeInterval !== '') {
        $overtimeInterval = (int)$overtimeInterval;
        if ($overtimeInterval <= 0) {
            throw new IgpValidationException('Overtime interval must be greater than zero.');
        }
    } else {
        $overtimeInterval = null;
    }
    if ($overtimeRate !== null && $overtimeRate !== '') {
        $overtimeRate = (float)$overtimeRate;
        if ($overtimeRate < 0) {
            throw new IgpValidationException('Overtime rate must be non-negative.');
        }
    } else {
        $overtimeRate = null;
    }

    $resolvedCategoryId = igpResolveCategoryId($pdo, $orgId, $categoryId, $categoryName);
    $itemName = igpResolveSharedItemName($pdo, $itemName, $categoryName);
    if ($hasImagePath && $imagePath === '') {
        $imagePath = igpResolveSharedItemImagePath($pdo, $itemName, $categoryName);
    }

    if ($itemId > 0) {
        $selectCols = $hasImagePath ? 'item_id, image_path, category_id' : 'item_id, category_id';
        $check = $pdo->prepare("SELECT {$selectCols} FROM inventory_items WHERE item_id = :id AND org_id = :org LIMIT 1");
        $check->execute([':id' => $itemId, ':org' => $orgId]);
        $existing = $check->fetch();
        if (!$existing) {
            throw new IgpValidationException('Item not found for this organization.');
        }
        $previousCategoryId = (int)($existing['category_id'] ?? 0);
        if ($hasImagePath && $imagePath === '') {
            $imagePath = trim((string)($existing['image_path'] ?? ''));
        }
        if ($hasImagePath && $imagePath === '') {
            $imagePath = igpGetDefaultInventoryImagePath(igpNormalizeInventoryDisplayName($itemName, trim((string)$categoryName)));
        }
        if ($hasImagePath && $imagePath === '') {
            throw new IgpValidationException('Item image is required.');
        }

        if ($hasImagePath) {
            $upd = $pdo->prepare(
                "UPDATE inventory_items
                 SET item_name = :name,
                     barcode = :barcode,
                     image_path = :image_path,
                     category_id = :cid,
                     hourly_rate = :rate,
                     overtime_interval_minutes = :ot_int,
                     overtime_rate_per_block = :ot_rate,
                     status = :status
                 WHERE item_id = :id AND org_id = :org"
            );
            $upd->execute([
                ':name' => $itemName,
                ':barcode' => $barcode,
                ':image_path' => $imagePath,
                ':cid' => $resolvedCategoryId,
                ':rate' => $hourlyRate,
                ':ot_int' => $overtimeInterval,
                ':ot_rate' => $overtimeRate,
                ':status' => $status,
                ':id' => $itemId,
                ':org' => $orgId,
            ]);
        } else {
            $upd = $pdo->prepare(
                "UPDATE inventory_items
                 SET item_name = :name,
                     barcode = :barcode,
                     category_id = :cid,
                     hourly_rate = :rate,
                     overtime_interval_minutes = :ot_int,
                     overtime_rate_per_block = :ot_rate,
                     status = :status
                 WHERE item_id = :id AND org_id = :org"
            );
            $upd->execute([
                ':name' => $itemName,
                ':barcode' => $barcode,
                ':cid' => $resolvedCategoryId,
                ':rate' => $hourlyRate,
                ':ot_int' => $overtimeInterval,
                ':ot_rate' => $overtimeRate,
                ':status' => $status,
                ':id' => $itemId,
                ':org' => $orgId,
            ]);
        }
        if ($previousCategoryId > 0 && $previousCategoryId !== $resolvedCategoryId) {
            igpDeleteUnusedCategory($pdo, $orgId, $previousCategoryId);
        }
        return $itemId;
    }

    if ($hasImagePath && $imagePath === '') {
        throw new IgpValidationException('Item image is required.');
    }

    if ($hasImagePath) {
        $ins = $pdo->prepare(
            "INSERT INTO inventory_items
                (org_id, item_name, barcode, image_path, category_id, hourly_rate, overtime_interval_minutes, overtime_rate_per_block, status)
             VALUES
                (:org, :name, :barcode, :image_path, :cid, :rate, :ot_int, :ot_rate, :status)"
        );
        $ins->execute([
            ':org' => $orgId,
            ':name' => $itemName,
            ':barcode' => $barcode,
            ':image_path' => $imagePath,
            ':cid' => $resolvedCategoryId,
            ':rate' => $hourlyRate,
            ':ot_int' => $overtimeInterval,
            ':ot_rate' => $overtimeRate,
            ':status' => $status,
        ]);
    } else {
        $ins = $pdo->prepare(
            "INSERT INTO inventory_items
                (org_id, item_name, barcode, category_id, hourly_rate, overtime_interval_minutes, overtime_rate_per_block, status)
             VALUES
                (:org, :name, :barcode, :cid, :rate, :ot_int, :ot_rate, :status)"
        );
        $ins->execute([
            ':org' => $orgId,
            ':name' => $itemName,
            ':barcode' => $barcode,
            ':cid' => $resolvedCategoryId,
            ':rate' => $hourlyRate,
            ':ot_int' => $overtimeInterval,
            ':ot_rate' => $overtimeRate,
            ':status' => $status,
        ]);
    }
    return (int)$pdo->lastInsertId();
}

function igpDeleteInventoryItem(PDO $pdo, int $orgId, int $itemId): void
{
    if ($itemId <= 0) {
        throw new IgpValidationException('Invalid item_id.');
    }

    $check = $pdo->prepare(
        "SELECT 1
         FROM rental_items ri
         JOIN rentals r ON r.rental_id = ri.rental_id
         WHERE ri.item_id = :item AND r.org_id = :org AND r.status IN ('reserved', 'active')
         LIMIT 1"
    );
    $check->execute([':item' => $itemId, ':org' => $orgId]);
    if ($check->fetch()) {
        throw new IgpValidationException('Cannot delete item with open rentals.');
    }

    $categoryStmt = $pdo->prepare("SELECT category_id FROM inventory_items WHERE item_id = :id AND org_id = :org LIMIT 1");
    $categoryStmt->execute([':id' => $itemId, ':org' => $orgId]);
    $categoryId = (int)$categoryStmt->fetchColumn();

    $del = $pdo->prepare("DELETE FROM inventory_items WHERE item_id = :id AND org_id = :org");
    $del->execute([':id' => $itemId, ':org' => $orgId]);
    if ($del->rowCount() === 0) {
        throw new IgpValidationException('Item not found for this organization.');
    }
    if ($categoryId > 0) {
        igpDeleteUnusedCategory($pdo, $orgId, $categoryId);
    }
}

function igpGetRentals(PDO $pdo, int $orgId, array $filters = []): array
{
    $hasUsersYearSection = igpColumnExists($pdo, 'users', 'year_section');
    $hasStudentNumbersYearSection = igpColumnExists($pdo, 'student_numbers', 'year_section');
    $hasRentalNotes = igpColumnExists($pdo, 'rentals', 'notes');

    if ($hasUsersYearSection && $hasStudentNumbersYearSection) {
        $renterSectionExpr = "COALESCE(NULLIF(sn.year_section, ''), NULLIF(ru.year_section, ''), '')";
    } elseif ($hasStudentNumbersYearSection) {
        $renterSectionExpr = "COALESCE(NULLIF(sn.year_section, ''), '')";
    } elseif ($hasUsersYearSection) {
        $renterSectionExpr = "COALESCE(NULLIF(ru.year_section, ''), '')";
    } else {
        $renterSectionExpr = "''";
    }

    $notesSelectExpr = $hasRentalNotes ? "r.notes" : "NULL AS notes";

    $where = ["r.org_id = :org"];
    $params = [':org' => $orgId];

    if (!empty($filters['status'])) {
        if ($filters['status'] === 'open') {
            $where[] = "r.status IN ('reserved', 'active')";
        } else {
            $where[] = "r.status = :status";
            $params[':status'] = $filters['status'];
        }
    }
    if (!empty($filters['payment_status'])) {
        $where[] = "r.payment_status = :pay";
        $params[':pay'] = $filters['payment_status'];
    }
    if (!empty($filters['date_from'])) {
        $where[] = "DATE(r.rent_time) >= :df";
        $params[':df'] = $filters['date_from'];
    }
    if (!empty($filters['date_to'])) {
        $where[] = "DATE(r.rent_time) <= :dt";
        $params[':dt'] = $filters['date_to'];
    }
    if (!empty($filters['q'])) {
        $where[] = "(u.student_number LIKE :q_student OR u.email LIKE :q_email OR i.item_name LIKE :q_item OR i.barcode LIKE :q_barcode)";
        $qLike = '%' . $filters['q'] . '%';
        $params[':q_student'] = $qLike;
        $params[':q_email'] = $qLike;
        $params[':q_item'] = $qLike;
        $params[':q_barcode'] = $qLike;
    }

    $sql = "
      SELECT r.rental_id,
             r.org_id,
             r.renter_user_id,
             CONCAT(ru.first_name, ' ', ru.last_name) AS renter_name,
             ru.student_number AS renter_student_number,
             {$renterSectionExpr} AS renter_section,
             r.processed_by_user_id,
             CONCAT(pu.first_name, ' ', pu.last_name) AS processor_name,
             r.rent_time,
             r.expected_return_time,
             r.actual_return_time,
             r.total_cost,
             r.payment_status,
             r.paid_at,
             r.status,
             {$notesSelectExpr},
             SUM(ri.quantity) AS item_count,
             SUM(ri.unit_rate * ri.quantity) AS hourly_total,
             GROUP_CONCAT(CONCAT(i.item_name, ' [', i.barcode, ']') ORDER BY i.item_name SEPARATOR ', ') AS items_label
      FROM rentals r
      JOIN users ru ON ru.user_id = r.renter_user_id
      JOIN users pu ON pu.user_id = r.processed_by_user_id
      LEFT JOIN student_numbers sn ON sn.student_number = ru.student_number
      JOIN rental_items ri ON ri.rental_id = r.rental_id
      JOIN inventory_items i ON i.item_id = ri.item_id
      WHERE " . implode(' AND ', $where) . "
      GROUP BY r.rental_id
      ORDER BY r.rent_time DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['rental_id'] = (int)$r['rental_id'];
        $r['renter_user_id'] = (int)$r['renter_user_id'];
        $r['processed_by_user_id'] = (int)$r['processed_by_user_id'];
        $r['item_count'] = (int)$r['item_count'];
        $r['total_cost'] = (float)$r['total_cost'];
        $r['hourly_total'] = (float)$r['hourly_total'];
    }
    return $rows;
}

function igpFindUserByIdentifier(PDO $pdo, string $identifier): ?array
{
    $id = trim($identifier);
    if ($id === '') return null;
    $stmt = $pdo->prepare(
        "SELECT user_id, student_number, employee_number, email, first_name, last_name, has_unpaid_debt, is_active, account_type
         FROM users
         WHERE (student_number = :student_number OR employee_number = :employee_number OR email = :email)
         LIMIT 1"
    );
    $stmt->execute([
        ':student_number' => $id,
        ':employee_number' => $id,
        ':email' => $id,
    ]);
    return $stmt->fetch() ?: null;
}

function igpGetUserById(PDO $pdo, int $userId): ?array
{
    if ($userId <= 0) return null;
    $stmt = $pdo->prepare(
        "SELECT user_id, student_number, employee_number, email, first_name, last_name, has_unpaid_debt, is_active, account_type
         FROM users
         WHERE user_id = :uid
         LIMIT 1"
    );
    $stmt->execute([':uid' => $userId]);
    return $stmt->fetch() ?: null;
}

function igpResolveOrgByCodeOrName(PDO $pdo, string $orgRef): ?array
{
    $ref = trim($orgRef);
    if ($ref === '') return null;

    $orgAliases = [
        'AET' => 'AETSO',
        'AMT' => 'AMTSO',
        'SSC' => 'SSC',
    ];
    $ref = $orgAliases[strtoupper($ref)] ?? $ref;

    $stmt = $pdo->prepare(
        "SELECT org_id, org_name, org_code
         FROM organizations
         WHERE UPPER(org_code) = UPPER(:ref_code)
            OR UPPER(REPLACE(org_name, \"'\", '')) = UPPER(REPLACE(:ref_name, \"'\", ''))
         LIMIT 1"
    );
    $stmt->execute([
        ':ref_code' => $ref,
        ':ref_name' => $ref,
    ]);
    return $stmt->fetch() ?: null;
}

function igpGetStudentRentalItemNameCandidates(string $itemName): array
{
    $trimmed = trim($itemName);
    if ($trimmed === '') return [];

    $aliases = [
        'SCIENTIFIC CALCULATOR' => ['Scientific Calculator', 'Sci Cal'],
        'BUSINESS CALCULATOR' => ['Business Calculator'],
        'SHOE RAG' => ['Shoe Rag', 'Shoe Covers', 'shoe'],
        'LOCKERS' => ['Lockers', 'Locker Unit', 'Locker'],
        'PRINTING' => ['Printing', 'Printing (per page)', 'Printer (per page)'],
        '1X1 PHOTO PROCESSING' => ['1x1 Photo Processing'],
        'NETWORK CRIMPING TOOL' => ['Network Crimping Tool'],
        'NETWORK CABLE TESTER' => ['Network Cable Tester'],
        'MINI FAN' => ['Mini Fan'],
        'T-SQUARE' => ['T-Square'],
        'TRIANGLE RULER' => ['Triangle Ruler'],
        'PROTRACTOR' => ['Protractor'],
        'RULERS' => ['Rulers', 'Ruler'],
        'ARNIS' => ['Arnis'],
    ];

    $key = strtoupper($trimmed);
    $candidates = $aliases[$key] ?? [$trimmed];
    $candidates[] = $trimmed;

    return array_values(array_unique(array_filter(array_map('trim', $candidates))));
}

function igpFindStudentRentalInventoryItem(PDO $pdo, int $orgId, string $itemName, bool $forUpdate = false): ?array
{
    $candidates = igpGetStudentRentalItemNameCandidates($itemName);
    if (!$candidates) return null;

    $conditions = [];
    $params = [':org' => $orgId];
    foreach ($candidates as $idx => $candidate) {
        $exactKey = ':exact_' . $idx;
        $likeKey = ':like_' . $idx;
        $params[$exactKey] = $candidate;
        $params[$likeKey] = '%' . $candidate . '%';
        $conditions[] = "UPPER(item_name) = UPPER({$exactKey})";
        $conditions[] = "UPPER(item_name) LIKE UPPER({$likeKey})";
    }

    $sql = "
        SELECT item_id, item_name, hourly_rate, overtime_interval_minutes, overtime_rate_per_block, status
        FROM inventory_items
        WHERE org_id = :org
          AND status = 'available'
          AND category_id IN (
              SELECT category_id
              FROM inventory_categories
              WHERE org_id = :org
                AND is_active = 1
                AND LOWER(TRIM(category_name)) <> 'locker'
          )
          AND (" . implode(' OR ', $conditions) . ")
        ORDER BY item_id ASC
        LIMIT 1";

    if ($forUpdate) {
        $sql .= " FOR UPDATE";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetch() ?: null;
}

function igpGetStudentRentalQuote(PDO $pdo, string $orgRef, string $itemName, float $hours = 0): array
{
    $org = igpResolveOrgByCodeOrName($pdo, $orgRef);
    if (!$org) {
        throw new IgpValidationException('Selected organization was not found.');
    }
    if (!stServiceEnabledForOrg($pdo, (int)$org['org_id'], 'rentals')) {
        throw new IgpValidationException('Selected organization is not authorized to offer rentals.');
    }

    $item = igpFindStudentRentalInventoryItem($pdo, (int)$org['org_id'], $itemName, false);
    if (!$item) {
        throw new IgpValidationException('No available inventory item was found for that service.');
    }

    $hourlyRate = (float)$item['hourly_rate'];
    $amount = $hours > 0 ? ($hourlyRate * $hours) : 0.0;

    return [
        'org_id' => (int)$org['org_id'],
        'org_name' => $org['org_name'],
        'org_code' => $org['org_code'],
        'item_id' => (int)$item['item_id'],
        'item_name' => $item['item_name'],
        'hourly_rate' => $hourlyRate,
        'amount' => $amount,
    ];
}

function igpGetStudentServicesCatalog(PDO $pdo): array
{
    $authorizedOrgIds = stGetAuthorizedOrgIds($pdo, 'rentals');
    if (!$authorizedOrgIds) {
        return [];
    }

    $hasImagePath = igpColumnExists($pdo, 'inventory_items', 'image_path');
    $imageSelectExpr = $hasImagePath ? 'i.image_path' : 'NULL AS image_path';
    $placeholders = implode(',', array_fill(0, count($authorizedOrgIds), '?'));

    $stmt = $pdo->prepare(
        "SELECT i.org_id,
                o.org_name,
                o.org_code,
                i.item_name,
                c.category_name,
                i.hourly_rate,
                i.status,
                {$imageSelectExpr}
         FROM inventory_items i
         JOIN inventory_categories c ON c.category_id = i.category_id
         JOIN organizations o ON o.org_id = i.org_id
           WHERE i.org_id IN ($placeholders)
             AND i.status IN ('available', 'reserved', 'rented')
             AND c.is_active = 1
             AND LOWER(TRIM(c.category_name)) <> 'locker'
             AND o.status = 'active'
           ORDER BY c.category_name ASC, i.item_name ASC, o.org_name ASC, i.item_id ASC"
      );
    $stmt->execute($authorizedOrgIds);
    $rows = $stmt->fetchAll();

    $catalog = [];
    foreach ($rows as $row) {
        $categoryName = trim((string)($row['category_name'] ?? ''));
        if ($categoryName === '') {
            continue;
        }

        $displayName = igpNormalizeInventoryDisplayName((string)($row['item_name'] ?? ''), $categoryName);
        if ($displayName === '') {
            continue;
        }

        $key = strtoupper($categoryName . '|' . $displayName);
        $resolvedImagePath = trim((string)($row['image_path'] ?? ''));
        if ($resolvedImagePath === '') {
            $resolvedImagePath = igpGetDefaultInventoryImagePath($displayName);
        }
        if ($resolvedImagePath === '') {
            continue;
        }

        if (!isset($catalog[$key])) {
            $catalog[$key] = [
                'service_key' => $key,
                'category_name' => $categoryName,
                'display_name' => $displayName,
                'image_path' => $resolvedImagePath,
                'total_count' => 0,
                'available_count' => 0,
                'hourly_rate_min' => null,
                'hourly_rate_max' => null,
                'orgs' => [],
            ];
        }

        $rate = (float)$row['hourly_rate'];
        $status = strtolower(trim((string)($row['status'] ?? '')));
        $isAvailable = $status === 'available';
        $catalog[$key]['total_count']++;
        if ($isAvailable) {
            $catalog[$key]['available_count']++;
        }
        $catalog[$key]['hourly_rate_min'] = $catalog[$key]['hourly_rate_min'] === null
            ? $rate
            : min($catalog[$key]['hourly_rate_min'], $rate);
        $catalog[$key]['hourly_rate_max'] = $catalog[$key]['hourly_rate_max'] === null
            ? $rate
            : max($catalog[$key]['hourly_rate_max'], $rate);

        $orgCode = (string)$row['org_code'];
        if (!isset($catalog[$key]['orgs'][$orgCode])) {
            $catalog[$key]['orgs'][$orgCode] = [
                'org_id' => (int)$row['org_id'],
                'org_code' => $orgCode,
                'org_name' => (string)$row['org_name'],
                'total_count' => 0,
                'available_count' => 0,
                'hourly_rate_min' => $rate,
                'hourly_rate_max' => $rate,
            ];
        }

        $catalog[$key]['orgs'][$orgCode]['total_count']++;
        if ($isAvailable) {
            $catalog[$key]['orgs'][$orgCode]['available_count']++;
        }
        $catalog[$key]['orgs'][$orgCode]['hourly_rate_min'] = min($catalog[$key]['orgs'][$orgCode]['hourly_rate_min'], $rate);
        $catalog[$key]['orgs'][$orgCode]['hourly_rate_max'] = max($catalog[$key]['orgs'][$orgCode]['hourly_rate_max'], $rate);
    }

    $items = array_values($catalog);
    usort($items, static function (array $a, array $b): int {
        $categoryCmp = strcasecmp($a['category_name'], $b['category_name']);
        if ($categoryCmp !== 0) return $categoryCmp;
        return strcasecmp($a['display_name'], $b['display_name']);
    });

    foreach ($items as &$item) {
        $item['orgs'] = array_values($item['orgs']);
        usort($item['orgs'], static function (array $a, array $b): int {
            return strcasecmp($a['org_name'], $b['org_name']);
        });
    }

    return $items;
}

function igpEnsureOfficerInOrg(PDO $pdo, int $userId, int $orgId): bool
{
    $stmt = $pdo->prepare(
        "SELECT 1
         FROM organization_members om
         JOIN org_roles r ON r.role_id = om.role_id
         WHERE om.user_id = :uid
           AND om.org_id = :org
           AND om.is_active = 1
           AND r.is_active = 1
           AND r.can_access_org_dashboard = 1
         LIMIT 1"
    );
    $stmt->execute([':uid' => $userId, ':org' => $orgId]);
    return (bool)$stmt->fetch();
}

function igpCreateRental(PDO $pdo, int $orgId, array $data): int
{
    $itemId = (int)($data['item_id'] ?? 0);
    $hours = (int)($data['hours'] ?? 0);
    $renterIdentifier = trim((string)($data['renter_identifier'] ?? ''));
    $processorUserId = (int)($data['processor_user_id'] ?? 0);
    $officerIdentifier = trim((string)($data['officer_identifier'] ?? ''));

    if ($itemId <= 0 || $hours <= 0 || $renterIdentifier === '') {
        throw new IgpValidationException('item_id, hours, and renter_identifier are required.');
    }

    $renter = igpFindUserByIdentifier($pdo, $renterIdentifier);
    if (!$renter || !(int)$renter['is_active']) {
        throw new IgpValidationException('Renter not found or inactive.');
    }

    if ((int)$renter['has_unpaid_debt'] === 1) {
        throw new IgpValidationException('Rental blocked: student account has unpaid debt.');
    }

    $unpaid = $pdo->prepare(
        "SELECT 1
         FROM rentals
         WHERE renter_user_id = :uid
           AND org_id = :org
           AND status = 'returned'
           AND payment_status = 'unpaid'
         LIMIT 1"
    );
    $unpaid->execute([':uid' => (int)$renter['user_id'], ':org' => $orgId]);
    if ($unpaid->fetch()) {
        throw new IgpValidationException('Renter has unpaid returned rentals.');
    }

    if ($officerIdentifier !== '') {
        $officer = igpFindUserByIdentifier($pdo, $officerIdentifier);
        if (!$officer || !igpEnsureOfficerInOrg($pdo, (int)$officer['user_id'], $orgId)) {
            throw new IgpValidationException('Officer verification failed for this organization.');
        }
        $processorUserId = (int)$officer['user_id'];
    } elseif ($processorUserId <= 0 || !igpEnsureOfficerInOrg($pdo, $processorUserId, $orgId)) {
        throw new IgpValidationException('Valid processor officer is required.');
    }

    $pdo->beginTransaction();
    try {
        $itemStmt = $pdo->prepare(
            "SELECT item_id, hourly_rate, overtime_interval_minutes, overtime_rate_per_block, status
             FROM inventory_items
             WHERE item_id = :id AND org_id = :org
             FOR UPDATE"
        );
        $itemStmt->execute([':id' => $itemId, ':org' => $orgId]);
        $item = $itemStmt->fetch();
        if (!$item) {
            throw new IgpValidationException('Item not found for this organization.');
        }
        if ($item['status'] !== 'available') {
            throw new IgpValidationException('Item is not currently available for rent.');
        }

        $tz = new DateTimeZone('Asia/Manila');
        $rentTime = new DateTimeImmutable('now', $tz);
        $expected = $rentTime->modify('+' . $hours . ' hours');
        $unitRate = (float)$item['hourly_rate'];
        $itemCost = $unitRate * $hours;

        $insRental = $pdo->prepare(
            "INSERT INTO rentals
                (org_id, renter_user_id, processed_by_user_id, rent_time, expected_return_time, total_cost, payment_status, status)
             VALUES
                (:org, :renter, :proc, :rent_time, :expected, :total, 'unpaid', 'active')"
        );
        $insRental->execute([
            ':org' => $orgId,
            ':renter' => (int)$renter['user_id'],
            ':proc' => $processorUserId,
            ':rent_time' => $rentTime->format('Y-m-d H:i:s'),
            ':expected' => $expected->format('Y-m-d H:i:s'),
            ':total' => $itemCost,
        ]);
        $rentalId = (int)$pdo->lastInsertId();

        $insItem = $pdo->prepare(
            "INSERT INTO rental_items
                (rental_id, item_id, quantity, unit_rate, item_cost, overtime_interval_minutes, overtime_rate_per_block)
             VALUES
                (:rid, :item, 1, :rate, :cost, :ot_int, :ot_rate)"
        );
        $insItem->execute([
            ':rid' => $rentalId,
            ':item' => $itemId,
            ':rate' => $unitRate,
            ':cost' => $itemCost,
            ':ot_int' => $item['overtime_interval_minutes'] !== null ? (int)$item['overtime_interval_minutes'] : null,
            ':ot_rate' => $item['overtime_rate_per_block'] !== null ? (float)$item['overtime_rate_per_block'] : null,
        ]);

        $updItem = $pdo->prepare(
            "UPDATE inventory_items SET status = 'rented' WHERE item_id = :id AND org_id = :org"
        );
        $updItem->execute([':id' => $itemId, ':org' => $orgId]);

        $pdo->commit();
        return $rentalId;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function igpCreateStudentRental(PDO $pdo, int $renterUserId, string $orgRef, string $itemName, float $hours, string $scheduledStart): int
{
    $itemName = trim($itemName);
    if ($renterUserId <= 0 || trim($orgRef) === '' || $itemName === '' || $hours <= 0 || trim($scheduledStart) === '') {
        throw new IgpValidationException('organization, item_name, hours, and scheduled_start are required.');
    }

    $renter = igpGetUserById($pdo, $renterUserId);
    if (!$renter || !(int)$renter['is_active']) {
        throw new IgpValidationException('Renter not found or inactive.');
    }
    if ((int)$renter['has_unpaid_debt'] === 1) {
        throw new IgpValidationException('Rental blocked: student account has unpaid debt.');
    }

    $org = igpResolveOrgByCodeOrName($pdo, $orgRef);
    if (!$org) {
        throw new IgpValidationException('Selected organization was not found.');
    }
    $orgId = (int)$org['org_id'];
    if (!stServiceEnabledForOrg($pdo, $orgId, 'rentals')) {
        throw new IgpValidationException('Selected organization is not authorized to offer rentals.');
    }

    $unpaid = $pdo->prepare(
        "SELECT 1
         FROM rentals
         WHERE renter_user_id = :uid
           AND org_id = :org
           AND status = 'returned'
           AND payment_status = 'unpaid'
         LIMIT 1"
    );
    $unpaid->execute([':uid' => $renterUserId, ':org' => $orgId]);
    if ($unpaid->fetch()) {
        throw new IgpValidationException('You have unpaid returned rentals for this organization.');
    }

    $pdo->beginTransaction();
    try {
        $hasRentalNotes = igpColumnExists($pdo, 'rentals', 'notes');

        $item = igpFindStudentRentalInventoryItem($pdo, $orgId, $itemName, true);
        if (!$item) {
            throw new IgpValidationException('No available inventory item was found for that service.');
        }

        $tz = new DateTimeZone('Asia/Manila');
        $rentTime = new DateTimeImmutable($scheduledStart, $tz);
        $now = new DateTimeImmutable('now', $tz);
        if ($rentTime <= $now) {
            throw new IgpValidationException('Reservation time must be in the future.');
        }
        $durationMinutes = (int)round($hours * 60);
        if ($durationMinutes <= 0) {
            throw new IgpValidationException('Reservation duration must be greater than zero.');
        }
        $expected = $rentTime->modify('+' . $durationMinutes . ' minutes');
        $unitRate = (float)$item['hourly_rate'];
        $itemCost = $unitRate * $hours;

        if ($hasRentalNotes) {
            $insRental = $pdo->prepare(
                "INSERT INTO rentals
                    (org_id, renter_user_id, processed_by_user_id, rent_time, expected_return_time, total_cost, payment_status, status, notes)
                 VALUES
                    (:org, :renter, :processor, :rent_time, :expected, :total, 'unpaid', 'reserved', :notes)"
            );
            $insRental->execute([
                ':org' => $orgId,
                ':renter' => $renterUserId,
                ':processor' => $renterUserId,
                ':rent_time' => $rentTime->format('Y-m-d H:i:s'),
                ':expected' => $expected->format('Y-m-d H:i:s'),
                ':total' => $itemCost,
                ':notes' => 'Student reservation via student dashboard',
            ]);
        } else {
            $insRental = $pdo->prepare(
                "INSERT INTO rentals
                    (org_id, renter_user_id, processed_by_user_id, rent_time, expected_return_time, total_cost, payment_status, status)
                 VALUES
                    (:org, :renter, :processor, :rent_time, :expected, :total, 'unpaid', 'reserved')"
            );
            $insRental->execute([
                ':org' => $orgId,
                ':renter' => $renterUserId,
                ':processor' => $renterUserId,
                ':rent_time' => $rentTime->format('Y-m-d H:i:s'),
                ':expected' => $expected->format('Y-m-d H:i:s'),
                ':total' => $itemCost,
            ]);
        }
        $rentalId = (int)$pdo->lastInsertId();

        $insItem = $pdo->prepare(
            "INSERT INTO rental_items
                (rental_id, item_id, quantity, unit_rate, item_cost, overtime_interval_minutes, overtime_rate_per_block)
             VALUES
                (:rid, :item, 1, :rate, :cost, :ot_int, :ot_rate)"
        );
        $insItem->execute([
            ':rid' => $rentalId,
            ':item' => (int)$item['item_id'],
            ':rate' => $unitRate,
            ':cost' => $itemCost,
            ':ot_int' => $item['overtime_interval_minutes'] !== null ? (int)$item['overtime_interval_minutes'] : null,
            ':ot_rate' => $item['overtime_rate_per_block'] !== null ? (float)$item['overtime_rate_per_block'] : null,
        ]);

        $updItem = $pdo->prepare(
            "UPDATE inventory_items
             SET status = 'reserved'
             WHERE item_id = :id AND org_id = :org"
        );
        $updItem->execute([
            ':id' => (int)$item['item_id'],
            ':org' => $orgId,
        ]);

        $pdo->commit();
        return $rentalId;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function igpRefreshUserDebtFlag(PDO $pdo, int $userId): void
{
    if ($userId <= 0) {
        return;
    }

    $check = $pdo->prepare(
        "SELECT 1
         FROM rentals
         WHERE renter_user_id = :uid
           AND payment_status = 'unpaid'
           AND status IN ('returned', 'overdue', 'cancelled')
         LIMIT 1"
    );
    $check->execute([':uid' => $userId]);
    $hasDebt = $check->fetch() ? 1 : 0;

    $upd = $pdo->prepare(
        "UPDATE users
         SET has_unpaid_debt = :flag
         WHERE user_id = :uid"
    );
    $upd->execute([
        ':flag' => $hasDebt,
        ':uid' => $userId,
    ]);
}

function igpStartReservedRental(PDO $pdo, int $orgId, int $rentalId): void
{
    if ($rentalId <= 0) {
        throw new IgpValidationException('Invalid rental_id.');
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            "SELECT rental_id, renter_user_id, rent_time, expected_return_time, status
             FROM rentals
             WHERE rental_id = :rid AND org_id = :org
             FOR UPDATE"
        );
        $stmt->execute([':rid' => $rentalId, ':org' => $orgId]);
        $rental = $stmt->fetch();
        if (!$rental) {
            throw new IgpValidationException('Rental not found for this organization.');
        }
        if ($rental['status'] !== 'reserved') {
            throw new IgpValidationException('Only reserved rentals can be started.');
        }

        $itemsStmt = $pdo->prepare(
            "SELECT ri.item_id
             FROM rental_items ri
             WHERE ri.rental_id = :rid
             FOR UPDATE"
        );
        $itemsStmt->execute([':rid' => $rentalId]);
        $items = $itemsStmt->fetchAll();
        if (!$items) {
            throw new IgpValidationException('No rental items found.');
        }

        $scheduledStart = new DateTimeImmutable((string)$rental['rent_time']);
        $scheduledEnd = new DateTimeImmutable((string)$rental['expected_return_time']);
        $durationSeconds = max(0, $scheduledEnd->getTimestamp() - $scheduledStart->getTimestamp());
        if ($durationSeconds <= 0) {
            throw new IgpValidationException('Reserved rental duration is invalid.');
        }

        $tz = new DateTimeZone('Asia/Manila');
        $actualStart = new DateTimeImmutable('now', $tz);
        $actualEnd = $actualStart->modify('+' . $durationSeconds . ' seconds');

        $updRental = $pdo->prepare(
            "UPDATE rentals
             SET rent_time = :rent_time,
                 expected_return_time = :expected,
                 status = 'active'
             WHERE rental_id = :rid AND org_id = :org"
        );
        $updRental->execute([
            ':rent_time' => $actualStart->format('Y-m-d H:i:s'),
            ':expected' => $actualEnd->format('Y-m-d H:i:s'),
            ':rid' => $rentalId,
            ':org' => $orgId,
        ]);

        $updItem = $pdo->prepare(
            "UPDATE inventory_items
             SET status = 'rented'
             WHERE item_id = :id AND org_id = :org"
        );
        foreach ($items as $item) {
            $updItem->execute([
                ':id' => (int)$item['item_id'],
                ':org' => $orgId,
            ]);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function igpMarkReservationNoShow(PDO $pdo, int $orgId, int $rentalId): void
{
    if ($rentalId <= 0) {
        throw new IgpValidationException('Invalid rental_id.');
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            "SELECT rental_id, renter_user_id, status, payment_status
             FROM rentals
             WHERE rental_id = :rid AND org_id = :org
             FOR UPDATE"
        );
        $stmt->execute([':rid' => $rentalId, ':org' => $orgId]);
        $rental = $stmt->fetch();
        if (!$rental) {
            throw new IgpValidationException('Rental not found for this organization.');
        }
        if ($rental['status'] !== 'reserved') {
            throw new IgpValidationException('Only reserved rentals can be marked as no-show.');
        }

        $itemsStmt = $pdo->prepare(
            "SELECT ri.item_id, i.status AS item_status
             FROM rental_items ri
             JOIN inventory_items i ON i.item_id = ri.item_id
             WHERE ri.rental_id = :rid
             FOR UPDATE"
        );
        $itemsStmt->execute([':rid' => $rentalId]);
        $items = $itemsStmt->fetchAll();
        if (!$items) {
            throw new IgpValidationException('No rental items found.');
        }

        $updRental = $pdo->prepare(
            "UPDATE rentals
             SET status = 'cancelled',
                 payment_status = 'unpaid'
             WHERE rental_id = :rid AND org_id = :org"
        );
        $updRental->execute([
            ':rid' => $rentalId,
            ':org' => $orgId,
        ]);

        $updItem = $pdo->prepare(
            "UPDATE inventory_items
             SET status = 'available'
             WHERE item_id = :id AND org_id = :org"
        );
        foreach ($items as $item) {
            $updItem->execute([
                ':id' => (int)$item['item_id'],
                ':org' => $orgId,
            ]);
        }

        igpRefreshUserDebtFlag($pdo, (int)$rental['renter_user_id']);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function igpReturnRental(PDO $pdo, int $orgId, array $data): array
{
    $rentalId = (int)($data['rental_id'] ?? 0);
    if ($rentalId <= 0) {
        throw new IgpValidationException('rental_id is required.');
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            "SELECT rental_id, rent_time, expected_return_time, status, payment_status
             FROM rentals
             WHERE rental_id = :rid AND org_id = :org
             FOR UPDATE"
        );
        $stmt->execute([':rid' => $rentalId, ':org' => $orgId]);
        $rental = $stmt->fetch();
        if (!$rental) throw new IgpValidationException('Rental not found for this organization.');
        if ($rental['status'] !== 'active') throw new IgpValidationException('Only active rentals can be returned.');

        $itemsStmt = $pdo->prepare(
            "SELECT ri.rental_item_id, ri.item_id, ri.quantity, ri.unit_rate, ri.item_cost, ri.overtime_interval_minutes, ri.overtime_rate_per_block,
                    i.status AS item_status
             FROM rental_items ri
             JOIN inventory_items i ON i.item_id = ri.item_id
             WHERE ri.rental_id = :rid
             FOR UPDATE"
        );
        $itemsStmt->execute([':rid' => $rentalId]);
        $items = $itemsStmt->fetchAll();
        if (!$items) throw new IgpValidationException('No rental items found.');

        $tz = new DateTimeZone('Asia/Manila');
        $actual = new DateTimeImmutable('now', $tz);
        $expected = new DateTimeImmutable($rental['expected_return_time']);
        $baseCost = 0.0;
        $overtimeCost = 0.0;
        $overMin = 0;

        if ($actual > $expected) {
            $overMin = (int)ceil(($actual->getTimestamp() - $expected->getTimestamp()) / 60);
        }

        foreach ($items as $it) {
            $qty = (int)$it['quantity'];
            $baseCost += (float)$it['item_cost'];
            $interval = $it['overtime_interval_minutes'] !== null ? (int)$it['overtime_interval_minutes'] : null;
            $rate = $it['overtime_rate_per_block'] !== null ? (float)$it['overtime_rate_per_block'] : null;
            if ($overMin > 0 && $interval && $rate !== null && $rate > 0) {
                $blocks = (int)ceil($overMin / $interval);
                $overtimeCost += ($blocks * $rate * $qty);
            }
        }

        $total = $baseCost + $overtimeCost;
        $newStatus = $overMin > 0 ? 'overdue' : 'returned';
        $updRental = $pdo->prepare(
            "UPDATE rentals
             SET actual_return_time = :actual,
                 total_cost = :total,
                 status = :status
             WHERE rental_id = :rid AND org_id = :org"
        );
        $updRental->execute([
            ':actual' => $actual->format('Y-m-d H:i:s'),
            ':total' => $total,
            ':status' => $newStatus,
            ':rid' => $rentalId,
            ':org' => $orgId,
        ]);

        foreach ($items as $it) {
            $newItemStatus = ($it['item_status'] === 'maintenance') ? 'maintenance' : 'available';
            $updItem = $pdo->prepare(
                "UPDATE inventory_items SET status = :status WHERE item_id = :iid AND org_id = :org"
            );
            $updItem->execute([
                ':status' => $newItemStatus,
                ':iid' => (int)$it['item_id'],
                ':org' => $orgId,
            ]);
        }

        $pdo->commit();
        return [
            'rental_id' => $rentalId,
            'base_cost' => $baseCost,
            'overtime_minutes' => $overMin,
            'overtime_cost' => $overtimeCost,
            'total_cost' => $total,
            'status' => $newStatus,
            'actual_return_time' => $actual->format(DateTimeInterface::ATOM),
        ];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function igpMarkRentalPaid(PDO $pdo, int $orgId, int $rentalId): void
{
    if ($rentalId <= 0) {
        throw new IgpValidationException('Invalid rental_id.');
    }

    $upd = $pdo->prepare(
        "UPDATE rentals
         SET payment_status = 'paid',
             paid_at = CURRENT_TIMESTAMP
         WHERE rental_id = :rid
           AND org_id = :org
           AND payment_status = 'unpaid'
           AND status IN ('returned', 'overdue', 'cancelled')"
    );
    $upd->execute([':rid' => $rentalId, ':org' => $orgId]);
    if ($upd->rowCount() === 0) {
        throw new IgpValidationException('Rental is not eligible for mark-paid.');
    }

    $userStmt = $pdo->prepare(
        "SELECT renter_user_id
         FROM rentals
         WHERE rental_id = :rid AND org_id = :org
         LIMIT 1"
    );
    $userStmt->execute([':rid' => $rentalId, ':org' => $orgId]);
    $userId = (int)$userStmt->fetchColumn();
    if ($userId > 0) {
        igpRefreshUserDebtFlag($pdo, $userId);
    }
}

function igpNormalizeFinancialServiceType(string $serviceType): string
{
    $normalized = strtolower(trim($serviceType));
    if ($normalized === 'locker') {
        return 'locker';
    }
    if ($normalized === 'printing') {
        return 'printing';
    }
    return 'rental';
}

function igpGetRentalFinancialRows(PDO $pdo, int $orgId): array
{
    $hasUsersYearSection = igpColumnExists($pdo, 'users', 'year_section');
    $hasStudentNumbersYearSection = igpColumnExists($pdo, 'student_numbers', 'year_section');

    if ($hasUsersYearSection && $hasStudentNumbersYearSection) {
        $renterSectionExpr = "COALESCE(NULLIF(sn.year_section, ''), NULLIF(ru.year_section, ''), '')";
    } elseif ($hasStudentNumbersYearSection) {
        $renterSectionExpr = "COALESCE(NULLIF(sn.year_section, ''), '')";
    } elseif ($hasUsersYearSection) {
        $renterSectionExpr = "COALESCE(NULLIF(ru.year_section, ''), '')";
    } else {
        $renterSectionExpr = "''";
    }

    $stmt = $pdo->prepare(
        "SELECT r.rental_id,
                r.service_kind,
                r.rent_time,
                r.expected_return_time,
                r.actual_return_time,
                r.total_cost,
                r.payment_status,
                r.status,
                r.locker_period_type,
                CONCAT(COALESCE(ru.first_name, ''), ' ', COALESCE(ru.last_name, '')) AS renter_name,
                ru.student_number AS renter_student_number,
                {$renterSectionExpr} AS renter_section,
                CONCAT(COALESCE(pu.first_name, ''), ' ', COALESCE(pu.last_name, '')) AS processor_name,
                COALESCE(SUM(ri.item_cost), 0) AS base_cost,
                GROUP_CONCAT(CONCAT(i.item_name, ' [', i.barcode, ']') ORDER BY i.item_name SEPARATOR ', ') AS items_label
         FROM rentals r
         JOIN users ru ON ru.user_id = r.renter_user_id
         LEFT JOIN users pu ON pu.user_id = r.processed_by_user_id
         LEFT JOIN student_numbers sn ON sn.student_number = ru.student_number
         JOIN rental_items ri ON ri.rental_id = r.rental_id
         JOIN inventory_items i ON i.item_id = ri.item_id
         WHERE r.org_id = :org_id
         GROUP BY r.rental_id
         ORDER BY r.rent_time DESC"
    );
    $stmt->execute([':org_id' => $orgId]);

    $rows = [];
    foreach ($stmt->fetchAll() as $row) {
        $serviceType = igpNormalizeFinancialServiceType((string)($row['service_kind'] ?? 'rental'));
        $totalCost = (float)($row['total_cost'] ?? 0);
        $baseCost = (float)($row['base_cost'] ?? 0);
        if ($serviceType === 'locker') {
            $baseCost = $totalCost;
        }
        $overtimeCost = $serviceType === 'rental' ? max(0, $totalCost - $baseCost) : 0.0;

        $rows[] = [
            'service_type' => $serviceType,
            'transaction_id' => (int)$row['rental_id'],
            'transaction_date' => (string)($row['rent_time'] ?? ''),
            'item_label' => (string)($row['items_label'] ?? ''),
            'customer_name' => trim((string)($row['renter_name'] ?? '')) ?: '-',
            'customer_identifier' => trim((string)($row['renter_student_number'] ?? '')) ?: '-',
            'customer_section' => trim((string)($row['renter_section'] ?? '')),
            'processed_by' => trim((string)($row['processor_name'] ?? '')) ?: '-',
            'status' => (string)($row['status'] ?? ''),
            'payment_status' => strtolower((string)($row['payment_status'] ?? 'unpaid')) === 'paid' ? 'paid' : 'unpaid',
            'base_cost' => $baseCost,
            'overtime_cost' => $overtimeCost,
            'total_cost' => $totalCost,
            'raw_total_cost' => $totalCost,
            'expected_return_time' => (string)($row['expected_return_time'] ?? ''),
            'actual_return_time' => (string)($row['actual_return_time'] ?? ''),
            'locker_period_type' => (string)($row['locker_period_type'] ?? ''),
        ];
    }

    return $rows;
}

function igpGetPrintingFinancialRows(PDO $pdo, int $orgId): array
{
    $hasPrintTotalCost = igpColumnExists($pdo, 'print_jobs', 'total_cost');
    $totalCostSelectExpr = $hasPrintTotalCost ? 'COALESCE(pj.total_cost, 0)' : '0';

    $stmt = $pdo->prepare(
        "SELECT pj.print_job_id,
                pj.file_name,
                pj.status,
                pj.submitted_at,
                pj.processing_started_at,
                pj.ready_at,
                pj.claimed_at,
                {$totalCostSelectExpr} AS total_cost,
                CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS student_name,
                u.student_number,
                CONCAT(COALESCE(updated_by.first_name, ''), ' ', COALESCE(updated_by.last_name, '')) AS processed_by
         FROM print_jobs pj
         JOIN users u ON u.user_id = pj.user_id
         LEFT JOIN users updated_by ON updated_by.user_id = pj.last_updated_by_user_id
         WHERE pj.org_id = :org_id
         ORDER BY pj.submitted_at DESC, pj.print_job_id DESC"
    );
    $stmt->execute([':org_id' => $orgId]);

    $rows = [];
    foreach ($stmt->fetchAll() as $row) {
        $status = strtolower((string)($row['status'] ?? 'queued'));
        $totalCost = (float)($row['total_cost'] ?? 0);
        $rows[] = [
            'service_type' => 'printing',
            'transaction_id' => (int)$row['print_job_id'],
            'transaction_date' => (string)($row['submitted_at'] ?? ''),
            'item_label' => trim((string)($row['file_name'] ?? '')) ?: 'Print Job',
            'customer_name' => trim((string)($row['student_name'] ?? '')) ?: '-',
            'customer_identifier' => trim((string)($row['student_number'] ?? '')) ?: '-',
            'customer_section' => '',
            'processed_by' => trim((string)($row['processed_by'] ?? '')) ?: '-',
            'status' => $status,
            'payment_status' => $status === 'claimed' ? 'paid' : 'unpaid',
            'base_cost' => $totalCost,
            'overtime_cost' => 0.0,
            'total_cost' => $totalCost,
            'raw_total_cost' => $totalCost,
            'expected_return_time' => '',
            'actual_return_time' => (string)($row['claimed_at'] ?? ''),
            'locker_period_type' => '',
            'processing_started_at' => (string)($row['processing_started_at'] ?? ''),
            'ready_at' => (string)($row['ready_at'] ?? ''),
            'claimed_at' => (string)($row['claimed_at'] ?? ''),
        ];
    }

    return $rows;
}

function igpApplyFinancialSummaryFilters(array $rows, array $filters = []): array
{
    $serviceType = igpNormalizeFinancialServiceType((string)($filters['service_type'] ?? ''));
    $rawServiceType = trim((string)($filters['service_type'] ?? ''));
    $paymentStatus = strtolower(trim((string)($filters['payment_status'] ?? '')));
    $dateFrom = trim((string)($filters['date_from'] ?? ''));
    $dateTo = trim((string)($filters['date_to'] ?? ''));
    $query = strtolower(trim((string)($filters['q'] ?? '')));

    return array_values(array_filter($rows, static function (array $row) use ($rawServiceType, $serviceType, $paymentStatus, $dateFrom, $dateTo, $query): bool {
        if ($rawServiceType !== '' && ($row['service_type'] ?? '') !== $serviceType) {
            return false;
        }
        if ($paymentStatus !== '' && strtolower((string)($row['payment_status'] ?? '')) !== $paymentStatus) {
            return false;
        }

        $transactionDate = trim((string)($row['transaction_date'] ?? ''));
        if ($dateFrom !== '' && $transactionDate !== '' && substr($transactionDate, 0, 10) < $dateFrom) {
            return false;
        }
        if ($dateTo !== '' && $transactionDate !== '' && substr($transactionDate, 0, 10) > $dateTo) {
            return false;
        }

        if ($query !== '') {
            $haystack = strtolower(implode(' ', [
                (string)($row['item_label'] ?? ''),
                (string)($row['customer_name'] ?? ''),
                (string)($row['customer_identifier'] ?? ''),
                (string)($row['processed_by'] ?? ''),
                (string)($row['status'] ?? ''),
                (string)($row['service_type'] ?? ''),
            ]));
            if (strpos($haystack, $query) === false) {
                return false;
            }
        }

        return true;
    }));
}

function igpGetFinancialSummary(PDO $pdo, int $orgId, array $filters = []): array
{
    $rows = array_merge(
        igpGetRentalFinancialRows($pdo, $orgId),
        igpGetPrintingFinancialRows($pdo, $orgId)
    );

    usort($rows, static function (array $a, array $b): int {
        return strcmp((string)($b['transaction_date'] ?? ''), (string)($a['transaction_date'] ?? ''));
    });

    $rows = igpApplyFinancialSummaryFilters($rows, $filters);

    $summary = [
        'total_transactions' => 0,
        'paid_transactions' => 0,
        'unpaid_transactions' => 0,
        'total_revenue' => 0.0,
        'total_unpaid' => 0.0,
        'items' => $rows,
    ];

    foreach ($rows as $row) {
        $summary['total_transactions']++;
        $cost = (float)($row['total_cost'] ?? 0);
        if (($row['payment_status'] ?? 'unpaid') === 'paid') {
            $summary['paid_transactions']++;
            $summary['total_revenue'] += $cost;
        } else {
            $summary['unpaid_transactions']++;
            $summary['total_unpaid'] += $cost;
        }
    }

    return $summary;
}

function igpImportLegacyPayload(PDO $pdo, int $orgId, array $payload): array
{
    $inventory = is_array($payload['inventoryItems'] ?? null) ? $payload['inventoryItems'] : [];
    $rentals = is_array($payload['rentalRecords'] ?? null) ? $payload['rentalRecords'] : [];

    $result = [
        'inventory' => ['inserted' => 0, 'updated' => 0, 'skipped' => 0, 'failed' => 0],
        'rentals' => ['inserted' => 0, 'skipped' => 0, 'failed' => 0],
        'errors' => [],
    ];

    foreach ($inventory as $idx => $row) {
        try {
            $barcode = trim((string)($row['barcode'] ?? ''));
            $name = trim((string)($row['name'] ?? ''));
            if ($barcode === '' || $name === '') {
                $result['inventory']['skipped']++;
                continue;
            }

            $find = $pdo->prepare("SELECT item_id FROM inventory_items WHERE org_id = :org AND barcode = :barcode LIMIT 1");
            $find->execute([':org' => $orgId, ':barcode' => $barcode]);
            $existing = $find->fetch();

            $savedId = igpSaveInventoryItem($pdo, $orgId, [
                'item_id' => $existing ? (int)$existing['item_id'] : 0,
                'item_name' => $name,
                'barcode' => $barcode,
                'stock_quantity' => max(1, (int)($row['stockQuantity'] ?? $row['stock_quantity'] ?? 1)),
                'hourly_rate' => (float)($row['pricePerHour'] ?? 0),
                'status' => (string)($row['status'] ?? 'available'),
                'category_name' => (string)($row['categoryName'] ?? 'Legacy'),
                'overtime_interval_minutes' => $row['overtimeInterval'] ?? null,
                'overtime_rate_per_block' => $row['overtimeRate'] ?? null,
            ]);
            if ($existing) {
                $result['inventory']['updated']++;
            } else {
                if ($savedId > 0) $result['inventory']['inserted']++;
            }
        } catch (Throwable $e) {
            $result['inventory']['failed']++;
            $result['errors'][] = 'inventory[' . $idx . ']: ' . $e->getMessage();
        }
    }

    foreach ($rentals as $idx => $row) {
        try {
            $hasRentalNotes = igpColumnExists($pdo, 'rentals', 'notes');
            $itemBarcode = trim((string)($row['itemBarcode'] ?? $row['barcode'] ?? ''));
            $renterId = trim((string)($row['renterId'] ?? ''));
            $rentalDate = trim((string)($row['rentalDate'] ?? ''));
            $dueDate = trim((string)($row['dueDate'] ?? ''));
            $hours = (int)($row['rentalHours'] ?? 1);

            if ($itemBarcode === '' || $renterId === '' || $rentalDate === '' || $dueDate === '') {
                $result['rentals']['skipped']++;
                continue;
            }

            $itemStmt = $pdo->prepare(
                "SELECT item_id, hourly_rate, overtime_interval_minutes, overtime_rate_per_block
                 FROM inventory_items
                 WHERE org_id = :org AND barcode = :barcode LIMIT 1"
            );
            $itemStmt->execute([':org' => $orgId, ':barcode' => $itemBarcode]);
            $item = $itemStmt->fetch();
            if (!$item) {
                $result['rentals']['skipped']++;
                $result['errors'][] = 'rental[' . $idx . ']: item barcode not found (' . $itemBarcode . ')';
                continue;
            }

            $renter = igpFindUserByIdentifier($pdo, $renterId);
            if (!$renter) {
                $result['rentals']['skipped']++;
                $result['errors'][] = 'rental[' . $idx . ']: renter not found (' . $renterId . ')';
                continue;
            }

            $findDup = $pdo->prepare(
                "SELECT r.rental_id
                 FROM rentals r
                 JOIN rental_items ri ON ri.rental_id = r.rental_id
                 WHERE r.org_id = :org
                   AND r.renter_user_id = :renter
                   AND r.rent_time = :rent_time
                   AND ri.item_id = :item
                 LIMIT 1"
            );
            $findDup->execute([
                ':org' => $orgId,
                ':renter' => (int)$renter['user_id'],
                ':rent_time' => date('Y-m-d H:i:s', strtotime($rentalDate)),
                ':item' => (int)$item['item_id'],
            ]);
            if ($findDup->fetch()) {
                $result['rentals']['skipped']++;
                continue;
            }

            $processorId = (int)$renter['user_id'];
            $maybeOfficer = trim((string)($row['officerId'] ?? ''));
            if ($maybeOfficer !== '') {
                $off = igpFindUserByIdentifier($pdo, $maybeOfficer);
                if ($off && igpEnsureOfficerInOrg($pdo, (int)$off['user_id'], $orgId)) {
                    $processorId = (int)$off['user_id'];
                }
            }
            if (!igpEnsureOfficerInOrg($pdo, $processorId, $orgId)) {
                $context = igpRequireOfficerOrgContext();
                $processorId = $context['user_id'];
            }

            $pdo->beginTransaction();
            if ($hasRentalNotes) {
                $insR = $pdo->prepare(
                    "INSERT INTO rentals
                        (org_id, renter_user_id, processed_by_user_id, rent_time, expected_return_time, actual_return_time, total_cost, payment_status, paid_at, status, notes)
                     VALUES
                        (:org, :renter, :proc, :rent_time, :expected, :actual, :total, :pay_status, :paid_at, :status, :notes)"
                );
            } else {
                $insR = $pdo->prepare(
                    "INSERT INTO rentals
                        (org_id, renter_user_id, processed_by_user_id, rent_time, expected_return_time, actual_return_time, total_cost, payment_status, paid_at, status)
                     VALUES
                        (:org, :renter, :proc, :rent_time, :expected, :actual, :total, :pay_status, :paid_at, :status)"
                );
            }
            $totalCost = (float)($row['totalCost'] ?? $row['baseCost'] ?? ($item['hourly_rate'] * max(1, $hours)));
            $params = [
                ':org' => $orgId,
                ':renter' => (int)$renter['user_id'],
                ':proc' => $processorId,
                ':rent_time' => date('Y-m-d H:i:s', strtotime($rentalDate)),
                ':expected' => date('Y-m-d H:i:s', strtotime($dueDate)),
                ':actual' => !empty($row['returnDate']) ? date('Y-m-d H:i:s', strtotime($row['returnDate'])) : null,
                ':total' => $totalCost,
                ':pay_status' => (($row['paymentStatus'] ?? 'unpaid') === 'paid') ? 'paid' : 'unpaid',
                ':paid_at' => (($row['paymentStatus'] ?? 'unpaid') === 'paid') ? date('Y-m-d H:i:s') : null,
                ':status' => in_array(($row['status'] ?? 'returned'), ['reserved', 'active', 'returned', 'overdue', 'cancelled'], true)
                    ? ($row['status'] ?? 'returned')
                    : 'returned',
            ];
            if ($hasRentalNotes) {
                $params[':notes'] = 'Imported from legacy localStorage';
            }
            $insR->execute($params);
            $rentalId = (int)$pdo->lastInsertId();

            $insRi = $pdo->prepare(
                "INSERT INTO rental_items
                    (rental_id, item_id, quantity, unit_rate, item_cost, overtime_interval_minutes, overtime_rate_per_block)
                 VALUES
                    (:rid, :item, 1, :rate, :cost, :ot_int, :ot_rate)"
            );
            $insRi->execute([
                ':rid' => $rentalId,
                ':item' => (int)$item['item_id'],
                ':rate' => (float)$item['hourly_rate'],
                ':cost' => (float)($row['baseCost'] ?? $totalCost),
                ':ot_int' => $item['overtime_interval_minutes'] !== null ? (int)$item['overtime_interval_minutes'] : null,
                ':ot_rate' => $item['overtime_rate_per_block'] !== null ? (float)$item['overtime_rate_per_block'] : null,
            ]);

            $pdo->commit();
            $result['rentals']['inserted']++;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            $result['rentals']['failed']++;
            $result['errors'][] = 'rental[' . $idx . ']: ' . $e->getMessage();
        }
    }

    return $result;
}
