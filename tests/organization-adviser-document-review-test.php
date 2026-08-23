<?php
declare(strict_types=1);

ini_set('session.save_path', sys_get_temp_dir());
require_once __DIR__ . '/../includes/documents.php';

function adviserDocumentAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$pdo = getPdo();
docEnsureTermColumns($pdo);
$suffix = strtoupper(bin2hex(random_bytes(4)));
$pdo->beginTransaction();

try {
    $pdo->prepare(
        "INSERT INTO organizations (org_name, org_code, status)
         VALUES (:name, :code, 'active')"
    )->execute([':name' => "Document Review {$suffix}", ':code' => "DR{$suffix}"]);
    $orgId = (int)$pdo->lastInsertId();

    $pdo->prepare(
        "INSERT INTO users
            (student_number, email, password_hash, first_name, last_name, account_type, is_active)
         VALUES (:student_number, :email, :password_hash, 'Test', 'Officer', 'student', 1)"
    )->execute([
        ':student_number' => "STU-{$suffix}",
        ':email' => strtolower($suffix) . '@officer.invalid',
        ':password_hash' => password_hash('test-password', PASSWORD_DEFAULT),
    ]);
    $officerId = (int)$pdo->lastInsertId();

    $pdo->prepare(
        "INSERT INTO users
            (employee_number, email, password_hash, first_name, last_name, account_type, is_active)
         VALUES (:employee_number, :email, :password_hash, 'Test', 'Adviser', 'organization_adviser', 1)"
    )->execute([
        ':employee_number' => "ADV-{$suffix}",
        ':email' => strtolower($suffix) . '@adviser.invalid',
        ':password_hash' => password_hash('test-password', PASSWORD_DEFAULT),
    ]);
    $adviserId = (int)$pdo->lastInsertId();

    $createSubmission = static function (string $title) use ($pdo, $orgId, $officerId): int {
        $pdo->prepare(
            "INSERT INTO document_submissions
                (org_id, submitted_by_user_id, title, document_type, file_url, recipient, status)
             VALUES (:org_id, :user_id, :title, 'Activity Report', 'documents/test.pdf', 'ADVISER', 'adviser_pending')"
        )->execute([':org_id' => $orgId, ':user_id' => $officerId, ':title' => $title]);
        $submissionId = (int)$pdo->lastInsertId();
        $pdo->prepare(
            "INSERT INTO document_versions
                (submission_id, root_submission_id, parent_submission_id, version_number, file_sha256, created_by_user_id)
             VALUES (:id, :id2, NULL, 1, :hash, :user_id)"
        )->execute([
            ':id' => $submissionId,
            ':id2' => $submissionId,
            ':hash' => str_repeat('a', 64),
            ':user_id' => $officerId,
        ]);
        return $submissionId;
    };

    $approvedId = $createSubmission('Adviser approval test');
    $approved = docReviewSubmission(
        $pdo, $approvedId, $adviserId, 'approved', 'Reviewed',
        'ADVISER', null, 'ADVISER', $orgId
    );
    adviserDocumentAssert($approved['status'] === 'adviser_approved', 'Adviser approval did not unlock forwarding.');
    adviserDocumentAssert($approved['recipient'] === 'ADVISER', 'Adviser approval improperly forwarded the document.');

    try {
        docReviewSubmission(
            $pdo, $approvedId, $adviserId, 'rejected', 'Late competing decision',
            'ADVISER', null, 'ADVISER', $orgId
        );
        throw new RuntimeException('A second adviser decision unexpectedly replaced the first decision.');
    } catch (DocumentValidationException $e) {
        adviserDocumentAssert(
            str_contains($e->getMessage(), 'not awaiting ADVISER review'),
            'Unexpected simultaneous-decision error.'
        );
    }
    $decisionCheck = $pdo->prepare(
        "SELECT decision FROM document_decisions
         WHERE submission_id = :id AND review_stage = 'ADVISER'"
    );
    $decisionCheck->execute([':id' => $approvedId]);
    adviserDocumentAssert(
        $decisionCheck->fetchColumn() === 'approved',
        'The first committed adviser decision was not preserved.'
    );

    $forwarded = docForwardSubmissionToSsc($pdo, $approvedId, $orgId, $officerId);
    adviserDocumentAssert($forwarded['status'] === 'pending', 'Officer forwarding did not place the document in the SSC queue.');
    adviserDocumentAssert($forwarded['recipient'] === 'SSC', 'Officer forwarding did not assign SSC.');
    $sameOrgFeedback = docRedactExternalAdviserFeedback($forwarded, [
        'login_role' => 'org',
        'active_org_id' => $orgId,
    ]);
    adviserDocumentAssert(
        $sameOrgFeedback['adviser_reviewer_notes'] === 'Reviewed',
        'The submitting organization lost its own adviser feedback.'
    );
    $osaFeedback = docRedactExternalAdviserFeedback($forwarded, [
        'login_role' => 'osa',
        'account_type' => 'osa_staff',
    ]);
    adviserDocumentAssert(
        $osaFeedback['adviser_reviewer_notes'] === null
        && $osaFeedback['reviewer_notes'] === null,
        'OSA received an organization adviser comment.'
    );

    $sscOrgId = (int)($pdo->query(
        "SELECT org_id FROM organizations
         WHERE UPPER(TRIM(COALESCE(org_code, ''))) = 'SSC'
            OR UPPER(TRIM(org_name)) = 'SUPREME STUDENT COUNCIL'
         LIMIT 1"
    )->fetchColumn() ?: 0);
    if ($sscOrgId > 0) {
        $strictSscList = docListSubmissions($pdo, ['strict_org_scope' => true], $sscOrgId);
        adviserDocumentAssert(
            !in_array($approvedId, array_column($strictSscList, 'submission_id'), true),
            'An SSC adviser scope discovered another organization document.'
        );
        $sscAdviserSession = [
            'login_role' => 'org',
            'account_type' => 'organization_adviser',
            'active_org_id' => $sscOrgId,
            'can_review_org_documents' => true,
            'can_manage_org_dashboard' => false,
        ];
        adviserDocumentAssert(
            docResolveSubmissionAccess($pdo, $approvedId, $sscAdviserSession) === null,
            'An SSC adviser scope could preview another organization document.'
        );
    }

    $ownOrgSession = [
        'login_role' => 'org',
        'account_type' => 'organization_adviser',
        'active_org_id' => $orgId,
        'can_review_org_documents' => true,
        'can_manage_org_dashboard' => false,
    ];
    $adviserAnnotation = docCreateAnnotation($pdo, $approvedId, $adviserId, $ownOrgSession, [
        'page' => 1,
        'text' => 'Adviser annotation',
        'rects' => [['x' => 0.1, 'y' => 0.1, 'width' => 0.2, 'height' => 0.03]],
        'comment' => 'Review note',
    ]);
    $officerAnnotation = docCreateAnnotation($pdo, $approvedId, $officerId, [
        'login_role' => 'org',
        'active_org_id' => $orgId,
    ], [
        'page' => 1,
        'text' => 'Officer annotation',
        'rects' => [['x' => 0.2, 'y' => 0.2, 'width' => 0.2, 'height' => 0.03]],
    ]);
    if ($sscOrgId > 0) {
        $sscVisibleAnnotations = docListAnnotations($pdo, $approvedId, [
            'login_role' => 'org',
            'account_type' => 'student',
            'active_org_id' => $sscOrgId,
            'can_manage_org_dashboard' => true,
        ]);
        $sscVisibleAnnotationIds = array_column($sscVisibleAnnotations, 'annotation_id');
        adviserDocumentAssert(
            !in_array((int)$adviserAnnotation['annotation_id'], $sscVisibleAnnotationIds, true),
            'SSC received an adviser-authored PDF annotation from another organization.'
        );
        adviserDocumentAssert(
            in_array((int)$officerAnnotation['annotation_id'], $sscVisibleAnnotationIds, true),
            'SSC unexpectedly lost a non-adviser PDF annotation.'
        );
    }
    adviserDocumentAssert(
        docDeleteAnnotation($pdo, (int)$adviserAnnotation['annotation_id'], $adviserId, $ownOrgSession),
        'An adviser could not delete their own annotation.'
    );
    try {
        docDeleteAnnotation($pdo, (int)$officerAnnotation['annotation_id'], $adviserId, $ownOrgSession);
        throw new RuntimeException('An adviser unexpectedly deleted another author\'s annotation.');
    } catch (DocumentAuthorizationException $e) {
        adviserDocumentAssert(
            str_contains($e->getMessage(), 'Only the author'),
            'Unexpected annotation ownership error.'
        );
    }

    $rejectedId = $createSubmission('Required rejection note test');
    try {
        docReviewSubmission($pdo, $rejectedId, $adviserId, 'rejected', '', 'ADVISER', null, 'ADVISER', $orgId);
        throw new RuntimeException('Adviser rejection unexpectedly accepted an empty comment.');
    } catch (DocumentValidationException $e) {
        adviserDocumentAssert(str_contains($e->getMessage(), 'comment is required'), 'Unexpected empty-rejection error.');
    }

    try {
        docReviewSubmission($pdo, $rejectedId, $adviserId, 'approved', null, 'ADVISER', null, 'ADVISER', $orgId + 1);
        throw new RuntimeException('A different organization adviser scope unexpectedly reviewed the document.');
    } catch (DocumentAuthorizationException $e) {
        adviserDocumentAssert(str_contains($e->getMessage(), 'different organization'), 'Unexpected cross-organization error.');
    }
} finally {
    if ($pdo->inTransaction()) $pdo->rollBack();
}

echo "Organization adviser document workflow tests passed.\n";
