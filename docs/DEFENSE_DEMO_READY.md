# Prepared local defense demonstration

Prepared for **Tuesday, October 6, 2026, approximately 5:00 PM, Asia/Manila**, allowing for a delayed start. This data is in the local XAMPP `capstone_db`; it has not been uploaded to a hosted deployment.

## Open the demonstration

Double-click [open-defense-demo.cmd](../cli/open-defense-demo.cmd), or run:

```powershell
node cli/defense-demo-browser.cjs --open
```

This opens five separate Edge profiles and authenticates the student, AISERS officer, AISERS adviser, SSC reviewer, and OSA. The browser profiles and credentials are stored in `%TEMP%\capstone-defense-demo`, outside the web root. Ordinary tabs in your normal browser continue to share a session; use the prepared profiles.

The setup helper uses the existing **localhost-only OSA test login** to preload OSA. During the defense, demonstrate normal OSA login by signing out in that OSA profile, logging in normally, and entering the fresh code received in Gmail. The email test confirmed SMTP delivery; it did not consume an OTP or change any passwords. Request a fresh code during the demonstration because codes expire after ten minutes.

Open the [student code card](defense-demo/student-code.html) locally or print [the PDF card](defense-demo/student-code-card.pdf). Both the QR and barcode contain `12324MN-000080`. Open the [timer](defense-demo/timer.html) on your presenter screen and start it when your demonstration begins.

The helper blocks browser notification prompts in the demo profiles. Turn on Windows **Do not disturb** on the defense computer before presenting. Physical scanner/camera operation and that computer's display and notification settings still need a check on the actual equipment.

## Accounts and email inbox

| Role | Login identifier | Organization | Email |
| --- | --- | --- | --- |
| Student | `12324MN-000080` | Student portal | `bkateyasmine02@gmail.com` |
| Organization officer | `12324MN-000080` | AISERS | Same account and email as the student |
| Organization adviser | `aisersadviser` | AISERS | `bkateyasmine02+adviser@gmail.com` |
| SSC reviewer | `DEMO-SSC-2026` | SSC | `bkateyasmine02+ssc@gmail.com` |
| Primary OSA | `osa` | OSA | `bkateyasmine02+osa@gmail.com` |

Use the previously supplied passwords for the existing accounts. The SSC password is in `%TEMP%\capstone-defense-demo\ssc-credentials.json`; the launcher reads it automatically. Unique Gmail aliases satisfy the database's unique-email requirement while reaching the same inbox. Student transaction email preferences are enabled for rentals, attendance, printing, and lockers.

## Five real documents

Each PDF has two pages of proposal content, including objectives, schedule, budget, safety provisions, and evaluation. Seeded feedback and decisions are explicitly marked as defense examples.

| Document | ID | Current stage | Prepared feedback |
| --- | --- | --- | --- |
| [DEMO 01 - Technical Skills Workshop](defense-demo/DEMO-01-workshop-proposal.pdf) | 135 | Awaiting adviser review | Two adviser highlights/comments; no approval yet |
| [DEMO 02 - Equipment Support Clinic](defense-demo/DEMO-02-equipment-clinic.pdf) | 136 | Awaiting SSC review | Adviser approval and notes, two adviser annotations, one SSC annotation |
| [DEMO 03 - Student Engagement Day](defense-demo/DEMO-03-student-engagement.pdf) | 137 | Awaiting OSA review | Adviser and SSC approvals/notes, four annotations across the three reviewing roles |
| [DEMO 04 - Financial Literacy Seminar](defense-demo/DEMO-04-financial-literacy.pdf) | 138 | Adviser approved; ready to Send to SSC | Real proposal PDF, adviser approval notes and two adviser annotations |
| [DEMO 05 - Peer Mentoring Orientation](defense-demo/DEMO-05-peer-mentoring.pdf) | 139 | SSC approved; ready to Send to OSA | Real proposal PDF, adviser and SSC approval notes, two adviser annotations and one SSC annotation |

