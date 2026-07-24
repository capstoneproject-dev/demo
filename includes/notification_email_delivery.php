<?php
/**
 * Durable email delivery for student transaction notifications.
 *
 * This file is intentionally independent from web requests. Both the CLI
 * dispatcher and authenticated preference/dashboard APIs reuse these helpers.
 */

require_once __DIR__ . '/student_notifications.php';
require_once __DIR__ . '/mailer.php';

const NOTIFICATION_EMAIL_LOCK_NAME = 'naap_transaction_notification_email_dispatch';
const NOTIFICATION_EMAIL_MAX_ATTEMPTS = 4;
const NOTIFICATION_EMAIL_RETENTION_DAYS = 90;

function notificationEmailGetPreferences(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare(
        "SELECT rental_enabled, locker_enabled, attendance_enabled, printing_enabled
         FROM student_email_notification_preferences
         WHERE user_id = :user_id
         LIMIT 1"
    );
    $stmt->execute([':user_id' => $userId]);
    $row = $stmt->fetch();
    return [
        'rental_enabled' => $row ? (bool)$row['rental_enabled'] : true,
        'locker_enabled' => $row ? (bool)$row['locker_enabled'] : true,
        'attendance_enabled' => $row ? (bool)$row['attendance_enabled'] : true,
        'printing_enabled' => $row ? (bool)$row['printing_enabled'] : true,
    ];
}

function notificationEmailSavePreferences(PDO $pdo, int $userId, array $data): array
{
    $current = notificationEmailGetPreferences($pdo, $userId);
    foreach (array_keys($current) as $field) {
        if (array_key_exists($field, $data)) {
            $value = $data[$field];
            if (!is_bool($value) && !in_array($value, [0, 1, '0', '1'], true)) {
                throw new InvalidArgumentException("{$field} must be a boolean.");
            }
            $current[$field] = filter_var($value, FILTER_VALIDATE_BOOLEAN);
        }
    }

    $stmt = $pdo->prepare(
        "INSERT INTO student_email_notification_preferences
            (user_id, rental_enabled, locker_enabled, attendance_enabled, printing_enabled)
         VALUES
            (:user_id, :rental_enabled, :locker_enabled, :attendance_enabled, :printing_enabled)
         ON DUPLICATE KEY UPDATE
            rental_enabled = VALUES(rental_enabled),
            locker_enabled = VALUES(locker_enabled),
            attendance_enabled = VALUES(attendance_enabled),
            printing_enabled = VALUES(printing_enabled)"
    );
    $stmt->execute([
        ':user_id' => $userId,
        ':rental_enabled' => $current['rental_enabled'] ? 1 : 0,
        ':locker_enabled' => $current['locker_enabled'] ? 1 : 0,
        ':attendance_enabled' => $current['attendance_enabled'] ? 1 : 0,
        ':printing_enabled' => $current['printing_enabled'] ? 1 : 0,
    ]);
    return $current;
}

function notificationEmailPreferenceField(string $sourceType): ?string
{
    return match (strtolower($sourceType)) {
        'rental' => 'rental_enabled',
        'locker' => 'locker_enabled',
        'attendance' => 'attendance_enabled',
        'printing' => 'printing_enabled',
        default => null,
    };
}

function notificationEmailIsEligible(array $notification): bool
{
    $source = strtolower((string)($notification['source_type'] ?? ''));
    $status = strtolower((string)($notification['status'] ?? ''));
    $allowed = [
        'rental' => ['reserved', 'active', 'due_soon', 'urgent', 'overtime', 'no_show', 'returned', 'returned_late'],
        'locker' => ['pending', 'active', 'upcoming', 'overdue', 'rejected', 'released'],
        'attendance' => ['registered', 'checked_in', 'checked_out'],
        'printing' => ['submitted', 'accepted', 'processing', 'ready_to_claim', 'claimed', 'cancelled'],
    ];
    return in_array($status, $allowed[$source] ?? [], true)
        && (int)($notification['org_id'] ?? 0) > 0
        && trim((string)($notification['id'] ?? '')) !== '';
}

