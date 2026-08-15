-- Application-level API rate-limit counters.
-- Idempotent: safe to run again. Existing application tables are unchanged.

CREATE TABLE IF NOT EXISTS api_rate_limit_buckets (
    bucket_hash CHAR(64) NOT NULL,
    policy_key VARCHAR(64) NOT NULL,
    window_started_at DATETIME NOT NULL,
    window_seconds INT UNSIGNED NOT NULL,
    request_count INT UNSIGNED NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    block_audited TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (bucket_hash),
    KEY idx_api_rate_limit_expiry (expires_at),
    KEY idx_api_rate_limit_policy_window (policy_key, window_started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

