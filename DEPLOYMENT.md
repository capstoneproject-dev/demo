# Deployment

## Production secrets

The application reads configuration from server environment variables first.
On shared hosting it also looks for `capstone-runtime.php` in the hosting
account home directory, beside (not inside) `public_html`. Start from
`deployment/capstone-runtime.php.example`; never commit the completed file.

Build the safe Z.com/cPanel upload package from PowerShell with:

```powershell
powershell -ExecutionPolicy Bypass -File deployment/build-zcom-package.ps1
```

The resulting ZIP under `build/` excludes development files, SQL dumps,
existing runtime uploads, caches, and secrets. Follow the checklist included
inside the ZIP before opening the deployed site.

## Runtime requirements

- PHP 8.1 or newer with PDO MySQL, Fileinfo, and GD image metadata support
- MySQL or MariaDB
- Apache 2.4 with `AllowOverride Options FileInfo AuthConfig` enabled for the `uploads`
  directory, or equivalent Nginx/IIS rules
- HTTPS in production

PHP session files must use a private, persistent directory outside the public web
root. Configure `session.save_handler=files` and an absolute `session.save_path`
owned by the PHP service account before accepting users. See
[session deployment instructions](docs/SESSION_SECURITY_DEPLOYMENT.md) for storage
permissions, expiry cleanup, session-lock behavior, and multi-server requirements.

## Local file storage

Uploaded files remain under `uploads/` and database rows store compatible
relative paths such as `uploads/announcements/example.png`. Do not commit
runtime files to Git. Preserve and back up the entire `uploads/` directory
together with the database.

On Linux, let only the web-server account write to the runtime directories:

```sh
chown -R www-data:www-data uploads
find uploads -type d -exec chmod 0755 {} \;
find uploads -type f -exec chmod 0644 {} \;
```

The included `uploads/.htaccess` disables directory listings, CGI execution,
and access to script-like extensions. If `.htaccess` overrides are disabled,
put equivalent rules in the Apache virtual host.

For Nginx, include equivalent protection:

```nginx
location ^~ /uploads/ {
    autoindex off;
    location ~ /\.upload-stage- {
        deny all;
    }
    location ~* \.(php[0-9]*|phtml|phar|cgi|pl|py|sh|bash|cmd|bat|exe|com)$ {
        deny all;
    }
    try_files $uri =404;
}
```

Uploads must be on persistent disk. If the application is deployed in a
container, mount `uploads/` as a persistent volume so a redeploy does not erase
user files.

Upload storage must support same-directory hard links. Completed files are published
without replacing existing files; unsupported storage fails safely instead of using
an overwrite-capable fallback. Keep the staging deny rule when the application is
served beneath a URL prefix, adjusting the outer location to that prefix.

To find files abandoned after publication or an uncertain database commit, run
`php deployment/reconcile-uploads.php`. This reports only generated announcement
images and document PDFs at least 48 hours old and checks existing database file
references before identifying candidates. It makes no changes by default.

For deletion, first put the site in maintenance mode so uploads, pending document
submissions, and other file-reference writes are blocked, and drain active requests.
Then run `php deployment/reconcile-uploads.php --delete --uploads-paused`.
The flag acknowledges that maintenance is already enforced; the script does not
pause the application itself. Keep upload/database backups before cleanup. Do not
run deletion while users can submit or attach files. The script creates no tables.

## Application base path

New profile and organization-image URLs are derived automatically from the
request path, so the application does not need to be deployed specifically at
`/CAPSTONE/demo`. If a reverse proxy hides the real application path, set:

```text
CAPSTONE_BASE_PATH=/your/application/path
```

Use an empty/root base path when the application is served directly from the
domain root.

## Upload limits

Application validation currently allows:

- Images: 5 MB, up to 8000×8000 pixels
- PDFs: 20 MB
- Image content: JPEG, PNG, WEBP; announcement/event galleries also allow GIF

Ensure PHP and the web server are at least as permissive as the application:

```ini
upload_max_filesize = 20M
post_max_size = 24M
```

Restart PHP/Apache after changing server configuration.

## Backups

A complete restore requires both:

1. A database dump
2. A matching archive/snapshot of `uploads/`

Back them up on the same schedule and test restoring both before launch.
