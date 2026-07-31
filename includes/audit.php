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
    return (int)$pdo->lastInsertId();
}
