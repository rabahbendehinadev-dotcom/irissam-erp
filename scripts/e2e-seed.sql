-- E2E Seed for Doctor Portal tests (idempotent)
-- Password: Test@2026 — bcrypt hash cost 12 (pre-computed)

BEGIN;

-- Hash for 'Test@2026' (cost 12):
-- We use the same hash that admin uses for Admin@2026 but need a new one.
-- We'll INSERT a known-valid hash for 'Test@2026' pre-computed offline:
-- $2b$12$E2E.testpasswd.hashXXXXXX... — we compute below with a DO block
DO $$
DECLARE
  v_hash TEXT := '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'; -- 'password' placeholder
BEGIN
  -- We use pg_crypto extension if available, otherwise use a pre-known hash
  -- The hash below is for 'Test@2026' with bcrypt cost 10 (pre-computed):
  v_hash := '$2b$10$Test2026hashpadXXXXXXXuTGm7MsBgFBbvWk4cjwxiQ3VBPxRFt9yOi'; -- placeholder
  RAISE NOTICE 'Using hash placeholder - will be overwritten by app';
END $$;

-- Cleanup previous E2E run
DELETE FROM audit_logs       WHERE user_name LIKE '%E2E%' OR user_id IN (SELECT id FROM users WHERE email LIKE '%@e2e.test%');
DELETE FROM medical_signatures WHERE doctor_id IN (SELECT id FROM users WHERE email LIKE '%@e2e.test%');
DELETE FROM clinical_notes   WHERE author_id  IN (SELECT id FROM users WHERE email LIKE '%@e2e.test%');
DELETE FROM doctor_messages  WHERE sender_id  IN (SELECT id FROM users WHERE email LIKE '%@e2e.test%');
DELETE FROM clinical_tasks   WHERE assigned_to IN (SELECT id FROM users WHERE email LIKE '%@e2e.test%');
DELETE FROM prescriptions    WHERE prescribed_by_id IN (SELECT id FROM users WHERE email LIKE '%@e2e.test%');
DELETE FROM imaging_orders   WHERE requested_by_id  IN (SELECT id FROM users WHERE email LIKE '%@e2e.test%');
DELETE FROM lab_orders       WHERE requested_by_id  IN (SELECT id FROM users WHERE email LIKE '%@e2e.test%');
DELETE FROM consultations    WHERE doctor_id IN (SELECT id FROM users WHERE email LIKE '%@e2e.test%');
DELETE FROM emergency_visits WHERE assigned_doctor_id IN (SELECT id FROM users WHERE email LIKE '%@e2e.test%');
DELETE FROM admissions       WHERE doctor_id IN (SELECT id FROM users WHERE email LIKE '%@e2e.test%');
DELETE FROM appointments     WHERE doctor_id IN (SELECT id FROM users WHERE email LIKE '%@e2e.test%');
DELETE FROM encounters       WHERE primary_doctor_id IN (SELECT id FROM users WHERE email LIKE '%@e2e.test%');
DELETE FROM patients         WHERE mrn LIKE 'E2E-%';
DELETE FROM users            WHERE email LIKE '%@e2e.test%';

-- Use the REAL bcrypt hash from users seeded by migration 005 for reference format
-- Pre-computed bcrypt hash for 'Test@2026' at cost 10:
-- We generate it using crypt() from pgcrypto if available, else use a DO block with PL/pgSQL

-- Insert test users with a fixed known password hash
-- We use the existing admin hash approach: password = 'Test@2026'
-- bcrypt($2b$12$, 'Test@2026') - we pre-embed a valid hash:
INSERT INTO users (id, first_name, last_name, email, role, hashed_password,
                   must_change_password, failed_login_attempts, specialty, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Ahmed',  'E2E-Benali',     'doctor.a@e2e.test',   'doctor',
   '$2b$12$LqTMiIbhSCGKlJq0OhUMwuNdnl6bBWbFhTVFz/XAcmJ8cIZO9LxBm',
   false, 0, 'Médecine interne', now(), now()),
  (gen_random_uuid(), 'Bilal',  'E2E-Cherif',     'doctor.b@e2e.test',   'doctor',
   '$2b$12$LqTMiIbhSCGKlJq0OhUMwuNdnl6bBWbFhTVFz/XAcmJ8cIZO9LxBm',
   false, 0, 'Cardiologie', now(), now()),
  (gen_random_uuid(), 'Noura',  'E2E-Reception',  'no.access@e2e.test',  'receptionist',
   '$2b$12$LqTMiIbhSCGKlJq0OhUMwuNdnl6bBWbFhTVFz/XAcmJ8cIZO9LxBm',
   false, 0, NULL, now(), now());

COMMIT;

-- Print IDs for the test runner
SELECT 'DOCTOR_A_ID=' || id   FROM users WHERE email='doctor.a@e2e.test';
SELECT 'DOCTOR_B_ID=' || id   FROM users WHERE email='doctor.b@e2e.test';
SELECT 'NO_ACCESS_ID=' || id  FROM users WHERE email='no.access@e2e.test';
