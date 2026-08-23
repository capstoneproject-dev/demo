-- Organization adviser registration uses a 33-character OTP purpose.
-- Keep additional room for future purpose identifiers.
ALTER TABLE email_otp_challenges
    MODIFY COLUMN purpose VARCHAR(64) NOT NULL;
