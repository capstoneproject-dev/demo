<?php

require_once __DIR__ . '/../includes/notification_email_delivery.php';

$aisersBranding = notificationEmailOrganizationBranding(
    'AISERS',
    'Alliance in Information System Empowered Responsive Students'
);
if ($aisersBranding !== [
    'header_fallback' => '#ffcf33',
    'header_background' => 'linear-gradient(135deg, #ffcf33 0%, #ffe796 100%)',
    'header_text' => '#111827',
]) {
    throw new RuntimeException('AISERS email branding is incorrect.');
}
$brandedBodies = notificationEmailRenderBodies([
    'title' => 'Test title',
    'message' => 'Test message',
    'recipient_name' => 'Test Student',
    'organization_code' => 'AISERS',
    'organization_name' => 'Alliance in Information System Empowered Responsive Students',
    'notification_status' => 'reserved',
    'due_at' => null,
], 'https://example.test/pages/studentDashboard.html');
if (!str_contains(
    $brandedBodies['html'],
    'background-color:#ffcf33;background:linear-gradient(135deg, #ffcf33 0%, #ffe796 100%);color:#111827'
)) {
    throw new RuntimeException('Organization branding was not applied to the email header.');
}

$printingBase = [
    'print_job_id' => 7654321,
    'org_id' => 2,
    'user_id' => 1,
    'provider_auto_assigned' => 0,
    'provider_accepted_at' => null,
    'file_name' => 'Smoke Test.pdf',
    'queue_order' => 1,
    'submitted_at' => date('Y-m-d H:i:s'),
    'processing_started_at' => null,
    'ready_at' => null,
    'claimed_at' => null,
    'updated_at' => date('Y-m-d H:i:s'),
    'organization' => 'AISERS',
];
$printingCases = [
    ['status' => 'queued', 'expected' => 'submitted'],
    ['status' => 'queued', 'provider_accepted_at' => date('Y-m-d H:i:s'), 'expected' => 'accepted'],
    ['status' => 'processing', 'processing_started_at' => date('Y-m-d H:i:s'), 'expected' => 'processing'],
    ['status' => 'ready_to_claim', 'ready_at' => date('Y-m-d H:i:s'), 'expected' => 'ready_to_claim'],
    ['status' => 'claimed', 'claimed_at' => date('Y-m-d H:i:s'), 'expected' => 'claimed'],
    ['status' => 'cancelled', 'expected' => 'cancelled'],
];
$printingCutoff = new DateTimeImmutable('-24 hours', new DateTimeZone('Asia/Manila'));
foreach ($printingCases as $case) {
    $expected = $case['expected'];
    unset($case['expected']);
    $notification = studentNotificationBuildPrinting(array_merge($printingBase, $case), $printingCutoff);
    if (!$notification
        || $notification['source_type'] !== 'printing'
        || $notification['status'] !== $expected
        || !notificationEmailIsEligible($notification)) {
        throw new RuntimeException("Printing notification state {$expected} is incorrect.");
    }
}

$pdo = getPdo();
$identity = $pdo->query(
    "SELECT u.user_id, o.org_id
     FROM users u
     CROSS JOIN organizations o
     WHERE u.account_type = 'student'
       AND u.is_active = 1
     ORDER BY u.user_id, o.org_id
     LIMIT 1"
)->fetch();

if (!$identity) {
    fwrite(STDERR, "Smoke test requires one active student and organization.\n");
    exit(2);
}

