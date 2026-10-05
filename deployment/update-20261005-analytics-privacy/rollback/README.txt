ROLLBACK - ANALYTICS FEEDBACK PRIVACY UPDATE

rollback/upload/ contains the four old runtime files from the parent of
88d9d046430cde619ca190956a9a760dad366b7b. The exact rollback commit and file
hashes are recorded in ../DEPLOYMENT-FILES.json.
These are repository baseline files, not live-server backups.

1. During a short maintenance window, upload the CONTENTS of rollback/upload/
   to the existing application root, preserving paths and overwriting all four
   matching files. If your live files had custom changes before the update, use
   those live backups instead. Finish uploading sw.js last.
2. Refresh PHP OPcache through the hosting panel if changed PHP files are not
   being revalidated automatically.
3. Reload online and close/reopen application tabs. The restored service worker
   uses cache v58 and the restored analytics content-cache version is 18.
4. If stale assets remain, unregister this application's service worker and
   remove only its naap-static-* and naap-runtime-* Cache Storage entries through
   browser developer tools, then reload online. Do not clear local storage or
   IndexedDB, which may contain pending offline records.
5. Verify Analytics, PDF/CSV exports, and existing dashboard functions.

No database rollback, file deletion, or configuration rollback is required.
Rolling back restores the previous analytics behavior, including the privacy
and status-handling issues fixed by the update.
Keep this folder and its instructions outside the public web directory.