The application intentionally hides internal adviser feedback from external reviewing offices. Therefore, the SSC viewer shows its permitted SSC comment, and the OSA viewer shows the permitted SSC and OSA comments. AISERS retains the organization's review history.

Show all three stages in AISERS Documents, then preview the corresponding document in each reviewer profile. For one live final decision, use **DEMO 03** in OSA and refresh its status in AISERS. The sample proposals concern future activities; they are not signed official authorizations. Their protected PDFs and earlier decision snapshots have not been rewritten.

For live forwarding, click **Send to SSC** on DEMO 04 (138), then refresh the SSC Documents page to show the incoming request. Click **Send to OSA** on DEMO 05 (139), then refresh OSA Documents. The adviser can see both records; SSC already sees DEMO 05 through its review history. OSA receives these requests only after forwarding. The three earlier examples remain available on the appropriate review pages. The forwarding demonstration was checked inside a rolled-back transaction, leaving both buttons ready for the defense. These records and PDFs are prepared locally; they have not been uploaded to your deployed server.

## Attendance and announcements

- **[DEMO] AISERS Student Engagement Day**, event **19**: October 6 at 5 PM. The provided student has no attendance record in this event, leaving it ready for the live time-in scan. Use time-out after the explanation.
- **[DEMO] AISERS Technical Skills Orientation**, event **20**: a prepared completed attendance example for the existing student, with both timestamps.
- **[DEMO] AISERS Equipment Support Clinic**, event **21**: October 7 at 9 AM, with the student pre-registered.
- **[DEMO] Offline Attendance Rehearsal**, event **22**: a separate unpublished event used for the successful offline synchronization and duplicate-scan checks. This preserved the live event's empty attendance state.
- Announcement **37** links to the live engagement-day event and is visible to students.

Export attendance through **Events → view event details → Export Event Data**. Exporting from the event details screen was tested. The live scanning page does not display the older `exportRecords` control referenced by its shared script.

## Rentals, printing, and lockers

| Example | Record | Ready action |
| --- | --- | --- |
| Available AISERS Shoe Rag | Inventory 74, barcode `SH002` | Show the remaining available stock |
| Student Shoe Rag reservation | Rental 25, inventory 62, barcode `SH001` | Existing AISERS item reserved for `12324MN-000080`, October 7, 9–11 AM, PHP 20 |
| Student Business Calculator reservation | Rental 27, inventory 61, barcode `BCALC001` | Existing AISERS item reserved for `12324MN-000080`, October 6, 5:10–7:10 PM, PHP 20 |
| Queued printing request | Print job 59 | Start processing |
| Printing ready to claim | Print job 58 | Preview the real handout and demonstrate claiming/payment |
| Completed printing job | Print job 57 | Claimed and paid, PHP 15; available in financial records |
| Pending demo locker | Rental 26, locker Z91 | SSC can approve the demo SSC user's request |
| Available demo locker | Z92 | Show an available locker on the SSC board |

Printing uses [this real handout PDF](defense-demo/DEMO-printing-handout.pdf). Rentals and printing belong to AISERS; lockers belong to SSC. Your existing student's **A01 locker assignment was preserved**. Because the system permits one open locker per student, the new Z91 request uses the clearly labeled demo SSC student account.

Printing now displays a permanent numeric **request number**, unique within each organization. It remains visible during processing, pickup, and completed history; queue position is separate and may change. Existing requests were numbered oldest first, including finished and cancelled requests. New numbers continue upward without reusing completed references. Printing notification emails include the request number. When an unaccepted request is taken by a different provider, it receives that provider's next number. The original printing rows are backed up in `%TEMP%\capstone-defense-demo\before-printing-numbers.json`.

At the user's request, 8 waived AISERS printing requests were subsequently removed and its 11 retained requests renumbered oldest first as **1–11**. The next AISERS request will be **12**. The completed, ready-to-claim, and queued handout examples now have reference numbers **9, 10, and 11**, respectively; their database IDs remain 57, 58, and 59. Unsent email references were updated; delivered emails retain their original historical numbers. The cleanup backup is `%TEMP%\capstone-defense-demo\before-waived-printing-cleanup-20261004-175001.json`. This was a one-time cleanup; normal completion does not renumber other requests.

