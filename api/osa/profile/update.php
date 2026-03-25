<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/functions.php';

header('Content-Type: application/json');

apiGuard();
requirePost();

$userId = (int)($_SESSION['user_id'] ?? 0);
if ($userId <= 0) {
    jsonError('Not authenticated.', 401);
}

$body = getRequestBody();
$fullName = trim((string)($body['full_name'] ?? ''));
$email = trim((string)($body['email'] ?? ''));
$phone = trim((string)($body['phone'] ?? ''));

if ($fullName === '' || $email === '') {
    jsonError('Full name and email are required.', 422);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonError('Invalid email address.', 422);
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
        jsonError('An account with that email already exists.', 409);
    }

    $updateStmt = $pdo->prepare('
        UPDATE users
        SET first_name = :first_name,
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
        ':last_name' => $lastName,
        ':email' => $email,
        ':phone' => ($phone !== '' ? $phone : null),
        ':user_id' => $userId,
    ]);

    $user = getUserById($userId);
    if (!$user) {
        jsonError('Updated account could not be reloaded.', 500);
    }

    $newSession = buildSessionPayload($user, [], 'osa');
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
} catch (PDOException $e) {
    error_log('[api/osa/profile/update] ' . $e->getMessage());
    jsonError('Could not update profile right now.', 500);
}
