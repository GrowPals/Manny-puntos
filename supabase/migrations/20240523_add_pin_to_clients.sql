-- Add PIN column to clientes table
ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS pin text;
-- Optional: Set a default PIN for existing users (e.g., last 4 digits of phone)
-- This prevents existing users from being locked out immediately
UPDATE clientes
SET pin = RIGHT(telefono, 4)
WHERE pin IS NULL
    AND telefono IS NOT NULL;
-- Add a check constraint to ensure PIN is 4 digits (optional but recommended)
ALTER TABLE clientes
ADD CONSTRAINT check_pin_format CHECK (pin ~ '^[0-9]{4}$');
-- Comment on column
COMMENT ON COLUMN clientes.pin IS '4-digit security PIN for login';