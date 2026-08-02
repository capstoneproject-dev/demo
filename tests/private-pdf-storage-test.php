<?php

declare(strict_types=1);

$testRoot = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'capstone-private-pdf-' . bin2hex(random_bytes(5));
$sessionRoot = $testRoot . DIRECTORY_SEPARATOR . 'sessions';
mkdir($sessionRoot, 0700, true);
putenv('CAPSTONE_PRIVATE_STORAGE_ROOT=' . $testRoot . DIRECTORY_SEPARATOR . 'files');
session_save_path($sessionRoot);
session_id('private-pdf-' . bin2hex(random_bytes(8)));
session_start();

require_once __DIR__ . '/../includes/private_pdf_storage.php';

function privatePdfTestAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function privatePdfTestThrows(callable $callback, string $message): void
{
    try {
        $callback();
    } catch (Throwable $e) {
        return;
    }
    throw new RuntimeException($message);
}

function privatePdfTestRemoveTree(string $directory): void
{
    if (!is_dir($directory)) return;
    foreach (scandir($directory) ?: [] as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = $directory . DIRECTORY_SEPARATOR . $item;
        if (is_dir($path)) privatePdfTestRemoveTree($path);
        else unlink($path);
    }
    rmdir($directory);
}

try {
    $documents = privatePdfEnsureDirectory('documents');
    privatePdfEnsureDirectory('print-jobs');
    $file = $documents . DIRECTORY_SEPARATOR . 'test.pdf';
    file_put_contents($file, "%PDF-1.4\nprivate storage test\n%%EOF");

    privatePdfTestAssert(privatePdfNormalizeKey('documents/test.pdf') === 'documents/test.pdf', 'Valid key rejected.');
    privatePdfTestThrows(
        fn() => privatePdfNormalizeKey('documents/../secret.pdf'),
        'Traversal storage key was accepted.'
    );
    privatePdfTestAssert(privatePdfResolveStoredFile('documents/test.pdf', ['documents']) === realpath($file), 'Stored PDF did not resolve.');
    privatePdfTestAssert(privatePdfResolveStoredFile('documents/test.pdf', ['print-jobs']) === null, 'Wrong category was accepted.');

    $stored = ['storage_key' => 'documents/test.pdf', 'original_name' => 'My File.pdf'];
    $token = privatePdfCreatePendingUpload($stored, 41, 7);
    privatePdfTestAssert(strlen($token) === 64, 'Upload token has an invalid format.');
    privatePdfTestAssert(privatePdfGetPendingUpload($token, 41, 7)['storage_key'] === 'documents/test.pdf', 'Bound token could not be read.');
    privatePdfTestThrows(fn() => privatePdfGetPendingUpload($token, 42, 7), 'Token was accepted for another user.');
    privatePdfTestThrows(fn() => privatePdfGetPendingUpload($token, 41, 8), 'Token was accepted for another organization.');
    privatePdfConsumePendingUpload($token);
    privatePdfTestThrows(fn() => privatePdfGetPendingUpload($token, 41, 7), 'Consumed token was reused.');

    $expiredToken = privatePdfCreatePendingUpload($stored, 41, 7);
    $_SESSION['private_pdf_pending'][$expiredToken]['expires_at'] = time() - 1;
    privatePdfTestThrows(fn() => privatePdfGetPendingUpload($expiredToken, 41, 7), 'Expired token was accepted.');
    privatePdfTestAssert(!is_file($file), 'Expired pending file was not removed.');

    $job = ['user_id' => 5, 'org_id' => 10];
    privatePdfTestAssert(!privatePdfCanAccessPrintJob($job, ['account_type' => 'osa_staff', 'user_id' => 5]), 'OSA gained printing-file access.');
    privatePdfTestAssert(privatePdfCanAccessPrintJob($job, ['user_id' => 5]), 'Student owner access failed.');
    privatePdfTestAssert(privatePdfCanAccessPrintJob($job, ['login_role' => 'org', 'active_org_id' => 10]), 'Assigned officer access failed.');
    privatePdfTestAssert(!privatePdfCanAccessPrintJob($job, ['user_id' => 6]), 'Another student gained access.');
    privatePdfTestAssert(!privatePdfCanAccessPrintJob($job, ['login_role' => 'org', 'active_org_id' => 11]), 'Another organization gained access.');

    fwrite(STDOUT, "Private PDF storage tests passed.\n");
} finally {
    session_write_close();
    privatePdfTestRemoveTree($testRoot);
    putenv('CAPSTONE_PRIVATE_STORAGE_ROOT');
}
