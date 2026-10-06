<?php

/**
 * Read runtime configuration without storing production secrets in public_html.
 *
 * Values provided by the web server take priority. On shared hosting, the app
 * also looks for capstone-runtime.php in the account home directory (normally
 * one level above public_html). That PHP file must return an associative array.
 */
function appRuntimeSettings(): array
{
    static $settings = null;
    if (is_array($settings)) {
        return $settings;
    }

    $settings = [];
    $candidates = [];
    $configuredPath = getenv('CAPSTONE_RUNTIME_CONFIG_FILE');
    if ($configuredPath !== false && trim($configuredPath) !== '') {
        $candidates[] = trim($configuredPath);
    }

    $home = getenv('HOME');
    if ($home !== false && trim($home) !== '') {
        $candidates[] = rtrim(trim($home), '/\\') . DIRECTORY_SEPARATOR . 'capstone-runtime.php';
    }

    $documentRoot = trim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''));
    if ($documentRoot !== '') {
        $candidates[] = dirname(rtrim($documentRoot, '/\\')) . DIRECTORY_SEPARATOR . 'capstone-runtime.php';
    }

    foreach (array_values(array_unique($candidates)) as $path) {
        if (!is_file($path) || !is_readable($path)) {
            continue;
        }
        $loaded = require $path;
        if (!is_array($loaded)) {
            throw new RuntimeException('The private runtime configuration must return an array.');
        }
        $settings = $loaded;
        break;
    }

    return $settings;
}

function appRuntimeValue(string $name, ?string $default = null): ?string
{
    $environmentValue = getenv($name);
    if ($environmentValue !== false && $environmentValue !== '') {
        return (string)$environmentValue;
    }

    $settings = appRuntimeSettings();
    if (!array_key_exists($name, $settings) || $settings[$name] === null || $settings[$name] === '') {
        return $default;
    }
    if (!is_scalar($settings[$name])) {
        throw new RuntimeException('Runtime configuration values must be scalar.');
    }
    return (string)$settings[$name];
}
