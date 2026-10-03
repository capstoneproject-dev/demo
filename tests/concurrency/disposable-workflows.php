<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$argv[1] = 'extra';
require __DIR__ . '/database-features.php';
if (!preg_match('/^capstone_disposable_[a-f0-9]{12}$/D', DB_NAME)
    || !str_starts_with((string)getenv('FEATURE_TEST_BASE_URL'), 'http://127.0.0.1:8941/')) {
    throw new RuntimeException('Isolated database and test server required.');
}
$manifest['extra_results_start'] = count($manifest['results']); saveManifest();
function expectStatus(string $role, string $route, array|null $payload, int $status, string $label): array {
    $response = request($role, $route, $payload);
    record($label, $response['status'] === $status, 'HTTP ' . $response['status']);
    if ($response['status'] !== $status) throw new RuntimeException($label . ': ' . ($response['json']['error'] ?? 'Unexpected response'));
    return $response['json'] ?? [];
}
function documentCreate(array $extra = []): int {
    global $manifest;
    $upload = ok('officer', 'api/documents/upload.php', ['file' => new CURLFile($manifest['pdf'], 'application/pdf', 'fixture.pdf')], true);
    $doc = ok('officer', 'api/documents/submit.php', $extra + ['upload_token' => $upload['upload_token'], 'title' => $manifest['token'] . ' extra', 'document_type' => 'Others', 'custom_document_type' => 'Fixture']);
    return (int)$doc['item']['submission_id'];
}
function switchOrg(int $id): void { ok('officer', 'api/auth/activate-org.php', ['org_id' => $id]); }
foreach (array_keys($manifest['users']) as $role) login($role);

