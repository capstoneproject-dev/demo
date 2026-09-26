# Complete UI deployment — 27 September 2026

This update package combines the current files for the UI changes from commit
dd28272 through HEAD, including the SEO and clean-URL commits ff9675c and
3ca4c4d. It also includes the local CSS and JavaScript referenced by the affected
pages, their available CSS assets, organization images, and CSRF/logout support.
Files are packaged from the working tree, not restored from historical commits.

## Deploy

1. Keep a downloaded backup of the live site.
2. Extract this ZIP into the existing application root: the directory containing
   `.htaccess`, `assets`, `pages`, and `api`. Preserve the ZIP's directory structure.
3. Allow the included files to replace their live counterparts. The ZIP contains
   no database dump, database credentials, uploads, or older deployment archives.
4. Reload the login page and sign in. The affected pages now request CSS and JS
   with version `20260927-complete-ui-1`, so they use new cache entries.
5. Check student, officer, OSA, and adviser accounts; the comment dropdown;
   organization switching; adviser banner and exports; and logout.

This is an update to an existing installation, not a full application installer.
The SQL snapshot changed during the earlier SAGE rename is intentionally excluded:
do not import a development database over live records.

## Checks completed

- Login, all three dashboards, IGP pages, QR-attendance pages, and the shared
  student database page were audited for local script and stylesheet references.
- JavaScript files and inline scripts, PHP files, manifest JSON, and sitemap XML
  passed syntax checks. Apache configuration passed its syntax check.
- Local clean routes `/`, `/student/`, `/officer/`, and `/osa/` returned HTTP 200.
  The officer stylesheet returned HTTP 200 with the CSS content type.
- Every ZIP entry is checked against the source file using SHA-256 after creation.

Authenticated browser flows on the live host have not been tested here.

## Existing vendor asset gaps

Font Awesome's CSS references legacy TTF fallbacks absent from this repository;
the corresponding WOFF2 fonts are included. The PDF viewer vendor CSS also
references missing `altText_add.svg`, `altText_done.svg`, and `loading-icon.gif`.
These pre-existing gaps are separate from the comment dropdown's missing styles.

`DEPLOYMENT-FILES.json` inside the ZIP lists every packaged file and its SHA-256.
