<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';

const ACADEMIC_TERM_DEFAULTS = [
    'academic_year' => '2026-2027',
    'semester' => '1st',
    'grading_period' => 'prelim',
];

function settingsEnsureTable(PDO $pdo): void
{
    static $ensured = false;
    if ($ensured) {
        return;
    }

    // Academic-term feature boundary: remove this table/seed block to revert global term settings.
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS system_settings (
            setting_key VARCHAR(100) PRIMARY KEY,
            setting_value VARCHAR(255) NOT NULL,
            updated_by_user_id INT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $stmt = $pdo->prepare("
        INSERT IGNORE INTO system_settings (setting_key, setting_value)
        VALUES (:setting_key, :setting_value)
    ");

    $seedRows = [
        'active_academic_year' => ACADEMIC_TERM_DEFAULTS['academic_year'],
        'active_semester' => ACADEMIC_TERM_DEFAULTS['semester'],
        'active_grading_period' => ACADEMIC_TERM_DEFAULTS['grading_period'],
    ];

    foreach ($seedRows as $key => $value) {
        $stmt->execute([
            ':setting_key' => $key,
            ':setting_value' => $value,
        ]);
    }

    $ensured = true;
}

function settingsValidateAcademicYear(?string $academicYear): string
{
    $value = trim((string)$academicYear);
    if (!preg_match('/^\d{4}-\d{4}$/', $value)) {
        throw new InvalidArgumentException('academic_year must use YYYY-YYYY format.');
    }

    [$start, $end] = array_map('intval', explode('-', $value));
    if ($end !== $start + 1) {
        throw new InvalidArgumentException('academic_year must cover one school year.');
    }

    return $value;
}

function settingsValidateSemester(?string $semester): string
{
    $value = trim((string)$semester);
    if (!in_array($value, ['1st', '2nd'], true)) {
        throw new InvalidArgumentException('semester must be 1st or 2nd.');
    }

    return $value;
}

function settingsValidateGradingPeriod(?string $gradingPeriod): string
{
    $value = strtolower(trim((string)$gradingPeriod));
    if (!in_array($value, ['prelim', 'midterm', 'finals'], true)) {
        throw new InvalidArgumentException('grading_period must be prelim, midterm, or finals.');
    }

    return $value;
}

function settingsGetActiveAcademicTerm(PDO $pdo): array
{
    settingsEnsureTable($pdo);

    $stmt = $pdo->prepare("
        SELECT setting_key, setting_value
        FROM system_settings
        WHERE setting_key IN ('active_academic_year', 'active_semester', 'active_grading_period')
    ");
    $stmt->execute();

    $settings = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $settings[$row['setting_key']] = $row['setting_value'];
    }

    return [
        'academic_year' => settingsValidateAcademicYear($settings['active_academic_year'] ?? ACADEMIC_TERM_DEFAULTS['academic_year']),
        'semester' => settingsValidateSemester($settings['active_semester'] ?? ACADEMIC_TERM_DEFAULTS['semester']),
        'grading_period' => settingsValidateGradingPeriod($settings['active_grading_period'] ?? ACADEMIC_TERM_DEFAULTS['grading_period']),
    ];
}

function settingsUpdateActiveAcademicTerm(PDO $pdo, array $term, ?int $userId): array
{
    settingsEnsureTable($pdo);

    $values = [
        'active_academic_year' => settingsValidateAcademicYear($term['academic_year'] ?? null),
        'active_semester' => settingsValidateSemester($term['semester'] ?? null),
        'active_grading_period' => settingsValidateGradingPeriod($term['grading_period'] ?? null),
    ];

    $stmt = $pdo->prepare("
        INSERT INTO system_settings (setting_key, setting_value, updated_by_user_id)
        VALUES (:setting_key, :setting_value, :updated_by_user_id)
        ON DUPLICATE KEY UPDATE
            setting_value = VALUES(setting_value),
            updated_by_user_id = VALUES(updated_by_user_id)
    ");

    foreach ($values as $key => $value) {
        $stmt->execute([
            ':setting_key' => $key,
            ':setting_value' => $value,
            ':updated_by_user_id' => $userId,
        ]);
    }

    return settingsGetActiveAcademicTerm($pdo);
}