function notificationEmailOrganizationBranding(string $organizationCode, string $organizationName = ''): array
{
    $key = strtoupper(trim($organizationCode));
    $name = strtoupper(trim($organizationName));
    $aliases = [
        'SUPREME STUDENT COUNCIL' => 'SSC',
        'ALLIANCE IN INFORMATION SYSTEM EMPOWERED RESPONSIVE STUDENTS' => 'AISERS',
        'ELITE TECHNOLOGIST SOCIETY' => 'ELITECH',
        'INSTITUTE OF LIBERAL ARTS AND SCIENCES STUDENT ORGANIZATION' => 'ILASSO',
        'AERONAUTICAL ENGINEERING ORGANIZATION' => 'AERO-ATSO',
        'AVIATION ELECTRONICS TECHNOLOGY STUDENT ORGANIZATION' => 'AETSO',
        'AIRCRAFT MAINTENANCE TECHNOLOGY STUDENT ORGANIZATION' => 'AMTSO',
        'RED CROSS YOUTH COUNCIL' => 'RCYC',
        'COLLEGE YOUTH CLUB' => 'CYC',
        "SCHOLAR'S GUILD" => 'SCHOLARS',
        'AERONAUTICA' => 'AERONAUTICA',
    ];
    if (!isset($aliases[$key]) && isset($aliases[$name])) {
        $key = $aliases[$name];
    } elseif (isset($aliases[$key])) {
        $key = $aliases[$key];
    }

    // These match the light-mode palettes in organizationColorThemes.css.
    $headerColors = [
        'SSC' => ['#4b5563', '#9ca3af'],
        'AISERS' => ['#ffcf33', '#ffe796'],
        'ELITECH' => ['#f2f2f2', '#d6d6d6'],
        'ILASSO' => ['#2ea56a', '#9be3bf'],
        'AERO-ATSO' => ['#49a6ff', '#a5d3ff'],
        'AETSO' => ['#5e8fff', '#eaff66'],
        'AMTSO' => ['#ff7a33', '#ffc494'],
        'RCYC' => ['#ff4a43', '#ffaca8'],
        'CYC' => ['#ff4db3', '#ffb8df'],
        'SCHOLARS' => ['#8f7320', '#9fd9b5'],
        'AERONAUTICA' => ['#49a6ff', '#a5d3ff'],
    ];
    [$primary, $secondary] = $headerColors[$key] ?? ['#002147', '#003366'];
    $linearize = static function (int $channel): float {
        $value = $channel / 255;
        return $value <= 0.04045
            ? $value / 12.92
            : (($value + 0.055) / 1.055) ** 2.4;
    };
    $luminance = static function (string $color) use ($linearize): float {
        [$red, $green, $blue] = sscanf($color, '#%02x%02x%02x');
        return 0.2126 * $linearize($red)
            + 0.7152 * $linearize($green)
            + 0.0722 * $linearize($blue);
    };
    $luminances = [$luminance($primary), $luminance($secondary)];
    $minimumWhiteContrast = min(array_map(
        static fn(float $value): float => 1.05 / ($value + 0.05),
        $luminances
    ));
    $minimumDarkContrast = min(array_map(
        static fn(float $value): float => ($value + 0.05) / 0.05,
        $luminances
    ));

    return [
        'header_fallback' => $primary,
        'header_background' => "linear-gradient(135deg, {$primary} 0%, {$secondary} 100%)",
        'header_text' => $minimumDarkContrast >= $minimumWhiteContrast ? '#111827' : '#ffffff',
    ];
}

function notificationEmailBuildSubject(array $notification): string
{
    $organization = trim((string)($notification['organization'] ?? 'NAAP')) ?: 'NAAP';
    $title = trim((string)($notification['title'] ?? 'Transaction update')) ?: 'Transaction update';
    return mb_substr("[{$organization}] {$title}", 0, 255);
}

