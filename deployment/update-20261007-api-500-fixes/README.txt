API 500 FIXES - 7 October 2026

Confirmed production errors:
- Analytics: Undefined constant ANALYTICS_AI_REVIEW_FEEDBACK_ENABLED.
- QR student list: MySQL error 1267 comparing general_ci and unicode_ci columns.

Upload the contents of upload/ into public_html, preserving these paths:
  config/environment.php
  config/analytics_ai.php
  includes/qr_attendance.php

Before upload, back up the three matching LIVE files outside public_html.
If the live config/analytics_ai.php contains hardcoded credentials or custom
settings, preserve them. Instead of replacing that custom file, add the
following block after its opening PHP tag (no second opening tag):

if (!defined('ANALYTICS_AI_REVIEW_FEEDBACK_ENABLED')) {
    require_once __DIR__ . '/environment.php';
    define('ANALYTICS_AI_REVIEW_FEEDBACK_ENABLED', filter_var(appRuntimeValue('ANALYTICS_AI_REVIEW_FEEDBACK_ENABLED', 'true'), FILTER_VALIDATE_BOOLEAN));
}

The supplied config reads credentials from environment/private runtime config.
Keep capstone-runtime.php and its production values unchanged. Respect any
existing explicit false setting for reviewer-feedback interpretation.

Upload config/environment.php and config/analytics_ai.php before the QR include.
Refresh PHP OPcache through hosting controls if updated PHP files stay cached.
Reload the officer dashboard and confirm both requests return successful JSON.
Check the PHP log for new errors. No database migration is required.

The QR query applies utf8mb4_unicode_ci to the student-number comparison only;
it does not change database columns or existing data.

Local validation: PHP syntax checks, analytics simple-language regression suite,
and QR roster checks using temporary tables with both mixed-collation orders.
The QR checks include organization isolation, inactive students and search.

This package has not been deployed. Roll back by restoring your live backups.
