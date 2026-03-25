<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/functions.php';

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

$file = $_FILES['profile_photo'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    jsonError('Could not upload the selected image.', 422);
}

$tmpPath = (string)($file['tmp_name'] ?? '');
if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
    jsonError('Invalid upload.', 422);
}

$maxBytes = 5 * 1024 * 1024;
if ((int)($file['size'] ?? 0) > $maxBytes) {
    jsonError('Image must be 5MB or smaller.', 422);
}

$imageInfo = @getimagesize($tmpPath);
if (!$imageInfo || empty($imageInfo['mime'])) {
    jsonError('Uploaded file is not a valid image.', 422);
}

$allowed = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
];
$mime = (string)$imageInfo['mime'];
if (!isset($allowed[$mime])) {
    jsonError('Only JPG, PNG, and WEBP images are allowed.', 422);
}

$uploadDir = realpath(__DIR__ . '/../../../uploads');
if ($uploadDir === false) {
    jsonError('Uploads directory is missing.', 500);
}

$profileDir = $uploadDir . DIRECTORY_SEPARATOR . 'profile-photos';
if (!is_dir($profileDir) && !mkdir($profileDir, 0775, true) && !is_dir($profileDir)) {
    jsonError('Could not create profile photo directory.', 500);
}

$filename = sprintf(
    'user_%d_%s.%s',
    $userId,
    bin2hex(random_bytes(8)),
    $allowed[$mime]
);
$targetPath = $profileDir . DIRECTORY_SEPARATOR . $filename;
if (!move_uploaded_file($tmpPath, $targetPath)) {
    jsonError('Failed to store uploaded image.', 500);
}

$photoUrl = '/CAPSTONE/demo/uploads/profile-photos/' . $filename;
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

    if ($oldPhoto !== '' && str_starts_with($oldPhoto, '/CAPSTONE/demo/uploads/profile-photos/')) {
        $oldFile = realpath(__DIR__ . '/../../../' . ltrim(str_replace('/CAPSTONE/demo/', '', $oldPhoto), '/'));
        if ($oldFile && is_file($oldFile) && $oldFile !== $targetPath) {
            @unlink($oldFile);
        }
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
