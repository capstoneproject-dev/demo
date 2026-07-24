# Analytics AI deployment

The officer dashboard sends analytics data to
`api/analytics/generate-insights.php`. That authenticated PHP endpoint calls
Gemini, so the API key never needs to be sent to the browser.

## Required production secret

Create this environment variable in the hosting platform's dashboard:

```text
ANALYTICS_AI_GEMINI_API_KEY=your_new_rotated_key
```

Restart or redeploy the PHP application after saving it. Do not add the real
value to `.env.example`, a PHP/JavaScript file, GitHub Actions output, or a
publicly accessible file.

The application also accepts these optional environment variables:

```text
ANALYTICS_AI_GEMINI_MODEL=gemini-2.5-flash
ANALYTICS_AI_GEMINI_MODELS=gemini-2.5-flash,gemini-2.5-flash-lite
ANALYTICS_AI_LLAMA_BASE_URL=http://127.0.0.1:11434
ANALYTICS_AI_LLAMA_MODEL=llama3.2:3b
```

## Local XAMPP

Set the variable in Apache's environment (for example with `SetEnv` in an
uncommitted local Apache configuration), then restart Apache:

```apache
SetEnv ANALYTICS_AI_GEMINI_API_KEY "your_new_rotated_key"
```

Avoid placing the key in HTML or JavaScript. Any value delivered to a browser
can be read through DevTools, source maps, or the network inspector, regardless
of encryption or obfuscation.

## If GitHub already detected the key

1. Revoke the exposed key and create a new one.
2. Restrict the replacement key to the Generative Language API and apply
   appropriate quotas/restrictions in Google Cloud.
3. Remove the old value from every commit that contains it. Editing only the
   latest file does not remove it from Git history.
4. Store the replacement only in the deployment platform's secret settings.