function notificationEmailRenderBodies(array $delivery, string $dashboardUrl): array
{
    $safe = static fn(?string $value): string => htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
    $title = $safe($delivery['title'] ?? 'Transaction update');
    $message = $safe($delivery['message'] ?? '');
    $studentName = $safe($delivery['recipient_name'] ?? 'Student');
    $organization = $safe($delivery['organization_name'] ?? $delivery['organization_code'] ?? 'NAAP');
    $status = $safe(ucwords(str_replace('_', ' ', (string)($delivery['notification_status'] ?? 'update'))));
    $due = studentNotificationDate($delivery['due_at'] ?? null);
    $dueText = $due ? studentNotificationFormatDate($due) : '';
    $safeDue = $safe($dueText);
    $safeUrl = $safe($dashboardUrl);
    $branding = notificationEmailOrganizationBranding(
        (string)($delivery['organization_code'] ?? ''),
        (string)($delivery['organization_name'] ?? '')
    );
    $headerFallback = $branding['header_fallback'];
    $headerBackground = $branding['header_background'];
    $headerText = $branding['header_text'];

    $dueHtml = $dueText !== ''
        ? '<tr><td style="padding:6px 0;color:#64748b">Relevant date</td><td style="padding:6px 0;text-align:right;font-weight:700">' . $safeDue . '</td></tr>'
        : '';
    $html = '<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#172033">'
        . '<div style="max-width:620px;margin:24px auto;padding:0 16px">'
        . '<div style="background-color:' . $headerFallback . ';background:' . $headerBackground . ';color:' . $headerText . ';padding:18px 22px;border-radius:14px 14px 0 0">'
        . '<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.8">' . $organization . ' via NAAP</div>'
        . '<h1 style="font-size:22px;margin:7px 0 0">' . $title . '</h1></div>'
        . '<div style="background:#fff;padding:24px 22px;border:1px solid #dce4ef;border-top:0;border-radius:0 0 14px 14px">'
        . '<p style="margin-top:0">Hello ' . $studentName . ',</p>'
        . '<p style="line-height:1.65">' . nl2br($message) . '</p>'
        . '<table style="width:100%;margin:18px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb">'
        . '<tr><td style="padding:10px 0;color:#64748b">Status</td><td style="padding:10px 0;text-align:right;font-weight:700">' . $status . '</td></tr>'
        . $dueHtml . '</table>'
        . '<a href="' . $safeUrl . '" style="display:inline-block;background:#f4d03f;color:#002147;text-decoration:none;font-weight:800;padding:11px 17px;border-radius:9px">Open Student Dashboard</a>'
        . '<p style="margin:22px 0 0;color:#64748b;font-size:12px">You can manage transaction email categories from your student profile.</p>'
        . '</div></div></body></html>';

    $text = "{$delivery['title']}\n\nHello {$delivery['recipient_name']},\n\n{$delivery['message']}\n"
        . "\nStatus: " . ucwords(str_replace('_', ' ', (string)$delivery['notification_status']))
        . ($dueText !== '' ? "\nRelevant date: {$dueText}" : '')
        . "\n\nOpen Student Dashboard: {$dashboardUrl}"
        . "\n\nYou can manage transaction email categories from your student profile.";

    return ['html' => $html, 'text' => $text];
}

function notificationEmailRetryDelayMinutes(int $failedAttempt): int
{
    return match ($failedAttempt) {
        1 => 1,
        2 => 5,
        3 => 15,
        default => 0,
    };
}

function notificationEmailSafeErrorMessage(string $category): string
{
    return match ($category) {
        'authentication' => 'The configured sending account could not authenticate.',
        'connection' => 'The mail server could not be reached.',
        'recipient' => 'The recipient email address was rejected or invalid.',
        'configuration' => 'Email delivery is not fully configured.',
        'dependency' => 'The email delivery dependency is unavailable.',
        default => 'The mail server could not deliver the message.',
    };
}

function notificationEmailGetActivationTimes(PDO $pdo): array
{
    $stmt = $pdo->query(
        "SELECT activated_at, printing_activated_at
         FROM notification_email_dispatch_state
         WHERE state_id = 1
         LIMIT 1"
    );
    $row = $stmt->fetch() ?: [];
    $fallback = new DateTimeImmutable('now', new DateTimeZone('Asia/Manila'));
    $default = studentNotificationDate($row['activated_at'] ?? null) ?? $fallback;
    return [
        'default' => $default,
        'printing' => studentNotificationDate($row['printing_activated_at'] ?? null) ?? $default,
    ];
}

function notificationEmailListStudents(PDO $pdo): array
{
    return $pdo->query(
        "SELECT user_id,
                student_number,
                CONCAT(first_name, ' ', last_name) AS full_name,
                email
         FROM users
         WHERE account_type = 'student'
           AND is_active = 1
           AND email IS NOT NULL
           AND email <> ''
         ORDER BY user_id"
    )->fetchAll();
}

