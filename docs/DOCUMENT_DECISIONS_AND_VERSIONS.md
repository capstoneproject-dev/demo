# Document Decisions and Versions

## What changed

- An OSA review is now final. A pending submission can be approved or rejected once only.
- Approved repository rows and decision records are append-only and protected by database triggers.
- Officers correct a finalized document by using **Submit Revision**. This creates a new pending submission linked to the prior one instead of changing it.
- Every new uploaded PDF receives a SHA-256 fingerprint. Existing records are preserved as version 1; their fingerprint remains blank because the SQL migration does not read server files.
- Each approval or rejection is also written to the protected application audit log.

## Local installation (XAMPP)

The current local `capstone_db` has already been migrated. On another XAMPP computer, import the normal database backup first, then import:

`migrations/20260807_document_integrity_versioning.sql`

In phpMyAdmin, select the application database, choose **Import**, select that SQL file, and run it. The migration is idempotent, so rerunning it is safe.

Command-line alternative:

```powershell
C:\xampp\mysql\bin\mysql.exe -u root capstone_db --execute="source C:/xampp/htdocs/CAPSTONE/demo/migrations/20260807_document_integrity_versioning.sql"
```

If the production database uses a password, add `-p` and enter it when prompted. Do not put the password in source code.

## Shared-hosting deployment

1. Back up the database and private document storage.
2. Upload the changed PHP, JavaScript, and HTML files.
3. Import `migrations/20260807_document_integrity_versioning.sql` in the hosting control panel's phpMyAdmin.
4. Confirm the database account is allowed to create tables and triggers.
5. Run the test below if command-line PHP is available.

No background worker, framework, Composer package, or new server is required.

## Verification

```powershell
C:\xampp\php\php.exe tests/document-integrity-versioning-test.php
```

Expected result:

```text
PASS: one-time decisions, immutable snapshots, and linked revisions are enforced.
```

The test uses a database transaction and rolls back its temporary records.

Manual browser check:

1. Submit a PDF from an officer account.
2. Approve or reject it once in OSA.
3. Confirm the OSA action buttons disappear and a second direct review request is rejected.
4. In the officer dashboard, click **Submit Revision** on the finalized record and attach a new PDF.
5. Confirm the new record is pending and labeled with the next version number.
6. Confirm the earlier finalized version remains visible and unchanged.
