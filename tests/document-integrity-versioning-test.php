<?php

ini_set('session.save_path', __DIR__ . '/../storage/private');
require_once __DIR__ . '/../includes/documents.php';

$pdo = getPdo();
$fixture = $pdo->query(
    "SELECT ds.org_id, ds.submitted_by_user_id, ds.file_url,
            COALESCE(ds.reviewed_by_user_id, ds.submitted_by_user_id) AS reviewer_id
     FROM document_submissions ds
     JOIN organizations fixture_org ON fixture_org.org_id = ds.org_id
     WHERE ds.file_url IS NOT NULL AND ds.file_url <> ''
       AND UPPER(TRIM(COALESCE(fixture_org.org_code, ''))) <> 'SSC'
       AND UPPER(TRIM(fixture_org.org_name)) <> 'SUPREME STUDENT COUNCIL'
     ORDER BY ds.submission_id
     LIMIT 1"
)->fetch();

$sscFixture = $pdo->query(
    "SELECT o.org_id, COALESCE(MIN(om.user_id), MIN(u.user_id)) AS reviewer_id
     FROM organizations o
     LEFT JOIN organization_members om ON om.org_id = o.org_id AND om.is_active = 1
     LEFT JOIN users u ON 1 = 1
     WHERE UPPER(TRIM(COALESCE(o.org_code, ''))) = 'SSC'
        OR UPPER(TRIM(o.org_name)) = 'SUPREME STUDENT COUNCIL'
     GROUP BY o.org_id
     LIMIT 1"
)->fetch();

if (!$fixture || !$sscFixture || !privatePdfResolveStoredFile((string)$fixture['file_url'], ['documents'])) {
    fwrite(STDERR, "FAIL: No stored document PDF is available for the test.\n");
    exit(1);
}

$assert = static function (bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
};

