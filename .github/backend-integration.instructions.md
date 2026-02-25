---
applyTo: "**/*.php,**/api/**,**/includes/**,**/config/**,**/assets/js/**,**/pages/**"
---

# Backend Integration Rules — CAPSTONE (PHP + XAMPP + MySQL)

## Project Context
The CAPSTONE project is transitioning from a static localStorage demo to a
**modular monolith + hybrid rendering** backend using:
- **XAMPP** (Apache + PHP 8.x + MariaDB/MySQL)
- **Database**: `aisers_db` on `localhost` (PDO, utf8mb4)
- **Root path**: `c:\xampp\htdocs\CAPSTONE\demo\`

---

## 1. Rendering Rules

| Concern | How to implement |
|---|---|
| Login, dashboards, forms, admin pages, reports | **PHP-rendered HTML** (`.php` pages) |
| QR scan submission, live attendance feed, rental status updates, async filtering/search, notifications | **REST API** (PHP returns JSON, JS fetches it) |

- **Do not** convert a PHP-rendered page into a full SPA or a pure API+JS pair unless the user explicitly asks.
- **Do not** use `echo` to inline large HTML blocks inside API endpoints — API endpoints return JSON only.

---

## 2. Folder Structure

```
config/
  db.php               ← PDO singleton — getPdo()
includes/
  auth.php             ← Session helpers, JSON response helpers, page guards
  functions.php        ← Shared DB query functions
api/
  auth/
    login.php          ← POST: credential validation, session start
    logout.php         ← GET/POST: session destroy
    session.php        ← GET: return current session state
    register-osa.php   ← POST: direct OSA account creation
  <feature>/
    <action>.php       ← One file per feature+action (e.g. api/rentals/list.php)
pages/
  login.html           ← Static login page (form submits via JS fetch to api/auth/login.php)
  studentDashboard.html
  officerDashboard.html
  osaDashboard.html
```

- Place all new REST endpoints under `api/<feature>/`.
- Place all new shared PHP functions in `includes/functions.php` or a new `includes/<feature>.php` if the file gets large.
- **Never** put business logic or DB queries directly inside a page `.php` file — keep them in `includes/`.

---

## 3. Database Connection

- **Always** use the singleton: `getPdo()` defined in `config/db.php`.
- **Never** create a new `PDO` instance outside of `config/db.php`.
- **Always** use prepared statements with named parameters (`:param`). Never interpolate user input into SQL strings.

```php
// ✅ Correct
$stmt = getPdo()->prepare("SELECT * FROM users WHERE email = :email");
$stmt->execute([':email' => $email]);

// ❌ Wrong — never do this
$stmt = getPdo()->query("SELECT * FROM users WHERE email = '$email'");
```

---

## 4. Auth & Sessions

- `includes/auth.php` must be `require_once`'d by every API endpoint and protected PHP page.
- Start user sessions with `startUserSession(array $payload)` — never write to `$_SESSION` directly outside `auth.php`.
- Protect PHP-rendered pages with `guardSession()` at the top of the file.
- Protect API endpoints by checking `isLoggedIn()` and calling `jsonError('Unauthorized.', 401)` if not.

```php
// PHP-rendered page
require_once '../includes/auth.php';
$session = guardSession('../pages/login.html');

// API endpoint
require_once '../../includes/auth.php';
if (!isLoggedIn()) jsonError('Unauthorized.', 401);
```

---

## 5. Password Handling

- **All passwords in the database must be bcrypt hashes** (`PASSWORD_BCRYPT`).
- Verify with `password_verify($input, $user['password_hash'])`.
- **Never** store or compare plain-text passwords.
- Minimum password length: **8 characters** (enforce in both PHP and JS).
- Seed data passwords use the hash of `12345678` (demo only — advise changing before production).

```php
// Hash on registration
$hash = password_hash($plaintext, PASSWORD_BCRYPT);