The three demo calculator items (75–77), their empty Defense Demo Equipment category, and their two seeded rental examples (23–24) were removed at the user's request. Reservation 25 now uses real AISERS Shoe Rag stock, including its actual pricing and overtime settings. Genuine rental history was preserved. The scoped backup is `%TEMP%\capstone-defense-demo\before-shoe-rag-replacement.json`.

The Business Calculator reservation is an explicitly requested **after-hours defense example**. Normal student booking still requires rentals to end by 5 PM. Officers can start reservation 27 from 4:55 PM until before 7:10 PM on October 6; after the scheduled end it is handled as a no-show. Its actual inventory rate is PHP 10/hour. Its setup and schedule are tracked privately in the manifest; the CLI helper reuses the existing reservation on repeat runs.

Completed printing examples were prepared on October 4. Use **All Time** or a date range including October 4–6 for financial and analytics demonstrations. Use printing job 58 for the live claim/payment workflow; the Shoe Rag reservation remains scheduled for the following morning.

## OSA accounts and reporting

The primary OSA account can view organizations, service authorization, account management, and audit logs. SSC services were enabled for its locker demonstration; AISERS already had rental and printing authorization.

Pending registration **21**, **Defense Demo Applicant**, identifier `DEMO-APPLICANT-01`, is ready in the OSA account queue. Its eligibility-roster entry is prepared, and its email is `bkateyasmine02+applicant@gmail.com`. It is a seeded demonstration request. Its generated password is in the private temporary `applicant-credentials.json` file if you approve it during a demonstration.

Financial XLSX and event attendance XLSX exports were generated successfully. They are in `%TEMP%\capstone-defense-demo\exports`. Gemini insights loaded successfully through the actual analytics endpoint, using the recorded data. Existing charts and generated insights may need refreshing after a live transaction or filter change.

## Email demonstration

Four explicitly labeled demonstration transaction emails were accepted by SMTP and recorded as sent: rental reservation, printing ready to claim, completed attendance, and pending locker request. Adviser password-recovery and OSA login OTP emails were also sent. **The user confirmed that the emails arrived in Gmail.** No passwords were reset.

Earlier sent email records retain their original recipients. New demo email replay records demonstrate delivery to the requested Gmail inbox without rewriting sent history. The email sender reports contain no SMTP passwords or plaintext OTPs.

For a live email, process a printing request or scan attendance, then refresh Gmail. Background dispatch is already operating locally; allow time for delivery. Document comments and announcements are demonstrated in the portal; do not promise email delivery for features that do not send it. Earlier calculator reservation emails remain historical messages; the current reservation shown in the portal is for Shoe Rag.

## Verification, backup, and repeat use

Verified through isolated browser profiles: all five logins and role contexts; student services and notifications; each permitted PDF preview and annotations; financial report and XLSX export; attendance XLSX export; OSA audit access; SSC locker board; Gemini insights; offline attendance queuing/synchronization; duplicate attendance handling. A small PDF toolbar fix now shows the actual page count in the officer/adviser viewer.

Backup screenshots are in `docs/defense-demo`, including the three reviewer previews, student services, financial summary, analytics, and attendance. These are local screenshots of prepared examples; use them as labeled backups if loading or equipment interrupts the live demonstration.

The original database backup is `%TEMP%\capstone-defense-demo\before-preparation.sql`. Private manifests and delivery/browser reports are in that same directory. Do not import the full backup over new work merely to reset a demonstration. Do not delete these temporary files before the defense: the launcher and generated-account credentials depend on them.

The preparation scripts reuse tracked IDs instead of adding duplicates. They do not undo approvals, returns, or claims performed during rehearsal. Before October 6, confirm that the five documents and live transactions remain in their intended starting states. Browser sessions still obey the normal expiry rules; use the launcher again shortly before presenting.
