<?php

require_once __DIR__ . '/../../../includes/otp.php';

header('Content-Type: application/json');
requirePost();

$body = getRequestBody();
$purpose = trim((string)($body['purpose'] ?? ''));
$email = trim((string)($body['email'] ?? ''));
$identifier = trim((string)($body['identifier'] ?? ''));

try {
    $challenge = createOtpChallenge($purpose, $email, $identifier);
    jsonOk([
        ...$challenge,
        'message' => 'If the supplied details are eligible, a verification code has been sent.',
    ]);
} catch (InvalidArgumentException $e) {
    jsonError($e->getMessage(), 422);
} catch (OtpRateLimitException $e) {
    http_response_code(429);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage(),
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
