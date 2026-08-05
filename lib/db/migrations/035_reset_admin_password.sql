-- Migration 035: Reset admin password to Admin@2026
-- The seed set force_password_change = TRUE, so on first login the password
-- was changed to an unknown value.  This migration restores the known hash
-- and clears every lock flag so the account is fully usable again.
-- ---------------------------------------------------------------------------
BEGIN;

UPDATE users
SET hashed_password        = '$2b$12$YuCltOy2wdHaBCksz.VZT.4rYzX4K5pyOfg5ZLYnXaY.LlqyR37Iy',
    force_password_change  = FALSE,
    failed_login_attempts  = 0,
    locked_until           = NULL,
    account_status         = 'active',
    updated_at             = now()
WHERE email = 'admin@irissam.dz';

COMMIT;
