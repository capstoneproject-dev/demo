<?php
declare(strict_types=1);

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/system_settings.php';
require_once __DIR__ . '/../advisers/roster.php';
require_once __DIR__ . '/../officers/roster.php';
require_once __DIR__ . '/roster.php';

header('Content-Type: application/json');
$session = apiRequireOsaSystemAdministrator();
requirePost();

try {
    $body = getRequestBody();
    $action = strtolower(trim((string)($body['action'] ?? 'preview')));
    if (!in_array($action, ['preview', 'apply'], true)) jsonError('action must be preview or apply.', 422);
    if ($action === 'apply') apiRequireRecentReauthentication();
    $rows = $body['records'] ?? [];
    $officers = $body['officers'] ?? [];
    $advisers = $body['advisers'] ?? [];
    $advisersPresent = ($body['advisersPresent'] ?? false) === true;
    if (!is_array($rows) || !is_array($officers) || !is_array($advisers) || (!$rows && !$advisersPresent)) {
        jsonError('The workbook must contain account or adviser rows.', 422);
    }
    if (!$advisersPresent && $advisers) jsonError('Advisers sheet indicator is missing.', 422);
    $pdo = getPdo();
    $academicYear = settingsGetActiveAcademicTerm($pdo)['academic_year'];
    $validation = accountRosterValidateRecords($pdo, $rows);
    if ($validation['errors']) jsonError("Account roster validation failed:\n" . implode("\n", array_slice($validation['errors'], 0, 20)), 422);
    $preview = $rows ? accountRosterBuildPreview($pdo, $validation['records']) : [
        'summary' => [], 'changes' => ['deactivated' => []],
    ];
    $adviserRecords = validateAdviserRows($pdo, $advisers);
    $adviserChanges = $advisersPresent ? adviserChangePreview($pdo, $adviserRecords) : ['new' => [], 'updated' => [], 'reactivated' => [], 'unchanged' => []];
    $adviserOmissions = $advisersPresent ? adviserOmissions($pdo, $adviserRecords) : ['accounts' => [], 'memberships' => []];
    $officerRecords = validateOfficerWorkbook($pdo, $officers);
    $officerChanges = officerChangePreview($pdo, $officerRecords);

    if ($action === 'preview') jsonOk([
        'academicYear' => $academicYear,
        'summary' => $preview['summary'], 'changes' => $preview['changes'],
        'officerImportCount' => count($officerRecords), 'officerChanges' => $officerChanges,
        'adviserOmissions' => $adviserOmissions, 'adviserChanges' => $adviserChanges,
    ]);
    if (($body['confirmedAcademicYear'] ?? '') !== $academicYear) {
        jsonError('The active academic year changed after preview. Please preview again.', 409);
    }
    $pdo->beginTransaction();
    try {
        accountRosterApply($pdo, $validation['records'], $preview);
        applyAdviserRows($pdo, $adviserRecords);
        if ($advisersPresent) deactivateOmittedAdvisers($pdo, $adviserOmissions);
        $officerResult = applyOfficerWorkbook($pdo, $officerRecords);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    jsonOk(['academicYear' => $academicYear, 'summary' => $preview['summary'],
        'officers' => $officerResult, 'msg' => 'Registered student accounts updated.']);
} catch (InvalidArgumentException $e) {
    jsonError($e->getMessage(), 422);
} catch (PDOException $e) {
    error_log('[student-account-import] ' . $e->getMessage());
    jsonError('The account roster could not be applied. No account changes were saved.', 500);
} catch (Throwable $e) {
    error_log('[student-account-import] ' . $e->getMessage());
    jsonError('The account roster could not be applied.', 400);
}