function notificationEmailDeliveryExists(PDO $pdo, int $userId, string $notificationId): bool
{
    $stmt = $pdo->prepare(
        "SELECT 1
         FROM notification_email_deliveries
         WHERE user_id = :user_id
           AND notification_id = :notification_id
         LIMIT 1"
    );
    $stmt->execute([
        ':user_id' => $userId,
        ':notification_id' => $notificationId,
    ]);
    return (bool)$stmt->fetchColumn();
}

function notificationEmailInsertCandidate(PDO $pdo, array $student, array $notification): bool
{
    $stmt = $pdo->prepare(
        "INSERT IGNORE INTO notification_email_deliveries
            (user_id, org_id, notification_id, source_type, source_id, notification_status,
             severity, recipient_name, recipient_email, subject, title, message, due_at,
             delivery_status, next_attempt_at)
         VALUES
            (:user_id, :org_id, :notification_id, :source_type, :source_id, :notification_status,
             :severity, :recipient_name, :recipient_email, :subject, :title, :message, :due_at,
             'pending', NOW())"
    );
    $stmt->execute([
        ':user_id' => (int)$student['user_id'],
        ':org_id' => (int)$notification['org_id'],
        ':notification_id' => (string)$notification['id'],
        ':source_type' => (string)$notification['source_type'],
        ':source_id' => (int)$notification['source_id'],
        ':notification_status' => (string)$notification['status'],
        ':severity' => (string)$notification['severity'],
        ':recipient_name' => (string)$student['full_name'],
        ':recipient_email' => (string)$student['email'],
        ':subject' => notificationEmailBuildSubject($notification),
        ':title' => (string)$notification['title'],
        ':message' => (string)$notification['message'],
        ':due_at' => $notification['due_at'] ?: null,
    ]);
    return $stmt->rowCount() > 0;
}

function notificationEmailQueueCandidates(PDO $pdo, bool $dryRun): array
{
    $activationTimes = notificationEmailGetActivationTimes($pdo);
    $queued = 0;
    $suppressedByPreference = 0;
    $existing = 0;
    $eligible = 0;

    foreach (notificationEmailListStudents($pdo) as $student) {
        $userId = (int)$student['user_id'];
        $preferences = notificationEmailGetPreferences($pdo, $userId);
        $notifications = studentBuildTransactionNotifications(
            $pdo,
            $userId,
            (string)($student['student_number'] ?? ''),
            0
        );
        foreach ($notifications as $notification) {
            if (!notificationEmailIsEligible($notification)) {
                continue;
            }
            $sourceType = strtolower((string)($notification['source_type'] ?? ''));
            $activation = $sourceType === 'printing'
                ? $activationTimes['printing']
                : $activationTimes['default'];
            $activityAt = studentNotificationDate($notification['activity_at'] ?? null);
            if (!$activityAt || $activityAt <= $activation) {
                continue;
            }
            $eligible++;
            $preferenceField = notificationEmailPreferenceField((string)$notification['source_type']);
            if (!$preferenceField || empty($preferences[$preferenceField])) {
                $suppressedByPreference++;
                continue;
            }
            if (notificationEmailDeliveryExists($pdo, $userId, (string)$notification['id'])) {
                $existing++;
                continue;
            }
            if ($dryRun) {
                $queued++;
                continue;
            }
            if (notificationEmailInsertCandidate($pdo, $student, $notification)) {
                $queued++;
            }
        }
    }

    return [
        'eligible' => $eligible,
        'queued' => $queued,
        'already_recorded' => $existing,
        'preference_suppressed' => $suppressedByPreference,
    ];
}

function notificationEmailMarkPreferenceSuppressed(PDO $pdo, int $deliveryId): void
{
    $stmt = $pdo->prepare(
        "UPDATE notification_email_deliveries
         SET delivery_status = 'suppressed_preference',
             next_attempt_at = NULL
         WHERE delivery_id = :delivery_id"
    );
    $stmt->execute([':delivery_id' => $deliveryId]);
}

