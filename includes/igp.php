<?php
/**
 * IGP Rental System domain services.
 * All functions are org-scoped and meant to be called by API endpoints.
 */

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/../config/db.php';

class IgpValidationException extends RuntimeException {}
class IgpAuthorizationException extends RuntimeException {}

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
    if ($categoryId) {
        $stmt = $pdo->prepare(
            "SELECT category_id
             FROM inventory_categories
             WHERE category_id = :cid AND org_id = :org AND is_active = 1
             LIMIT 1"
        );
        $stmt->execute([':cid' => $categoryId, ':org' => $orgId]);
        $row = $stmt->fetch();
        if ($row) return (int)$row['category_id'];
    }

    $name = trim((string)$categoryName);
    if ($name === '') {
        $name = 'General';
    }

    $find = $pdo->prepare(
        "SELECT category_id
         FROM inventory_categories
         WHERE org_id = :org AND category_name = :name
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

function igpGetInventory(PDO $pdo, int $orgId, array $filters = []): array
{
    $where = ["i.org_id = :org"];
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
               i.category_id,
               c.category_name,
               i.stock_quantity,
               i.available_quantity,
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
        $r['stock_quantity'] = (int)$r['stock_quantity'];
        $r['available_quantity'] = (int)$r['available_quantity'];
        $r['hourly_rate'] = (float)$r['hourly_rate'];
        $r['overtime_interval_minutes'] = $r['overtime_interval_minutes'] !== null ? (int)$r['overtime_interval_minutes'] : null;
        $r['overtime_rate_per_block'] = $r['overtime_rate_per_block'] !== null ? (float)$r['overtime_rate_per_block'] : null;
    }
    return $rows;
}

function igpSaveInventoryItem(PDO $pdo, int $orgId, array $data): int
{
    $itemId = isset($data['item_id']) ? (int)$data['item_id'] : 0;
    $itemName = trim((string)($data['item_name'] ?? ''));
    $barcode = trim((string)($data['barcode'] ?? ''));
    $stockQty = max(0, (int)($data['stock_quantity'] ?? 1));
    $hourlyRate = (float)($data['hourly_rate'] ?? 0);
    $status = trim((string)($data['status'] ?? 'available'));
    $categoryId = isset($data['category_id']) ? (int)$data['category_id'] : null;
    $categoryName = isset($data['category_name']) ? (string)$data['category_name'] : null;
    $overtimeInterval = ($data['overtime_interval_minutes'] ?? null);
    $overtimeRate = ($data['overtime_rate_per_block'] ?? null);

    if ($itemName === '' || $barcode === '') {
        throw new IgpValidationException('Item name and barcode are required.');
    }
    if ($hourlyRate < 0) {
        throw new IgpValidationException('Hourly rate must be non-negative.');
    }
    if (!in_array($status, ['available', 'rented', 'maintenance'], true)) {
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

    if ($itemId > 0) {
        $stmt = $pdo->prepare(
            "SELECT item_id, stock_quantity, available_quantity
             FROM inventory_items
             WHERE item_id = :id AND org_id = :org
             LIMIT 1"
        );
        $stmt->execute([':id' => $itemId, ':org' => $orgId]);
        $existing = $stmt->fetch();
        if (!$existing) {
            throw new IgpValidationException('Item not found for this organization.');
        }
        $currentlyRented = max(0, (int)$existing['stock_quantity'] - (int)$existing['available_quantity']);
        if ($stockQty < $currentlyRented) {
            throw new IgpValidationException('Stock quantity cannot be less than currently rented quantity.');
        }
        $newAvailable = $stockQty - $currentlyRented;

        $upd = $pdo->prepare(
            "UPDATE inventory_items
             SET item_name = :name,
                 barcode = :barcode,
                 category_id = :cid,
                 stock_quantity = :stock,
                 available_quantity = :avail,
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
            ':stock' => $stockQty,
            ':avail' => $newAvailable,
            ':rate' => $hourlyRate,
            ':ot_int' => $overtimeInterval,
            ':ot_rate' => $overtimeRate,
            ':status' => $status,
            ':id' => $itemId,
            ':org' => $orgId,
        ]);
        return $itemId;
    }

    $ins = $pdo->prepare(
        "INSERT INTO inventory_items
            (org_id, item_name, barcode, category_id, stock_quantity, available_quantity, hourly_rate, overtime_interval_minutes, overtime_rate_per_block, status)
         VALUES
            (:org, :name, :barcode, :cid, :stock, :avail, :rate, :ot_int, :ot_rate, :status)"
    );
    $ins->execute([
        ':org' => $orgId,
        ':name' => $itemName,
        ':barcode' => $barcode,
        ':cid' => $resolvedCategoryId,
        ':stock' => $stockQty,
        ':avail' => $stockQty,
        ':rate' => $hourlyRate,
        ':ot_int' => $overtimeInterval,
        ':ot_rate' => $overtimeRate,
        ':status' => $status,
    ]);
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
         WHERE ri.item_id = :item AND r.org_id = :org AND r.status = 'active'
         LIMIT 1"
    );
    $check->execute([':item' => $itemId, ':org' => $orgId]);
    if ($check->fetch()) {
        throw new IgpValidationException('Cannot delete item with active rentals.');
    }

    $del = $pdo->prepare("DELETE FROM inventory_items WHERE item_id = :id AND org_id = :org");
    $del->execute([':id' => $itemId, ':org' => $orgId]);
    if ($del->rowCount() === 0) {
        throw new IgpValidationException('Item not found for this organization.');
    }
}

