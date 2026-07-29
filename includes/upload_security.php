<?php
/**
 * Shared local-upload validation and storage helpers.
 *
 * Database values remain relative "uploads/..." paths so existing pages and
 * deployments continue to work. Runtime files are intentionally kept separate
 * from source control and protected by uploads/.htaccess or the equivalent
 * web-server configuration.
 */

class UploadValidationException extends RuntimeException {}

function uploadProjectRoot(): string
{
    return dirname(__DIR__);
}

function uploadRoot(): string
{
    return uploadProjectRoot() . DIRECTORY_SEPARATOR . 'uploads';
}

function uploadApplicationBasePath(): string
{
    $configured = getenv('CAPSTONE_BASE_PATH');
    if ($configured !== false && trim($configured) !== '') {
        $base = '/' . trim(str_replace('\\', '/', $configured), '/');
        return $base === '/' ? '' : $base;
    }

    $scriptName = str_replace('\\', '/', (string)($_SERVER['SCRIPT_NAME'] ?? ''));
    foreach (['/api/', '/pages/', '/systems/'] as $marker) {
        $position = strpos($scriptName, $marker);
        if ($position !== false) {
            return rtrim(substr($scriptName, 0, $position), '/');
        }
    }
    return '';
}

function uploadPublicUrl(string $relativePath): string
{
    $relativePath = ltrim(str_replace('\\', '/', $relativePath), '/');
    if (!preg_match('#^uploads/[A-Za-z0-9/_-]+(?:\.[A-Za-z0-9]+)?$#', $relativePath)) {
        throw new RuntimeException('Invalid public upload path.');
    }
    return uploadApplicationBasePath() . '/' . $relativePath;
}

function uploadResolvePublicFile(string $storedValue, string $relativeDirectory): ?string
{
    $relativeDirectory = trim(str_replace('\\', '/', $relativeDirectory), '/');
    $normalized = str_replace('\\', '/', trim($storedValue));
    $marker = '/uploads/' . $relativeDirectory . '/';
    $position = strpos('/' . ltrim($normalized, '/'), $marker);
    if ($position === false) {
        return null;
    }
    $filename = substr('/' . ltrim($normalized, '/'), $position + strlen($marker));
    if ($filename === '' || str_contains($filename, '/') || !preg_match('/^[A-Za-z0-9._-]+$/', $filename)) {
        return null;
    }

    $root = realpath(uploadRoot() . DIRECTORY_SEPARATOR
        . str_replace('/', DIRECTORY_SEPARATOR, $relativeDirectory));
    $file = realpath(uploadRoot() . DIRECTORY_SEPARATOR
        . str_replace('/', DIRECTORY_SEPARATOR, $relativeDirectory)
        . DIRECTORY_SEPARATOR . $filename);
    if (!$root || !$file || !str_starts_with($file, $root . DIRECTORY_SEPARATOR) || !is_file($file)) {
        return null;
    }
    return $file;
}

function uploadEnsureDirectory(string $relativeDirectory): string
{
    $relativeDirectory = trim(str_replace('\\', '/', $relativeDirectory), '/');
    if ($relativeDirectory === ''
        || str_contains($relativeDirectory, '..')
        || !preg_match('#^[A-Za-z0-9/_-]+$#', $relativeDirectory)) {
        throw new RuntimeException('Invalid upload directory.');
    }

    $directory = uploadRoot() . DIRECTORY_SEPARATOR
        . str_replace('/', DIRECTORY_SEPARATOR, $relativeDirectory);
    if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
        throw new RuntimeException('Could not prepare the upload directory.');
    }
    @chmod($directory, 0755);
    return $directory;
}

function uploadDetectMimeFromBuffer(string $binary): string
{
    if (!class_exists('finfo')) {
        throw new RuntimeException('PHP Fileinfo is required for secure uploads.');
    }
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    return strtolower((string)$finfo->buffer($binary));
}

function uploadDetectMimeFromFile(string $path): string
{
    if (!class_exists('finfo')) {
        throw new RuntimeException('PHP Fileinfo is required for secure uploads.');
    }
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    return strtolower((string)$finfo->file($path));
}

function uploadValidateImageBinary(
    string $binary,
    array $allowedMimeExtensions,
    int $maxBytes = 5242880,
    int $maxDimension = 8000
): array {
    $length = strlen($binary);
    if ($length <= 0) {
        throw new UploadValidationException('The selected image is empty.');
    }
    if ($length > $maxBytes) {
        throw new UploadValidationException(
            'Image must be ' . max(1, (int)floor($maxBytes / 1048576)) . 'MB or smaller.'
        );
    }

    $detectedMime = uploadDetectMimeFromBuffer($binary);
    $imageInfo = @getimagesizefromstring($binary);
    $imageMime = strtolower((string)($imageInfo['mime'] ?? ''));
    if (!$imageInfo || $detectedMime === '' || $detectedMime !== $imageMime) {
        throw new UploadValidationException('Uploaded file is not a valid image.');
    }
    if (!isset($allowedMimeExtensions[$detectedMime])) {
        throw new UploadValidationException('This image format is not allowed.');
    }

    $width = (int)($imageInfo[0] ?? 0);
    $height = (int)($imageInfo[1] ?? 0);
    if ($width <= 0 || $height <= 0 || $width > $maxDimension || $height > $maxDimension) {
        throw new UploadValidationException(
            "Image dimensions must not exceed {$maxDimension}×{$maxDimension} pixels."
        );
    }

    return [
        'mime' => $detectedMime,
        'extension' => $allowedMimeExtensions[$detectedMime],
        'width' => $width,
        'height' => $height,
        'size' => $length,
    ];
}

