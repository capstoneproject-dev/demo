ROLLBACK - LOCAL-ONLY MOCK CONTROLS UPDATE
4 October 2026

Contains the six previous tracked runtime files from Git revision:
24890415b23641e9faf63a073a31ebdb3551efa2
The new assets/js/app-environment.js file did not exist before this update.
These are repository baseline files, not backups downloaded from the live server.
If the live server had separate changes, use the live backups taken before deployment instead.

ROLL BACK
1. Upload the CONTENTS of rollback/upload/ to the existing application root. Preserve the assets/ and pages/ paths and overwrite all six matching files, including sw.js.
2. After restoring the files, delete assets/js/app-environment.js from the server. Its path is also in DELETE-AFTER-ROLLBACK.txt.
3. Reload while online so the restored service worker installs. It returns to cache v43. Close and reopen the application if an open tab still shows the newer interface. If necessary, use browser developer tools to unregister the service worker and delete only the application's naap-static-* and naap-runtime-* caches, then reload online. Do not clear local storage or IndexedDB, which can contain pending offline records.
4. Verify the officer dashboard and analytics load. Mock buttons should return to their previous behavior, including being visible on live domains.

No database changes are involved.
Keep rollback instructions, the deletion list, and the manifest outside the public application directory. Upload only the contents of rollback/upload/.
DEPLOYMENT-FILES.json records the source revision and verified SHA-256 hashes.
No ZIP was created and nothing has been deployed.
