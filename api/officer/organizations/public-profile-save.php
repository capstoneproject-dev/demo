<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/organization_public_profile_columns.php';

header('Content-Type: application/json');
apiGuard();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed.', 405);
}

$session = getPhpSession();
$userId = (int)($session['user_id'] ?? 0);
$orgId = (int)($session['active_org_id'] ?? 0);

if (($session['login_role'] ?? '') !== 'org' || $userId <= 0 || $orgId <= 0) {
    jsonError('Only organization officers can update this profile.', 403);
}

function orgProfileClean(?string $value, int $max = 500): ?string
{
    $clean = trim((string)$value);
    if ($clean === '') {
        return null;
    }
    return substr($clean, 0, $max);
}

function orgProfileStoreSingleImage(string $field, int $orgId): ?string
{
    if (empty($_FILES[$field]) || !is_array($_FILES[$field])) {
        return null;
    }

    $file = $_FILES[$field];
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        jsonError('Could not upload one of the selected images.', 422);
    }

    $tmpPath = (string)($file['tmp_name'] ?? '');
    if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
        jsonError('Invalid image upload.', 422);
    }

    $maxBytes = 5 * 1024 * 1024;
    if ((int)($file['size'] ?? 0) > $maxBytes) {
        jsonError('Images must be 5MB or smaller.', 422);
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

    $uploadRoot = realpath(__DIR__ . '/../../../uploads');
    if ($uploadRoot === false) {
        jsonError('Uploads directory is missing.', 500);
    }

    $orgDir = $uploadRoot . DIRECTORY_SEPARATOR . 'org-public' . DIRECTORY_SEPARATOR . $orgId;
    if (!is_dir($orgDir) && !mkdir($orgDir, 0775, true) && !is_dir($orgDir)) {
        jsonError('Could not create organization upload directory.', 500);
    }

    $prefix = $field === 'logoFile' ? 'logo' : 'banner';
    $filename = sprintf('%s_%d_%s.%s', $prefix, $orgId, bin2hex(random_bytes(8)), $allowed[$mime]);
    $targetPath = $orgDir . DIRECTORY_SEPARATOR . $filename;
    if (!move_uploaded_file($tmpPath, $targetPath)) {
        jsonError('Failed to store uploaded image.', 500);
    }

    return '/CAPSTONE/demo/uploads/org-public/' . $orgId . '/' . $filename;
}

function orgProfileStoreImageFile(array $file, string $prefix, int $orgId): ?string
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        jsonError('Could not upload one of the selected images.', 422);
    }

    $tmpPath = (string)($file['tmp_name'] ?? '');
    if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
        jsonError('Invalid image upload.', 422);
    }

    $maxBytes = 5 * 1024 * 1024;
    if ((int)($file['size'] ?? 0) > $maxBytes) {
        jsonError('Images must be 5MB or smaller.', 422);
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

    $uploadRoot = realpath(__DIR__ . '/../../../uploads');
    if ($uploadRoot === false) {
        jsonError('Uploads directory is missing.', 500);
    }

    $orgDir = $uploadRoot . DIRECTORY_SEPARATOR . 'org-public' . DIRECTORY_SEPARATOR . $orgId;
    if (!is_dir($orgDir) && !mkdir($orgDir, 0775, true) && !is_dir($orgDir)) {
        jsonError('Could not create organization upload directory.', 500);
    }

    $filename = sprintf('%s_%d_%s.%s', $prefix, $orgId, bin2hex(random_bytes(8)), $allowed[$mime]);
    $targetPath = $orgDir . DIRECTORY_SEPARATOR . $filename;
    if (!move_uploaded_file($tmpPath, $targetPath)) {
        jsonError('Failed to store uploaded image.', 500);
    }

    return '/CAPSTONE/demo/uploads/org-public/' . $orgId . '/' . $filename;
}

function orgProfileStoreMultipleImages(string $field, int $orgId): array
{
    if (empty($_FILES[$field]) || !is_array($_FILES[$field])) {
        return [];
    }

    $files = $_FILES[$field];
    $names = is_array($files['name'] ?? null) ? $files['name'] : [];
    $urls = [];

    foreach ($names as $index => $_name) {
        $file = [
            'name' => $files['name'][$index] ?? '',
            'type' => $files['type'][$index] ?? '',
            'tmp_name' => $files['tmp_name'][$index] ?? '',
            'error' => $files['error'][$index] ?? UPLOAD_ERR_NO_FILE,
            'size' => $files['size'][$index] ?? 0,
        ];
        $url = orgProfileStoreImageFile($file, 'banner', $orgId);
        if ($url) {
            $urls[] = $url;
        }
    }

    return $urls;
}

function orgProfileDecodeGallery(?string $json, ?string $fallbackBanner): array
{
    $gallery = [];
    if ($json) {
        $decoded = json_decode($json, true);
        if (is_array($decoded)) {
            $gallery = array_values(array_filter($decoded, 'is_string'));
        }
    }
    if (!$gallery && $fallbackBanner) {
        $gallery[] = $fallbackBanner;
    }
    return $gallery;
}

