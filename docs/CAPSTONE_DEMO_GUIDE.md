# Capstone system demonstration: 5–10 minutes

Aim for eight minutes, leaving up to two minutes for loading delays or panel questions. Cover every major module, but demonstrate only a few representative transactions. Use your approved thesis title in the introduction; the current login page is branded NAAP Student Organization Portal.

This guide is based on the local pages and implementation. The local demonstration records are now prepared; see [the prepared demo checklist](DEFENSE_DEMO_READY.md) for the accounts, exact records, launch instructions, and verified checks. Rehearse on the actual defense deployment to confirm its data and integrations match this local setup.

## Prepare before the defense

Confirmed demonstration accounts:

- Student and AISERS officer login: `12324MN-000080` (credentials supplied for the demonstration).
- AISERS organization adviser: `aisersadviser`. Verified in the local database as active, with AISERS dashboard access and document-review permission; organization management is disabled. The supplied adviser password matches the stored hash.
- Main OSA login: `osa` (credentials supplied for the demonstration).
- Dedicated SSC reviewer: `DEMO-SSC-2026`. Its generated password is stored outside the web root in the Windows temporary `capstone-defense-demo/ssc-credentials.json` file.

The student/AISERS account uses `bkateyasmine02@gmail.com`; adviser, OSA, and SSC use the `+adviser`, `+osa`, and `+ssc` Gmail aliases, respectively. They deliver to the same inbox. The user confirmed receipt of the demonstration emails.

Defense schedule: **Tuesday, October 6, 2026, at approximately 5:00 PM (Asia/Manila)**. The live event is scheduled at 5 PM. The student's existing AISERS **Shoe Rag (`SH001`)** is reserved for October 7, 9–11 AM, PHP 20. Show this scheduled reservation; demonstrate a live printing claim/payment during the defense. The three demo calculators and their two seeded rental examples have been removed.

- Use clearly labeled demo accounts and records. Prepare a student, an organization officer, an organization adviser with document-review permission, an SSC reviewer, and an OSA account with the permissions needed for account management and audit logs.
- Keep each role signed in through a separate browser profile or browser. Ordinary tabs in the same profile share the PHP session, so logging into another role can replace the first role's session. Label windows by role and open the needed pages beforehand.
- Use one recognizable scenario: **Demo Student attends Demo Organization's event and requests a service; officers manage the records; OSA oversees the organization.**
- Prepare an announcement and event, a valid student QR/barcode, one available rental item, a printing PDF, an available locker, and a short proposal PDF. Make sure the demonstration organization has the relevant services authorized. Use a second organization account if necessary.
- Prepare a document at each relevant stage: awaiting adviser review, adviser-approved, SSC-approved, awaiting OSA review, and a finalized record with a revision. This lets you explain the complete route without processing every stage live.
- Prepare a rental awaiting processing and a completed transaction for reports. Keep printing and locker examples ready as well.
- Test your scanner, email OTP, file preview, exports, and any AI insights on the defense computer. Preload charts and insights. Do not spend demonstration time waiting for email or AI generation.
- Rehearse an offline operation and synchronization only if you plan to show them. Sign in online and load the required screen first. Keep screenshots or a short recording of the same workflow as backup.
- Set a timer, enlarge the screen enough for the panel to read, and silence unrelated notifications.

## Eight-minute sequence and speaking script

### 0:00–0:25 — Purpose and login

**Show:** Login page, briefly point to registration and password recovery, then switch to the signed-in student window.

**Say:** “Good day. Our system centralizes student organization information, event attendance, student services, and document review. I will demonstrate how students, organization officers, advisers, SSC, and OSA use the system in one connected workflow. Access depends on the user's role.”

Mention email verification or OSA login OTP as configured in your deployment. Complete one normal login live only if it fits your rehearsal timing; keep the remaining roles signed in.

### 0:25–1:15 — Student portal

**Show:** Dashboard → Announcements → Organizations → Services. Briefly open Profile or a notification.

**Say:** “The student dashboard provides announcements and event information. Students can browse organizations, view organization details and membership information, and access available services. Their requests and notifications help them follow transaction progress, while their profile contains their personal account details.”

**Action:** Open the demo event and its registration option if available. Show one service request or submit a prepared rental request. Save the detailed service processing for the officer screen.

**Visible result:** The event details or service request appears with its current status.

