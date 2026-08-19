<?php

require_once __DIR__ . '/../../../includes/otp.php';

header('Content-Type: application/json');
requirePost();
rateLimitEnsureAllowed('otp_send_ip', 'ip:' . rateLimitClientIp(), 10, 600);

$body = getRequestBody();
$purpose = trim((string)($body['purpose'] ?? ''));
$email = trim((string)($body['email'] ?? ''));
$identifier = trim((string)($body['identifier'] ?? ''));
$invitationToken = trim((string)($body['invitation_token'] ?? ''));
$studentName = trim((string)($body['student_name'] ?? ''));

// OSA login codes are issued only after the password has been validated by
// login.php. Do not expose that purpose through this public-purpose endpoint.
if ($purpose === 'osa_login') {
    jsonError('Invalid OTP purpose.', 422);
}

try {
    $challenge = createOtpChallenge($purpose, $email, $identifier, $invitationToken, $studentName);
    jsonOk([
        ...$challenge,
        'message' => 'If the supplied details are eligible, a verification code has been sent.',
    ]);
} catch (InvalidArgumentException $e) {
    jsonError($e->getMessage(), 422);
} catch (OtpRateLimitException $e) {
    header('Retry-After: ' . max(1, $e->retryAfter));
    header('Cache-Control: no-store');
    http_response_code(429);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage(),
        'error_code' => CAPSTONE_RATE_LIMIT_ERROR_CODE,
        'retry_after' => $e->retryAfter,
    ]);
    exit;
} catch (RuntimeException $e) {
    error_log('[api/auth/otp/send] ' . $e->getMessage());
    jsonError('Could not send the verification code right now.', 503);
} catch (Throwable $e) {
    error_log('[api/auth/otp/send] ' . $e->getMessage());
    jsonError('Could not send the verification code right now.', 500);
}
