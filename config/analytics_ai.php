<?php

if (!defined('ANALYTICS_AI_ZERO_COST_ONLY')) {
    define('ANALYTICS_AI_ZERO_COST_ONLY', true);
}

if (!defined('ANALYTICS_AI_GEMINI_ENABLED')) {
    define('ANALYTICS_AI_GEMINI_ENABLED', true);
}

if (!defined('ANALYTICS_AI_GEMINI_API_KEY')) {
    define('ANALYTICS_AI_GEMINI_API_KEY', getenv('ANALYTICS_AI_GEMINI_API_KEY') ?: 'AIzaSyAJH7pfsBqjrT1AjpK0r4beVJbWPvjXgDg');
}

if (!defined('ANALYTICS_AI_GEMINI_MODEL')) {
    define('ANALYTICS_AI_GEMINI_MODEL', getenv('ANALYTICS_AI_GEMINI_MODEL') ?: 'gemini-2.5-flash');
}

if (!defined('ANALYTICS_AI_GEMINI_MODELS')) {
    define(
        'ANALYTICS_AI_GEMINI_MODELS',
        getenv('ANALYTICS_AI_GEMINI_MODELS') ?: 'gemini-2.5-flash,gemini-2.5-flash-lite'
    );
}

if (!defined('ANALYTICS_AI_LLAMA_ENABLED')) {
    define('ANALYTICS_AI_LLAMA_ENABLED', true);
}

if (!defined('ANALYTICS_AI_LLAMA_BASE_URL')) {
    define('ANALYTICS_AI_LLAMA_BASE_URL', getenv('ANALYTICS_AI_LLAMA_BASE_URL') ?: 'http://127.0.0.1:11434');
}

if (!defined('ANALYTICS_AI_LLAMA_MODEL')) {
    define('ANALYTICS_AI_LLAMA_MODEL', getenv('ANALYTICS_AI_LLAMA_MODEL') ?: 'llama3.2:3b');
}

if (!defined('ANALYTICS_AI_CACHE_DIR')) {
    define('ANALYTICS_AI_CACHE_DIR', __DIR__ . '/../storage/cache/analytics_ai');
}
