<?php
require_once __DIR__ . '/otp.php';
require_once __DIR__ . '/audit.php';
require_once __DIR__ . '/password_policy.php';

require_once __DIR__ . '/osa_identity.php';

/** Caller owns the transaction. Lock order is administrator, then registration. */
function lockCurrentOsaAdministrator(PDO $pdo, ?int $actorId = null, ?int $authorityVersion = null): array
{
    $rows = $pdo->query("SELECT * FROM users WHERE account_type = 'osa_staff' AND is_active = 1 ORDER BY user_id FOR UPDATE")->fetchAll();
    if (count($rows) !== 1 || (int)$rows[0]['is_primary_osa'] !== 1) {
        throw new InvalidArgumentException('OSA administrator configuration requires operator attention.');
    }
    if ($actorId !== null && (int)$rows[0]['user_id'] !== $actorId) {
        throw new InvalidArgumentException('Administrator authority changed. Sign in again.');
    }
    if ($authorityVersion !== null && (int)$rows[0]['osa_authority_version'] !== $authorityVersion) {
        throw new InvalidArgumentException('Administrator authority changed. Sign in again.');
    }
    return $rows[0];
}

function assertOsaRegistrationIdentityAvailable(PDO $pdo, string $email, string $employee, ?int $requestId = null): void
{
    $stmt = $pdo->prepare('SELECT user_id FROM users WHERE LOWER(email) = :email OR employee_number = :employee LIMIT 1 FOR UPDATE');
    $stmt->execute([':email' => normalizeOtpEmail($email), ':employee' => $employee]);
    if ($stmt->fetchColumn()) throw new InvalidArgumentException('An account with that email or employee ID already exists.');
    $stmt = $pdo->prepare("SELECT reg_id FROM pending_registrations
        WHERE status = 'pending' AND (LOWER(email) = :email OR employee_number = :employee)
          AND reg_id <> :request_id LIMIT 1 FOR UPDATE");
    $stmt->execute([':email' => normalizeOtpEmail($email), ':employee' => $employee, ':request_id' => $requestId ?? 0]);
    if ($stmt->fetchColumn()) throw new InvalidArgumentException('A pending registration with that email or employee ID already exists.');
}

function submitOsaRegistration(PDO $pdo, array $body): int
{
    foreach (['employee_number', 'email', 'first_name', 'last_name', 'phone', 'password', 'confirm_password', 'verification_token'] as $field) {
        if (isset($body[$field]) && !is_string($body[$field])) throw new InvalidArgumentException('Registration fields must contain text.');
    }
    $employee = normalizeOsaEmployeeNumber((string)($body['employee_number'] ?? ''));
    $email = normalizeOtpEmail((string)($body['email'] ?? ''));
    $first = trim((string)($body['first_name'] ?? ''));
    $last = trim((string)($body['last_name'] ?? ''));
    $phone = trim((string)($body['phone'] ?? ''));
    $password = (string)($body['password'] ?? '');
    if (!isValidOsaEmployeeNumber($employee)) throw new InvalidArgumentException('Employee ID must use the format 12-123-ABCD.');
    if ($first === '' || $last === '') throw new InvalidArgumentException('A full name is required.');
    [$first, $last] = splitOsaRegistrationName($first . ' ' . $last);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 255) throw new InvalidArgumentException('A valid email address is required.');
    if (!preg_match('/^\+63\s\d{10}$/D', $phone)) throw new InvalidArgumentException('Phone number must be +63 followed by a space and 10 digits.');
    if (!passwordMeetsPolicy($password)) throw new InvalidArgumentException(PASSWORD_POLICY_MESSAGE);
    if ($password !== (string)($body['confirm_password'] ?? '')) throw new InvalidArgumentException('Passwords do not match.');
    if (!filter_var($body['privacy_consent'] ?? false, FILTER_VALIDATE_BOOLEAN)) throw new InvalidArgumentException('Privacy consent is required.');
    $hash = password_hash($password, PASSWORD_BCRYPT);
    $pdo->beginTransaction();
    try {
        lockCurrentOsaAdministrator($pdo);
        assertOsaRegistrationIdentityAvailable($pdo, $email, $employee);
        consumeOtpVerification($pdo, (string)($body['verification_token'] ?? ''), 'osa_registration', $email, $employee);
        $pdo->prepare("INSERT INTO pending_registrations
            (employee_number, student_name, email, phone, password_hash, requested_role, status)
            VALUES (:employee, :name, :email, :phone, :password, 'osa_staff', 'pending')")
            ->execute([':employee' => $employee, ':name' => $first . ' ' . $last, ':email' => $email, ':phone' => $phone, ':password' => $hash]);
        $id = (int)$pdo->lastInsertId();
        $pdo->commit();
        return $id;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function reviewOsaRegistration(PDO $pdo, int $actorId, int $requestId, string $action, ?int $authorityVersion = null): array
{
    if (!in_array($action, ['approve', 'reject', 'reopen'], true)) throw new InvalidArgumentException('Invalid review action.');
    $pdo->beginTransaction();
    try {
        $current = lockCurrentOsaAdministrator($pdo, $actorId, $authorityVersion);
        $stmt = $pdo->prepare('SELECT * FROM pending_registrations WHERE reg_id = ? FOR UPDATE');
        $stmt->execute([$requestId]);
        $request = $stmt->fetch();
        if (!$request || $request['requested_role'] !== 'osa_staff') throw new InvalidArgumentException('OSA registration request not found.');
        $expected = $action === 'reopen' ? 'rejected' : 'pending';
        if ($request['status'] !== $expected) throw new InvalidArgumentException('This request has already been reviewed or its status changed.');
        $target = null;
        if ($action !== 'reject') assertOsaRegistrationIdentityAvailable($pdo, $request['email'], $request['employee_number'], $requestId);
        if ($action === 'approve') {
            $employee = normalizeOsaEmployeeNumber($request['employee_number']);
            if (!isValidOsaEmployeeNumber($employee) || !filter_var($request['email'], FILTER_VALIDATE_EMAIL)
                || empty(password_get_info($request['password_hash'])['algo'])) {
                throw new InvalidArgumentException('The pending registration has invalid account details.');
            }
            [$first, $last] = splitOsaRegistrationName($request['student_name']);
            $pdo->prepare('UPDATE users SET is_active = 0, is_primary_osa = 0, osa_authority_version = osa_authority_version + 1 WHERE user_id = ?')->execute([$actorId]);
            $pdo->prepare("INSERT INTO users (employee_number, email, password_hash, first_name, last_name, phone, account_type, is_active, is_primary_osa)
                VALUES (?, ?, ?, ?, ?, ?, 'osa_staff', 1, 1)")
                ->execute([$employee, $request['email'], $request['password_hash'], $first, $last, $request['phone']]);
            $target = ['user_id' => (int)$pdo->lastInsertId(), 'first_name' => $first, 'last_name' => $last, 'email' => $request['email'], 'employee_number' => $employee];
        }
        $status = ['approve' => 'approved', 'reject' => 'rejected', 'reopen' => 'pending'][$action];
        $pdo->prepare("UPDATE pending_registrations SET status = ?, reviewed_by_user_id = ?, reviewed_at = CASE WHEN ? = 'pending' THEN NULL ELSE CURRENT_TIMESTAMP END WHERE reg_id = ?")
            ->execute([$status, $action === 'reopen' ? null : $actorId, $status, $requestId]);
        appendAuditLog($action === 'approve' ? 'osa_administrator_transferred' : 'osa_registration_' . $status,
            'osa_registration', (string)$requestId, $current, $target,
            ['status' => $request['status'], 'administrator_user_id' => $actorId],
            ['status' => $status, 'administrator_user_id' => $target['user_id'] ?? $actorId], 'success', $pdo);
        $pdo->commit();
        return ['transfer_completed' => $action === 'approve', 'msg' => $action === 'approve' ? 'Administrator access transferred. Sign in with the new administrator account.' : 'OSA registration ' . $status . '.'];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}