function igpGetRentals(PDO $pdo, int $orgId, array $filters = []): array
{
    $where = ["r.org_id = :org"];
    $params = [':org' => $orgId];

    if (!empty($filters['status'])) {
        $where[] = "r.status = :status";
        $params[':status'] = $filters['status'];
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
             r.processed_by_user_id,
             CONCAT(pu.first_name, ' ', pu.last_name) AS processor_name,
             r.rent_time,
             r.expected_return_time,
             r.actual_return_time,
             r.total_cost,
             r.payment_status,
             r.payment_method,
             r.paid_at,
             r.status,
             r.notes,
             SUM(ri.quantity) AS item_count,
             GROUP_CONCAT(CONCAT(i.item_name, ' [', i.barcode, ']') ORDER BY i.item_name SEPARATOR ', ') AS items_label
      FROM rentals r
      JOIN users ru ON ru.user_id = r.renter_user_id
      JOIN users pu ON pu.user_id = r.processed_by_user_id
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
    $notes = trim((string)($data['notes'] ?? ''));

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
            "SELECT item_id, available_quantity, hourly_rate, overtime_interval_minutes, overtime_rate_per_block, status
             FROM inventory_items
             WHERE item_id = :id AND org_id = :org
             FOR UPDATE"
        );
        $itemStmt->execute([':id' => $itemId, ':org' => $orgId]);
        $item = $itemStmt->fetch();
        if (!$item) {
            throw new IgpValidationException('Item not found for this organization.');
        }
        if ((int)$item['available_quantity'] <= 0 || $item['status'] === 'maintenance') {
            throw new IgpValidationException('Item is not currently available for rent.');
        }

        $rentTime = new DateTimeImmutable('now');
        $expected = $rentTime->modify('+' . $hours . ' hours');
        $unitRate = (float)$item['hourly_rate'];
        $itemCost = $unitRate * $hours;

        $insRental = $pdo->prepare(
            "INSERT INTO rentals
                (org_id, renter_user_id, processed_by_user_id, rent_time, expected_return_time, total_cost, payment_status, status, notes)
             VALUES
                (:org, :renter, :proc, :rent_time, :expected, :total, 'unpaid', 'active', :notes)"
        );
        $insRental->execute([
            ':org' => $orgId,
            ':renter' => (int)$renter['user_id'],
            ':proc' => $processorUserId,
            ':rent_time' => $rentTime->format('Y-m-d H:i:s'),
            ':expected' => $expected->format('Y-m-d H:i:s'),
            ':total' => $itemCost,
            ':notes' => $notes !== '' ? $notes : null,
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

        $newAvail = (int)$item['available_quantity'] - 1;
        $newStatus = $newAvail > 0 ? 'available' : 'rented';
        $updItem = $pdo->prepare(
            "UPDATE inventory_items
             SET available_quantity = :avail, status = :status
             WHERE item_id = :id AND org_id = :org"
        );
        $updItem->execute([
            ':avail' => $newAvail,
            ':status' => $newStatus,
            ':id' => $itemId,
            ':org' => $orgId
        ]);

        $pdo->commit();
        return $rentalId;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
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
                    i.stock_quantity, i.available_quantity, i.status AS item_status
             FROM rental_items ri
             JOIN inventory_items i ON i.item_id = ri.item_id
             WHERE ri.rental_id = :rid
             FOR UPDATE"
        );
        $itemsStmt->execute([':rid' => $rentalId]);
        $items = $itemsStmt->fetchAll();
        if (!$items) throw new IgpValidationException('No rental items found.');

        $actual = new DateTimeImmutable('now');
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
            $qty = (int)$it['quantity'];
            $avail = min((int)$it['stock_quantity'], (int)$it['available_quantity'] + $qty);
            $status = ($it['item_status'] === 'maintenance')
                ? 'maintenance'
                : ($avail > 0 ? 'available' : 'rented');
            $updItem = $pdo->prepare(
                "UPDATE inventory_items
                 SET available_quantity = :avail, status = :status
                 WHERE item_id = :iid AND org_id = :org"
            );
            $updItem->execute([
                ':avail' => $avail,
                ':status' => $status,
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

function igpMarkRentalPaid(PDO $pdo, int $orgId, int $rentalId, string $method = 'cash'): void
{
    if ($rentalId <= 0) {
        throw new IgpValidationException('Invalid rental_id.');
    }
    if ($method !== 'cash') {
        throw new IgpValidationException('Unsupported payment method.');
    }

    $upd = $pdo->prepare(
        "UPDATE rentals
         SET payment_status = 'paid',
             payment_method = :method,
             paid_at = CURRENT_TIMESTAMP
         WHERE rental_id = :rid
           AND org_id = :org
           AND payment_status = 'unpaid'
           AND status IN ('returned', 'overdue')"
    );
    $upd->execute([':method' => $method, ':rid' => $rentalId, ':org' => $orgId]);
    if ($upd->rowCount() === 0) {
        throw new IgpValidationException('Rental is not eligible for mark-paid.');
    }
}

function igpGetFinancialSummary(PDO $pdo, int $orgId, array $filters = []): array
{
    $rows = igpGetRentals($pdo, $orgId, $filters);
    $summary = [
        'total_transactions' => 0,
        'paid_transactions' => 0,
        'unpaid_transactions' => 0,
        'total_revenue' => 0.0,
        'total_unpaid' => 0.0,
        'items' => $rows,
    ];

    foreach ($rows as $r) {
        $summary['total_transactions']++;
        $cost = (float)$r['total_cost'];
        if ($r['payment_status'] === 'paid') {
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
            $insR = $pdo->prepare(
                "INSERT INTO rentals
                    (org_id, renter_user_id, processed_by_user_id, rent_time, expected_return_time, actual_return_time, total_cost, payment_status, payment_method, paid_at, status, notes)
                 VALUES
                    (:org, :renter, :proc, :rent_time, :expected, :actual, :total, :pay_status, :pay_method, :paid_at, :status, :notes)"
            );
            $totalCost = (float)($row['totalCost'] ?? $row['baseCost'] ?? ($item['hourly_rate'] * max(1, $hours)));
            $insR->execute([
                ':org' => $orgId,
                ':renter' => (int)$renter['user_id'],
                ':proc' => $processorId,
                ':rent_time' => date('Y-m-d H:i:s', strtotime($rentalDate)),
                ':expected' => date('Y-m-d H:i:s', strtotime($dueDate)),
                ':actual' => !empty($row['returnDate']) ? date('Y-m-d H:i:s', strtotime($row['returnDate'])) : null,
                ':total' => $totalCost,
                ':pay_status' => (($row['paymentStatus'] ?? 'unpaid') === 'paid') ? 'paid' : 'unpaid',
                ':pay_method' => (($row['paymentStatus'] ?? 'unpaid') === 'paid') ? 'cash' : null,
                ':paid_at' => (($row['paymentStatus'] ?? 'unpaid') === 'paid') ? date('Y-m-d H:i:s') : null,
                ':status' => in_array(($row['status'] ?? 'returned'), ['active', 'returned', 'overdue', 'cancelled'], true)
                    ? ($row['status'] ?? 'returned')
                    : 'returned',
                ':notes' => 'Imported from legacy localStorage',
            ]);
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
