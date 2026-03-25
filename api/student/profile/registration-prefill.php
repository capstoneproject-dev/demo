<?php
require_once __DIR__ . '/../../../includes/auth.php';

header('Content-Type: application/json');
apiGuard();

try {
    $session = getPhpSession();
    $userId = (int)($session['user_id'] ?? 0);
    if ($userId <= 0) {
        jsonError('Invalid user session.', 401);
    }

    $stmt = getPdo()->prepare(
        "SELECT u.first_name,
                u.last_name,
                u.student_number,
                u.program_id,
                sn.year_section
         FROM users u
         LEFT JOIN student_numbers sn ON sn.student_number = u.student_number
         WHERE u.user_id = :uid
         LIMIT 1"
    );
    $stmt->execute([':uid' => $userId]);
    $row = $stmt->fetch();
    if (!$row) {
        jsonError('Student profile not found.', 404);
    }

    $fullName = trim((string)($row['first_name'] ?? '') . ' ' . (string)($row['last_name'] ?? ''));
    $yearSection = trim((string)($row['year_section'] ?? ''));
    $year = '';
    $section = '';

    if ($yearSection !== '' && preg_match('/^\s*(\d+)\s*([A-Za-z].*)?$/', $yearSection, $matches)) {
        $year = trim((string)($matches[1] ?? ''));
        $section = trim((string)($matches[2] ?? ''));
    }

    if ($section === '') {
        $section = $yearSection;
    }

    jsonOk([
        'item' => [
            'full_name' => $fullName,
            'student_number' => trim((string)($row['student_number'] ?? '')),
            'program_id' => isset($row['program_id']) ? (int)$row['program_id'] : null,
            'year' => $year,
            'section' => $section,
            'year_section' => trim(($year !== '' ? $year : '') . ($section !== '' ? $section : '')),
        ],
    ]);
} catch (PDOException $e) {
    error_log('[api/student/profile/registration-prefill] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
