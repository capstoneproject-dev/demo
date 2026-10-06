<?php
/** Connection-local temporary tables leave existing application data untouched. */
ini_set('session.save_path', sys_get_temp_dir());
require_once __DIR__ . '/../../includes/qr_attendance.php';

$pdo = getPdo();
$pdo->exec("CREATE TEMPORARY TABLE users (
    user_id INT, student_number VARCHAR(20), first_name VARCHAR(100), last_name VARCHAR(100),
    email VARCHAR(255), password_hash VARCHAR(255), account_type VARCHAR(30), is_active INT,
    year_section VARCHAR(50), created_at DATETIME, updated_at DATETIME
) DEFAULT CHARSET=utf8mb4");
$pdo->exec('CREATE TEMPORARY TABLE organization_members (membership_id INT, user_id INT, org_id INT, is_active INT)');
$pdo->exec('CREATE TEMPORARY TABLE events (event_id INT, org_id INT, created_by_user_id INT, event_name VARCHAR(100))');
$pdo->exec('CREATE TEMPORARY TABLE attendance_records (event_id INT, student_number VARCHAR(20), student_name VARCHAR(100)) DEFAULT CHARSET=utf8mb4');
foreach ([['utf8mb4_unicode_ci', 'utf8mb4_general_ci'], ['utf8mb4_general_ci', 'utf8mb4_unicode_ci']] as [$userCollation, $attendanceCollation]) {
    foreach (['users', 'organization_members', 'events', 'attendance_records'] as $table) {
        $pdo->exec("DELETE FROM {$table}");
    }
    $pdo->exec("ALTER TABLE users MODIFY student_number VARCHAR(20) CHARACTER SET utf8mb4 COLLATE {$userCollation} NULL");
    $pdo->exec("ALTER TABLE attendance_records MODIFY student_number VARCHAR(20) CHARACTER SET utf8mb4 COLLATE {$attendanceCollation} NULL");
    $pdo->exec("INSERT INTO users (user_id, student_number, first_name, last_name, email, password_hash, account_type, is_active) VALUES
        (901, 'QR-901', 'Test', 'Attendee', 'qr901@example.test', 'test', 'student', 1),
        (902, 'QR-902', 'Test', 'Other', 'qr902@example.test', 'test', 'student', 1),
        (903, 'QR-903', 'Test', 'Inactive', 'qr903@example.test', 'test', 'student', 0)");
    $pdo->exec("INSERT INTO events (event_id, org_id, created_by_user_id, event_name) VALUES
        (901, 901, 901, 'Test event'), (902, 902, 901, 'Other organization')");
    $pdo->exec("INSERT INTO attendance_records (event_id, student_number, student_name) VALUES
        (901, 'QR-901', 'Test Attendee'), (902, 'QR-902', 'Test Other'), (901, 'QR-903', 'Test Inactive')");
    if (array_column(qrListStudents($pdo, 901), 'user_id') !== [901]) {
        throw new RuntimeException('Mixed-collation matching or organization/active filtering failed.');
    }
    if (count(qrListStudents($pdo, 901, ['q' => 'Attendee'])) !== 1
        || qrListStudents($pdo, 901, ['q' => 'Other']) !== []) {
        throw new RuntimeException('Mixed-collation roster search failed.');
    }
    echo "{$userCollation} / {$attendanceCollation}: matching, organization isolation, active filtering and search passed.\n";
}
