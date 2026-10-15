# OSA registration and administrator transfer rollout

The OSA option in registration now verifies the applicant's email with OTP and submits a pending `osa_staff` request. Only the current administrator can approve a replacement under Account Verification. **Approve & Transfer** deactivates the outgoing account, activates the incoming account, records the transfer, and signs out the outgoing administrator. Registration alone grants no dashboard access.

## Database migration

Deploy the code and run this migration with PHP CLI during maintenance, using the same runtime database configuration as the application:

```powershell
C:\xampp\php\php.exe database/migrations/20261015_single_osa_administrator.php
```

Back up the database first. The migration retains the single active account already marked `is_primary_osa = 1`, deactivates/demotes other OSA accounts, and revokes pending invitations. Existing account, invitation, and audit history is retained. It then creates a unique generated-column index allowing at most one active OSA account and a check requiring that account to be primary. Other account types are unaffected. `pending_registrations.requested_role` already accepts `osa_staff`, so no role-column change is needed.

If there is no unambiguous active primary account, the migration stops before changing accounts. An operator must select the correct administrator in the database and rerun it. There is no public first-admin creation or self-approval. The migration is rerunnable; schema changes commit separately because MariaDB/MySQL DDL commits implicitly. If DDL fails, keep the app in maintenance and correct the error before rerunning.

The retired invite, inspection, resend, revoke, status, and deletion endpoints return HTTP 410. Replace any external client still using invitation-based OSA registration. `register-osa.php` now returns `{ok, reg_id, status: "pending", message}` rather than a user/session. OSA approval through the existing request-action API returns `transfer_completed: true`; clients must discard the outgoing session and return to login. The new administrator uses the existing password-and-OTP sign-in flow.

The OSA Staff **Current** tab also offers **Transfer Authority** for inactive, unarchived former administrators. `POST api/osa/staff/transfer-primary.php` accepts `{user_id}` and atomically deactivates the actor and reactivates the selected existing account as the sole primary administrator. It preserves the target's credentials, requires current primary authority and recent reauthentication, records the transfer, destroys the outgoing session, and returns `transfer_completed: true`. Archived accounts must be restored before selection. This is separate from approval of new registrations.

## Verification

For the former-administrator archive UI, also run `C:\xampp\php\php.exe database/migrations/20261015_osa_administrator_archive.php` before serving the updated staff list. Archive moves an inactive OSA account to the separate Archived view; Restore returns it to the inactive list. Both actions require the current primary administrator and recent reauthentication, are audited, and preserve account history. Restoring an archived account never reactivates it. The active administrator cannot be archived.

```powershell
C:\xampp\php\php.exe tests/osa-registration-transfer.php
node --test tests/osa-registration-ui.test.cjs
```

The PHP suite creates and removes an empty disposable database, exercising OTP expiration and attempt/resend limits, token binding and consumption rollback, registration/review entrypoints, rejection, duplicates, reauthentication, disabled endpoints, migration preconditions/reruns, concurrent approvals, audit rollback, and outgoing session revocation. No application account records are used as fixtures. The JavaScript suite checks registration sequencing, employee-ID editing, transfer confirmation/redirect behavior, and the API response contract. These tests do not send live email; SMTP delivery should be verified with an authorized registration in the deployed environment.
