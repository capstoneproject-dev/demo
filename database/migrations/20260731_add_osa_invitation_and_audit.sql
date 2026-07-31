-- Secure multi-OSA invitation and Primary OSA administration.
-- Apply once to an existing capstone_db database after taking a backup.

ALTER TABLE users
    ADD COLUMN is_primary_osa TINYINT(1) NOT NULL DEFAULT 0 AFTER account_type,
    ADD INDEX idx_users_osa_status (account_type, is_active, is_primary_osa),
    ADD CONSTRAINT chk_users_primary_osa
        CHECK (is_primary_osa = 0 OR (account_type = 'osa_staff' AND is_active = 1));

START TRANSACTION;
UPDATE users SET is_primary_osa = 0;
UPDATE users
SET is_primary_osa = 1
WHERE user_id = (
    SELECT selected.user_id
    FROM (
        SELECT MIN(user_id) AS user_id
        FROM users
        WHERE account_type = 'osa_staff' AND is_active = 1
    ) AS selected
);
COMMIT;

CREATE TABLE osa_staff_invitations (
    invitation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    employee_number VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    status ENUM('pending','accepted','revoked','expired') NOT NULL DEFAULT 'pending',
    delivery_status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
    delivery_error VARCHAR(255) DEFAULT NULL,
    invited_by_user_id INT NOT NULL,
    accepted_by_user_id INT DEFAULT NULL,
    revoked_by_user_id INT DEFAULT NULL,
    expires_at DATETIME NOT NULL,
    last_sent_at DATETIME DEFAULT NULL,
    accepted_at DATETIME DEFAULT NULL,
    revoked_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (invitation_id),
    UNIQUE KEY uq_osa_invitation_token (token_hash),
    KEY idx_osa_invitation_email_status (email, status),
    KEY idx_osa_invitation_employee_status (employee_number, status),
    KEY idx_osa_invitation_expiry (status, expires_at),
    CONSTRAINT fk_osa_invitation_inviter
        FOREIGN KEY (invited_by_user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_osa_invitation_accepted_user
        FOREIGN KEY (accepted_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_osa_invitation_revoker
        FOREIGN KEY (revoked_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
    audit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_user_id INT DEFAULT NULL,
    actor_name VARCHAR(201) DEFAULT NULL,
    actor_email VARCHAR(255) DEFAULT NULL,
    actor_employee_number VARCHAR(20) DEFAULT NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(100) DEFAULT NULL,
    target_name VARCHAR(201) DEFAULT NULL,
    target_email VARCHAR(255) DEFAULT NULL,
    target_employee_number VARCHAR(20) DEFAULT NULL,
    before_state JSON DEFAULT NULL,
    after_state JSON DEFAULT NULL,
    request_ip VARCHAR(45) DEFAULT NULL,
    user_agent VARCHAR(255) DEFAULT NULL,
    result VARCHAR(20) NOT NULL DEFAULT 'success',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (audit_id),
    KEY idx_audit_action_created (action, created_at),
    KEY idx_audit_actor_created (actor_user_id, created_at),
    KEY idx_audit_target (target_type, target_id),
    KEY idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$
CREATE TRIGGER trg_audit_logs_append_only_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Audit log entries are append-only and cannot be updated';
END$$

CREATE TRIGGER trg_audit_logs_append_only_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Audit log entries are append-only and cannot be deleted';
END$$
DELIMITER ;
