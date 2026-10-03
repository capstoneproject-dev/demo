<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$argv[1] = 'extra'; require __DIR__ . '/database-features.php';
if (!preg_match('/^capstone_disposable_[a-f0-9]{12}$/D', DB_NAME)) throw new RuntimeException('Disposable database required.');
$start = count($manifest['results']);
login('osa');
ok('osa', 'api/auth/reauthenticate.php', ['current_password' => $manifest['password']]);
group('Student account edits, roster CRUD/import and officer membership CRUD', function () use ($pdo, &$manifest) {
    $program = $pdo->query('SELECT ap.program_id, ap.program_code, ap.institute_id, i.institute_name FROM academic_programs ap JOIN institutes i ON i.institute_id = ap.institute_id LIMIT 1')->fetch();
    $before = $pdo->query('SELECT * FROM student_numbers ORDER BY sn_id')->fetchAll();
    ok('osa', 'api/accounts/students/save.php', ['userId' => $manifest['users']['student']['id'], 'studentId' => $manifest['users']['student']['identifier'], 'studentName' => 'Feature Student', 'programCode' => $program['program_code'], 'institute' => $program['institute_name'], 'yearSection' => '4-1', 'email' => $manifest['token'] . 'student@example.invalid']);
    record('Student account save leaves eligibility roster unchanged', $before === $pdo->query('SELECT * FROM student_numbers ORDER BY sn_id')->fetchAll());
    $number = $manifest['token'] . 'RN';
    $payload = ['studentId' => $number, 'studentName' => 'Fixture Roster', 'programCode' => $program['program_code'], 'institute' => $program['institute_name'], 'yearSection' => '2-1', 'isActive' => true];
    ok('osa', 'api/accounts/student-numbers/save.php', $payload);
    ok('osa', 'api/accounts/student-numbers/save.php', ['origStudentId' => $number, 'yearSection' => '3-1'] + $payload);
    $users = $pdo->prepare('SELECT COUNT(*) FROM users WHERE student_number = ?'); $users->execute([$number]);
    record('Eligibility roster save does not create login accounts', (int)$users->fetchColumn() === 0);
    $preview = ok('osa', 'api/accounts/student-numbers/import.php', ['action' => 'preview', 'records' => [$payload]]);
    ok('osa', 'api/accounts/student-numbers/import.php', ['action' => 'apply', 'records' => [$payload], 'confirmedAcademicYear' => $preview['academicYear']]);
    ok('osa', 'api/accounts/student-numbers/delete.php', ['studentId' => $number]);
    $pdo->prepare("INSERT INTO users (student_number, first_name, last_name, email, password_hash, account_type, is_active) VALUES (?, 'Feature', 'Disposable', ?, ?, 'student', 1)")->execute([$manifest['token'] . 'DEL', $manifest['token'] . 'delete@example.invalid', password_hash($manifest['password'], PASSWORD_BCRYPT)]);
    $uid = (int)$pdo->lastInsertId();
    $membershipPayload = ['studentId' => $manifest['token'] . 'DEL', 'orgCode' => $manifest['token'], 'roleName' => 'officer', 'positionTitle' => 'Fixture member', 'joinedAt' => '2026-10-03', 'isActive' => true];
    ok('osa', 'api/accounts/officers/save.php', $membershipPayload);
    $query = $pdo->prepare('SELECT membership_id FROM organization_members WHERE user_id = ? AND org_id = ?'); $query->execute([$uid, $manifest['org']]); $membership = (int)$query->fetchColumn();
    ok('osa', 'api/accounts/officers/save.php', ['id' => $membership, 'positionTitle' => 'Fixture updated'] + $membershipPayload);
    ok('osa', 'api/accounts/officers/delete.php', ['id' => $membership]);
    ok('osa', 'api/accounts/students/delete.php', ['userId' => $uid]);
    $query = $pdo->prepare('SELECT COUNT(*) FROM users WHERE user_id = ?'); $query->execute([$uid]);
    record('Unused disposable student account deleted', (int)$query->fetchColumn() === 0);
});
group('OSA invitations preserve failed delivery and support resend/revoke', function () use ($pdo, &$manifest) {
    // SMTP points to a closed localhost port: explicitly verify the failure path.
    $employee = $manifest['token'] . 'INV'; $email = $employee . '@example.invalid';
    $response = request('osa', 'api/osa/staff/invite.php', ['email' => $email, 'employee_number' => $employee]);
    record('SMTP failure returns recoverable invitation status', $response['status'] === 503);
    if ($response['status'] !== 503) throw new RuntimeException('Unexpected invitation response.');
    $query = $pdo->prepare('SELECT * FROM osa_staff_invitations WHERE employee_number = ?'); $query->execute([$employee]); $invite = $query->fetch();
    record('Failed invitation retained with delivery status', $invite && $invite['status'] === 'pending' && $invite['delivery_status'] === 'failed');
    $response = request('osa', 'api/osa/staff/invitations/resend.php', ['invitation_id' => $invite['invitation_id']]);
    record('SMTP resend failure remains recoverable', $response['status'] === 503);
    $query->execute([$employee]); $resent = $query->fetch();
    record('Resend rotates invitation token', $resent['token_hash'] !== $invite['token_hash']);
    ok('osa', 'api/osa/staff/invitations/revoke.php', ['invitation_id' => $invite['invitation_id']]);
    $query->execute([$employee]); record('Invitation revoked in database', $query->fetch()['status'] === 'revoked');
});
$results = array_slice($manifest['results'], $start);
$failed = count(array_filter($results, fn($result) => !$result['passed']));
$manifest['admin_summary'] = ['checks' => count($results), 'failed' => $failed]; saveManifest();
echo 'Administration results: ' . count($results) . ' checks, ' . $failed . " failed.\n";
exit($failed ? 1 : 0);
