# Copilot Instructions for CAPSTONE Demo

> **Backend integration is now in progress.**
> For all PHP, MySQL, session, and API rules see
> `.github/backend-integration.instructions.md`.

## Project Overview
- Originally a static demo; now transitioning to a **PHP + MySQL backend** served via XAMPP.
- The static HTML/CSS/JS structure is preserved; PHP endpoints are being added incrementally.
- Database: `capstone_db` on XAMPP MySQL. Schema source of truth: `aisers_database_setup_mysql.sql`.

## Key Architecture
- **HTML pages**: Located in `pages/` — static for now; will become PHP-rendered as features are wired up.
- **CSS**: Located in `assets/css/`, organized by feature/page.
- **JavaScript**: Located in `assets/js/`, with per-dashboard logic files.
- **PHP config**: `config/db.php` — PDO singleton.
- **PHP helpers**: `includes/auth.php` (session + JSON helpers), `includes/functions.php` (DB queries).
- **REST API**: `api/auth/` for login/logout/session; `api/<feature>/` for feature endpoints.
- **Mock data** (legacy): `data/users.json` and `localStorage` — being replaced by real DB calls.

## Developer Workflows
- **Local testing**: Start XAMPP (Apache + MySQL), open `http://localhost/CAPSTONE/demo/pages/login.html`.
- **No build step**: All files are static or plain PHP; changes are reflected immediately.
- **Database setup**: Import `aisers_database_setup_mysql.sql` into phpMyAdmin to create `capstone_db`.

## Project-Specific Patterns
- **Login**: `assets/js/login.js` POSTs to `api/auth/login.php`, receives JSON, saves session to `localStorage`, redirects.
- **Dashboard guard**: Each dashboard JS calls `validatePhpSession()` on load, which hits `api/auth/session.php`.
- **Hybrid session**: PHP `$_SESSION` is authoritative; `localStorage['naapAuthSession']` is a read cache for the dashboard JS.
- **Rendering rule**: Use PHP-rendered pages for full pages; REST endpoints (JSON only) for async/dynamic data.

## Conventions
- Keep UI/UX consistent across pages.
- Use the existing folder structure for new features.
- All DB credentials live only in `config/db.php`.
- See `.github/backend-integration.instructions.md` for the full backend ruleset.

## References
- Schema: `aisers_database_setup_mysql.sql`
- Backend rules: `.github/backend-integration.instructions.md`
- Key files: `config/db.php`, `includes/auth.php`, `includes/functions.php`, `api/`, `pages/`, `assets/`
