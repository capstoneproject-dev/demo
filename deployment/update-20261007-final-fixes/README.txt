DEPLOYMENT UPDATE - FINAL FIXES AND OSA RENTAL ADJUSTMENTS
7 October 2026

SOURCE AND SCOPE
Upload: c7e2eda1ce46813366a6b34a79aa6922a40bbfe2
Rollback: a50a11328259e994f2faa50647da12a0af517246 (the reference commit's parent)
Contains 29 runtime files: 24 replacements and 5 new files.
This incremental package requires the parent version already on the server.
Files are exact Git commit bytes, not copies of an older deployment bundle.
Includes rental pricing/adjustments, OTP approval, overdue feeds/timers and
notifications, profile email verification/loading and field restrictions,
manual attendance options, document filtering, OSA date selection/audit display,
and matching offline asset manifests. Tests are excluded from upload.

DEPLOY
1. Back up the matching LIVE files and database outside the public web directory.
   Compare any custom live changes with the rollback baseline before overwriting.
2. Confirm the parent application's schema is already installed, including
   audit_logs and email_otp_challenges. Existing rental payment_status must
   support 'waived'. This commit introduces no SQL migration or config change.
   Keep your database, SMTP, analytics credentials and runtime config unchanged.
3. Use a short maintenance window; pause rental writes while replacing files.
   Upload the CONTENTS of upload/ into the application root, preserving paths.
   Include new files. Do not upload this package's README, manifest or rollback/.
   Upload PHP includes/API files and JS/CSS assets before their dashboard pages;
   upload sw.js LAST, after every other file is in place.
4. Refresh PHP OPcache through hosting controls if files are not revalidated.
5. Reload online and close/reopen old tabs. Confirm service-worker caches
   naap-static-v73 and naap-runtime-v73. For persistent stale assets, unregister
   this application's worker and clear only its naap-* Cache Storage entries;
   retain local storage/IndexedDB containing pending offline work.

VERIFY
- Student, officer and OSA logins and dashboards still load.
- Profile email changes require OTP sent to the NEW address, show loading and
  save only after verification. Student/officer full names remain uneditable.
- Manual attendance accepts name-only input, optional student number, other
  programs/sections and N/A. Event filters removed from the intended views.
- Repository semester/period/year filters update the visible documents.
- OSA monitoring date selection works and the rental detail modal scrolls.
- OSA -> Monitoring -> organization -> Recent Activities -> View rental ->
  Adjust Rental. Only authorized admins can adjust unpaid equipment rentals.
  Cancelled/incorrect OTP saves nothing; valid OTP saves amount/reason/approver
  in the audit trail. Paid rental histories cannot be changed.
- Closed rentals adjusted to zero become waived. Another unpaid completed
  rental still blocks borrowing; waiving the last debt clears that block.
- Active and unreturned overdue rentals retain the approved adjustment while
  NEW overtime blocks continue charging. Student/officer amounts agree; an
  overdue-only student feed starts its timer. Return applies the adjustment
  and shows it separately in the payment breakdown. Waived notices show settled.
- A price change during OTP approval must reject the stale request with 409;
  reopen the form to review the current amount and approve again.
- OSA audit detail omits browser/device and IP display; audit storage is retained.
- Reopen dashboards/scanner online to warm updated offline assets, then verify
  their cached interface loads offline. OTP/adjustment writes require online.

No test accounts, temporary databases, user uploads, secrets or ZIP are included.
Nothing has been deployed. Manifest records SHA-256, bytes and Git blobs.
See rollback/README.txt for old files and removal of newly added files.
