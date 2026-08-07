<?php

require_once __DIR__ . '/auth.php';

function auditRequestContext(): array
{
    return [
        'request_ip' => substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45) ?: null,
        'user_agent' => substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255) ?: null,
    ];
}

function auditUserSnapshot(?array $user): array
{
    if (!$user) {
        return [
            'user_id' => null,
            'name' => null,
            'email' => null,
            'employee_number' => null,
        ];
    }

    return [
        'user_id' => isset($user['user_id']) ? (int)$user['user_id'] : null,
        'name' => trim((string)($user['first_name'] ?? '') . ' ' . (string)($user['last_name'] ?? '')) ?: null,
        'email' => $user['email'] ?? null,
        'employee_number' => $user['employee_number'] ?? null,
    ];
}

/**
 * Append an audit event. When a PDO instance is supplied, the caller controls
 * the transaction so the audit record commits atomically with the action.
 */
function appendAuditLog(
    string $action,
    string $targetType,
    ?string $targetId,
    ?array $actor,
    ?array $target,
    ?array $beforeState = null,
    ?array $afterState = null,
    string $result = 'success',
    ?PDO $pdo = null
): int {
    $pdo = $pdo ?: getPdo();
    $actorSnapshot = auditUserSnapshot($actor);
    $targetSnapshot = auditUserSnapshot($target);
    $context = auditRequestContext();

    $stmt = $pdo->prepare(
        "INSERT INTO audit_logs
            (actor_user_id, actor_name, actor_email, actor_employee_number,
             action, target_type, target_id, target_name, target_email,
             target_employee_number, before_state, after_state, request_ip,
             user_agent, result)
         VALUES
            (:actor_user_id, :actor_name, :actor_email, :actor_employee_number,
             :action, :target_type, :target_id, :target_name, :target_email,
             :target_employee_number, :before_state, :after_state, :request_ip,
             :user_agent, :result)"
    );
    $stmt->execute([
        ':actor_user_id' => $actorSnapshot['user_id'],
        ':actor_name' => $actorSnapshot['name'],
        ':actor_email' => $actorSnapshot['email'],
        ':actor_employee_number' => $actorSnapshot['employee_number'],
        ':action' => $action,
        ':target_type' => $targetType,
        ':target_id' => $targetId,
        ':target_name' => $targetSnapshot['name'],
        ':target_email' => $targetSnapshot['email'],
        ':target_employee_number' => $targetSnapshot['employee_number'],
        ':before_state' => $beforeState === null ? null : json_encode($beforeState, JSON_UNESCAPED_SLASHES),
        ':after_state' => $afterState === null ? null : json_encode($afterState, JSON_UNESCAPED_SLASHES),
        ':request_ip' => $context['request_ip'],
        ':user_agent' => $context['user_agent'],
        ':result' => substr($result, 0, 20),
    ]);
    $GLOBALS['capstone_audit_request_recorded'] = true;
    return (int)$pdo->lastInsertId();
}

function auditSanitizeValue(mixed $value, ?string $key = null, int $depth = 0): mixed
{
    if ($depth > 5) return '[truncated]';
    $normalizedKey = strtolower((string)$key);
    if ($normalizedKey !== '' && preg_match('/password|passphrase|otp|token|secret|session|cookie|authorization|file_url|storage_key|path/', $normalizedKey)) {
        return '[redacted]';
    }
    if (is_array($value)) {
        $clean = [];
        $count = 0;
        foreach ($value as $childKey => $childValue) {
            if (++$count > 100) {
                $clean['_truncated'] = true;
                break;
            }
            $clean[$childKey] = auditSanitizeValue($childValue, (string)$childKey, $depth + 1);
        }
        return $clean;
    }
    if (is_object($value)) return auditSanitizeValue((array)$value, $key, $depth + 1);
    if (is_string($value)) return mb_substr($value, 0, 2000);
    return $value;
}

