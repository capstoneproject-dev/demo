<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/private_pdf_storage.php';

$path = (string)($argv[1] ?? '');
if ($path === '') {
    fwrite(STDERR, "Usage: php tests/private-pdf-range-fixture.php <pdf-path>\n");
    exit(2);
}

$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['HTTP_RANGE'] = 'bytes=0-4';
privatePdfStream($path, 'range-test.pdf');
