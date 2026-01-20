# Copilot Instructions for CAPSTONE Demo

## Project Overview
- This is a static demo for a capstone project, designed for GitHub Pages deployment.
- No backend or PHP is used; all data is loaded from JSON files via JavaScript.
- The structure and design match a PHP version for future integration.

## Key Architecture
- **HTML pages**: Located in `pages/` (e.g., login, registration, dashboard, admin).
- **CSS**: Located in `assets/css/`, organized by feature/page.
- **JavaScript**: Located in `js/`, with files for data loading (`dataLoader.js`), dashboard logic, and admin logic.
- **Mock data**: In `data/users.json`, used for all user-related features.

## Developer Workflows
- **Local testing**: Open `index.html` directly or use a static server (e.g., `python -m http.server 8000`).
- **No build step**: All files are static; changes are reflected immediately.
- **No tests**: There are no automated tests or test runners in this demo.

## Project-Specific Patterns
- **Data loading**: All dynamic data comes from JSON files using JavaScript (see `js/dataLoader.js`).
- **Login/Forms**: Forms are functional but do not persist data; login accepts any credentials and redirects to dashboard.
- **Page navigation**: Each major feature is a separate HTML file in `pages/`.
- **CSS organization**: CSS is split by feature for maintainability (e.g., `dashboard.css`, `admin.css`).

## Integration Points
- When integrating with a backend, replace JSON data loading in JS with API calls or PHP queries.
- The structure is designed to allow easy migration to a PHP-based system.

## Conventions
- Keep UI/UX consistent with the PHP version.
- Use the existing folder structure for new features.
- Place new mock data in `data/` and new scripts in `js/`.

## Examples
- To add a new page: create an HTML file in `pages/`, add CSS in `assets/css/`, and JS in `js/`.
- To update user data: edit `data/users.json`.

## References
- See `README.md` for deployment and integration details.
- Key files: `pages/`, `assets/css/`, `js/`, `data/users.json`.

---
For questions or unclear conventions, review `README.md` or ask for clarification.
