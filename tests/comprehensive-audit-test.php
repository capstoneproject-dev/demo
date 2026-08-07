<?php
declare(strict_types=1);

ini_set('session.save_path', sys_get_temp_dir());
require_once __DIR__ . '/../includes/auth.php';

function auditAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$pdo = getPdo();

try {
    $actor = $pdo->query(
        "SELECT user_id, first_name, last_name, email, employee_number
         FROM users
         WHERE account_type = 'osa_staff' AND is_active = 1
         ORDER BY is_primary_osa DESC, user_id ASC
         LIMIT 1"
    )->fetch();
    auditAssert(is_array($actor), 'An active OSA account is required for the audit test.');

    $sanitized = auditSanitizeValue([
        'title' => 'Allowed value',
        'password' => 'never-store-this',
        'nested' => [
            'otp_code' => '123456',
            'invitation_token' => 'private-token',
            'storage_key' => 'documents/private.pdf',
            'session_id' => 'private-session',
        ],
    ]);
    auditAssert($sanitized['title'] === 'Allowed value', 'Safe audit values were removed.');
    auditAssert($sanitized['password'] === '[redacted]', 'Password was not redacted.');
    foreach ($sanitized['nested'] as $value) {
        auditAssert($value === '[redacted]', 'A sensitive nested audit value was not redacted.');
    }

    $_SESSION = [
        'user_id' => (int)$actor['user_id'],
        'naap_session' => [
            'user_id' => (int)$actor['user_id'],
            'display_name' => trim($actor['first_name'] . ' ' . $actor['last_name']),
            'email' => $actor['email'],
            'employee_number' => $actor['employee_number'],
            'account_type' => 'osa_staff',
            'login_role' => 'osa',
        ],
    ];
    $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
    $_SERVER['HTTP_USER_AGENT'] = 'CAPSTONE audit test';

    $targetId = (string)random_int(700000000, 799999999);
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_SERVER['REQUEST_URI'] = '/CAPSTONE/demo/api/printing/status.php';
    $_POST = [
        'print_job_id' => $targetId,
        'status' => 'ready_to_claim',
        'password' => 'must-not-appear',
        'otp' => '654321',
    ];
    unset($GLOBALS['capstone_audit_request_recorded'], $GLOBALS['capstone_audit_finalizing']);

    $pdo->beginTransaction();
    auditFinalizeRequest(200, true);
    $stmt = $pdo->prepare(
        "SELECT audit_id, action, target_type, target_id, result, after_state
         FROM audit_logs WHERE target_id = :target_id ORDER BY audit_id DESC LIMIT 1"
    );
    $stmt->execute([':target_id' => $targetId]);
    $generic = $stmt->fetch();
    auditAssert(is_array($generic), 'A protected API mutation did not produce an audit record.');
    auditAssert($generic['action'] === 'post_printing_status', 'The route was not mapped to a stable audit action.');
    auditAssert($generic['target_type'] === 'print_job', 'The audit target type was not detected.');
    auditAssert($generic['result'] === 'success', 'The successful mutation result was not recorded.');
    auditAssert(!str_contains((string)$generic['after_state'], 'must-not-appear'), 'Password leaked into the audit record.');
    auditAssert(!str_contains((string)$generic['after_state'], '654321'), 'OTP leaked into the audit record.');

    $rangeTarget = random_int(800000000, 899999999);
    auditProtectedFileAccessOnce('document_submission', $rangeTarget, ['disposition' => 'inline']);
    auditProtectedFileAccessOnce('document_submission', $rangeTarget, ['disposition' => 'inline']);
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) FROM audit_logs
         WHERE action = 'protected_file_accessed'
           AND target_type = 'document_submission' AND target_id = :target_id"
    );
    $stmt->execute([':target_id' => (string)$rangeTarget]);
    auditAssert((int)$stmt->fetchColumn() === 1, 'Repeated PDF range requests were not deduplicated.');

    $appendOnlyProtected = false;
    try {
        $pdo->prepare("UPDATE audit_logs SET result = 'changed' WHERE audit_id = :id")
            ->execute([':id' => (int)$generic['audit_id']]);
    } catch (PDOException $e) {
        $appendOnlyProtected = true;
    }
    auditAssert($appendOnlyProtected, 'Audit records can still be updated.');

    $deleteProtected = false;
    try {
        $pdo->prepare("DELETE FROM audit_logs WHERE audit_id = :id")
            ->execute([':id' => (int)$generic['audit_id']]);
    } catch (PDOException $e) {
        $deleteProtected = true;
    }
    auditAssert($deleteProtected, 'Audit records can still be deleted.');

    $pdo->rollBack();
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM audit_logs WHERE target_id IN (:generic_id, :range_id)");
    $stmt->execute([':generic_id' => $targetId, ':range_id' => (string)$rangeTarget]);
    auditAssert((int)$stmt->fetchColumn() === 0, 'Audit test records did not roll back atomically.');

    $html = file_get_contents(__DIR__ . '/../pages/osaDashboard.html');
    auditAssert(str_contains($html, 'id="osa-audit-nav-item" hidden'), 'The audit navigation is not hidden by default.');
    auditAssert(str_contains($html, 'id="audit" class="section-view" hidden'), 'The protected audit section is not hidden by default.');

    echo "Comprehensive protected audit tests passed.\n";
} finally {
    if ($pdo->inTransaction()) $pdo->rollBack();
}