group('Document full review chain, PDF permissions, annotations', function () use (&$manifest, $pdo) {
    $statement = $pdo->prepare("SELECT submission_id FROM document_submissions WHERE org_id = ? AND recipient = 'SSC' AND status = 'pending' ORDER BY submission_id DESC LIMIT 1");
    $statement->execute([$manifest['org']]); $id = (int)$statement->fetchColumn();
    if (empty($manifest['ssc'])) throw new RuntimeException('Expected SSC membership.');
    if (!$id) {
        $id = documentCreate();
        ok('adviser', 'api/documents/review.php', ['submission_id' => $id, 'decision' => 'approved', 'notes' => 'Fixture approval']);
        ok('officer', 'api/documents/forward-to-ssc.php', ['submission_id' => $id]);
    }
    switchOrg((int)$manifest['ssc']);
    ok('officer', 'api/documents/review.php', ['submission_id' => $id, 'decision' => 'approved', 'notes' => 'SSC test approval']);
    switchOrg((int)$manifest['org']);
    ok('officer', 'api/documents/forward-to-osa.php', ['submission_id' => $id]);
    ok('osa', 'api/documents/review.php', ['submission_id' => $id, 'decision' => 'approved', 'notes' => 'OSA test approval']);
    expectStatus('osa', 'api/documents/review.php', ['submission_id' => $id, 'decision' => 'approved'], 422, 'Finalized document rejects repeated decision');
    foreach (['officer', 'osa', 'adviser'] as $role) {
        $response = request($role, 'api/documents/download.php?submission_id=' . $id);
        record($role . ' authorized PDF preview', $response['status'] === 200 && str_starts_with((string)$response['body'], '%PDF-'));
    }
    expectStatus('student', 'api/documents/download.php?submission_id=' . $id, null, 403, 'Student cannot preview protected organization document');
    expectStatus('adviser', 'api/documents/download.php?submission_id=' . $id . '&download=1', null, 403, 'Adviser cannot download organization document');
    $annotation = ok('osa', 'api/documents/annotations/create.php', ['submission_id' => $id, 'page' => 1, 'text' => 'Fixture selection', 'rects' => [['x' => 10, 'y' => 10, 'width' => 20, 'height' => 5]], 'comment' => 'Fixture annotation']);
    ok('osa', 'api/documents/annotations/list.php?submission_id=' . $id);
    ok('osa', 'api/documents/annotations/delete.php', ['annotation_id' => $annotation['item']['annotation_id']]);
    record('All three document decision stages saved', (int)$pdo->query('SELECT COUNT(*) FROM document_decisions WHERE submission_id = ' . $id)->fetchColumn() === 3);
    $manifest['approved_doc'] = $id; saveManifest();
});
group('Document rejection, revision, cancellation', function () use (&$manifest, $pdo) {
    switchOrg((int)$manifest['org']);
    $id = documentCreate();
    ok('adviser', 'api/documents/review.php', ['submission_id' => $id, 'decision' => 'rejected', 'notes' => 'Fixture needs correction']);
    $revision = documentCreate(['revision_of_submission_id' => $id]);
    record('Document revision increments version', (int)$pdo->query('SELECT version_number FROM document_versions WHERE submission_id = ' . $revision)->fetchColumn() === 2);
    ok('officer', 'api/documents/cancel.php', ['submission_id' => $revision]);
});
group('Printing acceptance, status, unpaid and paid history', function () use (&$manifest, $pdo) {
    switchOrg((int)$manifest['org']);
    $job = ok('student', 'api/printing/student/submit.php', ['file' => new CURLFile($manifest['pdf'], 'application/pdf', 'fixture.pdf')], true);
    $id = (int)$job['items'][0]['print_job_id'];
    ok('officer', 'api/printing/officer/accept.php', ['print_job_id' => $id]);
    expectStatus('officer', 'api/printing/officer/accept.php', ['print_job_id' => $id], 409, 'Duplicate printing acceptance rejected');
    ok('officer', 'api/printing/officer/update-status.php', ['print_job_id' => $id, 'status' => 'processing']);
    ok('officer', 'api/printing/officer/update-status.php', ['print_job_id' => $id, 'status' => 'ready_to_claim']);
    ok('officer', 'api/printing/officer/update-status.php', ['print_job_id' => $id, 'status' => 'claimed', 'total_cost' => 25, 'payment_status' => 'unpaid']);
    ok('officer', 'api/printing/officer/mark-paid.php', ['print_job_id' => $id, 'officer_identifier' => $manifest['users']['officer']['identifier']]);
    $job = $pdo->query('SELECT status, payment_status FROM print_jobs WHERE print_job_id = ' . $id)->fetch();
    record('Printing claimed and paid persisted', $job['status'] === 'claimed' && $job['payment_status'] === 'paid');
});
group('Locker request, approve, notice, release, reject, manual assignment', function () use (&$manifest, $pdo) {
    switchOrg((int)$manifest['ssc']);
    $statement = $pdo->prepare("SELECT item_id FROM inventory_items WHERE org_id = ? AND item_name = 'Z99'");
    $statement->execute([$manifest['ssc']]); $id = (int)$statement->fetchColumn();
    if (!$id) {
        ok('officer', 'api/lockers/officer/add.php', ['locker_code' => 'Z99']);
        $statement->execute([$manifest['ssc']]); $id = (int)$statement->fetchColumn();
    }
    $active = $pdo->prepare("SELECT rental_id FROM rentals WHERE renter_user_id = ? AND service_kind = 'locker' AND status = 'locker_active'");
    $active->execute([$manifest['users']['student']['id']]);
    foreach ($active->fetchAll(PDO::FETCH_COLUMN) as $oldId) ok('officer', 'api/lockers/officer/release.php', ['rental_id' => $oldId]);
    ok('officer', 'api/lockers/officer/pricing.php', ['item_id' => $id, 'locker_monthly_rate' => 100, 'locker_semester_rate' => 500, 'locker_school_year_rate' => 900]);
    $dates = ['period_type' => 'monthly', 'period_quantity' => 1, 'start_date' => (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d')];
    $request = ok('student', 'api/lockers/student/request.php', ['item_id' => $id] + $dates);
    $rid = (int)$request['current_locker']['rental_id'];
    expectStatus('student', 'api/lockers/student/request.php', ['item_id' => $id] + $dates, 409, 'Duplicate locker request rejected');
    ok('officer', 'api/lockers/officer/approve.php', ['rental_id' => $rid] + $dates);
    expectStatus('officer', 'api/lockers/officer/notice.php', ['rental_id' => $rid, 'notice_type' => 'upcoming', 'message' => 'Fixture upcoming notice'], 400, 'Upcoming notice blocked outside seven-day window');
    // Advance this disposable rental to the notice window without waiting a month.
    $pdo->prepare('UPDATE rentals SET expected_return_time = DATE_ADD(NOW(), INTERVAL 5 DAY) WHERE rental_id = ?')->execute([$rid]);
    ok('officer', 'api/lockers/officer/notice.php', ['rental_id' => $rid, 'notice_type' => 'upcoming', 'message' => 'Fixture upcoming notice']);
    ok('officer', 'api/lockers/officer/clear-notice.php', ['rental_id' => $rid]);
    ok('officer', 'api/lockers/officer/release.php', ['rental_id' => $rid]);
    $request = ok('student', 'api/lockers/student/request.php', ['item_id' => $id] + $dates);
    ok('officer', 'api/lockers/officer/reject.php', ['rental_id' => $request['current_locker']['rental_id']]);
    ok('officer', 'api/lockers/officer/manual-assign.php', ['item_id' => $id, 'student_user_id' => $manifest['users']['student']['id']] + $dates);
    $request = ok('student', 'api/lockers/student/list.php');
    ok('officer', 'api/lockers/officer/release.php', ['rental_id' => $request['current_locker']['rental_id']]);
    record('Released locker is available', $pdo->query('SELECT status FROM inventory_items WHERE item_id = ' . $id)->fetchColumn() === 'available');
    switchOrg((int)$manifest['org']);
});
group('Offline HTTP announcement dispatch and exact replay', function () use (&$manifest, $pdo) {
    switchOrg((int)$manifest['org']);
    $uuid = sprintf('%s-%s-4%s-8%s-%s', bin2hex(random_bytes(4)), bin2hex(random_bytes(2)), bin2hex(random_bytes(2))[0] . bin2hex(random_bytes(1)), bin2hex(random_bytes(2))[0] . bin2hex(random_bytes(1)), bin2hex(random_bytes(6)));
    $envelope = ['operation_id' => $uuid, 'operation_type' => 'announcement.create', 'created_at' => gmdate('Y-m-d\TH:i:s\Z'), 'payload' => ['title' => $manifest['token'] . ' offline ' . $uuid, 'content' => 'Fixture offline content', 'publish' => 0]];
    $first = ok('officer', 'api/offline/sync.php', $envelope);
    $replay = ok('officer', 'api/offline/sync.php', $envelope);
    $query = $pdo->prepare('SELECT COUNT(*) FROM announcements WHERE title = ?'); $query->execute([$envelope['payload']['title']]);
    record('Offline replay creates exactly one announcement', (int)$query->fetchColumn() === 1 && $first['operation_id'] === $replay['operation_id']);
});
group('Profile updates, password and reauthentication', function () use (&$manifest) {
    foreach (['student', 'officer', 'osa'] as $role) {
        ok($role, 'api/' . $role . '/profile/update.php', ['full_name' => 'Feature ' . $role, 'email' => $manifest['token'] . $role . '@example.invalid', 'phone' => '+63 9000000000']);
        ok($role, 'api/auth/reauthenticate.php', ['current_password' => $manifest['password']]);
        $temporaryPassword = 'FeatureTest9-' . bin2hex(random_bytes(8));
        ok($role, 'api/' . $role . '/profile/update-password.php', ['current_password' => $manifest['password'], 'new_password' => $temporaryPassword, 'confirm_password' => $temporaryPassword]);
        ok($role, 'api/' . $role . '/profile/update-password.php', ['current_password' => $temporaryPassword, 'new_password' => 'RestoreTest9-' . $manifest['password'], 'confirm_password' => 'RestoreTest9-' . $manifest['password']]);
        // Restore the original random fixture password for subsequent login checks.
        global $pdo;
        $pdo->prepare('UPDATE users SET password_hash = ? WHERE user_id = ?')->execute([password_hash($manifest['password'], PASSWORD_BCRYPT), $manifest['users'][$role]['id']]);
    }
});
group('Offline multipart upload dispatch and replay', function () use (&$manifest, $pdo) {
    switchOrg((int)$manifest['org']);
    foreach (['student.printing.submit', 'document.submit', 'inventory.save'] as $type) {
        $uuid = 'a' . bin2hex(random_bytes(3)) . '1-' . bin2hex(random_bytes(2)) . '-4' . bin2hex(random_bytes(1)) . '1-8' . bin2hex(random_bytes(1)) . '1-' . bin2hex(random_bytes(6));
        $role = $type === 'student.printing.submit' ? 'student' : 'officer';
        $payload = match ($type) {
            'student.printing.submit' => ['org_id' => $manifest['org'], 'notes' => ['Offline fixture']],
            'document.submit' => ['title' => $manifest['token'] . ' offline PDF', 'document_type' => 'Others', 'custom_document_type' => 'Fixture'],
            'inventory.save' => ['item_name' => $manifest['token'] . substr($uuid, 0, 8), 'barcode' => $manifest['token'] . substr($uuid, 0, 8), 'category_id' => $manifest['category'], 'hourly_rate' => 10, 'status' => 'available'],
        };
        $form = ['operation_id' => $uuid, 'operation_type' => $type, 'created_at' => gmdate('Y-m-d\TH:i:s\Z'), 'payload' => json_encode($payload, JSON_THROW_ON_ERROR)];
        $form[$type === 'inventory.save' ? 'image' : 'file'] = $type === 'inventory.save' ? new CURLFile($manifest['png'], 'image/png', 'fixture.png') : new CURLFile($manifest['pdf'], 'application/pdf', 'fixture.pdf');
        $first = ok($role, 'api/offline/sync-upload.php', $form, true);
        $replay = ok($role, 'api/offline/sync-upload.php', $form, true);
        record('Upload replay retains the same ' . $type . ' record', ($first['items'] ?? $first['item'] ?? $first['item_id'] ?? null) === ($replay['items'] ?? $replay['item'] ?? $replay['item_id'] ?? null));
        $receipt = $pdo->prepare('SELECT status FROM offline_operations WHERE operation_id = ?'); $receipt->execute([$uuid]);
        record($type . ' upload receipt completed', $receipt->fetchColumn() === 'completed');
    }
});
group('Global academic term and service permissions', function () use (&$manifest) {
    $before = ok('osa', 'api/osa/settings/academic-term.php')['term'];
    $term = ['academic_year' => '2026-2027', 'semester' => '2nd', 'grading_period' => 'midterm'];
    $updated = ok('osa', 'api/osa/settings/academic-term.php', $term);
    record('Academic term write persisted', $updated['term'] === $term);
    ok('osa', 'api/osa/settings/academic-term.php', $before);
    ok('osa', 'api/services/osa/save.php', ['org_id' => $manifest['org'], 'services' => ['printing' => false, 'services' => true]]);
    $response = request('student', 'api/printing/student/submit.php', ['org_id' => $manifest['org'], 'file' => new CURLFile($manifest['pdf'], 'application/pdf', 'fixture.pdf')], true);
    record('Disabled printing provider rejects submission', in_array($response['status'], [400, 403], true));
    ok('osa', 'api/services/osa/save.php', ['org_id' => $manifest['org'], 'services' => ['printing' => true, 'services' => true]]);
});
group('Primary administration: staff lifecycle, authority transfer, audit', function () use (&$manifest, $pdo) {
    $pdo->exec("UPDATE users SET is_primary_osa = 0 WHERE account_type = 'osa_staff'");
    $pdo->prepare('UPDATE users SET is_primary_osa = 1 WHERE user_id = ?')->execute([$manifest['users']['osa']['id']]);
    ok('osa', 'api/auth/reauthenticate.php', ['current_password' => $manifest['password']]);
    ok('osa', 'api/osa/staff/list.php');
    ok('osa', 'api/osa/audit-logs/list.php');
    $existing = $pdo->prepare('SELECT user_id FROM users WHERE employee_number = ?'); $existing->execute([$manifest['token'] . 'sec']); $target = (int)$existing->fetchColumn();
    if (!$target) {
        $pdo->prepare("INSERT INTO users (employee_number, first_name, last_name, email, password_hash, account_type, is_active) VALUES (?, 'Feature', 'Secondary', ?, ?, 'osa_staff', 1)")->execute([$manifest['token'] . 'sec', $manifest['token'] . 'secondary@example.invalid', password_hash($manifest['password'], PASSWORD_BCRYPT)]);
        $target = (int)$pdo->lastInsertId();
    }
    ok('osa', 'api/osa/staff/status.php', ['user_id' => $target, 'is_active' => false]);
    ok('osa', 'api/osa/staff/status.php', ['user_id' => $target, 'is_active' => true]);
    ok('osa', 'api/osa/staff/transfer-primary.php', ['user_id' => $target]);
    expectStatus('osa', 'api/osa/staff/list.php', null, 403, 'Previous primary loses staff administration access');
    ok('secondary', 'api/auth/csrf.php');
    ok('secondary', 'api/auth/login.php', ['identifier' => $manifest['token'] . 'secondary@example.invalid', 'password' => $manifest['password'], 'testing_bypass_otp' => true]);
    ok('secondary', 'api/auth/csrf.php');
    ok('secondary', 'api/auth/reauthenticate.php', ['current_password' => $manifest['password']]);
    ok('secondary', 'api/osa/staff/transfer-primary.php', ['user_id' => $manifest['users']['osa']['id']]);
    ok('osa', 'api/osa/staff/status.php', ['user_id' => $target, 'is_active' => false]);
    ok('osa', 'api/osa/staff/delete.php', ['user_id' => $target]);
});
group('Account roster preview and apply on the disposable database', function () use (&$manifest, $pdo) {
    $program = $pdo->query('SELECT ap.program_id, ap.program_code, ap.institute_id, i.institute_name FROM academic_programs ap JOIN institutes i ON i.institute_id = ap.institute_id LIMIT 1')->fetch();
    $records = [];
    foreach (['student', 'officer'] as $role) {
        $pdo->prepare("UPDATE users SET program_id = ?, institute_id = ?, year_section = '2-1' WHERE user_id = ?")->execute([$program['program_id'], $program['institute_id'], $manifest['users'][$role]['id']]);
        $records[] = ['studentId' => $manifest['users'][$role]['identifier'], 'studentName' => 'Feature ' . $role, 'programCode' => $program['program_code'], 'institute' => $program['institute_name'], 'yearSection' => '3-1', 'email' => $manifest['token'] . $role . '@example.invalid', 'phone' => '+63 9000000000', 'isActive' => true];
    }
    $before = $pdo->query('SELECT * FROM student_numbers ORDER BY sn_id')->fetchAll();
    $preview = ok('osa', 'api/accounts/students/import.php', ['action' => 'preview', 'records' => $records]);
    ok('osa', 'api/accounts/students/import.php', ['action' => 'apply', 'records' => $records, 'confirmedAcademicYear' => $preview['academicYear']]);
    record('Account import leaves eligibility roster unchanged', $before === $pdo->query('SELECT * FROM student_numbers ORDER BY sn_id')->fetchAll());
    ok('osa', 'api/accounts/students/list.php');
});
$extra = array_slice($manifest['results'], $manifest['extra_results_start']);
$failed = count(array_filter($extra, fn($result) => !$result['passed']));
$manifest['extra_summary'] = ['checks' => count($extra), 'failed' => $failed]; saveManifest();
echo 'Extra results: ' . count($extra) . ' checks, ' . $failed . " failed.\n";
exit($failed ? 1 : 0);
