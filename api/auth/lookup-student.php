<?php
/**
 * POST /api/auth/lookup-student.php
 *
 * Public endpoint used by organization registration to verify that the
 * student number belongs to an active student account.
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/functions.php';

header('Content-Type: application/json');

requirePost();

$body = getRequestBody();
$studentNumber = trim((string)($body['student_number'] ?? $body['studentNumber'] ?? ''));

if ($studentNumber === '') {
    jsonError('Student number is required.', 422);
}

try {
    $user = findStudentUserByStudentNumber($studentNumber);

    if (!$user) {
        jsonError('Student number is not registered as an active student account.', 404);
    }

    $memberStmt = getPdo()->prepare("SELECT membership_id FROM organization_members WHERE user_id = :uid LIMIT 1");
    $memberStmt->execute([':uid' => (int)$user['user_id']]);
    if ($memberStmt->fetch()) {
        jsonError('This account already exists in the organization members table.', 409);
    }

    jsonOk([
        'student' => [
            'student_number' => (string)($user['student_number'] ?? ''),
            'full_name'      => trim((string)($user['first_name'] ?? '') . ' ' . (string)($user['last_name'] ?? '')),
            'course'         => (string)($user['program_code'] ?? ''),
            'section'        => (string)($user['student_numbers_year_section'] ?? ''),
            'email'          => (string)($user['email'] ?? ''),
            'phone'          => (string)($user['phone'] ?? ''),
        ],
    ]);
} catch (PDOException $e) {
    error_log('[api/auth/lookup-student] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
}
