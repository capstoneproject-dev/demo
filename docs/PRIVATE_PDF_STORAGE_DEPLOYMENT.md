# Private PDF Storage Deployment

Document submissions, approved repository PDFs, and printing files are served only through authenticated PHP endpoints. Public images remain in `uploads/`.

Printing PDFs are restricted to the submitting student and officers of the assigned active organization. OSA accounts can oversee printing records and statuses but cannot open the submitted printing file.

## Default setup (XAMPP, Apache, shared hosting)

1. Deploy the application normally. The default private root is `storage/private/`.
2. Ensure PHP can write to `storage/private/documents/` and `storage/private/print-jobs/`.
3. Confirm Apache permits `.htaccess`; `storage/.htaccess` and `uploads/documents/.htaccess` must return HTTP 403 for direct requests.
4. Back up the database and `uploads/documents/`.
5. Preview the migration:

   ```powershell
   C:\xampp\php\php.exe cli\migrate-private-pdfs.php
   ```

6. Apply it:

   ```powershell
   C:\xampp\php\php.exe cli\migrate-private-pdfs.php --apply
   ```

The command verifies every copy before changing database values and deletes a legacy public copy only after its database transaction commits. It is safe to rerun.

## Strongest production isolation

Set `CAPSTONE_PRIVATE_STORAGE_ROOT` to a persistent writable directory outside the web document root. Example:

```text
CAPSTONE_PRIVATE_STORAGE_ROOT=/var/lib/naap/private-pdfs
```

The application reads this from the web-server/PHP process environment; `.env.example` documents the setting but is not loaded automatically. For Apache, set it in the virtual host or an allowed `.htaccess` file, then restart Apache:

```apache
SetEnv CAPSTONE_PRIVATE_STORAGE_ROOT "/var/lib/naap/private-pdfs"
```

For containers, mount that path as a persistent volume. Do not use an ephemeral container filesystem.

## Non-Apache servers

Prefer an outside-web-root value for `CAPSTONE_PRIVATE_STORAGE_ROOT`. Also deny direct access to `/storage/` and `/uploads/documents/` in the web-server configuration. IIS deployments may use the included `web.config` files. Nginx must add equivalent `deny all` locations.

## Verification

- A direct URL under `uploads/documents/` or `storage/private/` returns 403.
- An unauthenticated protected endpoint returns 401.
- Authorized PDF viewing works through `api/documents/download.php` and `api/printing/file.php`.
- Database `file_url` values contain storage keys, never absolute filesystem paths.
