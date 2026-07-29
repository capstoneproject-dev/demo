<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/functions.php';
require_once __DIR__ . '/../../../includes/upload_security.php';

header('Content-Type: application/json');

apiGuard();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed.', 405);
}

$userId = (int)($_SESSION['user_id'] ?? 0);
if ($userId <= 0) {
    jsonError('Not authenticated.', 401);
}

if (empty($_FILES['profile_photo']) || !is_array($_FILES['profile_photo'])) {
    jsonError('No file uploaded.', 422);
}

$allowed = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
];
try {
    $relativePath = uploadStoreImageFile(
        $_FILES['profile_photo'],
        'profile-photos',
        'user_' . $userId,
        $allowed,
        5 * 1024 * 1024,
        8000
    );
} catch (UploadValidationException $e) {
    jsonError($e->getMessage(), 422);
}

$filename = basename($relativePath);
$targetPath = uploadProjectRoot() . DIRECTORY_SEPARATOR
    . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
$photoUrl = uploadPublicUrl($relativePath);
$pdo = getPdo();

try {
    $oldStmt = $pdo->prepare('SELECT profile_photo FROM users WHERE user_id = :user_id LIMIT 1');
    $oldStmt->execute([':user_id' => $userId]);
    $oldPhoto = (string)($oldStmt->fetchColumn() ?: '');

    $updateStmt = $pdo->prepare('
        UPDATE users
        SET profile_photo = :profile_photo,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = :user_id
        LIMIT 1
    ');
    $updateStmt->execute([
        ':profile_photo' => $photoUrl,
        ':user_id' => $userId,
    ]);

    $session = getPhpSession();
    $session['profile_photo'] = $photoUrl;
    startUserSession($session);

    $oldFile = uploadResolvePublicFile($oldPhoto, 'profile-photos');
    if ($oldFile && $oldFile !== $targetPath) {
        @unlink($oldFile);
    }

    jsonOk([
        'photo_url' => $photoUrl,
        'session' => $session,
    ]);
} catch (PDOException $e) {
    if (is_file($targetPath)) {
        @unlink($targetPath);
    }
    error_log('[api/student/profile/upload-photo] ' . $e->getMessage());
    if (stripos($e->getMessage(), 'profile_photo') !== false) {
        jsonError('Database column users.profile_photo is missing. Run the ALTER TABLE migration first.', 500);
    }
    jsonError('Could not save profile photo.', 500);
}
