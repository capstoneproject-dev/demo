<?php
// Public endpoint (no session guard) – students submit account requests from the login page or Android app
require_once '../../../config/db.php';
require_once '../../../includes/auth.php';
require_once '../../../includes/otp.php';

header('Content-Type: application/json');
requirePost();

$body          = getRequestBody();
$studentNumber = trim($body['studentId'] ?? '');
$studentName   = trim($body['name']      ?? '');
$email         = trim($body['email']     ?? '');
$phone         = trim($body['phone']     ?? '');
$password      = (string)($body['password'] ?? '');
$programCode   = trim($body['course']    ?? $body['programCode'] ?? '');
$yearSection   = trim($body['yearSection'] ?? $body['section'] ?? '');
$reqRole       = trim($body['requestedRole'] ?? 'student');
$reqOrg        = trim($body['requestedOrg']  ?? '');
$reqPosition   = preg_replace('/\s+/u', ' ', trim((string)($body['requestedPosition'] ?? ''))) ?? '';
$verificationToken = trim($body['verification_token'] ?? '');

if (!$studentNumber || !$studentName || !$email || $password === '') {
    jsonError('studentId, name, email, and password are required.', 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonError('Invalid email address.', 422);
}
if (!in_array($reqRole, ['student', 'org_officer'], true)) {
    jsonError('Invalid registration role.', 422);
}
$reqPositionLength = function_exists('mb_strlen') ? mb_strlen($reqPosition) : strlen($reqPosition);
if ($reqPositionLength > 120 || preg_match('/[\x00-\x1F\x7F]/u', $reqPosition)) {
    jsonError('Position title must be valid and 120 characters or fewer.', 422);
}
if ($reqRole === 'org_officer' && ($reqOrg === '' || $reqPosition === '')) {
    jsonError('Organization and position title are required for officer registration.', 422);
}

$registrationIpSubject = 'ip:' . rateLimitClientIp();
rateLimitEnsureAllowed('registration_submit_ip', $registrationIpSubject, 20, 3600);

try {
    $pdo = getPdo();

    // Verify student number exists in whitelist
    $snStmt = $pdo->prepare("SELECT sn_id, student_name FROM student_numbers WHERE student_number = :sn AND is_active = 1 LIMIT 1");
    $snStmt->execute([':sn' => $studentNumber]);
    $studentRegistryRecord = $snStmt->fetch();
    if (!$studentRegistryRecord) {
        jsonError('Your student number is not in the database. Please contact the OSA.', 403);
    }
    if ($reqRole === 'student') {
        if (!studentRegistryNamesMatch($studentName, (string)$studentRegistryRecord['student_name'])) {
            jsonError('The student number and name do not match our student records.', 422);
        }
        // Store the authoritative roster spelling rather than browser-entered
        // casing or punctuation.
        $studentName = trim((string)$studentRegistryRecord['student_name']);
    }
    rateLimitEnsureAllowed('registration_submit_student', 'student:' . $studentNumber, 3, 3600);

    // Student registration remains one account per student number. Officer
    // registration adds a membership to that account and is scoped to the
    // selected organization, allowing one student to serve in multiple orgs.
    if ($reqRole !== 'org_officer') {
        $dupStmt = $pdo->prepare(
            "SELECT reg_id FROM pending_registrations
             WHERE student_number = :sn
               AND requested_role = 'student'
               AND status = 'pending'
             LIMIT 1"
        );
        $dupStmt->execute([':sn' => $studentNumber]);
        if ($dupStmt->fetch()) {
            jsonError('You already have a pending student registration request.', 409);
        }

        $usrStmt = $pdo->prepare("SELECT user_id FROM users WHERE student_number = :sn LIMIT 1");
        $usrStmt->execute([':sn' => $studentNumber]);
        if ($usrStmt->fetch()) {
            jsonError('An account for that student number already exists. If you are registering as an organization officer, please select the Organization tab.', 409);
        }
    } else {
        $usrStmt = $pdo->prepare(
            "SELECT user_id, first_name, last_name, password_hash
             FROM users
             WHERE student_number = :sn AND is_active = 1
             LIMIT 1"
        );
        $usrStmt->execute([':sn' => $studentNumber]);
        $existingUser = $usrStmt->fetch();
        if (!$existingUser) {
            jsonError('A registered student account is required before requesting an organization account.', 409);
        }
        if (!password_verify($password, (string)$existingUser['password_hash'])) {
            jsonError('Incorrect password.', 403, ['error_code' => 'INCORRECT_PASSWORD']);
        }
        $studentName = trim((string)$existingUser['first_name'] . ' ' . (string)$existingUser['last_name']);

        $requestedOrgLookup = $reqOrg;
        $orgStmt = $pdo->prepare(
            "SELECT org_id, org_name
             FROM organizations
             WHERE (org_code = :org_code OR org_name = :org_name)
               AND status <> 'suspended'
             LIMIT 1"
        );
        $orgStmt->execute([':org_code' => $requestedOrgLookup, ':org_name' => $requestedOrgLookup]);
        $requestedOrg = $orgStmt->fetch();
        if (!$requestedOrg) {
            jsonError('Select a valid active organization.', 422);
        }
        $reqOrg = (string)$requestedOrg['org_name'];

        $dupStmt = $pdo->prepare(
            "SELECT reg_id FROM pending_registrations
             WHERE student_number = :sn
               AND requested_role = 'org_officer'
               AND (requested_org = :org_name OR requested_org = :org_code)
               AND status = 'pending'
             LIMIT 1"
        );
        $dupStmt->execute([
            ':sn' => $studentNumber,
            ':org_name' => $reqOrg,
            ':org_code' => $requestedOrgLookup,
        ]);
        if ($dupStmt->fetch()) {
            jsonError('You already have a pending officer request for this organization.', 409);
        }

        $memberStmt = $pdo->prepare(
            "SELECT membership_id FROM organization_members
             WHERE user_id = :uid AND org_id = :org_id
             LIMIT 1"
        );
        $memberStmt->execute([
            ':uid' => (int)$existingUser['user_id'],
            ':org_id' => (int)$requestedOrg['org_id'],
        ]);
        if ($memberStmt->fetch()) {
            jsonError('You already have a membership in this organization.', 409);
        }
    }

    $purpose = $reqRole === 'org_officer' ? 'org_registration' : 'student_registration';
    $pdo->beginTransaction();
    consumeOtpVerification($pdo, $verificationToken, $purpose, $email, $studentNumber);

    // Officer requests never create or change login credentials. The column
    // remains required by the legacy pending-registration schema, so store a
    // non-password marker that approval is forbidden from using as a hash.
    $pwHash = $reqRole === 'org_officer'
        ? 'ORG_MEMBERSHIP_REQUEST_NO_PASSWORD'
        : password_hash($password, PASSWORD_BCRYPT);

    $ins = $pdo->prepare("
        INSERT INTO pending_registrations
            (student_number, student_name, email, password_hash,
             program_code, year_section, phone, requested_role, requested_org, requested_position, status)
        VALUES (:sn, :name, :email, :pw, :prog, :ys, :phone, :role, :org, :position, 'pending')
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
        ':position' => $reqPosition ?: null,
    ]);
    $regId = (int)$pdo->lastInsertId();
    $pdo->commit();

    jsonOk(['reg_id' => $regId, 'msg' => 'Registration request submitted. Please wait for approval.']);
} catch (InvalidArgumentException $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('[api/accounts/requests/submit] ' . $e->getMessage());
    jsonError('Could not submit the registration request right now.', 500);
}
