<?php

require_once __DIR__ . '/environment.php';

/*
 * Keep secrets out of this file because it is committed to source control.
 * Configure ANALYTICS_AI_GEMINI_API_KEY in the web server or hosting
 * provider's environment-variable/secret settings.
 */

if (!defined('ANALYTICS_AI_ZERO_COST_ONLY')) {
    define('ANALYTICS_AI_ZERO_COST_ONLY', true);
}

if (!defined('ANALYTICS_AI_GEMINI_ENABLED')) {
    define('ANALYTICS_AI_GEMINI_ENABLED', true);
}

// Redacted reviewer feedback to Gemini was explicitly authorized for this installation.
// A deployment can still disable it through runtime configuration.
if (!defined('ANALYTICS_AI_REVIEW_FEEDBACK_ENABLED')) {
    define('ANALYTICS_AI_REVIEW_FEEDBACK_ENABLED', filter_var(appRuntimeValue('ANALYTICS_AI_REVIEW_FEEDBACK_ENABLED', 'true'), FILTER_VALIDATE_BOOLEAN));
}

if (!defined('ANALYTICS_AI_GEMINI_API_KEY')) {
    define('ANALYTICS_AI_GEMINI_API_KEY', trim((string)appRuntimeValue('ANALYTICS_AI_GEMINI_API_KEY', '')));
}

if (!defined('ANALYTICS_AI_GEMINI_MODEL')) {
    define('ANALYTICS_AI_GEMINI_MODEL', appRuntimeValue('ANALYTICS_AI_GEMINI_MODEL', 'gemini-2.5-flash'));
}

if (!defined('ANALYTICS_AI_GEMINI_MODELS')) {
    define(
        'ANALYTICS_AI_GEMINI_MODELS',
        appRuntimeValue('ANALYTICS_AI_GEMINI_MODELS', 'gemini-2.5-flash,gemini-2.5-flash-lite')
    );
}

if (!defined('ANALYTICS_AI_CACHE_DIR')) {
    define(
        'ANALYTICS_AI_CACHE_DIR',
        appRuntimeValue('ANALYTICS_AI_CACHE_DIR', __DIR__ . '/../storage/cache/analytics_ai')
    );
}
