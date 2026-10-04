DEPLOYMENT UPDATE - 4 October 2026

Contains the five current uncommitted replacement/addition files, including the new dashboard photo.

1. Back up the live files and database.
2. Upload the CONTENTS of upload/ to the existing application root (usually public_html). Preserve the api/, assets/, and pages/ paths and overwrite the matching files. Do not upload the upload/ folder itself.
3. Delete the old photo on the server using the path in DELETE-AFTER-UPLOAD.txt. Uploading files does not delete the old photo automatically.
4. If the hosted database is missing users.year_section, run database/20260929_split_student_account_roster.sql in phpMyAdmin against the application's database. This existing MariaDB migration adds required columns and initializes account institute/section values once using migration markers. The local database has already been repaired. Do not import a full development database.
5. Refresh login and OSA pages. Check NAAP text branding, the replacement photo, section validation (4-2 accepted; 123, 543, 789 rejected), and OSA Account Management loading and editing.

DEPLOYMENT-FILES.json contains SHA-256 hashes for the five upload files; all copies were verified against the working tree. Keep README.txt, the manifest, deletion list, and database/ outside the public directory.

No ZIP was created. No credentials, database dump, or user uploads are included. Nothing has been deployed or committed.
