# Transaction Notification Email Delivery

The transaction email dispatcher sends future equipment rental, locker,
printing request, and attendance notification transitions. It does not send organization
announcements.

## 1. Apply the database migration

Apply:

```text
database/migrations/20260724_create_transaction_notification_email_delivery.sql
database/migrations/20260724_add_printing_notification_delivery.sql
```

The migrations record the general activation time and a separate printing
activation time. Notifications whose activity time is at or before the
relevant activation time are intentionally skipped, preventing a first-run
email burst when either delivery feature is enabled.

## 2. Configure the environment

The dispatcher uses the same SMTP variables as OTP email:

```text
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_ENCRYPTION=tls
SMTP_USERNAME=notifications@example.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=notifications@example.com
SMTP_FROM_NAME=NAAP Account Security
APP_BASE_URL=https://your-production-domain.example/CAPSTONE/demo
```

`APP_BASE_URL` must not end with `/`. The CLI process must receive these
variables too. For Windows Task Scheduler, define them as Windows user/system
environment variables rather than only in Apache configuration.

All transaction messages authenticate through this one mailbox. The visible
sender name is `<Organization> via NAAP`; replies use the organization's valid
contact email when one is configured.

## 3. Verify without sending

From the project directory:

```text
C:\xampp\php\php.exe cli\dispatch-notification-emails.php --dry-run
```

Dry-run mode does not create delivery rows and does not contact SMTP.

## 4. Local Windows/XAMPP schedule

Create a Windows Task Scheduler task:

- Trigger: repeat every 1 minute indefinitely.
- Program: `C:\xampp\php\php.exe`
- Arguments: `"C:\xampp\htdocs\CAPSTONE\demo\cli\dispatch-notification-emails.php"`
- Start in: `C:\xampp\htdocs\CAPSTONE\demo`
- Run whether the user is logged on or not.
- Do not start a new instance if the task is already running.

The dispatcher also uses a MySQL advisory lock, so overlapping invocations exit
without duplicating delivery.

## 5. Hosted production schedule

Use the hosting control panel's cron feature. Example:

```text
* * * * * /usr/bin/php /absolute/path/to/cli/dispatch-notification-emails.php
```

Use the PHP CLI path and project path provided by the host. Production should
use hosted cron so delivery continues while the development PC is offline.

## Delivery behavior

- A stable notification ID is sent only once per student.
- Student profile category switches are enabled by default.
- A failure is retried after 1, 5, and 15 minutes.
- The fourth failed attempt becomes a final failure.
- Retrying and final failures appear only on the related organization's
  officer dashboard.
- Delivery payload details older than 90 days are redacted while the stable
  deduplication row remains archived.
- Printing notifications cover submission, provider acceptance, processing,
  ready-to-claim, claimed, and cancellation transitions. Queue reordering does
  not send email.
- SMTP failure never interrupts the underlying rental, locker, printing, or
  attendance transaction.
