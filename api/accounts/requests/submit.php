<?php
// Public endpoint (no session guard) – students submit account requests from the login page or Android app
require_once '../../../config/db.php';
require_once '../../../includes/auth.php';

header('Content-Type: application/json');
requirePost();

$body          = getRequestBody();
$studentNumber = trim($body['studentId'] ?? '');
$studentName   = trim($body['name']      ?? '');
$email         = trim($body['email']     ?? '');
$phone         = trim($body['phone']     ?? '');
$password      = trim($body['password']  ?? '');
$programCode   = trim($body['course']    ?? $body['programCode'] ?? '');
$yearSection   = trim($body['yearSection'] ?? $body['section'] ?? '');
$reqRole       = trim($body['requestedRole'] ?? 'student');
$reqOrg        = trim($body['requestedOrg']  ?? '');

if (!$studentNumber || !$studentName || !$email || !$password) {
    jsonError('studentId, name, email, and password are required.', 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonError('Invalid email address.', 422);
}

try {
    $pdo = getPdo();

    // Verify student number exists in whitelist
    $snStmt = $pdo->prepare("SELECT sn_id FROM student_numbers WHERE student_number = :sn AND is_active = 1 LIMIT 1");
    $snStmt->execute([':sn' => $studentNumber]);
    if (!$snStmt->fetch()) {
        jsonError('Your student number is not in the database. Please contact the OSA.', 403);
    }

    // Check for duplicate pending request
    $dupStmt = $pdo->prepare("SELECT reg_id FROM pending_registrations WHERE student_number = :sn AND status = 'pending' LIMIT 1");
    $dupStmt->execute([':sn' => $studentNumber]);
    if ($dupStmt->fetch()) {
        jsonError('You already have a pending registration request.', 409);
    }

    // Block duplicate student accounts, but allow org_officer requests even if already registered
    if ($reqRole !== 'org_officer') {
        $usrStmt = $pdo->prepare("SELECT user_id FROM users WHERE student_number = :sn LIMIT 1");
        $usrStmt->execute([':sn' => $studentNumber]);
        if ($usrStmt->fetch()) {
            jsonError('An account for that student number already exists. If you are registering as an organization officer, please select the Organization tab.', 409);
        }
    }

    $pwHash = password_hash($password, PASSWORD_BCRYPT);

    $ins = $pdo->prepare("
        INSERT INTO pending_registrations
            (student_number, student_name, email, password_hash,
             program_code, year_section, phone, requested_role, requested_org, status)
        VALUES (:sn, :name, :email, :pw, :prog, :ys, :phone, :role, :org, 'pending')
    ");
    $ins->execute([
        ':sn'   => $studentNumber,
        ':name' => $studentName,
        ':email'=> $email,
        ':pw'   => $pwHash,
        ':prog' => $programCode ?: '',
        ':ys'   => $yearSection ?: null,
        ':phone'=> $phone ?: null,
        ':role' => in_array($reqRole, ['student', 'org_officer']) ? $reqRole : 'student',
        ':org'  => $reqOrg ?: null,
    ]);
    $regId = (int)$pdo->lastInsertId();

    jsonOk(['reg_id' => $regId, 'msg' => 'Registration request submitted. Please wait for approval.']);
} catch (PDOException $e) {
    jsonError('DB error: ' . $e->getMessage(), 500);
}
