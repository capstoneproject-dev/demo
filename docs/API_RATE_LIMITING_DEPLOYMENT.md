# API Rate Limiting Deployment

The application uses one MySQL table for fixed-window abuse protection. It
does not require Redis, Composer packages, a cron job, or Apache modules.

## Deployment

1. Back up the database.
2. Run `database/migrations/20260815_create_api_rate_limit_buckets.sql` once.
3. Deploy the PHP changes after the table exists. The migration is idempotent
   and does not alter existing operational tables.

No environment setting is required for XAMPP or a server receiving client
connections directly.

## Reverse proxies

Forwarded IP headers are ignored by default because clients can forge them.
When the application is behind a trusted reverse proxy, set
`CAPSTONE_TRUSTED_PROXIES` to the proxy's exact IP address. Multiple addresses
are comma-separated. Only requests whose direct `REMOTE_ADDR` matches this
list may use `X-Forwarded-For` or `X-Real-IP`.

## Maintenance and scope

Expired counters are deleted automatically in small probabilistic batches.
The table stores hashes rather than raw account identifiers or tokens.

This limiter protects application workflows, brute-force targets, uploads,
mail actions, and costly analytics calls. Volumetric denial-of-service attacks
must still be handled by the production host, firewall, or CDN.
