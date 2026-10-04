DEPLOYMENT UPDATE - LOCAL-ONLY MOCK CONTROLS
4 October 2026

This incremental package contains seven runtime files for the mock-control update.
It is separate from deployment/update-20261004 and does not include that package's login, OSA, photo, or database changes.

DEPLOY
1. Back up the matching live files listed in DEPLOYMENT-FILES.json.
2. Upload the CONTENTS of upload/ to the existing application root (the directory containing sw.js, pages/, and assets/). Preserve the paths and overwrite the matching files. Do not upload the upload/ folder itself.
3. Include the new assets/js/app-environment.js file. Upload all seven files together.
4. Reload the application while online so its service worker installs cache v44. If an open tab still shows the previous UI, close it and reopen the site, or hard-refresh it.

VERIFY
- On the live domain, the officer dashboard must hide Mock Data, Generate Mock Data, and Clear Mock.
- Ordinary dashboard and analytics actions must continue to work with live records.
- On localhost, 127.0.0.1, or IPv6 loopback, the mock controls remain available; Clear Mock appears after generating mock analytics.
- LAN IP addresses and custom local hostnames are treated as live hosts.
- Officer and student mock preview functions return immediately on live hosts.

No database migration, server configuration change, or server file deletion is required.
Keep this README and DEPLOYMENT-FILES.json outside the public application directory.
The manifest contains verified SHA-256 hashes for every upload file.
No ZIP was created. No credentials, database dumps, or user uploads are included.
Nothing has been deployed to the live server.
