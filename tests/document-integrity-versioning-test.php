<?php

ini_set('session.save_path', __DIR__ . '/../storage/private');
require_once __DIR__ . '/../includes/documents.php';

$pdo = getPdo();
$fixture = $pdo->query(
    "SELECT ds.org_id, ds.submitted_by_user_id, ds.file_url,
            COALESCE(ds.reviewed_by_user_id, ds.submitted_by_user_id) AS reviewer_id
     FROM document_submissions ds
     WHERE ds.file_url IS NOT NULL AND ds.file_url <> ''
     ORDER BY ds.submission_id
     LIMIT 1"
)->fetch();

if (!$fixture || !privatePdfResolveStoredFile((string)$fixture['file_url'], ['documents'])) {
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
        'document_type' => 'Activity Report',
        'recipient' => 'OSA',
        'description' => 'Rolled back automatically after the test.',
        'storage_key' => (string)$fixture['file_url'],
    ]);
    $assert($pdo->inTransaction(), 'Transaction ended while creating the root submission.');
    $assert($root['version_number'] === 1, 'A new submission must start at version 1.');

    $rejected = docReviewSubmission($pdo, (int)$root['submission_id'], (int)$fixture['reviewer_id'], 'rejected', 'Please revise.');
    $assert($pdo->inTransaction(), 'Transaction ended while rejecting the root submission.');
    $assert($rejected['status'] === 'rejected', 'The first decision was not recorded.');

    $secondDecisionBlocked = false;
    try {
        docReviewSubmission($pdo, (int)$root['submission_id'], (int)$fixture['reviewer_id'], 'approved', 'Changed decision');
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

    $approved = docReviewSubmission($pdo, (int)$revision['submission_id'], (int)$fixture['reviewer_id'], 'approved', 'Approved revision.');
    $assert($pdo->inTransaction(), 'Transaction ended while approving the revision.');
    $assert($approved['status'] === 'approved', 'The revised submission was not approved.');

    $repoUpdateBlocked = false;
    try {
        $stmt = $pdo->prepare("UPDATE documents_approved SET title = 'Changed snapshot' WHERE submission_id = :id");
        $stmt->execute([':id' => (int)$revision['submission_id']]);
    } catch (PDOException $e) {
        $repoUpdateBlocked = true;
    }
    $assert($repoUpdateBlocked, 'The database allowed an approved snapshot to be overwritten.');

    $pdo->rollBack();
    echo "PASS: one-time decisions, immutable snapshots, and linked revisions are enforced.\n";
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR, 'FAIL: ' . $e->getMessage() . "\n");
    exit(1);
}