### 1:15–2:00 — Officer dashboard, announcements, and events

**Show:** Officer Dashboard → Announcements → Events.

**Say:** “Officers manage their organization's information and operations. They can publish announcements for selected audiences and manage events. These records feed the information students see, reducing the need to maintain separate copies.”

**Action:** Open a prepared announcement and point to its audience. Show the demo event and schedule. If publishing an announcement is one of your chosen live transactions, prepare the text before starting and show its appearance in the student view.

**Visible result:** A matching announcement or event is visible across the relevant officer and student views.

### 2:00–2:45 — QR/barcode attendance

**Show:** Event attendance screen and the selected demo event.

**Say:** “The attendance module records student participation through QR or barcode scanning. It supports time-in and time-out, checks duplicate attendance, and provides records that can be exported for documentation.”

**Action:** Scan one prepared student code for time-in and point to the new row and timestamp. Point to time-out and the export control. Optionally repeat the scan to show duplicate handling if this works reliably in rehearsal.

**Visible result:** One attendance record appears for the student and event.

### 2:45–4:00 — Services, inventory, and financial records

**Show:** Services Tracker → Rentals, Printing Queue, Locker Services, and Financial Summary, where authorized. In rentals, briefly show Inventory and Rental History.

**Say:** “The services module connects student requests with officer processing. For rentals, officers manage inventory, availability, issuance, returns, and payment records. Printing has a queue with job and payment statuses. Locker services support requests, assignment, and release. The financial summary brings the service transactions together for monitoring and export.”

**Action:** Show the student's AISERS Business Calculator reservation (October 6, 5:10–7:10 PM, PHP 20) and start it if presenting within its permitted start window, 4:55 PM to before 7:10 PM. This is a prepared after-hours defense example; normal student bookings must end by 5 PM. Show the reserved Shoe Rag for October 7 and the remaining available stock. Preview printing job 58 and demonstrate claiming/payment. Use the prepared locker request to explain its workflow. Show a financial total and one export control.

**Visible result:** The Shoe Rag reservation appears in the student and officer views, and the printing transaction progresses to claimed/paid. Point out that printing request numbers stay the same through processing and pickup and remain in history; each organization has its own sequence, while waiting queue positions can change. Printing emails contain the same request number. Refresh the financial summary when needed; do not assume every screen refreshes automatically.

### 4:00–5:30 — Documents, adviser, SSC, and OSA review

**Show:** Officer Documents, adviser document review, SSC review, and OSA Documents using prepared records.

**Say:** “Officers submit categorized PDF documents and track their review status. A regular organization's submission starts with its adviser. After adviser approval, an officer forwards it to SSC. After SSC approval, the organization forwards it to OSA for final review. Reviewers can inspect the PDF and record decisions and feedback. Finalized records and linked revisions preserve the document's history.”

**Action:** Open one PDF and show a comment or annotation. Point to the adviser and SSC decisions on a prepared document, then approve one demo submission already awaiting OSA review. Refresh its officer record to show the outcome. Briefly point to a revision or repository filter.

**Visible result:** The OSA decision is recorded and the officer sees the updated status.

**Routing detail:** SSC's own documents go from adviser approval to OSA; they do not undergo SSC self-review. Forwarding is an officer action after the prior approval. Advisers have restricted organization access, with document review available when specifically permitted.

### 5:30–6:30 — OSA oversight and accounts

**Show:** OSA Dashboard → Organizations → Account → Audit Log, if permitted → Profile.

**Say:** “OSA has a central view of organization activity and document compliance. It can inspect organization details, authorize services, and handle account requests and student or officer records. Authorized staff can inspect audit entries to identify recorded actions. Profile settings support account maintenance.”

**Action:** Open the demo organization's monitoring view and point to compliance and service authorization. Show one account request or roster entry and a relevant audit entry. Point to notifications and profile settings without editing them.

**Visible result:** The panel sees administrative oversight, account management, and accountability in the same system.

### 6:30–7:15 — Analytics and reports

**Show:** Officer Analytics, a date filter, prepared charts or insights, and export options.

**Say:** “Analytics summarizes participation, service activity, and financial performance. Officers can filter the reporting period and export results. Where configured, AI-generated insights help interpret the available data; the recorded transactions and charts remain the basis of the report.”

