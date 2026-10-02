# Session security deployment

The application uses PHP server-side sessions with synchronizer-token CSRF protection. No database migration is required.

## Production requirements

1. Deploy the application behind HTTPS.
2. If PHP cannot detect HTTPS at the application server (for example, TLS ends at a reverse proxy), set:

   ```text
   CAPSTONE_COOKIE_SECURE=1
   ```

3. Keep the default session limits unless the institution explicitly approves alternatives:

   ```text
   CAPSTONE_SESSION_IDLE_SECONDS=1800
   CAPSTONE_SESSION_ABSOLUTE_SECONDS=28800
   CAPSTONE_REAUTH_SECONDS=600
   ```

Apache deployments may define these with `SetEnv`; shared-hosting control panels may expose an environment-variable section. Restart PHP/Apache after changing server environment variables.

## Local XAMPP

No configuration is required for `http://localhost`. The session cookie remains non-Secure locally so browsers can send it over HTTP. Production deployments must use HTTPS and should set `CAPSTONE_COOKIE_SECURE=1` when automatic HTTPS detection is unavailable.

After deployment, log out and back in once, then confirm in browser developer tools that the PHP session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production.

## Session storage and parallel requests

For a single production web server, use PHP's file session handler with a dedicated,
persistent directory outside every public web root. Create the directory before
enabling it; only the PHP service account should have access (0700 on Linux, or an
equivalent Windows ACL). Do not use the application's public `storage/` directory.

Configure the production PHP INI settings or cPanel MultiPHP INI Editor:

```ini
session.save_handler = files
session.save_path = "/home/CPANEL_ACCOUNT/capstone-sessions"
session.gc_maxlifetime = 28800
```

Replace the example path with the real private directory. Keep `gc_maxlifetime`
aligned with `CAPSTONE_SESSION_ABSOLUTE_SECONDS`, and ensure garbage collection or
a hosting cleanup job removes expired session files. Verify the effective values
using the web PHP runtime, since CLI PHP can use a different configuration. Remove
any temporary diagnostic page after checking. Reload PHP/Apache as required by the
host. Changing the save path signs existing users out unless their session files
are securely migrated while requests are paused.

`apiGuard()` now saves authentication updates and releases the session lock before
the handler's business work. `guardSession()` does the same after saving page
activity. Session values remain readable as a snapshot for that request. CSRF
validation, session expiry, and permission refresh happen before release.
Existing session IDs are no longer reissued on every response, so an older
parallel response cannot overwrite a newly rotated login cookie. Browsers still
using a legacy narrow-path session cookie may need to log in once again when
that old cookie is removed; new session cookies use the root path.

Handlers that change session data must call `apiGuard(true)` on their first guard
call; nested guards retain that lock. This includes profile updates, organization
switching, reauthentication, and pending document upload tokens. Presence heartbeats
also retain it while recording presence, so logout cannot be followed by a stale
heartbeat. File download handlers retain it until their audit deduplication is
saved, then release it before
streaming. Do not restart a closed session to save an old snapshot: a concurrent
logout or organization switch may already have changed the stored session.

For multiple web servers, configure a shared session handler before scaling out.
Redis is an option if the installed PHP Redis extension is configured to lock
sessions and use private, authenticated storage with suitable expiry. Shared
storage without locking would make session updates race. This change adds no
shared handler or database tables; a database handler would require a separate
design review under the project's no-new-tables requirement.

Run `C:/xampp/php/php.exe tests/concurrency/auth-sessions.php` locally to verify
independent requests sharing a session can overlap while session writers stay
serialized. Also check login, logout, profile editing, organization switching,
reauthentication, document upload/submit, and PDF preview in the deployed browser.
