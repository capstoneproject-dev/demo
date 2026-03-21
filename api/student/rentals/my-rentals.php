<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/igp.php';

header('Content-Type: application/json');
apiGuard();

try {
    $session = getPhpSession();
    $userId = (int)($session['user_id'] ?? 0);
    if ($userId <= 0) {
        jsonError('Not authenticated.', 401);
    }

    // Get status filter (default: active and reserved)
    $status = trim((string)($_GET['status'] ?? 'open'));

    $pdo = getPdo();

    // Determine column existence for compatibility
    $hasRentalNotes = igpColumnExists($pdo, 'rentals', 'notes');
    $notesSelectExpr = $hasRentalNotes ? "r.notes" : "NULL AS notes";

    // Build WHERE clause
    $where = ["r.renter_user_id = :user_id"];
    $params = [':user_id' => $userId];

    if ($status === 'open') {
        $where[] = "r.status IN ('reserved', 'active')";
    } elseif ($status === 'active') {
        $where[] = "r.status = 'active'";
    } elseif ($status === 'reserved') {
        $where[] = "r.status = 'reserved'";
    } elseif (!empty($status)) {
        $where[] = "r.status = :status";
        $params[':status'] = $status;
    }

    $sql = "
      SELECT r.rental_id,
             r.org_id,
             o.org_name,
             r.renter_user_id,
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
             SUM(ri.unit_rate * ri.quantity) AS hourly_rate,
             GROUP_CONCAT(CONCAT(i.item_name, ' (', ri.quantity, 'x)') ORDER BY i.item_name SEPARATOR ', ') AS items_label,
             GROUP_CONCAT(i.barcode ORDER BY i.item_name SEPARATOR ', ') AS barcodes
      FROM rentals r
      JOIN organizations o ON o.org_id = r.org_id
      JOIN users pu ON pu.user_id = r.processed_by_user_id
      JOIN rental_items ri ON ri.rental_id = r.rental_id
      JOIN inventory_items i ON i.item_id = ri.item_id
      WHERE " . implode(' AND ', $where) . "
      GROUP BY r.rental_id
      ORDER BY r.rent_time DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    // Type cast numeric fields
    foreach ($rows as &$r) {
        $r['rental_id'] = (int)$r['rental_id'];
        $r['org_id'] = (int)$r['org_id'];
        $r['renter_user_id'] = (int)$r['renter_user_id'];
        $r['processed_by_user_id'] = (int)$r['processed_by_user_id'];
        $r['item_count'] = (int)$r['item_count'];
        $r['total_cost'] = (float)$r['total_cost'];
        $r['hourly_rate'] = (float)$r['hourly_rate'];
    }

    jsonOk(['items' => $rows]);
} catch (PDOException $e) {
    error_log('[api/student/rentals/my-rentals] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