**Action:** Apply one filter and explain one actual number on screen: “For this period, the system recorded [number] participants,” or “These transactions generated [amount] in recorded revenue.” Use the displayed values.

**Visible result:** A readable chart or report tied to your demonstration data.

### 7:15–7:45 — Offline support

**Show:** An offline status, one queued supported operation, then its synchronization result after reconnection, if rehearsed successfully. Otherwise use your prepared recording or explain the behavior briefly.

**Say:** “Supported operations can be queued locally during a connection interruption after the user has signed in and loaded the required resources. When connectivity returns, the system attempts synchronization and validates the queued work. I check the synchronization result to confirm that it was accepted.”

**Visible result:** The queued operation is accepted by the server, or a clear conflict/error is shown for resolution. A locally queued record is not yet a confirmed server transaction.

### 7:45–8:00 — Close

**Say:** “This demonstration covered student access, organization management, attendance, rental and other services, document review, OSA oversight, and reporting. The system connects these activities in one platform so users can follow requests and administrators can monitor the resulting records. Thank you.”

## If the panel gives you only five minutes

| Time | Coverage and action |
| --- | --- |
| 0:00–0:20 | Purpose, roles, login; point to registration and recovery. |
| 0:20–0:55 | Student dashboard, announcements, organizations, services, profile/notifications. Show one prepared request. |
| 0:55–1:20 | Officer dashboard, announcement audience, and event schedule. |
| 1:20–1:50 | Scan one student code; point to time-out and attendance export. |
| 1:50–2:40 | Process one rental; briefly show inventory, history, printing, lockers, and financial summary. |
| 2:40–3:40 | Explain adviser → SSC → OSA using prepared stages. Preview a PDF and show one OSA decision/status change. |
| 3:40–4:20 | OSA organization oversight, service authorization, account records, audit entry, and profile. |
| 4:20–4:45 | Show analytics, one real value, filters, and export; briefly explain supported offline queuing. |
| 4:45–5:00 | Close with the system's practical benefit. |

For five minutes, keep printing and locker records prepared and explain them on screen. Skip live registration, long form entry, fresh AI generation, and the network-disconnection exercise. All major modules still receive coverage.

## If you have ten minutes

Keep the eight-minute route and add one minute for an extra service transaction, such as accepting a printing job, and one minute for a stronger document or offline demonstration. Use the extra time to show a result rather than adding more navigation.

## Delivery and fallback cues

- Speak in the pattern: **purpose → action → visible result**. For example: “This tracks attendance. I scan the student's code. The timestamp now appears in the event record.”
- Avoid reading every field. Explain what the user accomplishes and why the recorded result matters.
- If a request takes more than about ten seconds, move to the prepared example and say: “I will use this prepared record to show the resulting state.” Clearly identify screenshots or recordings as prepared examples.
- Reserve the thesis methodology, ERD, architecture, and extensive security discussion for the presentation or questions unless the panel specifically asks for them during the demo.
- Describe demonstrated benefits as capabilities. Claim measured improvements, accuracy, or user satisfaction only when your evaluation supports them.

## Accuracy notes for defense questions

- The local implementation uses a PHP backend and MySQL through PDO. The existing `process_flow_diagram.md` mentions Firebase, which does not match the inspected database configuration. Use the architecture of your actual deployment in your explanation.
- The older `system_features.md` omits parts of the current portal and mentions bulk actions as a future feature. Do not present those bulk actions as implemented based on that document.
- Explain document routing accurately: regular organization → adviser → SSC → OSA, with officer forwarding between stages; SSC submissions → adviser → OSA.
- Offline support applies to supported queued operations and cached resources. Describe the supported workflow you have verified; avoid claiming every feature works fully offline.
- The analytics integration has a server-side AI endpoint. Confirm it is configured on the defense deployment before presenting generated insights live.

## Rehearsal completion checklist

- [ ] Finished the full route within eight minutes twice.
- [ ] Every major module appeared at least once.
- [ ] Demonstrated attendance, a service transaction, and a document outcome.
- [ ] Role switching preserved each account's session.
- [ ] Document stages, service authorization, and reporting filters matched the prepared data.
- [ ] No passwords, OTPs, private student information, or API keys appeared in projected material.
- [ ] Backup examples were ready and clearly labeled.
- [ ] Prepared a five-minute route and a one-sentence closing.
