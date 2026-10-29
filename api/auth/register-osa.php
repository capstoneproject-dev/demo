<?php
/** OTP-verified registration creates a pending request, never an active account or session. */
require_once __DIR__ . '/../../includes/osa_registration.php';
header('Content-Type: application/json');
requirePost();
rateLimitEnsureAllowed('osa_registration_submit', 'ip:' . rateLimitClientIp(), 10, 600);
try {
    $id = submitOsaRegistration(getPdo(), getRequestBody());
    jsonOk(['reg_id' => $id, 'status' => 'pending', 'message' => 'Email verified. Registration submitted for administrator approval.']);
} catch (InvalidArgumentException $e) {
    jsonError($e->getMessage(), 422);
} catch (PDOException $e) {
    error_log('[api/auth/register-osa] ' . $e->getMessage());
    jsonError('Could not submit registration. Please try again.', 409);
}
