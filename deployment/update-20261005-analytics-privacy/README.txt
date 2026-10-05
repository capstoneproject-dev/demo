DEPLOYMENT UPDATE - ANALYTICS FEEDBACK PRIVACY
5 October 2026

SOURCE AND SCOPE
Updated files come directly from commit 88d9d046430cde619ca190956a9a760dad366b7b.
Rollback files come from its parent, recorded in DEPLOYMENT-FILES.json.
This is an incremental update for a server already running the parent version
(7eba3db). It does not include earlier analytics, printing, or other updates.
The local checkout was older than the source commit; upload files were extracted
from the requested commit, not copied from that older checkout.

Contains four runtime files:
- assets/js/officerAnalytics.js
- includes/analytics_ai.php
- pages/officerDashboard.html
- sw.js

Updates document-feedback privacy, final approval status handling, Unicode-safe
truncation, annotation coverage, and final generated document guidance checks.
Original reviewer comments and annotations remain unchanged in local reports.
Privacy detection is best effort and may omit comments; detected unsafe AI
guidance causes a full rule-based fallback.

DEPLOY
1. Check that your live application already contains the parent version and its
   dependencies. If it has custom changes in these files, compare them first.
2. Back up the four matching live files outside the public application directory.
3. During a short maintenance window, upload the CONTENTS of upload/ to the
   application root containing assets/, includes/, pages/, and sw.js. Preserve
   the relative paths and overwrite all four files together. Do not upload the
   outer package folder, rollback/, this README, or the manifest to the web root.
4. Finish uploading sw.js last. If PHP OPcache does not revalidate changed files,
   refresh OPcache through your hosting panel or restart PHP using host controls.
5. Reload online so the service worker installs cache v63. Close and reopen
   existing application tabs if they retain the previous interface. The browser
   and server insight cache version is 23, so previous explanations are bypassed.

VERIFY
- Sign in as an authorized organization officer and open Analytics.
- Generate insights with approved/rejected document feedback. Known full names
  become general roles in the AI input; original recorded feedback remains intact.
- Confirm adviser/SSC-approved documents still awaiting final approval do not
  contribute to successful-document feedback analysis.
- Check ordinary instructions such as "Ask for clarification" remain usable.
- Confirm annotations-loading failures are reflected in report coverage.
- Check the overview, filter changes, PDF/CSV reports, and rule-based fallback.
- Confirm a second request for unchanged data can reuse cached insights.
- In developer tools, confirm officerAnalytics.js uses analytics-privacy-2 and
  the service worker uses naap-static-v63 / naap-runtime-v63.
- Check existing attendance, rentals, printing, and dashboard pages still load.

No database migration or configuration change is required. Keep the existing
Gemini configuration and server credentials. No credentials, database dumps,
user uploads, tests, or generated insight caches are included in this package.
DEPLOYMENT-FILES.json contains source revisions, Git blob IDs, byte sizes, and
SHA-256 hashes for both upload and rollback files.
No ZIP was created. Nothing has been deployed to the server.

ROLLBACK
See rollback/README.txt. The rollback files are repository baseline versions,
not downloaded live-server backups. Prefer your live backups if they differ.