function orgProfileCleanFeaturedImages($value): array
{
    $items = is_array($value) ? $value : [];
    $clean = [];
    foreach ($items as $item) {
        $url = trim((string)$item);
        if ($url !== '') {
            $clean[] = substr($url, 0, 700);
        }
    }
    return array_slice(array_values(array_unique($clean)), 0, 20);
}

try {
    $pdo = getPdo();
    orgPublicProfilesEnsureOrganizationColumns($pdo);

    $existingStmt = $pdo->prepare(
        "SELECT banner_url, banner_gallery_json, logo_url
         FROM organizations
         WHERE org_id = :org_id
         LIMIT 1"
    );
    $existingStmt->execute([':org_id' => $orgId]);
    $existing = $existingStmt->fetch() ?: [];

    $existingGallery = orgProfileDecodeGallery($existing['banner_gallery_json'] ?? null, $existing['banner_url'] ?? null);
    $selectedFeatured = orgProfileCleanFeaturedImages($_POST['featuredImages'] ?? []);
    $removedFeatured = orgProfileCleanFeaturedImages($_POST['removeFeaturedImages'] ?? []);
    $newGalleryImages = orgProfileStoreMultipleImages('bannerFiles', $orgId);
    $baseFeatured = array_key_exists('featuredImagesTouched', $_POST) ? $selectedFeatured : $existingGallery;
    if ($removedFeatured) {
        $removeSet = array_flip($removedFeatured);
        $baseFeatured = array_values(array_filter($baseFeatured, static fn($url) => !isset($removeSet[$url])));
    }
    $bannerGallery = array_slice(array_values(array_unique(array_merge($baseFeatured, $newGalleryImages))), 0, 20);
    $bannerUrl = $bannerGallery[0] ?? ($existing['banner_url'] ?? null);
    $logoUrl = orgProfileStoreSingleImage('logoFile', $orgId) ?: ($existing['logo_url'] ?? null);

    $updateStmt = $pdo->prepare(
        "UPDATE organizations
         SET logo_url = :logo_url,
             banner_url = :banner_url,
             banner_gallery_json = :banner_gallery_json,
             public_motto = :public_motto,
             public_about = :public_about,
             contact_office = :contact_office,
             contact_hours = :contact_hours,
             contact_email = :contact_email,
             contact_phone = :contact_phone,
             contact_facebook = :contact_facebook,
             contact_instagram = :contact_instagram,
             contact_x_url = :contact_x_url,
             contact_tiktok = :contact_tiktok,
             contact_summary = :contact_summary,
             updated_at = CURRENT_TIMESTAMP
         WHERE org_id = :org_id
         LIMIT 1"
    );
    $updateStmt->execute([
        ':logo_url' => $logoUrl,
        ':banner_url' => $bannerUrl,
        ':banner_gallery_json' => $bannerGallery ? json_encode($bannerGallery) : null,
        ':public_motto' => orgProfileClean($_POST['motto'] ?? null, 255),
        ':public_about' => orgProfileClean($_POST['about'] ?? null, 5000),
        ':contact_office' => orgProfileClean($_POST['office'] ?? null, 255),
        ':contact_hours' => orgProfileClean($_POST['hours'] ?? null, 255),
        ':contact_email' => orgProfileClean($_POST['email'] ?? null, 255),
        ':contact_phone' => orgProfileClean($_POST['phone'] ?? null, 100),
        ':contact_facebook' => orgProfileClean($_POST['facebook'] ?? null, 500),
        ':contact_instagram' => orgProfileClean($_POST['instagram'] ?? null, 500),
        ':contact_x_url' => orgProfileClean($_POST['x'] ?? null, 500),
        ':contact_tiktok' => orgProfileClean($_POST['tiktok'] ?? null, 500),
        ':contact_summary' => orgProfileClean($_POST['summary'] ?? null, 5000),
        ':org_id' => $orgId,
    ]);

    $fetchStmt = $pdo->prepare(
        "SELECT org_id,
                org_name,
                org_code,
                logo_url,
                banner_url,
                banner_gallery_json,
                public_motto,
                public_about,
                contact_office,
                contact_hours,
                contact_email,
                contact_phone,
                contact_facebook,
                contact_instagram,
                contact_x_url,
                contact_tiktok,
                contact_summary,
                updated_at
         FROM organizations
         WHERE org_id = :org_id
         LIMIT 1"
    );
    $fetchStmt->execute([':org_id' => $orgId]);
    $profile = $fetchStmt->fetch() ?: [];

    jsonOk(['profile' => $profile]);
} catch (PDOException $e) {
    error_log('[api/officer/organizations/public-profile-save] ' . $e->getMessage());
    jsonError('Could not save organization profile right now.', 500);
}
