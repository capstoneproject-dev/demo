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