function notificationEmailProcessQueue(PDO $pdo, int $limit, ?callable $sender = null): array
{
    $stmt = $pdo->query(
        "SELECT d.*,
                COALESCE(o.org_code, o.org_name, 'Organization') AS organization_code,
                COALESCE(o.org_name, o.org_code, 'Organization') AS organization_name,
                o.contact_email AS organization_reply_to
         FROM notification_email_deliveries d
         JOIN organizations o ON o.org_id = d.org_id
         WHERE d.delivery_status IN ('pending', 'retrying')
           AND d.attempt_count < " . NOTIFICATION_EMAIL_MAX_ATTEMPTS . "
           AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= NOW())
         ORDER BY COALESCE(d.next_attempt_at, d.created_at), d.delivery_id
         LIMIT " . max(1, min(500, $limit))
    );
    $deliveries = $stmt->fetchAll();
    $sent = 0;
    $retrying = 0;
    $failedFinal = 0;
    $preferenceSuppressed = 0;
    $config = getMailConfig();
    $dashboardUrl = $config['app_base_url'] . '/pages/studentDashboard.html';
    $preferenceCache = [];
    $sender ??= static function (array $delivery, array $bodies): void {
        $organizationLabel = trim((string)$delivery['organization_code']) ?: 'Organization';
        sendConfiguredEmail(
            (string)$delivery['recipient_email'],
            (string)$delivery['subject'],
            $bodies['html'],
            $bodies['text'],
            mb_substr("{$organizationLabel} via NAAP", 0, 128),
            filter_var($delivery['organization_reply_to'], FILTER_VALIDATE_EMAIL)
                ? (string)$delivery['organization_reply_to']
                : null,
            (string)$delivery['organization_name']
        );
    };

    foreach ($deliveries as $delivery) {
        $userId = (int)$delivery['user_id'];
        $preferenceCache[$userId] ??= notificationEmailGetPreferences($pdo, $userId);
        $preferenceField = notificationEmailPreferenceField((string)$delivery['source_type']);
        if (!$preferenceField || empty($preferenceCache[$userId][$preferenceField])) {
            notificationEmailMarkPreferenceSuppressed($pdo, (int)$delivery['delivery_id']);
            $preferenceSuppressed++;
            continue;
        }

        $attempt = (int)$delivery['attempt_count'] + 1;
        try {
            $bodies = notificationEmailRenderBodies($delivery, $dashboardUrl);
            $sender($delivery, $bodies);
            $update = $pdo->prepare(
                "UPDATE notification_email_deliveries
                 SET delivery_status = 'sent',
                     attempt_count = :attempt_count,
                     last_attempt_at = NOW(),
                     sent_at = NOW(),
                     next_attempt_at = NULL,
                     last_error_category = NULL,
                     last_error_message = NULL
                 WHERE delivery_id = :delivery_id"
            );
            $update->execute([
                ':attempt_count' => $attempt,
                ':delivery_id' => (int)$delivery['delivery_id'],
            ]);
            $sent++;
        } catch (MailDeliveryException $e) {
            $isFinal = $attempt >= NOTIFICATION_EMAIL_MAX_ATTEMPTS;
            $delay = notificationEmailRetryDelayMinutes($attempt);
            $update = $pdo->prepare(
                "UPDATE notification_email_deliveries
                 SET delivery_status = :delivery_status,
                     attempt_count = :attempt_count,
                     last_attempt_at = NOW(),
                     next_attempt_at = " . ($isFinal ? 'NULL' : 'DATE_ADD(NOW(), INTERVAL :delay MINUTE)') . ",
                     last_error_category = :error_category,
                     last_error_message = :error_message
                 WHERE delivery_id = :delivery_id"
            );
            $params = [
                ':delivery_status' => $isFinal ? 'failed_final' : 'retrying',
                ':attempt_count' => $attempt,
                ':error_category' => $e->category,
                ':error_message' => notificationEmailSafeErrorMessage($e->category),
                ':delivery_id' => (int)$delivery['delivery_id'],
            ];
            if (!$isFinal) {
                $params[':delay'] = $delay;
            }
            $update->execute($params);
            if ($isFinal) {
                $failedFinal++;
            } else {
                $retrying++;
            }
        }
    }

    return [
        'processed' => count($deliveries),
        'sent' => $sent,
        'retrying' => $retrying,
        'failed_final' => $failedFinal,
        'preference_suppressed' => $preferenceSuppressed,
    ];
}

