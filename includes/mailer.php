<?php

use PHPMailer\PHPMailer\Exception as MailerException;
use PHPMailer\PHPMailer\PHPMailer;

require_once __DIR__ . '/../config/mail.php';

class MailDeliveryException extends RuntimeException
{
    public string $category;

    public function __construct(string $category, string $message)
    {
        parent::__construct($message);
        $this->category = $category;
    }
}

function createConfiguredMailer(): PHPMailer
{
    $autoload = __DIR__ . '/../vendor/autoload.php';
    if (!is_file($autoload)) {
        throw new MailDeliveryException('dependency', 'Email service dependency is not installed.');
    }
    require_once $autoload;

    $config = getMailConfig();
    if (!$config['username'] || !$config['password'] || !$config['from_email']) {
        throw new MailDeliveryException('configuration', 'SMTP is not configured.');
    }
    if (!filter_var($config['from_email'], FILTER_VALIDATE_EMAIL)) {
        throw new MailDeliveryException('configuration', 'The configured SMTP sender address is invalid.');
    }

    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host = $config['host'];
    $mail->Port = $config['port'];
    $mail->SMTPAuth = true;
    $mail->Username = $config['username'];
    $mail->Password = $config['password'];
    $mail->CharSet = 'UTF-8';
    $mail->Timeout = 20;
    $mail->SMTPSecure = $config['encryption'] === 'ssl'
        ? PHPMailer::ENCRYPTION_SMTPS
        : PHPMailer::ENCRYPTION_STARTTLS;
    return $mail;
}

function classifyMailDeliveryFailure(string $message): string
{
    $normalized = strtolower($message);
    if (str_contains($normalized, 'authenticate') || str_contains($normalized, 'password')) {
        return 'authentication';
    }
    if (str_contains($normalized, 'recipient') || str_contains($normalized, 'address')) {
        return 'recipient';
    }
    if (str_contains($normalized, 'connect') || str_contains($normalized, 'timed out')
        || str_contains($normalized, 'could not instantiate')) {
        return 'connection';
    }
    return 'transport';
}

function sendConfiguredEmail(
    string $recipient,
    string $subject,
    string $htmlBody,
    string $textBody,
    string $fromName,
    ?string $replyTo = null,
    ?string $replyToName = null
): void {
    if (!filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
        throw new MailDeliveryException('recipient', 'The recipient email address is invalid.');
    }

    $config = getMailConfig();
    $mail = createConfiguredMailer();
    try {
        $mail->setFrom($config['from_email'], $fromName);
        $mail->addAddress($recipient);
        if ($replyTo && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
            $mail->addReplyTo($replyTo, $replyToName ?: $fromName);
        }
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body = $htmlBody;
        $mail->AltBody = $textBody;
        $mail->send();
    } catch (MailerException $e) {
        throw new MailDeliveryException(
            classifyMailDeliveryFailure($e->getMessage()),
            'The email service could not deliver this message.'
        );
    }
}

function sendOtpEmail(string $recipient, string $otp, string $purpose): void
{
    $config = getMailConfig();
    $labels = [
        'student_registration' => 'student registration',
        'org_registration' => 'organization registration',
        'osa_registration' => 'OSA registration',
        'password_reset' => 'password reset',
    ];
    $label = $labels[$purpose] ?? 'account verification';

    try {
        $safeOtp = htmlspecialchars($otp, ENT_QUOTES, 'UTF-8');
        $safeLabel = htmlspecialchars($label, ENT_QUOTES, 'UTF-8');
        $body = '<p>Your verification code for ' . $safeLabel . ' is:</p>'
            . '<p style="font-size:28px;font-weight:bold;letter-spacing:6px">' . $safeOtp . '</p>'
            . '<p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>';
        sendConfiguredEmail(
            $recipient,
            'Your NAAP verification code',
            $body,
            "Your verification code for {$label} is {$otp}. It expires in 10 minutes.",
            (string)$config['from_name']
        );
    } catch (MailDeliveryException $e) {
        error_log('[mailer] OTP email delivery failed.');
        throw new RuntimeException('Could not send the verification email.');
    }
}
