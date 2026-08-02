<?php

require_once __DIR__ . '/upload_security.php';

const PRIVATE_PDF_PENDING_TTL_SECONDS = 1800;

function privatePdfStorageRoot(): string
{
    $configured = getenv('CAPSTONE_PRIVATE_STORAGE_ROOT');
    $root = $configured !== false && trim($configured) !== ''
        ? trim($configured)
        : uploadProjectRoot() . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'private';

    if (!preg_match('~^(?:[A-Za-z]:[\\\\/]|[\\\\/])~', $root)) {
        $root = uploadProjectRoot() . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $root);
    }
    return rtrim($root, "\\/");
}

function privatePdfNormalizeKey(string $storageKey): string
{
    $key = ltrim(str_replace('\\', '/', trim($storageKey)), '/');
    if (!preg_match('#^(documents|print-jobs)/[A-Za-z0-9._-]+\.pdf$#i', $key)) {
        throw new RuntimeException('Invalid private PDF storage key.');
    }
    return $key;
}

function privatePdfEnsureDirectory(string $category): string
{
    if (!in_array($category, ['documents', 'print-jobs'], true)) {
        throw new RuntimeException('Invalid private PDF category.');
    }
    $directory = privatePdfStorageRoot() . DIRECTORY_SEPARATOR . $category;
    if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
        throw new RuntimeException('Could not prepare private PDF storage.');
    }
    @chmod(privatePdfStorageRoot(), 0750);
    @chmod($directory, 0750);
    return $directory;
}

function privatePdfPathIsInside(string $path, string $root): bool
{
    $resolvedPath = realpath($path);
    $resolvedRoot = realpath($root);
    if ($resolvedPath === false || $resolvedRoot === false) return false;
    $resolvedPath = rtrim(str_replace('\\', '/', $resolvedPath), '/');
    $resolvedRoot = rtrim(str_replace('\\', '/', $resolvedRoot), '/');
    if (PHP_OS_FAMILY === 'Windows') {
        $resolvedPath = strtolower($resolvedPath);
        $resolvedRoot = strtolower($resolvedRoot);
    }
    return str_starts_with($resolvedPath, $resolvedRoot . '/');
}

function privatePdfStoreUploadedFile(array $file, string $category, int $maxBytes = 20971520): array
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new UploadValidationException('A PDF file is required.');
    }
    $temporaryPath = (string)($file['tmp_name'] ?? '');
    if ($temporaryPath === '' || !is_uploaded_file($temporaryPath)) {
        throw new UploadValidationException('Invalid PDF upload.');
    }
    $size = (int)($file['size'] ?? 0);
    if ($size <= 0 || $size > $maxBytes) {
        throw new UploadValidationException('PDF must be ' . max(1, (int)floor($maxBytes / 1048576)) . 'MB or smaller.');
    }
    $mime = uploadDetectMimeFromFile($temporaryPath);
    $header = file_get_contents($temporaryPath, false, null, 0, 5);
    if (!in_array($mime, ['application/pdf', 'application/x-pdf'], true) || $header !== '%PDF-') {
        throw new UploadValidationException('Uploaded file is not a valid PDF.');
    }

    $originalName = trim((string)($file['name'] ?? 'document.pdf'));
    $safeBase = preg_replace('/[^A-Za-z0-9_-]/', '_', pathinfo($originalName, PATHINFO_FILENAME));
    $safeBase = substr(trim((string)$safeBase, '_-') ?: 'document', 0, 80);
    $filename = date('Ymd_His') . '_' . bin2hex(random_bytes(8)) . '_' . $safeBase . '.pdf';
    $directory = privatePdfEnsureDirectory($category);
    $target = $directory . DIRECTORY_SEPARATOR . $filename;
    if (!move_uploaded_file($temporaryPath, $target)) {
        throw new RuntimeException('Could not store the uploaded PDF.');
    }
    @chmod($target, 0640);
    return [
        'original_name' => $originalName,
        'storage_key' => $category . '/' . $filename,
        'absolute_path' => $target,
        'size' => $size,
    ];
}

function privatePdfResolveStoredFile(string $storedValue, array $allowedCategories = ['documents', 'print-jobs']): ?string
{
    $normalized = ltrim(str_replace('\\', '/', trim($storedValue)), '/');
    if (preg_match('#^(documents|print-jobs)/[A-Za-z0-9._-]+\.pdf$#i', $normalized, $matches)) {
        $category = strtolower($matches[1]);
        if (!in_array($category, $allowedCategories, true)) return null;
        $categoryRoot = privatePdfStorageRoot() . DIRECTORY_SEPARATOR . $category;
        $file = privatePdfStorageRoot() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $normalized);
        if (privatePdfPathIsInside($file, $categoryRoot) && is_file($file)) return realpath($file) ?: $file;
        return null;
    }

    // Transitional support while legacy public files are being migrated.
    if (in_array('documents', $allowedCategories, true) || in_array('print-jobs', $allowedCategories, true)) {
        return uploadResolvePublicFile($storedValue, 'documents');
    }
    return null;
}

function privatePdfDeleteStorageKey(string $storageKey): void
{
    try {
        privatePdfNormalizeKey($storageKey);
    } catch (RuntimeException $e) {
        return;
    }
    $file = privatePdfResolveStoredFile($storageKey);
    if ($file && privatePdfPathIsInside($file, privatePdfStorageRoot())) @unlink($file);
}