function notificationEmailArchiveOldDeliveries(PDO $pdo): int
{
    $stmt = $pdo->prepare(
        "UPDATE notification_email_deliveries
         SET delivery_status = 'archived',
             recipient_name = NULL,
             recipient_email = NULL,
             subject = NULL,
             title = NULL,
             message = NULL,
             last_error_message = NULL,
             archived_at = NOW()
         WHERE delivery_status IN ('sent', 'failed_final', 'suppressed_preference')
           AND updated_at < DATE_SUB(NOW(), INTERVAL :retention_days DAY)"
    );
    $stmt->bindValue(':retention_days', NOTIFICATION_EMAIL_RETENTION_DAYS, PDO::PARAM_INT);
    $stmt->execute();
    return $stmt->rowCount();
}

function notificationEmailUpdateDispatchState(PDO $pdo, string $status, ?string $errorCategory = null): void
{
    $stmt = $pdo->prepare(
        "UPDATE notification_email_dispatch_state
         SET last_run_at = NOW(),
             last_run_status = :status,
             last_error_category = :error_category
         WHERE state_id = 1"
    );
    $stmt->execute([
        ':status' => $status,
        ':error_category' => $errorCategory,
    ]);
}

function dispatchTransactionNotificationEmails(PDO $pdo, bool $dryRun = false, int $limit = 100): array
{
    $lockStmt = $pdo->prepare('SELECT GET_LOCK(:lock_name, 0)');
    $lockStmt->execute([':lock_name' => NOTIFICATION_EMAIL_LOCK_NAME]);
    if ((int)$lockStmt->fetchColumn() !== 1) {
        return ['locked' => true, 'message' => 'Another dispatcher is already running.'];
    }

    try {
        $candidates = notificationEmailQueueCandidates($pdo, $dryRun);
        if ($dryRun) {
            return [
                'dry_run' => true,
                'candidates' => $candidates,
                'message' => 'Dry run completed; no delivery rows were created and no email was sent.',
            ];
        }

        $processed = notificationEmailProcessQueue($pdo, $limit);
        $archived = notificationEmailArchiveOldDeliveries($pdo);
        notificationEmailUpdateDispatchState($pdo, 'success');
        return [
            'dry_run' => false,
            'candidates' => $candidates,
            'delivery' => $processed,
            'archived' => $archived,
        ];
    } catch (Throwable $e) {
        try {
            notificationEmailUpdateDispatchState($pdo, 'failed', 'dispatcher');
        } catch (Throwable $_) {
            // Preserve the original exception.
        }
        throw $e;
    } finally {
        $release = $pdo->prepare('SELECT RELEASE_LOCK(:lock_name)');
        $release->execute([':lock_name' => NOTIFICATION_EMAIL_LOCK_NAME]);
    }
}

function notificationEmailGetOrgFailureSummary(PDO $pdo, int $orgId): array
{
    $countStmt = $pdo->prepare(
        "SELECT
            SUM(delivery_status = 'retrying') AS retrying_count,
            SUM(delivery_status = 'failed_final') AS failed_count
         FROM notification_email_deliveries
         WHERE org_id = :org_id
           AND delivery_status IN ('retrying', 'failed_final')"
    );
    $countStmt->execute([':org_id' => $orgId]);
    $counts = $countStmt->fetch() ?: [];

    $listStmt = $pdo->prepare(
        "SELECT delivery_id,
                recipient_name,
                recipient_email,
                source_type,
                title,
                delivery_status,
                attempt_count,
                last_attempt_at,
                last_error_category,
                last_error_message
         FROM notification_email_deliveries
         WHERE org_id = :org_id
           AND delivery_status IN ('retrying', 'failed_final')
         ORDER BY COALESCE(last_attempt_at, updated_at) DESC
         LIMIT 10"
    );
    $listStmt->execute([':org_id' => $orgId]);
    $items = $listStmt->fetchAll();
    foreach ($items as &$item) {
        $item['delivery_id'] = (int)$item['delivery_id'];
        $item['attempt_count'] = (int)$item['attempt_count'];
        $item['last_error_message'] = notificationEmailSafeErrorMessage(
            (string)($item['last_error_category'] ?? 'transport')
        );
    }

    return [
        'retrying' => (int)($counts['retrying_count'] ?? 0),
        'failed' => (int)($counts['failed_count'] ?? 0),
        'items' => $items,
    ];
}
