<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../includes/private_pdf_storage.php';

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This command can only run from the command line.\n");
    exit(1);
}

$apply = in_array('--apply', $argv, true);
$pdo = getPdo();

function migrationTableExists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table"
    );
    $stmt->execute([':table' => $table]);
    return (int)$stmt->fetchColumn() > 0;
}

function migrationLegacySource(string $storedValue): ?string
{
    $resolved = uploadResolvePublicFile($storedValue, 'documents');
    if ($resolved) return $resolved;

    $normalized = str_replace('\\', '/', trim($storedValue));
    if (!str_contains($normalized, '/') && preg_match('/^[A-Za-z0-9._-]+\.pdf$/i', $normalized)) {
        $candidate = uploadRoot() . DIRECTORY_SEPARATOR . 'documents' . DIRECTORY_SEPARATOR . $normalized;
        return is_file($candidate) ? $candidate : null;
    }
    return null;
}

function migrationCopyVerified(string $source, string $destination): void
{
    if (is_file($destination)) {
        if (hash_file('sha256', $source) !== hash_file('sha256', $destination)) {
            throw new RuntimeException("Destination exists with different content: {$destination}");
        }
        return;
    }
    $temporary = $destination . '.migrating-' . bin2hex(random_bytes(4));
    if (!copy($source, $temporary)) throw new RuntimeException("Could not copy {$source}");
    if (hash_file('sha256', $source) !== hash_file('sha256', $temporary)) {
        @unlink($temporary);
        throw new RuntimeException("Copy verification failed for {$source}");
    }
    @chmod($temporary, 0640);
    if (!rename($temporary, $destination)) {
        @unlink($temporary);
        throw new RuntimeException("Could not finalize {$destination}");
    }
}

$tables = [
    'document_submissions' => ['id' => 'submission_id', 'category' => 'documents'],
    'documents_approved' => ['id' => 'repo_id', 'category' => 'documents'],
    'print_jobs' => ['id' => 'print_job_id', 'category' => 'print-jobs'],
];
$references = [];

foreach ($tables as $table => $config) {
    if (!migrationTableExists($pdo, $table)) continue;
    $stmt = $pdo->query("SELECT {$config['id']} AS row_id, file_url FROM {$table} WHERE file_url IS NOT NULL AND file_url <> ''");
    foreach ($stmt->fetchAll() as $row) {
        $value = trim((string)$row['file_url']);
        if (preg_match('#^(documents|print-jobs)/[A-Za-z0-9._-]+\.pdf$#i', $value)) continue;
        $operationKey = $config['category'] . "\0" . $value;
        $references[$operationKey]['old_value'] = $value;
        $references[$operationKey]['category'] = $config['category'];
        $references[$operationKey]['tables'][$table][] = (int)$row['row_id'];
    }
}

$migrated = 0;
$skipped = 0;
$failed = 0;
$copiedSources = [];
$failedSources = [];
fwrite(STDOUT, ($apply ? 'APPLY' : 'DRY RUN') . ": private PDF migration\n");
fwrite(STDOUT, 'Private root: ' . privatePdfStorageRoot() . "\n");

foreach ($references as $reference) {
    $oldValue = (string)$reference['old_value'];
    $source = null;
    try {
        $source = migrationLegacySource($oldValue);
        if (!$source) throw new RuntimeException("Legacy file is missing for database value: {$oldValue}");
        if (file_get_contents($source, false, null, 0, 5) !== '%PDF-'
            || !in_array(uploadDetectMimeFromFile($source), ['application/pdf', 'application/x-pdf'], true)) {
            throw new RuntimeException("Legacy file is not a PDF: {$source}");
        }
        $category = (string)$reference['category'];
        $filename = basename(str_replace('\\', '/', $source));
        if (!preg_match('/^[A-Za-z0-9._-]+\.pdf$/i', $filename)) {
            throw new RuntimeException("Unsafe legacy filename: {$filename}");
        }
        $newKey = privatePdfNormalizeKey($category . '/' . $filename);
        $destination = privatePdfEnsureDirectory($category) . DIRECTORY_SEPARATOR . $filename;
        fwrite(STDOUT, "{$oldValue} -> {$newKey}\n");

        if (!$apply) {
            $migrated++;
            continue;
        }

        migrationCopyVerified($source, $destination);
        $copiedSources[$source][$destination] = true;
        $pdo->beginTransaction();
        try {
            foreach (array_keys($reference['tables']) as $table) {
                $update = $pdo->prepare("UPDATE {$table} SET file_url = :new_value WHERE file_url = :old_value");
                $update->execute([':new_value' => $newKey, ':old_value' => $oldValue]);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
        $migrated++;
    } catch (Throwable $e) {
        $failed++;
        if ($source) $failedSources[$source] = true;
        fwrite(STDERR, 'ERROR: ' . $e->getMessage() . "\n");
    }
}

if ($apply) {
    foreach ($copiedSources as $source => $destinations) {
        if (isset($failedSources[$source]) || !is_file($source)) continue;
        $sourceHash = hash_file('sha256', $source);
        $verified = $sourceHash !== false;
        foreach (array_keys($destinations) as $destination) {
            if (!is_file($destination) || hash_file('sha256', $destination) !== $sourceHash) {
                $verified = false;
                break;
            }
        }
        if ($verified) @unlink($source);
    }
}

if (!$references) $skipped++;
fwrite(STDOUT, "Summary: candidates={$migrated}, failed={$failed}, no_work={$skipped}\n");
if (!$apply) fwrite(STDOUT, "Dry run only. Re-run with --apply after backing up the database and uploads/documents.\n");
exit($failed > 0 ? 1 : 0);
