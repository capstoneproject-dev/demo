<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/functions.php';
require_once __DIR__ . '/../../../includes/osa_registration.php';

header('Content-Type: application/json');

apiGuard(true); // This request writes session data after authentication.
$actorSession = apiRequirePrimaryOsaAdministrator();
requirePost();

$userId = (int)($_SESSION['user_id'] ?? 0);
if ($userId <= 0) {
    jsonError('Not authenticated.', 401);
}

$body = getRequestBody();
foreach (['full_name', 'email', 'phone', 'employee_number', 'email_verification_token'] as $field) {
    if (isset($body[$field]) && !is_string($body[$field])) jsonError('Profile fields must contain text.', 422);
}
$fullName = trim((string)($body['full_name'] ?? ''));
$email = trim((string)($body['email'] ?? ''));
$phone = trim((string)($body['phone'] ?? ''));

if ($fullName === '' || $email === '') {
    jsonError('Full name and email are required.', 422);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonError('Invalid email address.', 422);
}

$currentUser = getUserById($userId);
if (!$currentUser) jsonError('User not found.', 404);
$employeeNumber = normalizeOsaEmployeeNumber((string)($body['employee_number'] ?? $currentUser['employee_number'] ?? ''));
if (!isValidOsaEmployeeNumber(normalizeOsaEmployeeNumber((string)$currentUser['employee_number']))
    && $employeeNumber === normalizeOsaEmployeeNumber((string)$currentUser['employee_number'])) {
    $employeeNumber = (string)$currentUser['employee_number']; // Preserve an unchanged legacy ID when saving other profile fields.
}
$employeeChanged = $employeeNumber !== (string)($currentUser['employee_number'] ?? '');
if ($employeeChanged && !isValidOsaEmployeeNumber($employeeNumber)) {
    jsonError('Employee ID must contain two digits, a hyphen, three digits, a hyphen, and four characters (e.g. 12-123-ABCD).', 422);
}
$emailChanged = strcasecmp($email, (string)($currentUser['email'] ?? '')) !== 0;
if ($emailChanged || $employeeChanged) {
    apiRequireRecentReauthentication();
}

if ($phone !== '' && !preg_match('/^\+63\s\d{10}$/', $phone)) {
    jsonError('Phone number must be +63 followed by a space and 10 digits.', 422);
}

function splitOsaProfileName(string $fullName): array
{
    $clean = preg_replace('/\s+/', ' ', trim($fullName));
    if ($clean === '') {
        return ['', ''];
    }
    $parts = explode(' ', $clean);
    if (count($parts) === 1) {
        return [$parts[0], '-'];
    }
    $lastName = array_pop($parts);
    return [implode(' ', $parts), $lastName];
}

[$firstName, $lastName] = splitOsaProfileName($fullName);
$pdo = getPdo();

try {
    $pdo->beginTransaction();
    $lockedUser = lockCurrentOsaAdministrator($pdo, $userId, (int)($actorSession['osa_authority_version'] ?? 0));
    if ($lockedUser['employee_number'] !== $currentUser['employee_number'] || $lockedUser['email'] !== $currentUser['email']) {
        throw new InvalidArgumentException('Your profile changed. Refresh the page before saving again.', 409);
    }
    if ($employeeChanged) {
        $pending = $pdo->prepare("SELECT reg_id FROM pending_registrations WHERE status='pending' AND employee_number=? LIMIT 1 FOR UPDATE");
        $pending->execute([$employeeNumber]);
        if ($pending->fetchColumn()) throw new InvalidArgumentException('That employee ID is reserved by a pending registration.', 409);
    }
    $employeeDupStmt = $pdo->prepare('
        SELECT user_id FROM users
        WHERE employee_number = :employee_number AND user_id <> :user_id
        LIMIT 1
    ');
    $employeeDupStmt->execute([
        ':employee_number' => $employeeNumber,
        ':user_id' => $userId,
    ]);
    if ($employeeDupStmt->fetch()) {
        throw new InvalidArgumentException('An account with that employee ID already exists.', 409);
    }

    $dupStmt = $pdo->prepare('
        SELECT user_id
        FROM users
        WHERE email = :email
          AND user_id <> :user_id
        LIMIT 1
    ');
    $dupStmt->execute([
        ':email' => $email,
        ':user_id' => $userId,
    ]);
    if ($dupStmt->fetch()) {
        throw new InvalidArgumentException('An account with that email already exists.', 409);
    }

    if ($emailChanged) {
        consumeOtpVerification($pdo, (string)($body['email_verification_token'] ?? ''),
            'profile_email_change', $email, (string)$userId);
    }

    $updateStmt = $pdo->prepare('
        UPDATE users
        SET first_name = :first_name,
            employee_number = :employee_number,
            last_name = :last_name,
            email = :email,
            phone = :phone,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = :user_id
          AND is_active = 1
        LIMIT 1
    ');
    $updateStmt->execute([
        ':first_name' => $firstName,
        ':employee_number' => $employeeNumber,
        ':last_name' => $lastName,
        ':email' => $email,
        ':phone' => ($phone !== '' ? $phone : null),
        ':user_id' => $userId,
    ]);

    $pdo->commit();
    $user = getUserById($userId);
    if (!$user) {
        jsonError('Updated account could not be reloaded.', 500);
    }

    $newSession = buildSessionPayload($user, [], 'osa');
    $newSession['osa_authority_version'] = (int)$lockedUser['osa_authority_version'];
    startUserSession($newSession);

    jsonOk([
        'session' => $newSession,
        'user' => [
            'user_id' => (int)$user['user_id'],
            'full_name' => trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? '')),
            'email' => $user['email'] ?? '',
            'phone' => $user['phone'] ?? '',
            'employee_number' => $user['employee_number'] ?? null,
            'profile_photo' => $user['profile_photo'] ?? null,
        ],
    ]);
} catch (InvalidArgumentException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    jsonError($e->getMessage(), $e->getCode() === 409 ? 409 : 422);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('[api/osa/profile/update] ' . $e->getMessage());
    if ((int)($e->errorInfo[1] ?? 0) === 1062) jsonError('An account with that employee ID or email already exists.', 409);
    jsonError('Could not update profile right now.', 500);
}
