ROLLBACK - PRINTING REQUEST NUMBERS

These 10 old application files come from:
9f4d7f8d622aa9b4bf9952eb361e5597507ac039
They are Git baseline versions, not copies downloaded from your live server.
Use your pre-deployment live backup if the live files had additional changes.

FILE ROLLBACK (recommended first)
1. Pause traffic and the transaction-email dispatcher.
2. Upload the CONTENTS of rollback/upload/ into the application root, preserving paths.
3. Delete includes/printing_numbers.php AFTER restoring all old files. This is the new
   file listed in DELETE-AFTER-ROLLBACK.txt; there is no old version of it to upload.
4. Keep the added request_number column, counters, index, and triggers initially.
   The old application ignores the added reference field and continues using queue positions.
   Keeping the schema preserves references and avoids unnecessary data loss.
5. Reload online so the restored service worker installs cache v44. Close/reopen tabs;
   if needed, clear only the application's naap-static-* and naap-runtime-* caches.
   Do not delete IndexedDB/local storage or pending offline operations.
6. Verify printing submission, processing, claiming, history, and email delivery; resume service.

OPTIONAL FULL SCHEMA REVERSAL
Use database-rollback.sql only after restoring the old files and taking another full
database backup, with traffic and the dispatcher stopped. Select the correct database
in phpMyAdmin or your SQL client. It removes ONLY the added numbering triggers, counters,
unique index, and reference column. It does not delete the print_jobs table or normal jobs.
The SQL uses MariaDB DROP ... IF EXISTS syntax. Running it discards new reference numbers.
It does not restore requests removed by the optional waived-request cleanup.

DATA ROLLBACK FOR WAIVED CLEANUP
Use the full pre-cleanup database export or have the database administrator restore the
specific deleted requests, email records, and old counter from the private cleanup snapshot.
Do not import a full old database over newer transactions without reconciling those changes.
The update's --apply cleanup saves those records in the supplied private backup directory.
Neither uploading old files nor running database-rollback.sql restores deleted data.

Keep rollback instructions, SQL, deletion lists, and backups outside the public web root.
