<?php

/**
 * Database-backed, fixed-window API rate limiting.
 *
 * Bucket subjects are hashed before storage. Callers may use an IP address,
 * user id, organization id, or another server-validated identifier without
 * placing that raw value in the rate-limit table.
 */

const CAPSTONE_RATE_LIMIT_ERROR_CODE = 'RATE_LIMITED';

function rateLimitRoute(): string
{
    $path = parse_url((string)($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH) ?: '';
    return strtolower(str_replace('\\', '/', $path));
}

function rateLimitClientIp(): string
{
    $direct = trim((string)($_SERVER['REMOTE_ADDR'] ?? ''));
    $trusted = array_values(array_filter(array_map(
        'trim',
        explode(',', (string)(getenv('CAPSTONE_TRUSTED_PROXIES') ?: ''))
    )));

    if ($direct !== '' && in_array($direct, $trusted, true)) {
        $forwarded = trim((string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''));
        if ($forwarded !== '') {
            $candidate = trim(explode(',', $forwarded)[0]);
            if (filter_var($candidate, FILTER_VALIDATE_IP)) return $candidate;
        }
        $realIp = trim((string)($_SERVER['HTTP_X_REAL_IP'] ?? ''));
        if (filter_var($realIp, FILTER_VALIDATE_IP)) return $realIp;
    }

    return filter_var($direct, FILTER_VALIDATE_IP) ? $direct : 'unknown';
}

function rateLimitWindow(string $policy, string $subject, int $windowSeconds): array
{
    $windowSeconds = max(1, $windowSeconds);
    $now = time();
    $startedAt = intdiv($now, $windowSeconds) * $windowSeconds;
    return [
        'hash' => hash('sha256', $policy . "\0" . $subject . "\0" . $startedAt),
        'started_at' => $startedAt,
        'expires_at' => $startedAt + ($windowSeconds * 2),
        'retry_after' => max(1, ($startedAt + $windowSeconds) - $now),
    ];
}

function rateLimitCleanupMaybe(PDO $pdo): void
{
    if (random_int(1, 100) !== 1) return;
    $pdo->exec("DELETE FROM api_rate_limit_buckets WHERE expires_at < CURRENT_TIMESTAMP LIMIT 500");
}

function rateLimitStorageFailure(Throwable $e): never
{
    error_log('[rate-limit/storage] ' . $e->getMessage());
    jsonError('Request protection is temporarily unavailable. Please try again later.', 503, [
        'error_code' => 'RATE_LIMIT_UNAVAILABLE',
    ]);
}

function rateLimitStatus(string $policy, string $subject, int $limit, int $windowSeconds): array
{
    $bucket = rateLimitWindow($policy, $subject, $windowSeconds);
    try {
        $stmt = getPdo()->prepare(
            "SELECT request_count, block_audited
             FROM api_rate_limit_buckets
             WHERE bucket_hash = :bucket_hash
             LIMIT 1"
        );
        $stmt->execute([':bucket_hash' => $bucket['hash']]);
        $row = $stmt->fetch() ?: [];
        $count = (int)($row['request_count'] ?? 0);
        return $bucket + [
            'policy' => $policy,
            'limit' => $limit,
            'count' => $count,
            'limited' => $count >= $limit,
            'block_audited' => (int)($row['block_audited'] ?? 0) === 1,
        ];
    } catch (Throwable $e) {
        rateLimitStorageFailure($e);
    }
}

function rateLimitConsume(string $policy, string $subject, int $limit, int $windowSeconds): array
{
    $bucket = rateLimitWindow($policy, $subject, $windowSeconds);
    try {
        $pdo = getPdo();
        $stmt = $pdo->prepare(
            "INSERT INTO api_rate_limit_buckets
                (bucket_hash, policy_key, window_started_at, window_seconds,
                 request_count, expires_at, block_audited)
             VALUES
                (:bucket_hash, :policy_key, :window_started_at, :window_seconds,
                 1, :expires_at, 0)
             ON DUPLICATE KEY UPDATE
                request_count = request_count + 1,
                updated_at = CURRENT_TIMESTAMP"
        );
        $stmt->execute([
            ':bucket_hash' => $bucket['hash'],
            ':policy_key' => substr($policy, 0, 64),
            ':window_started_at' => date('Y-m-d H:i:s', $bucket['started_at']),
            ':window_seconds' => $windowSeconds,
            ':expires_at' => date('Y-m-d H:i:s', $bucket['expires_at']),
        ]);

        $read = $pdo->prepare(
            "SELECT request_count, block_audited
             FROM api_rate_limit_buckets
             WHERE bucket_hash = :bucket_hash
             LIMIT 1"
        );
        $read->execute([':bucket_hash' => $bucket['hash']]);
        $row = $read->fetch() ?: [];
        rateLimitCleanupMaybe($pdo);
        $count = (int)($row['request_count'] ?? 1);
        return $bucket + [
            'policy' => $policy,
            'limit' => $limit,
            'count' => $count,
            'limited' => $count > $limit,
            'block_audited' => (int)($row['block_audited'] ?? 0) === 1,
        ];
    } catch (Throwable $e) {
        rateLimitStorageFailure($e);
    }
}

function rateLimitClear(string $policy, string $subject, int $windowSeconds): void
{
    $bucket = rateLimitWindow($policy, $subject, $windowSeconds);
    try {
        $stmt = getPdo()->prepare("DELETE FROM api_rate_limit_buckets WHERE bucket_hash = :bucket_hash");
        $stmt->execute([':bucket_hash' => $bucket['hash']]);
    } catch (Throwable $e) {
        rateLimitStorageFailure($e);
    }
}

function rateLimitAuditBlockOnce(array $state): void
{
    try {
        $pdo = getPdo();
        $mark = $pdo->prepare(
            "UPDATE api_rate_limit_buckets
             SET block_audited = 1
             WHERE bucket_hash = :bucket_hash AND block_audited = 0"
        );
        $mark->execute([':bucket_hash' => $state['hash']]);

        if ($mark->rowCount() === 1 && function_exists('appendAuditLog')) {
            appendAuditLog(
                'rate_limit_blocked',
                'rate_limit',
                (string)$state['policy'],
                function_exists('auditActorFromSession') ? auditActorFromSession() : null,
                null,
                null,
                [
                    'policy' => (string)$state['policy'],
                    'route' => rateLimitRoute(),
                    'retry_after' => (int)$state['retry_after'],
                    'client_ip' => rateLimitClientIp(),
                ],
                'failure'
            );
        }

        // Prevent the request-wide audit fallback from creating one entry for
        // every rejected request in the same bucket window.
        $GLOBALS['capstone_audit_request_recorded'] = true;
    } catch (Throwable $e) {
        error_log('[rate-limit/audit] ' . $e->getMessage());
        $GLOBALS['capstone_audit_request_recorded'] = true;
    }
}

function rateLimitDeny(array $state): never
{
    rateLimitAuditBlockOnce($state);
    $retryAfter = max(1, (int)$state['retry_after']);
    header('Retry-After: ' . $retryAfter);
    header('Cache-Control: no-store');
    jsonError('Too many requests. Please wait before trying again.', 429, [
        'error_code' => CAPSTONE_RATE_LIMIT_ERROR_CODE,
        'retry_after' => $retryAfter,
    ]);
}

function rateLimitEnsureAllowed(string $policy, string $subject, int $limit, int $windowSeconds): void
{
    $state = rateLimitConsume($policy, $subject, $limit, $windowSeconds);
    if ($state['limited']) rateLimitDeny($state);
}

function rateLimitEnsureNotBlocked(string $policy, string $subject, int $limit, int $windowSeconds): void
{
    $state = rateLimitStatus($policy, $subject, $limit, $windowSeconds);
    if ($state['limited']) rateLimitDeny($state);
}

function rateLimitRecordFailure(string $policy, string $subject, int $limit, int $windowSeconds): void
{
    $state = rateLimitConsume($policy, $subject, $limit, $windowSeconds);
    if ($state['limited']) rateLimitDeny($state);
}

function rateLimitRequestHasFileAttempt(): bool
{
    foreach ($_FILES as $file) {
        if (!is_array($file) || !array_key_exists('error', $file)) continue;
        $errors = is_array($file['error']) ? $file['error'] : [$file['error']];
        foreach ($errors as $error) {
            if ((int)$error !== UPLOAD_ERR_NO_FILE) return true;
        }
    }
    return false;
}

/** Apply broad and route-specific policies to authenticated unsafe requests. */
function rateLimitApplyAuthenticatedApiPolicies(): void
{
    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? ''));
    if (!in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true) || !isLoggedIn()) return;

    $route = rateLimitRoute();
    if ($route === '' || !str_contains($route, '/api/')) return;
    if (str_ends_with($route, '/api/auth/activity.php')) return;

    $session = getPhpSession();
    $userId = (int)($session['user_id'] ?? $_SESSION['user_id'] ?? 0);
    if ($userId <= 0) return;
    $userSubject = 'user:' . $userId;

    // Check-in, checkout, and attendance time corrections can arrive in large
    // bursts at institutional events. Their existing authorization, CSRF, and
    // duplicate-attendance protections remain active, but they are exempt from
    // request-rate counters so legitimate student queues cannot be interrupted.
    if (str_contains($route, '/api/qr-attendance/attendance/')) return;

    rateLimitEnsureAllowed('authenticated_mutation', $userSubject, 120, 300);

    if (str_ends_with($route, '/api/documents/upload.php')) {
        rateLimitEnsureAllowed('document_upload', $userSubject, 10, 3600);
    } elseif (str_ends_with($route, '/api/documents/submit.php')) {
        rateLimitEnsureAllowed('document_submission', $userSubject, 20, 3600);
    } elseif (str_ends_with($route, '/api/printing/student/submit.php')) {
        rateLimitEnsureAllowed('printing_submission', $userSubject, 10, 3600);
    }

    $imageUploadRoute = str_ends_with($route, '/profile/upload-photo.php')
        || (
            (
                str_ends_with($route, '/organizations/public-profile-save.php')
                || str_ends_with($route, '/igp/inventory/save.php')
            )
            && rateLimitRequestHasFileAttempt()
        );
    if ($imageUploadRoute) {
        rateLimitEnsureAllowed('image_upload', $userSubject, 20, 3600);
    }

    if (str_ends_with($route, '/api/analytics/generate-insights.php')) {
        $orgId = (int)($session['active_org_id'] ?? 0);
        rateLimitEnsureAllowed('analytics_generation', $userSubject . ':org:' . $orgId, 5, 600);
    }

    if (
        str_ends_with($route, '/api/osa/staff/invite.php')
        || str_ends_with($route, '/api/osa/staff/invitations/resend.php')
    ) {
        rateLimitEnsureAllowed('osa_invitation_delivery', $userSubject, 10, 3600);
    }
}