docEnsureTermColumns($pdo);
settingsEnsureTable($pdo);
$pdo->beginTransaction();
try {
    $root = docCreateSubmission($pdo, (int)$fixture['org_id'], (int)$fixture['submitted_by_user_id'], [
        'title' => 'Integrity test document',
        'document_type' => 'Others',
        'custom_document_type' => 'Compliance Matrix',
        'recipient' => 'OSA',
        'description' => 'Rolled back automatically after the test.',
        'storage_key' => (string)$fixture['file_url'],
    ]);
    $assert($pdo->inTransaction(), 'Transaction ended while creating the root submission.');
    $assert($root['version_number'] === 1, 'A new submission must start at version 1.');
    $assert($root['document_type'] === 'Others', 'The custom document category was not preserved.');
    $assert($root['custom_document_type'] === 'Compliance Matrix', 'The custom document type was not preserved.');
    $assert($root['recipient'] === 'ADVISER', 'A non-SSC submission bypassed mandatory adviser routing.');
    $assert($root['status'] === 'adviser_pending', 'A new submission did not start in adviser review.');

    $rejected = docReviewSubmission(
        $pdo, (int)$root['submission_id'], (int)$fixture['reviewer_id'],
        'rejected', 'Please revise.', 'ADVISER', null, 'ADVISER', (int)$fixture['org_id']
    );
    $assert($pdo->inTransaction(), 'Transaction ended while rejecting the root submission.');
    $assert($rejected['status'] === 'rejected', 'The first decision was not recorded.');

    $secondDecisionBlocked = false;
    try {
        docReviewSubmission(
            $pdo, (int)$root['submission_id'], (int)$fixture['reviewer_id'],
            'approved', 'Changed decision', 'ADVISER', null, 'ADVISER', (int)$fixture['org_id']
        );
    } catch (DocumentValidationException $e) {
        $secondDecisionBlocked = true;
    }
    $assert($secondDecisionBlocked, 'A second final decision was not blocked.');
    $assert($pdo->inTransaction(), 'Transaction ended while blocking the second decision.');

    $directUpdateBlocked = false;
    try {
        $stmt = $pdo->prepare("UPDATE document_submissions SET status = 'approved' WHERE submission_id = :id");
        $stmt->execute([':id' => (int)$root['submission_id']]);
    } catch (PDOException $e) {
        $directUpdateBlocked = true;
    }
    $assert($directUpdateBlocked, 'The database allowed a finalized submission to be changed.');
    $assert($pdo->inTransaction(), 'Transaction ended while blocking a direct submission update.');

    $revision = docCreateSubmission($pdo, (int)$fixture['org_id'], (int)$fixture['submitted_by_user_id'], [
        'title' => 'Integrity test document (revised)',
        'document_type' => 'Activity Report',
        'recipient' => 'OSA',
        'description' => 'Revision test.',
        'storage_key' => (string)$fixture['file_url'],
        'revision_of_submission_id' => (int)$root['submission_id'],
    ]);
    $assert($pdo->inTransaction(), 'Transaction ended while creating the revision.');
    $assert($revision['version_number'] === 2, 'The revision was not assigned version 2.');
    $assert($revision['parent_submission_id'] === (int)$root['submission_id'], 'The revision is not linked to its parent.');
    $assert($revision['document_type'] === 'Others', 'The revision changed the custom document category.');
    $assert($revision['custom_document_type'] === 'Compliance Matrix', 'The revision lost the custom document type.');
    $assert($revision['recipient'] === 'ADVISER', 'A non-SSC revision bypassed mandatory adviser routing.');
    $assert($revision['status'] === 'adviser_pending', 'A revision did not restart adviser review.');
    $rejectedAlertStmt = $pdo->prepare(
        "SELECT COUNT(*)
         FROM document_submissions rejected_submission
         WHERE rejected_submission.submission_id = :id
           AND rejected_submission.status = 'rejected'
           AND NOT EXISTS (
                SELECT 1 FROM document_versions newer
                WHERE newer.parent_submission_id = rejected_submission.submission_id
           )"
    );
    $rejectedAlertStmt->execute([':id' => (int)$root['submission_id']]);
    $assert((int)$rejectedAlertStmt->fetchColumn() === 0, 'A rejected document remained actionable after its revision was submitted.');
    $assert(
        docResolveSubmissionAccess($pdo, (int)$revision['submission_id'], ['login_role' => 'osa']) === null,
        'OSA could access a document before it was forwarded.'
    );

    $adviserApproved = docReviewSubmission(
        $pdo, (int)$revision['submission_id'], (int)$fixture['reviewer_id'],
        'approved', 'Approved by adviser.', 'ADVISER', null, 'ADVISER', (int)$fixture['org_id']
    );
    $assert($adviserApproved['status'] === 'adviser_approved', 'Adviser approval did not unlock officer forwarding.');
    docForwardSubmissionToSsc(
        $pdo, (int)$revision['submission_id'], (int)$fixture['org_id'], (int)$fixture['submitted_by_user_id']
    );
    $sscApproved = docReviewSubmission(
        $pdo, (int)$revision['submission_id'], (int)$sscFixture['reviewer_id'],
        'approved', 'Approved by SSC.', 'SSC', (int)$sscFixture['org_id'], 'SSC'
    );
    $assert($sscApproved['status'] === 'ssc_approved', 'SSC approval did not enter the forwarding stage.');
    $prematureRepoStmt = $pdo->prepare("SELECT COUNT(*) FROM documents_approved WHERE submission_id = :id");
    $prematureRepoStmt->execute([':id' => (int)$revision['submission_id']]);
    $assert((int)$prematureRepoStmt->fetchColumn() === 0, 'SSC approval created a final repository snapshot.');

    $forwarded = docForwardSubmissionToOsa(
        $pdo, (int)$revision['submission_id'], (int)$fixture['org_id'], (int)$fixture['submitted_by_user_id']
    );
    $assert($forwarded['status'] === 'sent_to_osa' && $forwarded['recipient'] === 'OSA', 'SSC-approved document was not forwarded to OSA.');
    $assert(
        docResolveSubmissionAccess($pdo, (int)$revision['submission_id'], ['login_role' => 'osa']) !== null,
        'OSA could not access a forwarded document.'
    );

    $approved = docReviewSubmission(
        $pdo, (int)$revision['submission_id'], (int)$fixture['reviewer_id'],
        'approved', 'Final OSA approval.', 'OSA', null, 'OSA'
    );
    $assert($pdo->inTransaction(), 'Transaction ended while approving the revision.');
    $assert($approved['status'] === 'approved', 'OSA did not issue the final approval.');
    $assert(
        $approved['adviser_decision'] === 'approved'
        && $approved['ssc_decision'] === 'approved'
        && $approved['osa_decision'] === 'approved',
        'All staged decisions were not preserved.'
    );
    $finalCancellationBlocked = false;
    try {
        docCancelSubmission(
            $pdo, (int)$revision['submission_id'], (int)$fixture['org_id'], (int)$fixture['submitted_by_user_id']
        );
    } catch (DocumentValidationException $e) {
        $finalCancellationBlocked = true;
    }
    $assert($finalCancellationBlocked, 'A finalized OSA decision could still be cancelled.');
    $approvedSnapshotStmt = $pdo->prepare(
        "SELECT document_type, custom_document_type FROM documents_approved WHERE submission_id = :id"
    );
    $approvedSnapshotStmt->execute([':id' => (int)$revision['submission_id']]);
    $approvedSnapshot = $approvedSnapshotStmt->fetch();
    $assert(($approvedSnapshot['document_type'] ?? '') === 'Others', 'The approved snapshot lost the Others category.');
    $assert(($approvedSnapshot['custom_document_type'] ?? '') === 'Compliance Matrix', 'The approved snapshot lost the custom document type.');

    $repoUpdateBlocked = false;
    try {
        $stmt = $pdo->prepare("UPDATE documents_approved SET title = 'Changed snapshot' WHERE submission_id = :id");
        $stmt->execute([':id' => (int)$revision['submission_id']]);
    } catch (PDOException $e) {
        $repoUpdateBlocked = true;
    }
    $assert($repoUpdateBlocked, 'The database allowed an approved snapshot to be overwritten.');

    $cancelCandidate = docCreateSubmission($pdo, (int)$fixture['org_id'], (int)$fixture['submitted_by_user_id'], [
        'title' => 'Cancellation test document',
        'document_type' => 'Activity Report',
        'recipient' => 'OSA',
        'storage_key' => (string)$fixture['file_url'],
    ]);
    $cancelled = docCancelSubmission(
        $pdo, (int)$cancelCandidate['submission_id'], (int)$fixture['org_id'], (int)$fixture['submitted_by_user_id']
    );
    $assert($cancelled['status'] === 'cancelled', 'Pending document cancellation was not persisted.');
    $assert(
        docResolveSubmissionAccess($pdo, (int)$cancelCandidate['submission_id'], [
            'login_role' => 'org',
            'active_org_id' => (int)$fixture['org_id'],
        ]) !== null,
        'The submitting organization lost access to its cancelled document.'
    );
    $assert(
        docResolveSubmissionAccess($pdo, (int)$cancelCandidate['submission_id'], [
            'login_role' => 'org',
            'active_org_id' => (int)$sscFixture['org_id'],
        ]) === null,
        'SSC retained recipient-side access to a cancelled document.'
    );
    $ownerVisibleIds = array_column(docListSubmissions($pdo, [], (int)$fixture['org_id']), 'submission_id');
    $sscVisibleIds = array_column(docListSubmissions($pdo, [], (int)$sscFixture['org_id']), 'submission_id');
    $assert(in_array((int)$cancelCandidate['submission_id'], $ownerVisibleIds, true), 'Cancelled document was hidden from its sender list.');
    $assert(!in_array((int)$cancelCandidate['submission_id'], $sscVisibleIds, true), 'Cancelled document remained in the SSC recipient list.');
    $cancelReviewBlocked = false;
    try {
        docReviewSubmission(
            $pdo, (int)$cancelCandidate['submission_id'], (int)$fixture['reviewer_id'],
            'approved', null, 'ADVISER', null, 'ADVISER', (int)$fixture['org_id']
        );
    } catch (DocumentValidationException $e) {
        $cancelReviewBlocked = true;
    }
    $assert($cancelReviewBlocked, 'A cancelled document still accepted a reviewer decision.');

    $forwardCancelCandidate = docCreateSubmission($pdo, (int)$fixture['org_id'], (int)$fixture['submitted_by_user_id'], [
        'title' => 'Forwarded cancellation test document',
        'document_type' => 'Financial Statement',
        'storage_key' => (string)$fixture['file_url'],
    ]);
    docReviewSubmission(
        $pdo, (int)$forwardCancelCandidate['submission_id'], (int)$fixture['reviewer_id'],
        'approved', null, 'ADVISER', null, 'ADVISER', (int)$fixture['org_id']
    );
    docForwardSubmissionToSsc(
        $pdo, (int)$forwardCancelCandidate['submission_id'], (int)$fixture['org_id'], (int)$fixture['submitted_by_user_id']
    );
    docReviewSubmission(
        $pdo, (int)$forwardCancelCandidate['submission_id'], (int)$sscFixture['reviewer_id'],
        'approved', null, 'SSC', (int)$sscFixture['org_id'], 'SSC'
    );
    docForwardSubmissionToOsa(
        $pdo, (int)$forwardCancelCandidate['submission_id'], (int)$fixture['org_id'], (int)$fixture['submitted_by_user_id']
    );
    $forwardCancelled = docCancelSubmission(
        $pdo, (int)$forwardCancelCandidate['submission_id'], (int)$fixture['org_id'], (int)$fixture['submitted_by_user_id']
    );
    $assert($forwardCancelled['status'] === 'cancelled', 'A document awaiting OSA review could not be cancelled.');
    $assert(
        docResolveSubmissionAccess($pdo, (int)$forwardCancelCandidate['submission_id'], ['login_role' => 'osa']) === null,
        'OSA retained recipient-side access to a cancelled document.'
    );
    $osaVisibleIds = array_column(docListOsaRequestOverview($pdo, ['recipient' => 'OSA']), 'submission_id');
    $assert(!in_array((int)$forwardCancelCandidate['submission_id'], $osaVisibleIds, true), 'Cancelled document remained in the OSA recipient list.');
    $forwardCancelledReviewBlocked = false;
    try {
        docReviewSubmission(
            $pdo, (int)$forwardCancelCandidate['submission_id'], (int)$fixture['reviewer_id'],
            'approved', null, 'OSA', null, 'OSA'
        );
    } catch (DocumentValidationException $e) {
        $forwardCancelledReviewBlocked = true;
    }
    $assert($forwardCancelledReviewBlocked, 'OSA reviewed a document after its organization cancelled it.');

    $sscDirect = docCreateSubmission($pdo, (int)$sscFixture['org_id'], (int)$sscFixture['reviewer_id'], [
        'title' => 'SSC direct-to-OSA test document',
        'document_type' => 'Resolution',
        'recipient' => 'SSC',
        'storage_key' => (string)$fixture['file_url'],
    ]);
    $assert($sscDirect['recipient'] === 'ADVISER', 'An SSC-originated document bypassed its adviser.');
    $sscAdviserApproved = docReviewSubmission(
        $pdo, (int)$sscDirect['submission_id'], (int)$sscFixture['reviewer_id'],
        'approved', 'Approved by SSC adviser.', 'ADVISER', null, 'ADVISER', (int)$sscFixture['org_id']
    );
    $assert($sscAdviserApproved['status'] === 'adviser_approved', 'SSC adviser approval did not unlock forwarding.');
    docForwardSubmissionToOsa(
        $pdo, (int)$sscDirect['submission_id'], (int)$sscFixture['org_id'], (int)$sscFixture['reviewer_id']
    );
    $sscDirectApproved = docReviewSubmission(
        $pdo, (int)$sscDirect['submission_id'], (int)$fixture['reviewer_id'],
        'approved', 'Direct OSA approval.', 'OSA', null, 'OSA'
    );
    $assert($sscDirectApproved['status'] === 'approved', 'SSC direct-to-OSA submission did not receive final approval.');
    $assert(
        $sscDirectApproved['adviser_decision'] === 'approved'
        && $sscDirectApproved['ssc_decision'] === null
        && $sscDirectApproved['osa_decision'] === 'approved',
        'SSC direct submission recorded the wrong review stages.'
    );

    $pdo->rollBack();
    echo "PASS: hierarchical adviser-to-SSC-to-OSA decisions, cancellation, immutable snapshots, and linked revisions are enforced.\n";
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR, 'FAIL: ' . $e->getMessage() . "\n");
    exit(1);
}
