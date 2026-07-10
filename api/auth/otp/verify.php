<?php

require_once __DIR__ . '/../../../includes/otp.php';

header('Content-Type: application/json');
requirePost();

$body = getRequestBody();
$challengeToken = trim((string)($body['challenge_token'] ?? ''));
$otp = trim((string)($body['otp'] ?? ''));

try {
    $verificationToken = verifyOtpChallenge($challengeToken, $otp);
    jsonOk([
        'verification_token' => $verificationToken,
        'expires_in' => OTP_VERIFICATION_SECONDS,
    ]);
} catch (InvalidArgumentException $e) {
    jsonError($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('[api/auth/otp/verify] ' . $e->getMessage());
    jsonError('Could not verify the code right now.', 500);
}
