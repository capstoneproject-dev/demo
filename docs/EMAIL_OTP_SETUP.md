# Email OTP setup

The OTP code and SMTP password are handled only by PHP. The browser receives
opaque challenge and verification tokens, never the OTP stored by the server.

## 1. Gmail account

1. Use a dedicated Gmail account for the application.
2. Enable two-step verification on that account.
3. Create a Google App Password for Mail. Use the 16-character App Password,
   not the normal Gmail password.

## 2. Environment variables

Define the following variables for the Windows account that launches the XAMPP
Control Panel/Apache, then completely restart the XAMPP Control Panel and
Apache so PHP receives the new environment:

```text
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_ENCRYPTION=tls
SMTP_USERNAME=your-dedicated-account@gmail.com
SMTP_PASSWORD=your-google-app-password
SMTP_FROM_EMAIL=your-dedicated-account@gmail.com
SMTP_FROM_NAME=NAAP Account Security
```

Do not add real credentials to `config/mail.php`, source control, JavaScript,
or the database dump.

## 3. Dependency and database

PHPMailer is managed by `composer.json` and `composer.lock`. On another machine,
install it from the project directory with:

```powershell
C:\xampp\php\php.exe composer.phar install --no-dev --prefer-source
```

Apply `database/migrations/20260710_create_email_otp_challenges.sql` to an
existing database. New database imports already receive the table from
`capstone_db.sql`.

## OTP policy

- Six numeric digits
- Ten-minute code lifetime
- Five verification attempts
- Sixty-second resend cooldown
- Ten requests per IP address per ten minutes
- A new code invalidates older codes for the same email and purpose
- Successful verification tokens expire after ten minutes and are single-use
