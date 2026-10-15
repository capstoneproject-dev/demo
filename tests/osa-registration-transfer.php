<?php
/** CLI only. Uses an empty disposable database; never changes application records. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
ini_set('session.use_cookies', '0');
ini_set('session.cache_limiter', '');
ini_set('session.save_path', sys_get_temp_dir());
require_once __DIR__ . '/../includes/osa_registration.php';
require_once __DIR__ . '/../includes/osa_archive.php';
require_once __DIR__ . '/../database/migrations/20261015_osa_administrator_archive.php';
require_once __DIR__ . '/../database/migrations/20261015_osa_authority_version.php';
require_once __DIR__ . '/../database/migrations/20261015_single_osa_administrator.php';

function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
function rejects(callable $fn, string $message): void {
    try { $fn(); } catch (InvalidArgumentException|PDOException|RuntimeException $e) { return; }
    throw new RuntimeException($message);
}
function selectTestDatabase(PDO $pdo, string $name): void {
    if (!preg_match('/^capstone_osa_test_[a-f0-9]{12}$/D', $name)) throw new RuntimeException('Invalid disposable database name.');
    $pdo->exec('USE `' . $name . '`');
}

if (($argv[1] ?? '') === 'worker') {
    $pdo = getPdo(); selectTestDatabase($pdo, $argv[2]);
    try {
        reviewOsaRegistration($pdo, (int)$argv[3], (int)$argv[4], 'approve');
        echo 'approved';
    } catch (Throwable $e) { echo 'rejected'; }
    exit;
}
if (($argv[1] ?? '') === 'guard') {
    $pdo = getPdo(); selectTestDatabase($pdo, $argv[2]);
    $user = $pdo->query('SELECT * FROM users WHERE user_id = ' . (int)$argv[3])->fetch();
    startUserSession(['user_id' => (int)$user['user_id'], 'account_type' => 'osa_staff', 'login_role' => 'osa', 'is_primary_osa' => true,
        'osa_authority_version' => isset($argv[4]) ? (int)$argv[4] : (int)$user['osa_authority_version']]);
    apiGuard();
    echo 'authorized'; exit;
}
if (($argv[1] ?? '') === 'endpoint') {
    $pdo = getPdo(); selectTestDatabase($pdo, $argv[2]);
    $route = $argv[3];
    $allowed = ['api/auth/otp/send.php','api/auth/session.php','api/osa/profile/update.php','api/osa/staff/archive.php','api/auth/login.php','api/auth/register-osa.php','api/accounts/requests/action.php','api/auth/osa-invitations/inspect.php',
        'api/osa/staff/invite.php','api/osa/staff/status.php','api/osa/staff/delete.php','api/osa/staff/transfer-primary.php',
        'api/osa/staff/invitations/resend.php','api/osa/staff/invitations/revoke.php'];
    if (!in_array($route,$allowed,true)) throw new RuntimeException('Invalid test endpoint.');
    if ((int)$argv[5]>0) {
        $user=$pdo->query('SELECT * FROM users WHERE user_id='.(int)$argv[5])->fetch();
        startUserSession(['user_id'=>(int)$user['user_id'],'account_type'=>$user['account_type'],'login_role'=>$user['account_type']==='osa_staff'?'osa':'student','is_primary_osa'=>(bool)$user['is_primary_osa'],
            'osa_authority_version'=>($argv[6]??'')==='old-authority'?0:(int)$user['osa_authority_version']]);
        $_SESSION['capstone_security']['reauthenticated_at']=($argv[6]??'recent')==='stale' ? 0 : time();
    }
    $_POST=json_decode(base64_decode($argv[4]),true,512,JSON_THROW_ON_ERROR);
    $_SERVER['REQUEST_METHOD']='POST'; $_SERVER['REQUEST_URI']='/'.$route;
    $_SERVER['HTTP_X_CSRF_TOKEN']=authCsrfToken();
    authEnforceCsrfForApiRequest();
    chdir(dirname(__DIR__.'/../'.$route));
    require __DIR__.'/../'.$route;
    exit;
}

function endpoint(string $database,string $route,array $body,int $actor=0,string $freshness='recent'): array {
    $pipes=[];
    $process=proc_open([PHP_BINARY,__FILE__,'endpoint',$database,$route,base64_encode(json_encode($body)),(string)$actor,$freshness],
        [0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
    fclose($pipes[0]);$result=stream_get_contents($pipes[1]);$errors=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);
    check(proc_close($process)===0,'Endpoint worker failed: '.$errors);
    $data=json_decode($result,true);
    check(is_array($data),'Invalid endpoint JSON: '.$result.' '.$errors);
    return $data;
}

$pdo = getPdo();
$source = DB_NAME;
$database = 'capstone_osa_test_' . bin2hex(random_bytes(6));
$pdo->exec('CREATE DATABASE `' . $database . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
try {
    foreach (['users', 'pending_registrations', 'email_otp_challenges', 'osa_staff_invitations', 'audit_logs', 'api_rate_limit_buckets', 'academic_programs'] as $table) {
        $pdo->exec('CREATE TABLE `' . $database . '`.`' . $table . '` LIKE `' . str_replace('`', '``', $source) . '`.`' . $table . '`');
    }
    selectTestDatabase($pdo, $database);
    migrateOsaAuthorityVersion($pdo);
    migrateOsaAuthorityVersion($pdo);
    // Allow the same legacy fixtures even when the source has already been migrated.
    $constraints = $pdo->query("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'users'")->fetchAll(PDO::FETCH_COLUMN);
    if (in_array('chk_active_osa_primary', $constraints, true)) $pdo->exec('ALTER TABLE users DROP CONSTRAINT chk_active_osa_primary');
    if (in_array('uq_users_single_active_osa', $constraints, true)) $pdo->exec('ALTER TABLE users DROP INDEX uq_users_single_active_osa, DROP COLUMN active_osa_singleton');
    $hash = password_hash('TestPassword123!', PASSWORD_BCRYPT);
    $insert = $pdo->prepare("INSERT INTO users (employee_number,email,password_hash,first_name,last_name,account_type,is_active,is_primary_osa) VALUES (?,?,?,'Test','Admin','osa_staff',1,?)");
    $insert->execute(['10-100-TEST', 'primary@example.invalid', $hash, 1]); $admin = (int)$pdo->lastInsertId();
    $insert->execute(['10-101-TEST', 'staff@example.invalid', $hash, 0]);
    $insert->execute(['10-102-TEST', 'other@example.invalid', $hash, 0]);
    $pdo->exec("UPDATE users SET is_primary_osa=0 WHERE user_id=$admin");
    rejects(fn() => migrateSingleOsaAdministrator($pdo), 'Migration accepted no primary.');
    check((int)$pdo->query('SELECT COUNT(*) FROM users WHERE is_active=1')->fetchColumn()===3,'Failed migration changed accounts.');
    $pdo->exec("UPDATE users SET is_primary_osa=1 WHERE user_id=$admin OR email='staff@example.invalid'");
    rejects(fn() => migrateSingleOsaAdministrator($pdo), 'Migration accepted ambiguous primaries.');
    $pdo->exec("UPDATE users SET is_primary_osa=0 WHERE email='staff@example.invalid'");
    $pdo->prepare("INSERT INTO osa_staff_invitations (employee_number,email,token_hash,invited_by_user_id,expires_at) VALUES ('11-111-TEST','invite@example.invalid',?,?,DATE_ADD(NOW(), INTERVAL 1 DAY))")
        ->execute([hash('sha256', 'invitation'), $admin]);
    migrateSingleOsaAdministrator($pdo);
    migrateSingleOsaAdministrator($pdo);
    $pdo->exec('ALTER TABLE users DROP INDEX uq_users_single_active_osa');
    migrateSingleOsaAdministrator($pdo);
    check((int)$pdo->query("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='uq_users_single_active_osa'")->fetchColumn()===1,'Migration failed to restore a missing singleton index.');
    migrateOsaAdministratorArchive($pdo);
    migrateOsaAdministratorArchive($pdo);
    check((int)$pdo->query("SELECT COUNT(*) FROM users WHERE account_type='osa_staff' AND is_active=1")->fetchColumn() === 1, 'Migration must preserve one active admin.');
    check((int)$pdo->query("SELECT COUNT(*) FROM users WHERE is_active=0")->fetchColumn() === 2, 'Migration must preserve inactive staff history.');
    check($pdo->query('SELECT status FROM osa_staff_invitations LIMIT 1')->fetchColumn() === 'revoked', 'Invitations not revoked.');
    rejects(fn() => $insert->execute(['10-103-TEST','blocked@example.invalid',$hash,1]), 'Second active admin accepted.');
    rejects(fn() => $pdo->exec("UPDATE users SET is_primary_osa=0 WHERE user_id=$admin"), 'Active non-primary admin accepted.');
    echo "PASS: migration, rerun, history, invitations, database constraints.\n";

    $former=(int)$pdo->query("SELECT user_id FROM users WHERE email='staff@example.invalid'")->fetchColumn();
    rejects(fn()=>archiveOsaAdministrator($pdo,$admin,$admin,true),'Current administrator archived.');
    rejects(fn()=>archiveOsaAdministrator($pdo,$former,$admin,true),'Former administrator granted archive authority.');
    $staleArchive=endpoint($database,'api/osa/staff/archive.php',['user_id'=>$former,'action'=>'archive'],$admin,'stale');
    check(($staleArchive['error_code']??'')==='REAUTHENTICATION_REQUIRED','Archive skipped reauthentication.');
    $anonymousArchive=endpoint($database,'api/osa/staff/archive.php',['user_id'=>$former,'action'=>'archive']);
    check(($anonymousArchive['error_code']??'')==='AUTHENTICATION_REQUIRED','Archive allowed anonymous actor.');
    $archived=endpoint($database,'api/osa/staff/archive.php',['user_id'=>$former,'action'=>'archive'],$admin);
    check(($archived['ok']??false),'Archive endpoint failed.');
    check((bool)$pdo->query("SELECT osa_archived_at FROM users WHERE user_id=$former")->fetchColumn(),'Archive not persisted.');
    rejects(fn()=>archiveOsaAdministrator($pdo,$admin,$former,true),'Duplicate archive accepted.');
    rejects(fn()=>$pdo->exec("UPDATE users SET osa_archived_at=NOW() WHERE user_id=$admin"),'Database allowed archived active admin.');
    $restored=endpoint($database,'api/osa/staff/archive.php',['user_id'=>$former,'action'=>'restore'],$admin);
    check(($restored['ok']??false),'Restore endpoint failed.');
    $formerRow=$pdo->query("SELECT is_active,osa_archived_at FROM users WHERE user_id=$former")->fetch();
    check((int)$formerRow['is_active']===0 && $formerRow['osa_archived_at']===null,'Restore granted sign-in access.');
    $pdo->exec("CREATE TRIGGER test_archive_audit BEFORE INSERT ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Forced archive audit failure'");
    rejects(fn()=>archiveOsaAdministrator($pdo,$admin,$former,true),'Archive ignored audit failure.');
    check($pdo->query("SELECT osa_archived_at FROM users WHERE user_id=$former")->fetchColumn()===null,'Failed archive was not rolled back.');
    $pdo->exec('DROP TRIGGER test_archive_audit');
    echo "PASS: archive/restore, authorization, inactive-only enforcement, audit rollback.\n";

    $body = ['employee_number'=>'12-123-abcd','first_name'=>'Incoming','last_name'=>'Admin','email'=>'incoming@example.invalid',
        'phone'=>'+63 9000000000','password'=>'TestPassword123!','confirm_password'=>'TestPassword123!','privacy_consent'=>true];
    check(normalizeOsaEmployeeNumber('12-123-éäöü')==='12-123-ÉÄÖÜ' && isValidOsaEmployeeNumber('12-123-ÉÄÖÜ'),'Unicode employee ID normalization or validation differs from browser.');
    check(isValidOsaEmployeeNumber('12-123-😀😃😄😁'),'Four Unicode characters must count as four characters.');
    foreach (["12-123-AB\x01D", "12-123-AB\x00D", "12-123-AB\x7FD", '12-123-AB​D'] as $invalid) {
        check(!isValidOsaEmployeeNumber($invalid),'Invisible employee ID character accepted.');
    }
    rejects(fn()=>submitOsaRegistration($pdo,array_merge($body,['first_name'=>str_repeat('A',100),'last_name'=>str_repeat('B',97).' C'])),'Submitted name would overflow the user first-name column on approval.');
    check(osaTextLength(splitOsaRegistrationName(str_repeat('É',99).' Admin')[0])===99,'Valid multibyte name rejected or counted as bytes.');
    foreach ([[1], true, 1.5, '1e2', '-1', '9999999999999999999999999'] as $invalidId) {
        check(osaRequestUserId($invalidId)===0,'Malformed account ID coerced into a transfer target.');
    }
    function challenge(PDO $pdo, array $body): array {
        $token = generateOpaqueToken();
        $pdo->prepare("INSERT INTO email_otp_challenges (challenge_token_hash,purpose,email,identifier,otp_hash,expires_at,resend_available_at)
            VALUES (?,'osa_registration',?,?,?,DATE_ADD(NOW(),INTERVAL 10 MINUTE),DATE_ADD(NOW(),INTERVAL 60 SECOND))")
            ->execute([hashOtpToken($token),normalizeOtpEmail($body['email']),normalizeOsaEmployeeNumber($body['employee_number']),password_hash('123456',PASSWORD_DEFAULT)]);
        return [$token, (int)$pdo->lastInsertId()];
    }
    check(otpRecipientIsEligible($pdo, 'osa_registration', $body['email'], '12-123-ABCD'), 'Public OSA OTP incorrectly requires an invitation.');
    rejects(fn() => submitOsaRegistration($pdo, $body), 'Unverified submission accepted.');
    [$token, $challengeId] = challenge($pdo, $body);
    rejects(fn() => verifyOtpChallenge($token, '000000'), 'Wrong OTP accepted.');
    check((int)$pdo->query("SELECT attempt_count FROM email_otp_challenges WHERE challenge_id=$challengeId")->fetchColumn() === 1, 'Failed OTP attempt not counted.');
    rejects(fn() => createOtpChallenge('osa_registration', $body['email'], '12-123-ABCD'), 'Resend cooldown bypassed.');
    $body['verification_token'] = verifyOtpChallenge($token, '123456');
    rejects(fn() => verifyOtpChallenge($token,'123456'), 'OTP verification reused.');
    rejects(fn() => submitOsaRegistration($pdo, array_merge($body,['email'=>'changed@example.invalid'])), 'Changed email accepted.');
    rejects(fn() => submitOsaRegistration($pdo, array_merge($body,['employee_number'=>'12-124-ABCD'])), 'Changed employee ID accepted.');
    rejects(fn() => submitOsaRegistration($pdo, array_merge($body,['employee_number'=>'123-123-ABCD'])), 'Invalid format accepted.');
    $request = submitOsaRegistration($pdo, $body);
    foreach (['student','organization_adviser'] as $type) {
        $pdo->prepare("INSERT INTO users (email,password_hash,first_name,last_name,account_type) VALUES (?,?,'Role','Test',?)")->execute([$type.'@example.invalid',$hash,$type]);
        $nonOsa=(int)$pdo->lastInsertId();
        $forbidden=endpoint($database,'api/osa/profile/update.php',['full_name'=>'Changed User','email'=>$type.'@example.invalid','phone'=>'+63 9000000000','employee_number'=>'19-123-ABCD'],$nonOsa);
        check(($forbidden['ok']??true)===false && str_contains($forbidden['error']??'','authorized'),'Non-OSA user can update OSA employee ID.');
        check($pdo->query("SELECT employee_number FROM users WHERE user_id=$nonOsa")->fetchColumn()===null,'Forbidden profile update modified a non-OSA account.');
        $pdo->exec("DELETE FROM users WHERE user_id=$nonOsa");
    }
    $profile=['full_name'=>'Test Admin','email'=>'primary@example.invalid','phone'=>'+63 9000000000','employee_number'=>'19-123-ABCD'];
    $staleId=endpoint($database,'api/osa/profile/update.php',$profile,$admin,'stale');
    check(($staleId['error_code']??'')==='REAUTHENTICATION_REQUIRED','Employee ID change skipped reauthentication.');
    $reservedId=endpoint($database,'api/osa/profile/update.php',array_merge($profile,['employee_number'=>'12-123-ABCD']),$admin);
    check(($reservedId['ok']??true)===false && str_contains($reservedId['error']??'','pending'),'Employee ID overwrote a pending registration identity.');
    $badType=endpoint($database,'api/osa/profile/update.php',array_merge($profile,['employee_number'=>['19-123-ABCD']]),$admin);
    check(($badType['ok']??true)===false,'Array employee ID accepted.');
    $profileSaved=endpoint($database,'api/osa/profile/update.php',$profile,$admin);
    check(($profileSaved['ok']??false) && $profileSaved['user']['employee_number']==='19-123-ABCD','Valid employee ID update failed.');
    $pdo->prepare('UPDATE users SET employee_number=? WHERE user_id=?')->execute(['osa-legacy',$admin]);
    $legacy=endpoint($database,'api/osa/profile/update.php',array_merge($profile,['employee_number'=>'OSA-LEGACY']),$admin,'stale');
    check(($legacy['ok']??false) && $legacy['user']['employee_number']==='osa-legacy','Unchanged legacy employee ID blocks unrelated profile edits.');
    $pdo->prepare('UPDATE users SET employee_number=? WHERE user_id=?')->execute(['19-123-ABCD',$admin]);
    $malformed=endpoint($database,'api/auth/register-osa.php',array_merge($body,['first_name'=>['Incoming']]));
    check(($malformed['ok']??true)===false && str_contains($malformed['error']??'','text'),'Malformed registration type did not return clean validation JSON.');
    $malformedOtp=endpoint($database,'api/auth/otp/send.php',['purpose'=>'osa_registration','email'=>$body['email'],'identifier'=>['12-123-ABCD']]);
    check(($malformedOtp['ok']??true)===false && str_contains($malformedOtp['error']??'','text'),'Malformed OTP request did not return clean validation JSON.');
    $malformedTransfer=endpoint($database,'api/osa/staff/transfer-primary.php',['user_id'=>[$former]],$admin);
    check(($malformedTransfer['ok']??true)===false && str_contains($malformedTransfer['error']??'','Select'),'Malformed transfer target did not return clean validation JSON.');
    $pendingLogin=endpoint($database,'api/auth/login.php',['identifier'=>$body['email'],'password'=>$body['password']]);
    check(($pendingLogin['ok']??true)===false && str_contains($pendingLogin['error']??'','Account not found'),'Pending applicant can sign in.');
    $noOtp=endpoint($database,'api/auth/register-osa.php',array_merge($body,['employee_number'=>'16-123-ABCD','email'=>'nootp@example.invalid','verification_token'=>'']));
    check(($noOtp['ok']??true)===false && str_contains($noOtp['error']??'','verification'),'Public registration accepted missing OTP.');
    $stale=endpoint($database,'api/accounts/requests/action.php',['requestId'=>$request,'action'=>'approve'],$admin,'stale');
    check(($stale['error_code']??'')==='REAUTHENTICATION_REQUIRED','Approval did not require recent authentication.');
    $unauthorized=endpoint($database,'api/accounts/requests/action.php',['requestId'=>$request,'action'=>'approve']);
    check(($unauthorized['error_code']??'')==='AUTHENTICATION_REQUIRED','Anonymous approval allowed.');
    $public=array_merge($body,['employee_number'=>'17-123-abcd','email'=>'public@example.invalid']);
    [$publicToken]=challenge($pdo,$public);
    $public['verification_token']=verifyOtpChallenge($publicToken,'123456');
    $submitted=endpoint($database,'api/auth/register-osa.php',$public);
    check(($submitted['ok']??false) && ($submitted['status']??'')==='pending' && !isset($submitted['user'],$submitted['session']),'Public submission did not return pending-only response.');
    $publicReject=endpoint($database,'api/accounts/requests/action.php',['requestId'=>$submitted['reg_id'],'action'=>'reject'],$admin);
    check(($publicReject['ok']??false) && $publicReject['transfer_completed']===false,'Request rejection endpoint failed.');
    check((int)$pdo->query('SELECT ABS(TIMESTAMPDIFF(SECOND,reviewed_at,CURRENT_TIMESTAMP)) FROM pending_registrations WHERE reg_id='.(int)$submitted['reg_id'])->fetchColumn()<5,'Review timestamp is not using the database clock.');
    foreach (['api/auth/osa-invitations/inspect.php','api/osa/staff/invite.php','api/osa/staff/status.php','api/osa/staff/delete.php',
        'api/osa/staff/invitations/resend.php','api/osa/staff/invitations/revoke.php'] as $route) {
        $disabled=endpoint($database,$route,[],$admin);
        check(($disabled['ok']??true)===false && str_contains($disabled['error']??'','retired'),'Legacy endpoint still works: '.$route);
    }
    check((int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() === 3, 'Pending request created a user.');
    $row = $pdo->query("SELECT * FROM pending_registrations WHERE reg_id=$request")->fetch();
    check($row['status'] === 'pending' && $row['employee_number'] === '12-123-ABCD' && password_verify($body['password'],$row['password_hash']), 'Pending data/hash incorrect.');
    check(!otpRecipientIsEligible($pdo,'osa_registration',$body['email'],'12-123-ABCD'), 'Duplicate pending request eligible for OTP.');
    rejects(fn() => submitOsaRegistration($pdo,$body), 'Duplicate pending registration accepted.');
    rejects(fn() => reviewOsaRegistration($pdo,$admin+1,$request,'approve'), 'Non-primary actor approved.');
    check(reviewOsaRegistration($pdo,$admin,$request,'reject')['transfer_completed'] === false, 'Reject transferred access.');
    rejects(fn() => submitOsaRegistration($pdo,$body), 'Consumed verification token reused after rejection.');
    reviewOsaRegistration($pdo,$admin,$request,'reopen');
    $pdo->prepare("INSERT INTO users (email,password_hash,first_name,last_name,account_type) VALUES (?,?,'Duplicate','Student','student')")
        ->execute([$body['email'],$hash]);
    $duplicateId=(int)$pdo->lastInsertId();
    rejects(fn()=>reviewOsaRegistration($pdo,$admin,$request,'approve'),'Duplicate identity approved.');
    $pdo->exec("DELETE FROM users WHERE user_id=$duplicateId");
    // Force an audit failure after the user changes to prove the entire transfer rolls back.
    $pdo->exec("ALTER TABLE audit_logs ADD CONSTRAINT test_audit_failure CHECK (action <> 'osa_administrator_transferred')");
    rejects(fn() => reviewOsaRegistration($pdo,$admin,$request,'approve'), 'Audit failure did not abort transfer.');
    check((int)$pdo->query("SELECT is_active FROM users WHERE user_id=$admin")->fetchColumn() === 1, 'Outgoing admin deactivated after failed transfer.');
    check($pdo->query("SELECT status FROM pending_registrations WHERE reg_id=$request")->fetchColumn() === 'pending', 'Failed transfer changed request.');
    check((int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() === 3, 'Failed transfer leaked new user.');
    $pdo->exec('ALTER TABLE audit_logs DROP CONSTRAINT test_audit_failure');
    echo "PASS: OTP binding, cooldown, single use, pending-only registration, reject/reopen, rollback.\n";

    $expired = array_merge($body,['employee_number'=>'13-123-ABCD','email'=>'expired@example.invalid']);
    [$expiredToken,$expiredId] = challenge($pdo,$expired);
    $pdo->exec("UPDATE email_otp_challenges SET expires_at=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE challenge_id=$expiredId");
    rejects(fn() => verifyOtpChallenge($expiredToken,'123456'), 'Expired OTP accepted.');
    [$attemptToken,$attemptId] = challenge($pdo,$expired);
    for ($i=0; $i<OTP_MAX_ATTEMPTS; $i++) rejects(fn() => verifyOtpChallenge($attemptToken,'000000'), 'Wrong code accepted.');
    rejects(fn() => verifyOtpChallenge($attemptToken,'123456'), 'OTP attempt limit bypassed.');
    [$verificationToken,$verificationId] = challenge($pdo,$expired);
    $expired['verification_token'] = verifyOtpChallenge($verificationToken,'123456');
    $pdo->exec("UPDATE email_otp_challenges SET verification_expires_at=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE challenge_id=$verificationId");
    rejects(fn() => submitOsaRegistration($pdo,$expired), 'Expired verification accepted.');
    $rollback=array_merge($body,['employee_number'=>'15-123-ABCD','email'=>'rollback@example.invalid']);
    [$rollbackToken,$rollbackId]=challenge($pdo,$rollback);
    $rollback['verification_token']=verifyOtpChallenge($rollbackToken,'123456');
    $pdo->exec("ALTER TABLE pending_registrations ADD CONSTRAINT test_insert_failure CHECK (email <> 'rollback@example.invalid')");
    rejects(fn()=>submitOsaRegistration($pdo,$rollback),'Insert failure ignored.');
    check($pdo->query("SELECT consumed_at FROM email_otp_challenges WHERE challenge_id=$rollbackId")->fetchColumn()===null,'Failed submission consumed OTP verification.');
    $pdo->exec('ALTER TABLE pending_registrations DROP CONSTRAINT test_insert_failure');

    // Two real independent DB connections race to approve different pending applicants.
    $second = array_merge($body,['employee_number'=>'14-123-ABCD','email'=>'second@example.invalid']);
    [$secondToken] = challenge($pdo,$second);
    $second['verification_token'] = verifyOtpChallenge($secondToken,'123456');
    $secondRequest = submitOsaRegistration($pdo,$second);
    $processes=[];
    foreach ([$request,$secondRequest] as $id) {
        $pipes=[];
        $process=proc_open([PHP_BINARY,__FILE__,'worker',$database,(string)$admin,(string)$id],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
        check(is_resource($process),'Could not launch concurrency worker.'); fclose($pipes[0]);
        $processes[]=[$process,$pipes];
    }
    $results=[];
    foreach($processes as [$process,$pipes]) { $results[]=trim(stream_get_contents($pipes[1])); $errors=stream_get_contents($pipes[2]); fclose($pipes[1]);fclose($pipes[2]);check(proc_close($process)===0,'Concurrency worker failed: '.$errors); }
    sort($results);check($results===['approved','rejected'],'Concurrent approvals did not yield exactly one winner.');
    check((int)$pdo->query("SELECT COUNT(*) FROM users WHERE account_type='osa_staff' AND is_active=1 AND is_primary_osa=1")->fetchColumn()===1,'Transfer violated singleton.');
    check((int)$pdo->query("SELECT is_active FROM users WHERE user_id=$admin")->fetchColumn()===0,'Former admin still active.');
    $winner=(int)$pdo->query("SELECT user_id FROM users WHERE account_type='osa_staff' AND is_active=1")->fetchColumn();
    $approved=(int)$pdo->query("SELECT reg_id FROM pending_registrations WHERE status='approved'")->fetchColumn();
    rejects(fn()=>reviewOsaRegistration($pdo,$winner,$approved,'approve'),'Repeated approval accepted.');
    check((int)$pdo->query("SELECT COUNT(*) FROM pending_registrations WHERE status='pending'")->fetchColumn()===1,'Other applicant was discarded.');
    check((int)$pdo->query("SELECT COUNT(*) FROM audit_logs WHERE action='osa_administrator_transferred'")->fetchColumn()===1,'Transfer audit missing or duplicated.');
    $pipes=[];$guard=proc_open([PHP_BINARY,__FILE__,'guard',$database,(string)$admin],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
    fclose($pipes[0]);$result=json_decode(stream_get_contents($pipes[1]),true);fclose($pipes[1]);fclose($pipes[2]);proc_close($guard);
    check(($result['error_code']??'')==='AUTHENTICATION_REQUIRED','Former admin session retained API access.');
    $remaining=(int)$pdo->query("SELECT reg_id FROM pending_registrations WHERE status='pending'")->fetchColumn();
    $transferred=endpoint($database,'api/accounts/requests/action.php',['requestId'=>$remaining,'action'=>'approve'],$winner);
    check(($transferred['ok']??false) && ($transferred['transfer_completed']??false),'Approval endpoint did not return transfer-completed response.');
    $outgoing=endpoint($database,'api/auth/login.php',['identifier'=>'primary@example.invalid','password'=>$body['password']]);
    check(($outgoing['ok']??true)===false,'Outgoing administrator can sign in.');
    $now=(int)$pdo->query("SELECT user_id FROM users WHERE account_type='osa_staff' AND is_active=1")->fetchColumn();
    rejects(fn()=>transferOsaAdministrator($pdo,$now,$now),'Self transfer accepted.');
    archiveOsaAdministrator($pdo,$now,$admin,true);
    rejects(fn()=>transferOsaAdministrator($pdo,$now,$admin),'Archived transfer target accepted.');
    archiveOsaAdministrator($pdo,$now,$admin,false);
    $pdo->exec("CREATE TRIGGER test_direct_transfer BEFORE INSERT ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Forced transfer audit failure'");
    rejects(fn()=>transferOsaAdministrator($pdo,$now,$admin),'Direct transfer ignored audit failure.');
    check((int)$pdo->query("SELECT is_active FROM users WHERE user_id=$now")->fetchColumn()===1,'Failed direct transfer disabled current admin.');
    check((int)$pdo->query("SELECT is_active FROM users WHERE user_id=$admin")->fetchColumn()===0,'Failed direct transfer activated target.');
    $pdo->exec('DROP TRIGGER test_direct_transfer');
    $staleTransfer=endpoint($database,'api/osa/staff/transfer-primary.php',['user_id'=>$admin],$now,'stale');
    check(($staleTransfer['error_code']??'')==='REAUTHENTICATION_REQUIRED','Direct transfer skipped recent authentication.');
    $anonymousTransfer=endpoint($database,'api/osa/staff/transfer-primary.php',['user_id'=>$admin]);
    check(($anonymousTransfer['error_code']??'')==='AUTHENTICATION_REQUIRED','Anonymous direct transfer allowed.');
    $direct=endpoint($database,'api/osa/staff/transfer-primary.php',['user_id'=>$admin],$now);
    check(($direct['ok']??false) && ($direct['transfer_completed']??false),'Direct transfer endpoint failed.');
    check((int)$pdo->query("SELECT user_id FROM users WHERE account_type='osa_staff' AND is_active=1 AND is_primary_osa=1")->fetchColumn()===$admin,'Direct transfer activated wrong account.');
    check((int)$pdo->query("SELECT COUNT(*) FROM users WHERE account_type='osa_staff' AND is_active=1")->fetchColumn()===1,'Direct transfer violated singleton.');
    check(password_verify($body['password'],$pdo->query("SELECT password_hash FROM users WHERE user_id=$admin")->fetchColumn()),'Direct transfer changed target credentials.');
    $oldActor=endpoint($database,'api/osa/staff/transfer-primary.php',['user_id'=>$winner],$now);
    check(($oldActor['error_code']??'')==='AUTHENTICATION_REQUIRED','Outgoing direct-transfer actor retained access.');
    $staleAuthority=endpoint($database,'api/osa/staff/transfer-primary.php',['user_id'=>$winner],$admin,'old-authority');
    check(($staleAuthority['error_code']??'')==='AUTHENTICATION_REQUIRED','Old session revived after authority transferred back.');
    $staleSession=endpoint($database,'api/auth/session.php',[],$admin,'old-authority');
    check(($staleSession['authenticated']??true)===false,'Session refresh revived old administrator authority.');
    rejects(fn()=>transferOsaAdministrator($pdo,$admin,$winner,0),'Locked mutation accepted a stale authority version.');
    echo "PASS: direct authority transfer, archive exclusion, reauthentication, audit rollback, and former account reactivation.\n";
    echo "PASS: expiration, attempt limit, concurrent approvals, repeated approval, audit, outgoing session revocation.\n";
} finally {
    if ($pdo->inTransaction()) $pdo->rollBack();
    $pdo->exec('USE `' . str_replace('`','``',$source) . '`');
    $pdo->exec('DROP DATABASE `' . $database . '`');
}
