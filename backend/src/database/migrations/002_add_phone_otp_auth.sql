-- Migration: Add Phone Number and OTP Authentication
-- Date: 2025-10-12
-- Description: Switch from email/password to phone/OTP authentication

-- 1. Add phone_number to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) UNIQUE;

-- 2. Make email nullable (optional field now)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- 3. Create index on phone_number
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);

-- 4. Create OTP codes table
CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) NOT NULL,
    otp_code VARCHAR(4) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_otp_codes_phone ON otp_codes(phone_number);
CREATE INDEX idx_otp_codes_expires_at ON otp_codes(expires_at);

-- 5. Add banner_image_url to trip_groups (bonus feature from Session 6)
ALTER TABLE trip_groups ADD COLUMN IF NOT EXISTS banner_image_url TEXT;

COMMENT ON TABLE otp_codes IS 'Stores OTP codes for phone verification during login/registration';
COMMENT ON COLUMN otp_codes.otp_code IS 'Hardcoded to 0000 for development';
COMMENT ON COLUMN users.phone_number IS 'Primary authentication method';