function auditRequestRoute(): string
{
    $path = parse_url((string)($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH) ?: '';
    return strtolower(str_replace('\\', '/', $path));
}

function auditActionFromRoute(string $route, string $method): string
{
    $path = preg_replace('#^.*?/api/#', '', $route);
    $path = preg_replace('/\.php$/', '', (string)$path);
    $path = preg_replace('/[^a-z0-9]+/', '_', (string)$path);
    return trim(strtolower($method . '_' . $path), '_') ?: strtolower($method . '_api_request');
}

function auditTargetFromBody(array $body, string $route): array
{
    $idKeys = [
        'user_id', 'submission_id', 'print_job_id', 'rental_id', 'event_id',
        'announcement_id', 'item_id', 'membership_id', 'student_number',
        'org_id', 'record_id', 'invitation_id', 'annotation_id', 'request_id'
    ];
    foreach ($idKeys as $key) {
        if (isset($body[$key]) && $body[$key] !== '') {
            return [str_replace('_id', '', $key), (string)$body[$key]];
        }
    }
    $segments = array_values(array_filter(explode('/', trim($route, '/'))));
    return [isset($segments[count($segments) - 2]) ? $segments[count($segments) - 2] : 'api_request', null];
}

function auditTargetSnapshotFromBody(array $body): ?array
{
    $email = trim((string)($body['email'] ?? $body['target_email'] ?? ''));
    $employeeNumber = trim((string)($body['employee_number'] ?? ''));
    $firstName = trim((string)($body['first_name'] ?? $body['name'] ?? ''));
    $lastName = trim((string)($body['last_name'] ?? ''));
    if ($email === '' && $employeeNumber === '' && $firstName === '' && $lastName === '') return null;
    return [
        'first_name' => $firstName !== '' ? $firstName : null,
        'last_name' => $lastName !== '' ? $lastName : null,
        'email' => $email !== '' ? $email : null,
        'employee_number' => $employeeNumber !== '' ? $employeeNumber : null,
    ];
}

function auditActorFromSession(): ?array
{
    $session = getPhpSession();
    if (!$session) return null;
    return [
        'user_id' => $session['user_id'] ?? $_SESSION['user_id'] ?? null,
        'first_name' => $session['first_name'] ?? $session['display_name'] ?? null,
        'last_name' => $session['last_name'] ?? null,
        'email' => $session['email'] ?? null,
        'employee_number' => $session['employee_number'] ?? null,
    ];
}

function auditShouldCaptureRequest(): bool
{
    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? ''));
    if (!in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) return false;
    $route = auditRequestRoute();
    if ($route === '' || !str_contains($route, '/api/')) return false;
    return !str_contains($route, '/api/osa/audit-logs/');
}

function auditFinalizeRequest(?int $status = null, bool $throwOnFailure = false, ?array $responseData = null): void
{
    if (
        !auditShouldCaptureRequest()
        || !empty($GLOBALS['capstone_audit_request_recorded'])
        || !empty($GLOBALS['capstone_audit_finalizing'])
    ) return;
    $GLOBALS['capstone_audit_finalizing'] = true;

    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'POST'));
    $route = auditRequestRoute();
    $body = function_exists('getRequestBody') ? getRequestBody() : $_POST;
    if (!is_array($body)) $body = [];
    [$targetType, $targetId] = auditTargetFromBody($body, $route);
    $httpStatus = $status ?: http_response_code();
    if ($httpStatus < 100) $httpStatus = 200;
    $result = $httpStatus >= 400 ? 'failure' : 'success';

    try {
        appendAuditLog(
            auditActionFromRoute($route, $method),
            $targetType,
            $targetId,
            auditActorFromSession(),
            auditTargetSnapshotFromBody($body),
            null,
            array_filter([
                'route' => $route,
                'method' => $method,
                'http_status' => $httpStatus,
                'request' => auditSanitizeValue($body),
                'response' => $responseData === null ? null : auditSanitizeValue($responseData),
            ], static fn (mixed $value): bool => $value !== null),
            $result
        );
    } catch (Throwable $e) {
        error_log('[audit/request] ' . $e->getMessage());
        if ($throwOnFailure) throw $e;
    } finally {
        $GLOBALS['capstone_audit_finalizing'] = false;
    }
}

function auditRegisterRequestCapture(): void
{
    if (!auditShouldCaptureRequest() || !empty($GLOBALS['capstone_audit_shutdown_registered'])) return;
    $GLOBALS['capstone_audit_shutdown_registered'] = true;
    register_shutdown_function(static function (): void {
        auditFinalizeRequest();
    });
}

function auditProtectedFileAccessOnce(string $targetType, int $targetId, array $details = []): void
{
    if ($targetId <= 0 || !isLoggedIn()) return;
    $userId = (int)(getPhpSession()['user_id'] ?? $_SESSION['user_id'] ?? 0);
    $key = hash('sha256', $targetType . ':' . $targetId . ':' . $userId);
    $now = time();
    $last = (int)($_SESSION['audit_file_access'][$key] ?? 0);
    if ($last > 0 && ($now - $last) < 300) return;

    appendAuditLog(
        'protected_file_accessed',
        $targetType,
        (string)$targetId,
        auditActorFromSession(),
        null,
        null,
        auditSanitizeValue($details),
        'success'
    );
    $_SESSION['audit_file_access'][$key] = $now;
}

auditRegisterRequestCapture();
