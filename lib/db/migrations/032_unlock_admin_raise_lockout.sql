-- Migration 032: Unlock admin account + raise brute-force threshold to 20 attempts
-- This migration is idempotent: safe to run multiple times.

UPDATE users
SET failed_login_attempts = 0,
    locked_until          = NULL
WHERE email = 'admin@irissam.dz';
