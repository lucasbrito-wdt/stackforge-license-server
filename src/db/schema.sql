-- StackForge License Server Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(19) UNIQUE NOT NULL,          -- XXXX-XXXX-XXXX-XXXX
    email VARCHAR(255) NOT NULL,
    plan VARCHAR(20) NOT NULL DEFAULT 'pro',  -- 'free' | 'pro'
    features JSONB NOT NULL DEFAULT '[]',
    max_activations INT NOT NULL DEFAULT 3,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,                   -- NULL = lifetime
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    stripe_session_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    hardware_fingerprint VARCHAR(64) NOT NULL,
    hostname VARCHAR(255),
    os VARCHAR(50),
    first_activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT,
    UNIQUE(license_id, hardware_fingerprint)
);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID REFERENCES licenses(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,              -- activate, validate, deactivate, revoke
    ip_address VARCHAR(45),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_licenses_key ON licenses(key);
CREATE INDEX idx_licenses_email ON licenses(email);
CREATE INDEX idx_activations_license_id ON activations(license_id);
CREATE INDEX idx_activations_fingerprint ON activations(hardware_fingerprint);
CREATE INDEX idx_audit_license_id ON audit_log(license_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created_at ON audit_log(created_at);
