-- Add PIN column to clientes table
-- NOTE: New users must register their own PIN during onboarding.
-- Existing users without PIN will be prompted to create one on first login.
ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS pin text;

-- SECURITY: Removed auto-generation of PIN from phone number.
-- Users must set their own PIN through the secure onboarding flow.
-- The register_client_pin_secure RPC handles PIN hashing with bcrypt.

-- Comment on column
COMMENT ON COLUMN clientes.pin IS '4-digit security PIN for login. Users register their own PIN during onboarding.';