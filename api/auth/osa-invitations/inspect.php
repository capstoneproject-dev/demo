<?php
require_once __DIR__ . '/../../../includes/auth.php';
header('Content-Type: application/json');
jsonError('OSA invitations and direct staff changes have been retired. Use OSA registration and Account Verification to approve an administrator transfer.', 410);