function privatePdfPrunePendingUploads(): void
{
    $pending = $_SESSION['private_pdf_pending'] ?? [];
    if (!is_array($pending)) $pending = [];
    $now = time();
    foreach ($pending as $token => $entry) {
        if (!is_array($entry) || (int)($entry['expires_at'] ?? 0) < $now) {
            if (is_array($entry) && !empty($entry['storage_key'])) privatePdfDeleteStorageKey((string)$entry['storage_key']);
            unset($pending[$token]);
        }
    }
    $_SESSION['private_pdf_pending'] = $pending;
}

function privatePdfCreatePendingUpload(array $stored, int $userId, int $orgId): string
{
    privatePdfPrunePendingUploads();
    $token = bin2hex(random_bytes(32));
    $_SESSION['private_pdf_pending'][$token] = [
        'storage_key' => privatePdfNormalizeKey((string)$stored['storage_key']),
        'original_name' => (string)$stored['original_name'],
        'user_id' => $userId,
        'org_id' => $orgId,
        'expires_at' => time() + PRIVATE_PDF_PENDING_TTL_SECONDS,
    ];
    return $token;
}

function privatePdfGetPendingUpload(string $token, int $userId, int $orgId): array
{
    privatePdfPrunePendingUploads();
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) throw new UploadValidationException('Invalid or expired document upload.');
    $entry = $_SESSION['private_pdf_pending'][$token] ?? null;
    if (!is_array($entry)
        || (int)($entry['user_id'] ?? 0) !== $userId
        || (int)($entry['org_id'] ?? 0) !== $orgId
        || (int)($entry['expires_at'] ?? 0) < time()
        || !privatePdfResolveStoredFile((string)($entry['storage_key'] ?? ''), ['documents'])) {
        throw new UploadValidationException('Invalid or expired document upload.');
    }
    return $entry;
}

function privatePdfConsumePendingUpload(string $token): void
{
    unset($_SESSION['private_pdf_pending'][$token]);
}

function privatePdfDocumentUrl(int $submissionId): string
{
    return uploadApplicationBasePath() . '/api/documents/download.php?submission_id=' . $submissionId;
}

function privatePdfPrintJobUrl(int $printJobId): string
{
    return uploadApplicationBasePath() . '/api/printing/file.php?print_job_id=' . $printJobId;
}

function privatePdfDecorateDocumentRow(array $row): array
{
    $row['file_url'] = privatePdfDocumentUrl((int)$row['submission_id']);
    return $row;
}

function privatePdfDecoratePrintJobRow(array $row): array
{
    $row['file_url'] = privatePdfPrintJobUrl((int)$row['print_job_id']);
    return $row;
}

function privatePdfCanAccessPrintJob(array $job, array $session): bool
{
    if (($session['account_type'] ?? '') === 'osa_staff' || ($session['login_role'] ?? '') === 'osa') {
        return false;
    }
    $userId = (int)($session['user_id'] ?? 0);
    if ($userId > 0 && $userId === (int)($job['user_id'] ?? 0)) return true;
    return ($session['login_role'] ?? '') === 'org'
        && (int)($session['active_org_id'] ?? 0) > 0
        && (int)($session['active_org_id'] ?? 0) === (int)($job['org_id'] ?? 0);
}

function privatePdfSafeDownloadName(string $name): string
{
    $base = preg_replace('/[^A-Za-z0-9._-]/', '_', pathinfo($name, PATHINFO_FILENAME));
    $base = substr(trim((string)$base, '._-') ?: 'document', 0, 120);
    return $base . '.pdf';
}

function privatePdfStream(string $path, string $displayName, bool $attachment = false): never
{
    if (!is_file($path) || !is_readable($path)) {
        http_response_code(404);
        exit;
    }
    $size = filesize($path);
    $mime = uploadDetectMimeFromFile($path);
    if ($size === false
        || $size < 5
        || file_get_contents($path, false, null, 0, 5) !== '%PDF-'
        || !in_array($mime, ['application/pdf', 'application/x-pdf'], true)) {
        http_response_code(404);
        exit;
    }

    $start = 0;
    $end = $size - 1;
    $range = trim((string)($_SERVER['HTTP_RANGE'] ?? ''));
    if ($range !== '') {
        if (!preg_match('/^bytes=(\d*)-(\d*)$/', $range, $matches)) {
            header('Content-Range: bytes */' . $size);
            http_response_code(416);
            exit;
        }
        if ($matches[1] === '' && $matches[2] !== '') {
            $suffix = min((int)$matches[2], $size);
            $start = $size - $suffix;
        } else {
            $start = (int)$matches[1];
            if ($matches[2] !== '') $end = min((int)$matches[2], $end);
        }
        if ($start < 0 || $start > $end || $start >= $size) {
            header('Content-Range: bytes */' . $size);
            http_response_code(416);
            exit;
        }
        http_response_code(206);
        header("Content-Range: bytes {$start}-{$end}/{$size}");
    }

    $length = $end - $start + 1;
    header('Content-Type: application/pdf');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, no-store, max-age=0');
    header('Pragma: no-cache');
    header('Accept-Ranges: bytes');
    header('Content-Length: ' . $length);
    header('Content-Disposition: ' . ($attachment ? 'attachment' : 'inline')
        . '; filename="' . privatePdfSafeDownloadName($displayName) . '"');

    if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) === 'HEAD') exit;

    $handle = fopen($path, 'rb');
    if ($handle === false) { http_response_code(500); exit; }
    fseek($handle, $start);
    $remaining = $length;
    while ($remaining > 0 && !feof($handle)) {
        $chunk = fread($handle, min(8192, $remaining));
        if ($chunk === false) break;
        echo $chunk;
        $remaining -= strlen($chunk);
        if (connection_aborted()) break;
    }
    fclose($handle);
    exit;
}