// Verify on login
if (!password_verify($plaintext, $user['password_hash'])) { jsonError('Invalid password.'); }
```

---

## 6. API Response Format

All REST endpoints must use the helper functions from `includes/auth.php`:

```php
jsonOk(['key' => $value]);          // { "ok": true, "key": ... }
jsonError('Message here.', 400);    // { "ok": false, "error": "Message here." }
```

- Always set `header('Content-Type: application/json')` at the top of every API file.
- Always call `requirePost()` for POST-only endpoints.
- Read request body with `getRequestBody()` (handles both JSON and form-encoded POST).
- For GET endpoints that return lists, wrap results in a named key: `jsonOk(['items' => $rows])`.

---

## 7. Session Payload Shape

The PHP session must match the shape the existing JS (`officerDashboard.js`, `studentDashboard.js`) expects under `localStorage['naapAuthSession']`:

```json
{
  "user_id": 1,
  "account_type": "student",
  "display_name": "Full Name",
  "email": "user@school.edu",
  "student_number": "2023-10001",
  "employee_number": null,
  "authenticated_at": "2026-02-25T00:00:00+08:00",
  "login_role": "student | org | osa",
  "active_org_id": 1,
  "active_org_name": "AISERS",
  "active_role_name": "officer",
  "officer_memberships": [],
  "program_code": "BSAIS",
  "section": "IS-1A"
}
```

- Use `buildSessionPayload()` from `includes/functions.php` to construct this — do not build it manually.
- Do not add or rename top-level keys without also updating the consuming JS.

---

## 8. JS ↔ PHP Integration Rules

- JS `fetch()` calls to PHP endpoints **must** include `credentials: 'same-origin'` so the PHP session cookie is sent.
- JS receives the JSON payload from the login endpoint, builds the localStorage session shape client-side, then saves it — this preserves backward compatibility with dashboard JS that reads localStorage.
- The PHP session (`$_SESSION`) is the **authoritative** session. localStorage is a client-side cache.
- `validatePhpSession()` in each dashboard JS calls `api/auth/session.php` on load to detect server-side expiry — do not remove or skip this call.

```js
// ✅ Always include credentials
const resp = await fetch('../api/auth/login.php', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'same-origin',
  body: JSON.stringify(payload)
});
```

---

## 9. Adding a New Feature (checklist)

When the user asks to add a new backend-driven feature (e.g., rentals list, event CRUD, profile update):

1. **DB queries** → add helper functions in `includes/functions.php` (or `includes/<feature>.php`)
2. **REST endpoint** → create `api/<feature>/<action>.php`; require auth, call helpers, return `jsonOk`/`jsonError`
3. **PHP-rendered page** (if needed) → create in `pages/`, call `guardSession()` at top, include shared CSS/JS
4. **JS** → replace any localStorage mock data with `fetch('../api/<feature>/<action>.php', { credentials: 'same-origin' })`
5. **No mock localStorage logic** should remain for features that have a live endpoint

---

## 10. Database Schema Rules

- The canonical schema is `aisers_database_setup_mysql.sql` in the project root.
- **Always update the SQL file** when changing the schema, so it stays the source of truth.
- Use `DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` for `created_at`.
- Use `DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` for `updated_at`.
- Foreign keys must be explicitly named (`CONSTRAINT fk_<table>_<ref>`).
- All string constraints must be named (`CONSTRAINT chk_<table>_<col>`).
- **Never** `ALTER TABLE` in application code — schema changes go in the SQL file only.

---

## 11. Error Handling

- API endpoints must catch `PDOException` and return a generic `jsonError` — do not leak SQL details to the client.
- Log detailed errors server-side (use `error_log()`) rather than echoing them.

```php
try {
    // ... DB work ...
} catch (PDOException $e) {
    error_log('[api/rentals/list] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
}
```

---

## 12. XAMPP-Specific Notes

- The project is served at `http://localhost/CAPSTONE/demo/`.
- Static `.html` files are served by Apache directly; PHP files require the XAMPP Apache server to be running.
- DB credentials: host `localhost`, user `root`, password `` (empty), database `capstone_db`.
- To change credentials, edit **only** `config/db.php` constants (`DB_HOST`, `DB_USER`, `DB_PASS`).
- Do not hardcode DB credentials anywhere else in the codebase.

---

## 13. What NOT to Do

- ❌ Do not use `mysqli_*` functions — use PDO only.
- ❌ Do not use `$_GET`/`$_POST` directly without sanitization (`trim()`, type casting, prepared statements).
- ❌ Do not store sensitive data (passwords, session tokens) in `localStorage` — only the session payload shape goes there.
- ❌ Do not create new `.php` files that mix REST JSON responses with HTML output.
- ❌ Do not call `session_start()` manually — `includes/auth.php` handles this.
- ❌ Do not skip `require_once '../includes/auth.php'` in any endpoint or protected page.