function uploadStoreImageDataUrl(
    string $dataUrl,
    string $relativeDirectory,
    string $filenamePrefix,
    array $allowedMimeExtensions,
    int $maxBytes = 5242880,
    int $maxDimension = 8000
): string {
    $raw = trim($dataUrl);
    if (!preg_match('#^data:([a-z0-9.+-]+/[a-z0-9.+-]+);base64,(.+)$#is', $raw, $matches)) {
        throw new UploadValidationException('Invalid image data.');
    }

    // Reject oversized Base64 payloads before allocating the decoded buffer.
    $encoded = preg_replace('/\s+/', '', $matches[2]);
    $maxEncodedLength = (int)ceil($maxBytes * 4 / 3) + 16;
    if (!is_string($encoded) || strlen($encoded) > $maxEncodedLength) {
        throw new UploadValidationException(
            'Image must be ' . max(1, (int)floor($maxBytes / 1048576)) . 'MB or smaller.'
        );
    }
    $binary = base64_decode($encoded, true);
    if ($binary === false) {
        throw new UploadValidationException('Invalid image encoding.');
    }

    $claimedMime = strtolower($matches[1]);
    $details = uploadValidateImageBinary($binary, $allowedMimeExtensions, $maxBytes, $maxDimension);
    if ($claimedMime === 'image/jpg') {
        $claimedMime = 'image/jpeg';
    }
    if ($claimedMime !== $details['mime']) {
        throw new UploadValidationException('Image type does not match its contents.');
    }

    $directory = uploadEnsureDirectory($relativeDirectory);
    $safePrefix = preg_replace('/[^A-Za-z0-9_-]/', '_', $filenamePrefix) ?: 'upload';
    $filename = $safePrefix . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(8))
        . '.' . $details['extension'];
    $target = $directory . DIRECTORY_SEPARATOR . $filename;
    if (file_put_contents($target, $binary, LOCK_EX) === false) {
        throw new RuntimeException('Could not save the uploaded image.');
    }
    @chmod($target, 0644);

    return 'uploads/' . trim(str_replace('\\', '/', $relativeDirectory), '/') . '/' . $filename;
}

function uploadStoreImageFile(
    array $file,
    string $relativeDirectory,
    string $filenamePrefix,
    array $allowedMimeExtensions,
    int $maxBytes = 5242880,
    int $maxDimension = 8000
): string {
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new UploadValidationException('Could not upload the selected image.');
    }
    $temporaryPath = (string)($file['tmp_name'] ?? '');
    if ($temporaryPath === '' || !is_uploaded_file($temporaryPath)) {
        throw new UploadValidationException('Invalid image upload.');
    }

    $reportedSize = (int)($file['size'] ?? 0);
    if ($reportedSize <= 0 || $reportedSize > $maxBytes) {
        throw new UploadValidationException(
            'Image must be ' . max(1, (int)floor($maxBytes / 1048576)) . 'MB or smaller.'
        );
    }
    $binary = file_get_contents($temporaryPath);
    if ($binary === false) {
        throw new RuntimeException('Could not inspect the uploaded image.');
    }
    $details = uploadValidateImageBinary($binary, $allowedMimeExtensions, $maxBytes, $maxDimension);

    $directory = uploadEnsureDirectory($relativeDirectory);
    $safePrefix = preg_replace('/[^A-Za-z0-9_-]/', '_', $filenamePrefix) ?: 'upload';
    $filename = $safePrefix . '_' . bin2hex(random_bytes(8)) . '.' . $details['extension'];
    $target = $directory . DIRECTORY_SEPARATOR . $filename;
    if (!move_uploaded_file($temporaryPath, $target)) {
        throw new RuntimeException('Could not store the uploaded image.');
    }
    @chmod($target, 0644);

    return 'uploads/' . trim(str_replace('\\', '/', $relativeDirectory), '/') . '/' . $filename;
}

function uploadStorePdfFile(
    array $file,
    string $relativeDirectory = 'documents',
    int $maxBytes = 20971520
): array {
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new UploadValidationException('A PDF file is required.');
    }
    $temporaryPath = (string)($file['tmp_name'] ?? '');
    if ($temporaryPath === '' || !is_uploaded_file($temporaryPath)) {
        throw new UploadValidationException('Invalid PDF upload.');
    }

    $size = (int)($file['size'] ?? 0);
    if ($size <= 0 || $size > $maxBytes) {
        throw new UploadValidationException(
            'PDF must be ' . max(1, (int)floor($maxBytes / 1048576)) . 'MB or smaller.'
        );
    }
    $mime = uploadDetectMimeFromFile($temporaryPath);
    $header = file_get_contents($temporaryPath, false, null, 0, 5);
    if (!in_array($mime, ['application/pdf', 'application/x-pdf'], true) || $header !== '%PDF-') {
        throw new UploadValidationException('Uploaded file is not a valid PDF.');
    }

    $originalName = trim((string)($file['name'] ?? 'document.pdf'));
    $safeBase = preg_replace('/[^A-Za-z0-9_-]/', '_', pathinfo($originalName, PATHINFO_FILENAME));
    $safeBase = trim((string)$safeBase, '_-') ?: 'document';
    $safeBase = substr($safeBase, 0, 80);
    $filename = date('Ymd_His') . '_' . bin2hex(random_bytes(8)) . '_' . $safeBase . '.pdf';
    $directory = uploadEnsureDirectory($relativeDirectory);
    $target = $directory . DIRECTORY_SEPARATOR . $filename;
    if (!move_uploaded_file($temporaryPath, $target)) {
        throw new RuntimeException('Could not store the uploaded PDF.');
    }
    @chmod($target, 0644);

    return [
        'original_name' => $originalName,
        'relative_path' => 'uploads/' . trim(str_replace('\\', '/', $relativeDirectory), '/')
            . '/' . $filename,
        'absolute_path' => $target,
    ];
}
