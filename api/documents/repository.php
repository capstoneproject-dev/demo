<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/documents.php';

header('Content-Type: application/json');
apiGuard();

try {
    $session = getPhpSession();
    $isOsa   = ($session['login_role'] ?? '') === 'osa' || ($session['account_type'] ?? '') === 'osa_staff';
    $orgScope = null;
    if ($isOsa) {
        docRequireOsaContext();
    } else {
        $ctx = docRequireOfficerOrgContext();
        $orgScope = $ctx['org_id'];
    }

    $filters = [
        'document_type' => $_GET['document_type'] ?? null,
        'semester'      => $_GET['semester'] ?? null,
        'academic_year' => $_GET['academic_year'] ?? null,
        'from'          => $_GET['from'] ?? null,
        'to'            => $_GET['to'] ?? null,
        'q'             => trim((string)($_GET['q'] ?? '')),
    ];

    $items = docListRepository(getPdo(), $filters, $orgScope);
    jsonOk(['items' => $items]);
} catch (DocumentAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/documents/repository] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
