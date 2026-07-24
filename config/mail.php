<?php

/**
 * SMTP configuration. Set these values in Apache's environment and restart
 * Apache. Secrets must never be committed to this repository.
 */
function getMailConfig(): array
{
    $read = static function (string $name, ?string $default = null): ?string {
        $value = getenv($name);
        return $value === false || $value === '' ? $default : $value;
    };

    return [
        'host' => $read('SMTP_HOST', 'smtp.gmail.com'),
        'port' => (int)$read('SMTP_PORT', '587'),
        'username' => $read('SMTP_USERNAME', ''),
        'password' => $read('SMTP_PASSWORD', ''),
        'encryption' => strtolower((string)$read('SMTP_ENCRYPTION', 'tls')),
        'from_email' => $read('SMTP_FROM_EMAIL', $read('SMTP_USERNAME', '')),
        'from_name' => $read('SMTP_FROM_NAME', 'NAAP Account Security'),
        'app_base_url' => rtrim((string)$read('APP_BASE_URL', 'http://localhost/CAPSTONE/demo'), '/'),
    ];
}
