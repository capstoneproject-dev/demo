PRINTING REQUEST NUMBER UPDATE
4 October 2026 (Asia/Manila)

Source: f0632fe748125225c05dd8cf835623534318b58a
Previous version: 9f4d7f8d622aa9b4bf9952eb361e5597507ac039

This incremental package contains 11 application files from the source commit.
rollback/upload contains the 10 previous files from its parent commit.
The new includes/printing_numbers.php has no previous version; rollback has a deletion list.
Repository versions are not backups of separate changes already on your live server.
No ZIP was generated and nothing has been deployed.

WHAT CHANGES
- Plain permanent request numbers (1, 2, 3...) independently within each organization.
- Numbers stay visible through processing, pickup, and history.
- Queue position remains separate and can change when requests are reordered.
- Existing printing requests receive numbers oldest first within each organization.
- New requests do not reuse completed numbers; printing emails include the reference.
- Service worker cache advances from v44 to v45.

BEFORE UPLOADING
1. Back up the live files listed in DEPLOYMENT-FILES.json and export the full live database.
   Store database exports outside public_html. Keep them until deployment is verified.
2. Confirm the live application has the parent version or compatible preceding updates.
   This is not a complete application package. Existing config, vendor dependencies,
   private uploads, and the preceding local-mock update are not bundled here.
3. Pause the transaction-email dispatcher and put the application into maintenance mode
   so no requests or printing writes race with deployment, migration, or optional cleanup.
4. The schema helper uses MariaDB syntax (including CREATE OR REPLACE TRIGGER,
   ADD COLUMN IF NOT EXISTS, and UPDATE ... ORDER BY). Confirm hosting compatibility.
   The database account needs ALTER, CREATE, TRIGGER, SELECT, INSERT, UPDATE, DELETE,
   access to schema metadata, and support for GET_LOCK/IS_USED_LOCK.
   Existing production compatibility is not verified by this package.

UPLOAD AND MIGRATE
1. Upload the CONTENTS of upload/ into your existing application root. Preserve paths
   and overwrite all matching files together. Do not upload this package as an app folder.
2. Keep tools/, rollback/, these instructions, and the manifests outside public_html.
   CLI tools require PHP CLI and refuse HTTP execution. Do not expose them through a browser.
3. From a server terminal, run (replace the paths with your actual hosting paths):

   php /home/ACCOUNT/printing-update/tools/migrate-printing-numbers.php --app-root=/home/ACCOUNT/public_html --backup-dir=/home/ACCOUNT/printing-backups

   This saves a private JSON snapshot of printing rows, installs the reference column,
   counters, unique index and triggers, numbers existing records, and updates unsent
   printing messages. It does not delete waived requests or rewrite delivered emails.
   The JSON snapshot complements your full database backup; it is not a full SQL restore.
4. Run the read-only verification:

   php /home/ACCOUNT/printing-update/tools/migrate-printing-numbers.php --app-root=/home/ACCOUNT/public_html --backup-dir=/home/ACCOUNT/printing-backups --verify

   If terminal access is unavailable, ask the hosting administrator to run these CLI
   commands. Do not remove their CLI guard or upload a public migration endpoint.

OPTIONAL AISERS WAIVED-REQUEST CLEANUP
The earlier removal of 8 waived requests happened only in the local demo database.
No local student records, credentials, SQL dumps, or attachments are bundled.
The hosted database may have different requests and counts.

Preview the exact live rows first:
   php /home/ACCOUNT/printing-update/tools/clean-waived-printing.php --app-root=/home/ACCOUNT/public_html --backup-dir=/home/ACCOUNT/printing-backups --org-code=AISERS

To apply that cleanup on the hosted database:
   php /home/ACCOUNT/printing-update/tools/clean-waived-printing.php --app-root=/home/ACCOUNT/public_html --backup-dir=/home/ACCOUNT/printing-backups --org-code=AISERS --apply

The apply command backs up printing rows, relevant email records, and the counter;
deletes only the selected organization's payment_status=waived requests; renumbers
its retained requests oldest first; sets the next number; removes unsent messages for
deleted requests; and updates retained unsent message references. Attached files and
already-delivered email history are preserved. Other organizations are unaffected.
This is a one-time cleanup, not automatic renumbering whenever a request finishes.
Previously delivered emails can contain pre-cleanup reference numbers.
Restoring deleted requests requires your pre-cleanup database backup, not file rollback.

VERIFY AND RESUME
- Officer printing: Queued, Processing, and Ready to Claim rows all show request numbers.
- Reordering changes queue position without changing request number.
- History keeps the same references; student cards show the same number as the officer.
- Separate organizations may each have number 1; no duplicates exist inside one organization.
- A new request continues after the highest allocated number, including after completion.
- A normal printing status notification email includes the request number.
- Resume the dispatcher and normal traffic after checks pass.
- Reload online to install cache v45. Close/reopen old tabs if required. If clearing caches,
  clear only naap-static-* and naap-runtime-*; retain IndexedDB/local storage and offline work.

ROLLBACK
See rollback/README.txt. File rollback can safely leave the added numbering schema in
place. Full schema reversal and restoring cleanup-deleted records are separate operations.

PACKAGE CONTENTS
upload/                 11 application files from the requested commit
rollback/upload/        10 previous application files
rollback/               rollback instructions, deletion list, optional schema reversal SQL
tools/                  private CLI migration, verification, and optional cleanup helpers
DEPLOYMENT-FILES.json    source revisions and application-file hashes
PACKAGE-HASHES.json      hashes for the packaged files
VALIDATION.json         package validation results
