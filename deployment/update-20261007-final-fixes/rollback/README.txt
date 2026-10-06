ROLLBACK - FINAL FIXES AND OSA RENTAL ADJUSTMENTS

rollback/upload/ contains 24 OLD runtime files from a50a11328259e994f2faa50647da12a0af517246.
These are repository baseline copies; prefer live backups if they differ.
The 5 new files have no previous version. Their exact paths are recorded
in REMOVE-NEW-FILES.txt and ../DEPLOYMENT-FILES.json.

1. Enter maintenance and pause rental writes. Preserve the live database and
   audit trail, including adjustments made after deployment.
2. Upload the CONTENTS of rollback/upload/ to the application root, preserving
   relative paths and overwriting the matching files. Upload sw.js LAST.
3. Delete ONLY the five new paths listed in REMOVE-NEW-FILES.txt from the live
   application. Do not delete containing directories or unrelated files.
4. Refresh PHP OPcache if needed. Reload online and close/reopen old tabs.
   The restored worker uses naap-static-v63 and naap-runtime-v63. If necessary,
   unregister it and remove only naap-* Cache Storage; keep local storage and
   IndexedDB to retain pending offline records.
5. Verify dashboards, profiles, attendance, rental returns and payments.

DATA LIMITATION
This is a FILE rollback, not a database rollback. No SQL is executed. Existing
closed-rental adjusted totals and waived statuses remain stored; audit entries
remain intact. The old code does not apply the new open-rental adjustment ledger
or consistently handle imported open overdue records. If adjustments were saved,
reconcile affected rentals using their audit records before reopening rental
operations. Do not blindly restore an old database over newer live transactions.
Keep this folder outside the public web directory.
