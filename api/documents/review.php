<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/documents.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

try {
    $pdo = getPdo();
    $session = getPhpSession();
    $isOsa = ($session['login_role'] ?? '') === 'osa' || ($session['account_type'] ?? '') === 'osa_staff';
    $requiredRecipient = 'OSA';
    $disallowedReviewerOrgId = null;

    if ($isOsa) {
        $ctx = docRequireOsaContext();
    } else {
        $ctx = docRequireOfficerOrgContext();
        if (!docIsSscOrganization($pdo, (int)$ctx['org_id'])) {
            throw new DocumentAuthorizationException('Only SSC officers can review SSC-addressed documents.');
        }
        $requiredRecipient = 'SSC';
        $disallowedReviewerOrgId = (int)$ctx['org_id'];
    }
    $body = getRequestBody();
    $submissionId = (int)($body['submission_id'] ?? 0);
    $decision     = $body['decision'] ?? '';
    $notes        = $body['notes'] ?? null;

    if ($submissionId <= 0) {
        throw new DocumentValidationException('submission_id is required.');
    }

    $item = docReviewSubmission(
        $pdo,
        $submissionId,
        (int)$ctx['user_id'],
        $decision,
        $notes,
        $requiredRecipient,
        $disallowedReviewerOrgId
    );
    jsonOk(['item' => privatePdfDecorateDocumentRow($item)]);
} catch (DocumentAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (DocumentValidationException $e) {
    jsonError($e->getMessage(), 422);
} catch (PDOException $e) {
    error_log('[api/documents/review] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
