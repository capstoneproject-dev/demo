<?php
/** Local feature verification. CLI only. prepare -> run -> cleanup.
 * Uses isolated records in existing tables; preserves append-only audit entries.
 * Credentials and results are kept outside the web root in the OS temporary folder.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../../config/db.php';
$pdo = getPdo();
$manifestPath = sys_get_temp_dir() . '/capstone-feature-check-' . substr(hash('sha256', __DIR__), 0, 12) . '.json';
$mode = $argv[1] ?? 'run';
$manifest = is_file($manifestPath) ? json_decode(file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR) : [];
function saveManifest(): void {
    global $manifestPath, $manifest;
    file_put_contents($manifestPath, json_encode($manifest, JSON_THROW_ON_ERROR));
}
function dataFingerprint(): array {
    global $pdo;
    $tables = [];
    foreach ($pdo->query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")->fetchAll(PDO::FETCH_COLUMN) as $table) {
        $name = '`' . str_replace('`', '``', $table) . '`';
        $ddl = preg_replace('/ AUTO_INCREMENT=[0-9]+/', '', $pdo->query('SHOW CREATE TABLE ' . $name)->fetch(PDO::FETCH_NUM)[1]);
        $rows = [];
        foreach ($pdo->query('SELECT * FROM ' . $name) as $row) $rows[] = hash('sha256', serialize($row));
        sort($rows);
        $tables[$table] = ['schema' => hash('sha256', $ddl), 'data' => hash('sha256', implode('', $rows)), 'count' => count($rows)];
    }
    return $tables;
}
if ($mode === 'prepare') {
    if ($manifest && empty($manifest['cleaned'])) throw new RuntimeException('A previous fixture manifest remains; clean it up first.');
    $manifest = ['token' => 'FT' . bin2hex(random_bytes(6)), 'password' => bin2hex(random_bytes(16)), 'baseline' => dataFingerprint(), 'users' => [], 'results' => []];
    saveManifest();
    $token = $manifest['token'];
    $pdo->prepare('INSERT INTO organizations (org_name, org_code, can_offer_services, can_offer_printing) VALUES (?, ?, 1, 1)')->execute([$token, $token]);
    $manifest['org'] = (int)$pdo->lastInsertId(); saveManifest();
    foreach (['officer' => [1, 1, 1], 'adviser' => [1, 0, 1]] as $role => $flags) {
        $pdo->prepare('INSERT INTO org_roles (org_id, role_name, can_access_org_dashboard, can_manage_org_dashboard, can_review_org_documents) VALUES (?, ?, ?, ?, ?)')->execute([$manifest['org'], $role, ...$flags]);
        $manifest['roles'][$role] = (int)$pdo->lastInsertId(); saveManifest();
    }
    foreach (['student' => 'student', 'officer' => 'student', 'adviser' => 'organization_adviser', 'osa' => 'osa_staff'] as $role => $type) {
        $identifier = substr($token . $role, 0, 20);
        $pdo->prepare('INSERT INTO users (student_number, employee_number, first_name, last_name, email, password_hash, account_type, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)')
            ->execute([$type === 'student' ? $identifier : null, $type === 'student' ? null : $identifier, 'Feature', $role, $token . $role . '@example.invalid', password_hash($manifest['password'], PASSWORD_BCRYPT), $type]);
        $uid = (int)$pdo->lastInsertId();
        $manifest['users'][$role] = ['id' => $uid, 'identifier' => $identifier]; saveManifest();
        $pdo->prepare('INSERT INTO student_email_notification_preferences (user_id, rental_enabled, locker_enabled, attendance_enabled, printing_enabled) VALUES (?, 0, 0, 0, 0)')->execute([$uid]);
        if (isset($manifest['roles'][$role])) $pdo->prepare("INSERT INTO organization_members (user_id, org_id, role_id, position_title, joined_at, is_active) VALUES (?, ?, ?, 'Fixture', CURRENT_DATE, 1)")->execute([$uid, $manifest['org'], $manifest['roles'][$role]]);
    }
    $ssc = $pdo->query("SELECT o.org_id, r.role_id FROM organizations o JOIN org_roles r ON r.org_id = o.org_id WHERE o.org_code = 'SSC' AND o.status = 'active' AND r.is_active = 1 AND r.can_manage_org_dashboard = 1 LIMIT 1")->fetch();
    if ($ssc) {
        $manifest['ssc'] = (int)$ssc['org_id']; saveManifest();
        $pdo->prepare("INSERT INTO organization_members (user_id, org_id, role_id, position_title, joined_at, is_active) VALUES (?, ?, ?, 'Fixture', CURRENT_DATE, 1)")->execute([$manifest['users']['officer']['id'], $ssc['org_id'], $ssc['role_id']]);
    }
    $pdo->prepare('INSERT INTO inventory_categories (org_id, category_name) VALUES (?, ?)')->execute([$manifest['org'], $token]);
    $manifest['category'] = (int)$pdo->lastInsertId(); saveManifest();
    $pdf = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n";
    $manifest['pdf'] = sys_get_temp_dir() . '/' . $token . '.pdf'; file_put_contents($manifest['pdf'], $pdf);
    $manifest['png'] = sys_get_temp_dir() . '/' . $token . '.png'; file_put_contents($manifest['png'], base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII='));
    if (function_exists('imagecreatetruecolor')) { $image = imagecreatetruecolor(2, 2); imagepng($image, $manifest['png']); imagedestroy($image); }
    $program = $pdo->query('SELECT program_id FROM program_org_mappings WHERE is_active = 1 LIMIT 1')->fetchColumn();
    if ($program) $pdo->prepare('UPDATE users SET program_id = ? WHERE user_id = ?')->execute([$program, $manifest['users']['student']['id']]);
    saveManifest(); echo "Prepared isolated feature fixtures.\n"; exit;
}
if (!$manifest) throw new RuntimeException('Run prepare first.');
if ($mode === 'cleanup') {
    $statement = $pdo->prepare('SELECT COUNT(*) FROM document_decisions WHERE submission_id IN (SELECT submission_id FROM document_submissions WHERE org_id = ?)');
    $statement->execute([$manifest['org']]);
    // Preserve protected history automatically; never attempt to disable triggers.
    if ($statement->fetchColumn()) $mode = 'contain';
}
$clients = [];
function request(string $role, string $route, ?array $payload = null, bool $multipart = false): array {
    global $clients;
    $client = $clients[$role] ?? ['cookies' => [], 'csrf' => ''];
    $handle = curl_init((getenv('FEATURE_TEST_BASE_URL') ?: 'http://localhost/CAPSTONE/demo/') . $route);
    $headers = ['User-Agent: Capstone-complete-feature-verification'];
    if ($client['cookies']) $headers[] = 'Cookie: ' . implode('; ', array_map(fn($k, $v) => $k . '=' . $v, array_keys($client['cookies']), $client['cookies']));
    if ($client['csrf']) $headers[] = 'X-CSRF-Token: ' . $client['csrf'];
    if ($payload !== null && !$multipart) $headers[] = 'Content-Type: application/json';
    curl_setopt_array($handle, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_HTTPHEADER => $headers,
        CURLOPT_HEADERFUNCTION => function ($handle, $header) use (&$client) {
            if (preg_match('/^Set-Cookie: ([^=]+)=([^;]*);/i', $header, $m) && preg_match('/;\s*path=\/(?:;|\s*$)/i', $header)) {
                if ($m[2] !== '' && $m[2] !== 'deleted') $client['cookies'][$m[1]] = $m[2]; else unset($client['cookies'][$m[1]]);
            }
            return strlen($header);
        }]);
    if ($payload !== null) curl_setopt_array($handle, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $multipart ? $payload : json_encode($payload, JSON_THROW_ON_ERROR)]);
    $body = curl_exec($handle); $status = curl_getinfo($handle, CURLINFO_RESPONSE_CODE); $error = curl_error($handle); curl_close($handle);
    $json = json_decode((string)$body, true);
    if (isset($json['csrf_token'])) $client['csrf'] = $json['csrf_token'];
    $clients[$role] = $client;
    return ['status' => $status, 'json' => $json, 'body' => $body, 'error' => $error];
}
function record(string $name, bool $passed, string $detail = ''): void {
    global $manifest;
    $manifest['results'][] = ['name' => $name, 'passed' => $passed, 'detail' => $detail]; saveManifest();
    echo ($passed ? 'PASS: ' : 'FAIL: ') . $name . ($detail ? ' — ' . $detail : '') . "\n";
}
function ok(string $role, string $route, ?array $payload = null, bool $multipart = false): array {
    $response = request($role, $route, $payload, $multipart);
    $passed = $response['status'] === 200 && ($response['json']['ok'] ?? false);
    record($role . ' ' . $route, $passed, $passed ? '' : 'HTTP ' . $response['status'] . ' ' . ($response['json']['error'] ?? $response['error'] ?: 'Invalid JSON'));
    if (!$passed) throw new RuntimeException('Workflow stopped at ' . $route);
    return $response['json'];
}
function group(string $name, callable $action): void {
    try { $action(); } catch (Throwable $error) { record($name, false, $error->getMessage()); }
}
function login(string $role): void {
    global $manifest;
    ok($role, 'api/auth/csrf.php');
    ok($role, 'api/auth/login.php', ['identifier' => $manifest['token'] . $role . '@example.invalid', 'password' => $manifest['password'], 'testing_bypass_otp' => $role === 'osa']);
    ok($role, 'api/auth/csrf.php');
    if (in_array($role, ['officer', 'adviser'], true)) ok($role, 'api/auth/activate-org.php', ['org_id' => $manifest['org']]);
}
if ($mode === 'probe') {
    login('osa');
    $response = request('osa', 'api/accounts/students/list.php');
    echo json_encode(['status' => $response['status'], 'error' => $response['json']['error'] ?? null], JSON_PRETTY_PRINT) . "\n";
    exit;
}
if ($mode === 'guards') {
    ok('guest', 'api/auth/csrf.php');
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(dirname(__DIR__, 2) . '/api', FilesystemIterator::SKIP_DOTS));
    $count = 0;
    foreach ($iterator as $file) {
        if ($file->getExtension() !== 'php') continue;
        $code = file_get_contents($file->getPathname());
        if (!preg_match('/^\s*(?:apiGuard|apiRequireOsaSystemAdministrator|apiRequirePrimaryOsaAdministrator|apiRequireRecentReauthentication)\((?:true|false)?\);/m', $code)) continue;
        $relative = str_replace('\\', '/', substr($file->getPathname(), strlen(dirname(__DIR__, 2)) + 1));
        if ($relative === 'api/auth/session.php') continue;
        $response = request('guest', $relative, []);
        record('Unauthenticated guard ' . $relative, in_array($response['status'], [401, 403], true), 'HTTP ' . $response['status']);
        $count++;
    }
    echo 'Authentication boundaries checked: ' . $count . " endpoints.\n";
    exit;
}
if ($mode === 'verify-original') {
    $org = (int)$manifest['org'];
    $ids = implode(',', array_map(fn($user) => (int)$user['id'], $manifest['users']));
    $newSubmissions = 'SELECT submission_id FROM document_submissions WHERE org_id = ' . $org;
    $newRentals = 'SELECT rental_id FROM rentals WHERE org_id = ' . $org;
    $filters = [
        'users' => 'user_id NOT IN (' . $ids . ')',
        'organizations' => 'org_id <> ' . $org,
        'org_roles' => 'org_id <> ' . $org,
        'organization_members' => 'user_id NOT IN (' . $ids . ')',
        'inventory_categories' => 'org_id <> ' . $org,
        'inventory_items' => 'org_id <> ' . $org,
        'rentals' => 'org_id <> ' . $org,
        'rental_items' => 'rental_id NOT IN (' . $newRentals . ')',
        'print_jobs' => 'org_id <> ' . $org,
        'events' => 'org_id <> ' . $org,
        'attendance_records' => 'event_id NOT IN (SELECT event_id FROM events WHERE org_id = ' . $org . ')',
        'announcements' => 'org_id <> ' . $org,
        'announcement_target_programs' => 'announcement_id NOT IN (SELECT announcement_id FROM announcements WHERE org_id = ' . $org . ')',
        'document_submissions' => 'org_id <> ' . $org,
        'document_annotations' => 'submission_id NOT IN (' . $newSubmissions . ')',
        'document_decisions' => 'submission_id NOT IN (' . $newSubmissions . ')',
        'document_versions' => 'submission_id NOT IN (' . $newSubmissions . ')',
        'documents_approved' => 'submission_id NOT IN (' . $newSubmissions . ')',
        'student_email_notification_preferences' => 'user_id NOT IN (' . $ids . ')',
        'user_presence' => 'user_id NOT IN (' . $ids . ')',
        'offline_operations' => 'user_id NOT IN (' . $ids . ')',
    ];
    $current = dataFingerprint();
    $failures = [];
    foreach ($manifest['baseline'] as $table => $before) {
        if (($current[$table]['schema'] ?? null) !== $before['schema']) $failures[] = 'Schema changed: ' . $table;
        if (in_array($table, ['audit_logs', 'api_rate_limit_buckets', 'notification_email_dispatch_state'], true)) continue;
        $name = '`' . str_replace('`', '``', $table) . '`';
        $rows = [];
        foreach ($pdo->query('SELECT * FROM ' . $name . (isset($filters[$table]) ? ' WHERE ' . $filters[$table] : '')) as $row) $rows[] = hash('sha256', serialize($row));
        sort($rows);
        if (hash('sha256', implode('', $rows)) !== $before['data'] || count($rows) !== $before['count']) $failures[] = 'Original business data differs: ' . $table . ' (baseline rows=' . $before['count'] . ', current non-fixture rows=' . count($rows) . ')';
    }
    $manifest['original_data_verification'] = $failures; saveManifest();
    echo $failures ? implode("\n", $failures) . "\n" : "PASS: existing table definitions and all original business rows preserved; fixtures and runtime/audit bookkeeping excluded\n";
    exit($failures ? 1 : 0);
}
if ($mode === 'inspect-inventory') {
    $statement = $pdo->prepare('SELECT item_id, item_name, status, updated_at FROM inventory_items WHERE org_id <> ? AND updated_at >= (SELECT created_at FROM organizations WHERE org_id = ?) ORDER BY updated_at DESC');
    $statement->execute([$manifest['org'], $manifest['org']]);
    $rows = $statement->fetchAll();
    echo 'Inventory rows updated during checks: ' . count($rows) . "\n";
    foreach ($pdo->query("SHOW TRIGGERS WHERE `Table` = 'inventory_items'") as $trigger) echo $trigger['Trigger'] . ': ' . $trigger['Statement'] . "\n";
    exit;
}
if ($mode === 'contain') {
    // Preserve append-only document history and its PDF; disable all fixture access.
    require_once __DIR__ . '/../../includes/private_pdf_storage.php';
    $org = (int)$manifest['org'];
    foreach ($pdo->query('SELECT file_url FROM document_submissions WHERE org_id = ' . $org)->fetchAll(PDO::FETCH_COLUMN) as $key) {
        $target = privatePdfStorageRoot() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, privatePdfNormalizeKey($key));
        if (!is_file($target) && is_file($manifest['pdf'])) copy($manifest['pdf'], $target);
    }
    foreach ($manifest['users'] as $user) {
        $pdo->prepare('DELETE FROM organization_members WHERE user_id = ?')->execute([$user['id']]);
        $pdo->prepare('DELETE FROM user_presence WHERE user_id = ?')->execute([$user['id']]);
        $pdo->prepare('UPDATE users SET is_active = 0 WHERE user_id = ?')->execute([$user['id']]);
    }
    $pdo->prepare("UPDATE organizations SET status = 'suspended', can_offer_services = 0, can_offer_printing = 0 WHERE org_id = ?")->execute([$org]);
    $pdo->prepare('UPDATE org_roles SET is_active = 0 WHERE org_id = ?')->execute([$org]);
    $pdo->prepare('UPDATE announcements SET is_published = 0, archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP) WHERE org_id = ?')->execute([$org]);
    $pdo->prepare('UPDATE events SET is_published = 0, archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP) WHERE org_id = ?')->execute([$org]);
    $pdo->prepare("UPDATE document_submissions SET status = 'cancelled', cancelled_at = COALESCE(cancelled_at, CURRENT_TIMESTAMP) WHERE org_id = ? AND status = 'pending'")->execute([$org]);
    $manifest['cleaned'] = true; saveManifest();
    echo "Fixture accounts disabled, organization suspended, memberships removed; append-only document history and PDF preserved.\n";
    exit;
}
if ($mode === 'run') {
    $manifest['results'] = []; saveManifest();
    foreach ($manifest['users'] as $role => $user) {
        $statement = $pdo->prepare('SELECT student_number, employee_number FROM users WHERE user_id = ?');
        $statement->execute([$user['id']]); $row = $statement->fetch();
        $manifest['users'][$role]['identifier'] = $row['student_number'] ?: $row['employee_number'];
    }
    saveManifest();
    foreach (array_keys($manifest['users']) as $role) group('Login ' . $role, fn() => login($role));
    $lists = [
        'student' => ['student/dashboard/recent-activity', 'student/announcements/list', 'student/events/list', 'student/services/catalog', 'student/services/tracker', 'student/rentals/my-rentals', 'student/notifications/list', 'student/notifications/email-preferences', 'student/organizations/officers', 'student/organizations/public-profiles', 'student/profile/registration-prefill', 'printing/student/list'],
        'officer' => ['officer/dashboard', 'officer/notifications/list', 'announcements/list', 'announcements/programs', 'documents/list', 'documents/repository', 'igp/inventory/list', 'igp/inventory/categories', 'igp/inventory/item-names', 'igp/students/list', 'igp/officers/list', 'igp/reference/officers', 'igp/rentals/list', 'igp/reports/financial-summary', 'printing/officer/list', 'printing/officer/pending', 'qr-attendance/events/list', 'qr-attendance/students/list', 'qr-attendance/attendance/list', 'services/officer/status'],
        'adviser' => ['documents/list', 'documents/repository', 'officer/dashboard'],
        'osa' => ['osa/dashboard-stats', 'osa/notifications/list', 'osa/activity-feed', 'documents/list', 'documents/repository', 'documents/requests-overview', 'services/osa/list', 'settings/academic-term', 'osa/settings/academic-term', 'accounts/students/list', 'accounts/student-numbers/list', 'accounts/officers/list', 'accounts/advisers/list', 'accounts/requests/list', 'accounts/poll'],
    ];
    foreach ($lists as $role => $routes) foreach ($routes as $route) group($route, fn() => ok($role, 'api/' . $route . '.php'));
    foreach (['osa/audit-logs/list', 'osa/staff/list'] as $route) { $r = request('osa', 'api/' . $route . '.php'); record('Non-primary access rejected: ' . $route, $r['status'] === 403); }
    group('Announcement lifecycle', function () use (&$manifest) {
        $created = ok('officer', 'api/announcements/create.php', ['title' => $manifest['token'], 'content' => 'Fixture content', 'publish' => 0]);
        $id = $created['item']['announcement_id'];
        ok('officer', 'api/announcements/update.php', ['announcement_id' => $id, 'title' => $manifest['token'] . ' updated', 'content' => 'Updated fixture', 'publish' => 0, 'expected_edit_state' => $created['item']['edit_state'] ?? '', 'expected_photo_state' => $created['item']['photo_state'] ?? '']);
        ok('officer', 'api/announcements/archive.php', ['announcement_id' => $id]);
        ok('officer', 'api/announcements/restore.php', ['announcement_id' => $id]);
    });
    group('Inventory/rental lifecycle', function () use (&$manifest) {
        $item = ok('officer', 'api/igp/inventory/save.php', ['item_name' => $manifest['token'], 'barcode' => $manifest['token'], 'category_id' => $manifest['category'], 'hourly_rate' => 10, 'status' => 'available', 'image' => new CURLFile($manifest['png'], 'image/png', 'fixture.png')], true);
        $id = (int)($item['item_id'] ?? $item['item']['item_id'] ?? 0);
        $rent = ok('officer', 'api/igp/rentals/rent.php', ['item_id' => $id, 'hours' => 1, 'renter_identifier' => $manifest['users']['student']['identifier'], 'officer_identifier' => $manifest['users']['officer']['identifier']]);
        $rid = (int)$rent['rental_id'];
        ok('officer', 'api/igp/rentals/mark-paid.php', ['rental_id' => $rid, 'officer_identifier' => $manifest['users']['officer']['identifier']]);
        ok('officer', 'api/igp/rentals/return.php', ['rental_id' => $rid, 'officer_identifier' => $manifest['users']['officer']['identifier']]);
    });
    group('Event/attendance lifecycle', function () use (&$manifest) {
        $event = ok('officer', 'api/qr-attendance/events/save.php', ['event_name' => $manifest['token'], 'is_published' => 1]);
        $id = (int)$event['event_id'];
        ok('student', 'api/student/events/register.php', ['event_id' => $id]);
        $scan = ok('officer', 'api/qr-attendance/attendance/checkin.php', ['event_id' => $id, 'student_number' => $manifest['users']['student']['identifier']]);
        $rid = (int)($scan['record_id'] ?? $scan['item']['record_id'] ?? 0);
        ok('officer', 'api/qr-attendance/attendance/checkin.php', ['event_id' => $id, 'student_number' => $manifest['users']['student']['identifier']]);
        ok('officer', 'api/qr-attendance/attendance/checkout.php', ['record_id' => $rid]);
        ok('officer', 'api/qr-attendance/events/archive.php', ['event_id' => $id, 'action' => 'archive']);
        ok('officer', 'api/qr-attendance/events/archive.php', ['event_id' => $id, 'action' => 'restore']);
    });
    group('Printing upload/download/cancel', function () use (&$manifest) {
        $job = ok('student', 'api/printing/student/submit.php', ['org_id' => $manifest['org'], 'file' => new CURLFile($manifest['pdf'], 'application/pdf', 'fixture.pdf')], true);
        $id = (int)$job['items'][0]['print_job_id'];
        $file = request('student', 'api/printing/file.php?print_job_id=' . $id);
        record('Printing PDF download', $file['status'] === 200 && str_starts_with((string)$file['body'], '%PDF-'));
        ok('officer', 'api/printing/officer/reorder.php', ['print_job_id' => $id, 'new_queue_order' => 1]);
        ok('student', 'api/printing/student/cancel.php', ['print_job_id' => $id]);
    });
    group('Document upload/submit/review', function () use (&$manifest) {
        $upload = ok('officer', 'api/documents/upload.php', ['file' => new CURLFile($manifest['pdf'], 'application/pdf', 'fixture.pdf')], true);
        $doc = ok('officer', 'api/documents/submit.php', ['upload_token' => $upload['upload_token'], 'title' => $manifest['token'], 'document_type' => 'Others', 'custom_document_type' => 'Fixture']);
        $id = (int)$doc['item']['submission_id'];
        ok('adviser', 'api/documents/review.php', ['submission_id' => $id, 'decision' => 'approved', 'notes' => 'Fixture approved']);
        ok('officer', 'api/documents/forward-to-ssc.php', ['submission_id' => $id]);
    });
    foreach (['student', 'officer', 'osa'] as $role) group('Profile upload ' . $role, fn() => ok($role, 'api/' . $role . '/profile/upload-photo.php', ['profile_photo' => new CURLFile($manifest['png'], 'image/png', 'fixture.png')], true));
    $failed = count(array_filter($manifest['results'], fn($r) => !$r['passed']));
    echo 'Results: ' . count($manifest['results']) . ' checks, ' . $failed . " failed. Fixtures retained for follow-up/browser checks.\n";
    exit($failed ? 1 : 0);
}
if ($mode === 'cleanup') {
    require_once __DIR__ . '/../../includes/private_pdf_storage.php';
    $org = (int)$manifest['org'];
    foreach ($pdo->query('SELECT file_url FROM print_jobs WHERE org_id = ' . $org)->fetchAll(PDO::FETCH_COLUMN) as $key) { try { privatePdfDeleteStorageKey($key); } catch (Throwable $e) {} }
    foreach ($pdo->query('SELECT file_url FROM document_submissions WHERE org_id = ' . $org)->fetchAll(PDO::FETCH_COLUMN) as $key) { try { privatePdfDeleteStorageKey($key); } catch (Throwable $e) {} }
    $pdo->prepare('DELETE FROM rentals WHERE org_id = ?')->execute([$org]);
    $pdo->prepare('DELETE FROM inventory_items WHERE org_id = ?')->execute([$org]);
    $pdo->prepare('DELETE FROM inventory_categories WHERE org_id = ?')->execute([$org]);
    $pdo->prepare('DELETE FROM print_jobs WHERE org_id = ?')->execute([$org]);
    foreach (['document_annotations', 'document_decisions', 'document_versions'] as $table) {
        $pdo->prepare('DELETE FROM ' . $table . ' WHERE submission_id IN (SELECT submission_id FROM document_submissions WHERE org_id = ?)')->execute([$org]);
    }
    $pdo->prepare('DELETE FROM documents_approved WHERE submission_id IN (SELECT submission_id FROM document_submissions WHERE org_id = ?)')->execute([$org]);
    $pdo->prepare('DELETE FROM document_submissions WHERE org_id = ?')->execute([$org]);
    $pdo->prepare('DELETE FROM announcements WHERE org_id = ?')->execute([$org]);
    $pdo->prepare('DELETE FROM events WHERE org_id = ?')->execute([$org]);
    foreach ($manifest['users'] as $user) {
        $pdo->prepare('DELETE FROM organization_members WHERE user_id = ?')->execute([$user['id']]);
        $pdo->prepare('DELETE FROM user_presence WHERE user_id = ?')->execute([$user['id']]);
        $pdo->prepare('DELETE FROM users WHERE user_id = ?')->execute([$user['id']]);
    }
    $pdo->prepare('DELETE FROM org_roles WHERE org_id = ?')->execute([$org]);
    $pdo->prepare('DELETE FROM organizations WHERE org_id = ?')->execute([$org]);
    foreach (['pdf', 'png'] as $key) if (is_file($manifest[$key])) unlink($manifest[$key]);
    $after = dataFingerprint();
    foreach ($manifest['baseline'] as $table => $baseline) if (($after[$table] ?? null) !== $baseline) echo 'Changed after cleanup: ' . $table . "\n";
    $manifest['cleaned'] = true; $manifest['after'] = $after; saveManifest();
    echo "Business fixtures cleaned; manifest retained for the report.\n";
}
