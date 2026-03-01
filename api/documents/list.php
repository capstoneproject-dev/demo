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
        'status'    => $_GET['status']    ?? 'all',
        'recipient' => $_GET['recipient'] ?? null,
        'q'         => trim((string)($_GET['q'] ?? '')),
        'from'      => $_GET['from']      ?? null,
        'to'        => $_GET['to']        ?? null,
    ];
    if ($filters['status'] === null) unset($filters['status']);

    $items = docListSubmissions(getPdo(), $filters, $orgScope);
    jsonOk(['items' => $items]);
} catch (DocumentAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/documents/list] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
