<?php

use PHPMailer\PHPMailer\Exception as MailerException;
use PHPMailer\PHPMailer\PHPMailer;

require_once __DIR__ . '/../config/mail.php';

function sendOtpEmail(string $recipient, string $otp, string $purpose): void
{
    $autoload = __DIR__ . '/../vendor/autoload.php';
    if (!is_file($autoload)) {
        throw new RuntimeException('Email service dependency is not installed.');
    }
    require_once $autoload;

    $config = getMailConfig();
    if (!$config['username'] || !$config['password'] || !$config['from_email']) {
        throw new RuntimeException('SMTP is not configured.');
    }

    $labels = [
        'student_registration' => 'student registration',
        'org_registration' => 'organization registration',
        'osa_registration' => 'OSA registration',
        'password_reset' => 'password reset',
    ];
    $label = $labels[$purpose] ?? 'account verification';

    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host = $config['host'];
        $mail->Port = $config['port'];
        $mail->SMTPAuth = true;
        $mail->Username = $config['username'];
        $mail->Password = $config['password'];
        $mail->CharSet = 'UTF-8';
        $mail->SMTPSecure = $config['encryption'] === 'ssl'
            ? PHPMailer::ENCRYPTION_SMTPS
            : PHPMailer::ENCRYPTION_STARTTLS;

        $mail->setFrom($config['from_email'], $config['from_name']);
        $mail->addAddress($recipient);
        $mail->isHTML(true);
        $mail->Subject = 'Your NAAP verification code';
        $safeOtp = htmlspecialchars($otp, ENT_QUOTES, 'UTF-8');
        $safeLabel = htmlspecialchars($label, ENT_QUOTES, 'UTF-8');
        $mail->Body = '<p>Your verification code for ' . $safeLabel . ' is:</p>'
            . '<p style="font-size:28px;font-weight:bold;letter-spacing:6px">' . $safeOtp . '</p>'
            . '<p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>';
        $mail->AltBody = "Your verification code for {$label} is {$otp}. It expires in 10 minutes.";
        $mail->send();
    } catch (MailerException $e) {
        error_log('[mailer] OTP email delivery failed.');
        throw new RuntimeException('Could not send the verification email.');
    }
}