$pdo->beginTransaction();
try {
    $userId = (int)$identity['user_id'];
    $orgId = (int)$identity['org_id'];

    $clearPreferences = $pdo->prepare(
        'DELETE FROM student_email_notification_preferences WHERE user_id = :user_id'
    );
    $clearPreferences->execute([':user_id' => $userId]);
    $defaults = notificationEmailGetPreferences($pdo, $userId);
    if ($defaults !== [
        'rental_enabled' => true,
        'locker_enabled' => true,
        'attendance_enabled' => true,
        'printing_enabled' => true,
    ]) {
        throw new RuntimeException('Default email preferences are incorrect.');
    }

    $saved = notificationEmailSavePreferences($pdo, $userId, [
        'rental_enabled' => false,
        'locker_enabled' => true,
        'attendance_enabled' => false,
        'printing_enabled' => false,
    ]);
    if ($saved['rental_enabled'] !== false
        || $saved['attendance_enabled'] !== false
        || $saved['printing_enabled'] !== false) {
        throw new RuntimeException('Email preference update failed.');
    }

    // Re-enable rental delivery so the synthetic queue row is processed.
    notificationEmailSavePreferences($pdo, $userId, [
        'rental_enabled' => true,
        'locker_enabled' => true,
        'attendance_enabled' => true,
        'printing_enabled' => true,
    ]);

    $printInsert = $pdo->prepare(
        "INSERT INTO print_jobs
            (org_id, user_id, provider_auto_assigned, file_name, file_url, status,
             queue_order, last_updated_by_user_id)
         VALUES
            (:org_id, :user_id, 0, 'Notification Smoke Test.pdf',
             'uploads/documents/notification-smoke-test.pdf', 'queued', 999999, :updated_by)"
    );
    $printInsert->execute([
        ':org_id' => $orgId,
        ':user_id' => $userId,
        ':updated_by' => $userId,
    ]);
    $printJobId = (int)$pdo->lastInsertId();
    $studentNumberStmt = $pdo->prepare('SELECT student_number FROM users WHERE user_id = :user_id');
    $studentNumberStmt->execute([':user_id' => $userId]);
    $builtNotifications = studentBuildTransactionNotifications(
        $pdo,
        $userId,
        (string)$studentNumberStmt->fetchColumn(),
        0
    );
    $expectedPrintingId = "printing:{$printJobId}:submitted";
    if (!array_filter(
        $builtNotifications,
        static fn(array $item): bool => $item['id'] === $expectedPrintingId
            && $item['source_type'] === 'printing'
    )) {
        throw new RuntimeException('Database-backed printing notification was not generated.');
    }

    $insert = $pdo->prepare(
        "INSERT INTO notification_email_deliveries
            (user_id, org_id, notification_id, source_type, source_id,
             notification_status, severity, recipient_name, recipient_email,
             subject, title, message, delivery_status, next_attempt_at)
         VALUES
            (:user_id, :org_id, :notification_id, 'rental', 999999,
             'urgent', 'urgent', 'Test Student', 'test@example.com',
             'Test subject', 'Test title', 'Test message', 'pending', NOW())"
    );
    $notificationId = 'smoke:retry:' . bin2hex(random_bytes(5));
    $insert->execute([
        ':user_id' => $userId,
        ':org_id' => $orgId,
        ':notification_id' => $notificationId,
    ]);

    $check = $pdo->prepare(
        "SELECT delivery_status, attempt_count, last_error_category,
                TIMESTAMPDIFF(SECOND, NOW(), next_attempt_at) AS retry_seconds
         FROM notification_email_deliveries
         WHERE user_id = :user_id
           AND notification_id = :notification_id"
    );
    $makeDue = $pdo->prepare(
        "UPDATE notification_email_deliveries
         SET next_attempt_at = NOW()
         WHERE user_id = :user_id
           AND notification_id = :notification_id"
    );
    $expectedDelays = [1 => 1, 2 => 5, 3 => 15, 4 => 0];
    foreach ($expectedDelays as $attempt => $expectedDelay) {
        if ($attempt > 1) {
            $makeDue->execute([
                ':user_id' => $userId,
                ':notification_id' => $notificationId,
            ]);
        }
        $result = notificationEmailProcessQueue(
            $pdo,
            10,
            static function (): void {
                throw new MailDeliveryException('connection', 'Synthetic connection failure.');
            }
        );
        $check->execute([
            ':user_id' => $userId,
            ':notification_id' => $notificationId,
        ]);
        $delivery = $check->fetch();
        $expectedStatus = $attempt === 4 ? 'failed_final' : 'retrying';
        if (!$delivery
            || $delivery['delivery_status'] !== $expectedStatus
            || (int)$delivery['attempt_count'] !== $attempt
            || $delivery['last_error_category'] !== 'connection') {
            throw new RuntimeException("Delivery attempt {$attempt} state is incorrect.");
        }
        if ($expectedDelay > 0) {
            $minimumSeconds = ($expectedDelay * 60) - 10;
            if ((int)$delivery['retry_seconds'] < $minimumSeconds) {
                throw new RuntimeException("Delivery attempt {$attempt} retry delay is incorrect.");
            }
        } elseif ($delivery['retry_seconds'] !== null) {
            throw new RuntimeException('Final failure should not have another retry time.');
        }
    }

    $pdo->rollBack();
    echo "notification_email_delivery_smoke: PASS\n";
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, "notification_email_delivery_smoke: FAIL - {$e->getMessage()}\n");
    exit(1);
}
