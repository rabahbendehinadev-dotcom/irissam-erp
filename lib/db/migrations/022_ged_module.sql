-- =============================================================
-- Migration 022 — GED / Gestion Électronique des Documents
-- =============================================================
BEGIN;

-- ─── ENUMs ───────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE document_status AS ENUM (
    'draft','uploaded','under_review','approved','rejected',
    'signed','archived','expired','deleted_soft'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE document_confidentiality AS ENUM (
    'public_internal','staff','confidential',
    'medical_confidential','hr_confidential',
    'finance_confidential','direction_only'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE document_category AS ENUM (
    'Patient','Medical','Laboratoire','Imagerie','Pharmacie',
    'Hospitalisation','Bloc_operatoire','Facturation','Assurance',
    'RH','Biomedical','Stock','Qualite','Juridique',
    'Administratif','Direction','Autre'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE doc_workflow_step_status AS ENUM (
    'pending','in_progress','approved','rejected','skipped','escalated'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE doc_workflow_type AS ENUM (
    'upload','review','approval','signature','publication','archive'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE doc_approval_mode AS ENUM ('single','multiple','sequential');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE doc_access_action AS ENUM ('view','download','print','edit','delete','share','approve','sign');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE doc_retention_action AS ENUM ('notify','archive','delete_soft','legal_hold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE doc_share_type AS ENUM ('user','role','department','public_link');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── document_folders ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_folders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          UUID REFERENCES sites(id) ON DELETE SET NULL,
  parent_id        UUID REFERENCES document_folders(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  path             TEXT NOT NULL,                -- materialized path e.g. /RH/Contrats
  description      TEXT,
  category         document_category,
  icon             TEXT,
  color            TEXT,
  is_system        BOOLEAN NOT NULL DEFAULT false,
  confidentiality  document_confidentiality NOT NULL DEFAULT 'staff',
  metadata         JSONB,
  version          INTEGER NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ─── document_records ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_records (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id              UUID REFERENCES sites(id) ON DELETE SET NULL,
  folder_id            UUID REFERENCES document_folders(id) ON DELETE SET NULL,
  document_number      TEXT NOT NULL UNIQUE,
  title                TEXT NOT NULL,
  description          TEXT,
  category             document_category NOT NULL DEFAULT 'Autre',
  module               TEXT,
  entity_type          TEXT,
  entity_id            UUID,
  patient_id           UUID REFERENCES patients(id) ON DELETE SET NULL,
  employee_id          UUID,
  encounter_id         UUID,
  invoice_id           UUID,
  file_name            TEXT NOT NULL,
  original_file_name   TEXT NOT NULL,
  mime_type            TEXT NOT NULL,
  file_size            BIGINT NOT NULL DEFAULT 0,
  storage_provider     TEXT NOT NULL DEFAULT 'gcs',
  storage_key          TEXT NOT NULL,             -- internal only, never sent to frontend
  checksum             TEXT,                      -- SHA-256 for duplicate detection
  version_number       INTEGER NOT NULL DEFAULT 1,
  confidentiality      document_confidentiality NOT NULL DEFAULT 'staff',
  status               document_status NOT NULL DEFAULT 'uploaded',
  is_favorite          BOOLEAN NOT NULL DEFAULT false,
  is_template          BOOLEAN NOT NULL DEFAULT false,
  retention_until      DATE,
  expires_at           TIMESTAMPTZ,
  archived_at          TIMESTAMPTZ,
  signed_at            TIMESTAMPTZ,
  legal_hold           BOOLEAN NOT NULL DEFAULT false,
  tags                 TEXT[] DEFAULT '{}',
  metadata             JSONB,
  version              INTEGER NOT NULL DEFAULT 1,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ,
  created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by           UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Auto-increment document number
CREATE SEQUENCE IF NOT EXISTS document_number_seq START 1000;

-- ─── document_versions ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           UUID REFERENCES sites(id) ON DELETE SET NULL,
  document_id       UUID NOT NULL REFERENCES document_records(id) ON DELETE CASCADE,
  version_number    INTEGER NOT NULL,
  file_name         TEXT NOT NULL,
  storage_key       TEXT NOT NULL,
  file_size         BIGINT NOT NULL DEFAULT 0,
  mime_type         TEXT NOT NULL,
  checksum          TEXT,
  change_reason     TEXT,
  metadata_snapshot JSONB,
  version           INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (document_id, version_number)
);

-- ─── document_tags ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID REFERENCES sites(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  color       TEXT,
  category    document_category,
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (site_id, name)
);

-- ─── document_links ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES sites(id) ON DELETE SET NULL,
  source_id       UUID NOT NULL REFERENCES document_records(id) ON DELETE CASCADE,
  target_id       UUID NOT NULL REFERENCES document_records(id) ON DELETE CASCADE,
  link_type       TEXT NOT NULL DEFAULT 'related',
  note            TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (source_id, target_id, link_type)
);

-- ─── document_access_rules ───────────────────────────────────

CREATE TABLE IF NOT EXISTS document_access_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES sites(id) ON DELETE SET NULL,
  document_id     UUID REFERENCES document_records(id) ON DELETE CASCADE,
  folder_id       UUID REFERENCES document_folders(id) ON DELETE CASCADE,
  rule_type       TEXT NOT NULL DEFAULT 'role',  -- role|user|department|category
  role_name       TEXT,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  department      TEXT,
  allowed_actions doc_access_action[] DEFAULT '{}',
  denied_actions  doc_access_action[] DEFAULT '{}',
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ─── document_workflows ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_workflows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES sites(id) ON DELETE SET NULL,
  document_id     UUID NOT NULL REFERENCES document_records(id) ON DELETE CASCADE,
  workflow_type   doc_workflow_type NOT NULL DEFAULT 'approval',
  approval_mode   doc_approval_mode NOT NULL DEFAULT 'sequential',
  current_step    INTEGER NOT NULL DEFAULT 1,
  total_steps     INTEGER NOT NULL DEFAULT 1,
  status          doc_workflow_step_status NOT NULL DEFAULT 'pending',
  initiated_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ─── document_workflow_steps ─────────────────────────────────

CREATE TABLE IF NOT EXISTS document_workflow_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       UUID REFERENCES sites(id) ON DELETE SET NULL,
  workflow_id   UUID NOT NULL REFERENCES document_workflows(id) ON DELETE CASCADE,
  step_number   INTEGER NOT NULL,
  step_name     TEXT NOT NULL,
  step_type     doc_workflow_type NOT NULL DEFAULT 'approval',
  assigned_role TEXT,
  assigned_user UUID REFERENCES users(id) ON DELETE SET NULL,
  status        doc_workflow_step_status NOT NULL DEFAULT 'pending',
  due_date      DATE,
  comment       TEXT,
  decision_at   TIMESTAMPTZ,
  escalated_at  TIMESTAMPTZ,
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (workflow_id, step_number)
);

-- ─── document_approvals ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_approvals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       UUID REFERENCES sites(id) ON DELETE SET NULL,
  document_id   UUID NOT NULL REFERENCES document_records(id) ON DELETE CASCADE,
  step_id       UUID REFERENCES document_workflow_steps(id) ON DELETE SET NULL,
  approver_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action        TEXT NOT NULL DEFAULT 'pending', -- pending|approved|rejected|returned
  comment       TEXT,
  decided_at    TIMESTAMPTZ,
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by    UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ─── document_signatures ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_signatures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES sites(id) ON DELETE SET NULL,
  document_id     UUID NOT NULL REFERENCES document_records(id) ON DELETE CASCADE,
  signer_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  signer_name     TEXT NOT NULL,
  signer_role     TEXT,
  signature_type  TEXT NOT NULL DEFAULT 'signature', -- signature|visa|cachet
  doc_hash        TEXT NOT NULL,          -- SHA-256 of document content at signing time
  reason          TEXT,
  ip_address      TEXT,
  signed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_valid        BOOLEAN NOT NULL DEFAULT true,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ─── document_retention_rules ────────────────────────────────

CREATE TABLE IF NOT EXISTS document_retention_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           UUID REFERENCES sites(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  category          document_category,
  module            TEXT,
  retention_years   INTEGER NOT NULL DEFAULT 10,
  warn_days_before  INTEGER NOT NULL DEFAULT 90,   -- notify this many days before
  action_on_expire  doc_retention_action NOT NULL DEFAULT 'notify',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  version           INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ─── document_archive_jobs ───────────────────────────────────

CREATE TABLE IF NOT EXISTS document_archive_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES sites(id) ON DELETE SET NULL,
  document_id     UUID NOT NULL REFERENCES document_records(id) ON DELETE CASCADE,
  rule_id         UUID REFERENCES document_retention_rules(id) ON DELETE SET NULL,
  action          doc_retention_action NOT NULL DEFAULT 'archive',
  scheduled_at    TIMESTAMPTZ NOT NULL,
  executed_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'scheduled',
  result          JSONB,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ─── document_shares ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_shares (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES sites(id) ON DELETE SET NULL,
  document_id     UUID NOT NULL REFERENCES document_records(id) ON DELETE CASCADE,
  share_type      doc_share_type NOT NULL DEFAULT 'user',
  shared_with_user UUID REFERENCES users(id) ON DELETE CASCADE,
  shared_with_role TEXT,
  token           TEXT UNIQUE,             -- for public_link type
  allowed_actions doc_access_action[] DEFAULT '{view,download}',
  expires_at      TIMESTAMPTZ,
  message         TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ─── document_download_logs ──────────────────────────────────

CREATE TABLE IF NOT EXISTS document_download_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES sites(id) ON DELETE SET NULL,
  document_id     UUID NOT NULL REFERENCES document_records(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL DEFAULT 'view',   -- view|download|print
  ip_address      TEXT,
  user_agent      TEXT,
  denied          BOOLEAN NOT NULL DEFAULT false,
  deny_reason     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ─── document_watermarks ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_watermarks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES sites(id) ON DELETE SET NULL,
  document_id     UUID NOT NULL REFERENCES document_records(id) ON DELETE CASCADE,
  watermark_text  TEXT NOT NULL,
  applied_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  applied_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ─── document_comments ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES sites(id) ON DELETE SET NULL,
  document_id     UUID NOT NULL REFERENCES document_records(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES document_comments(id) ON DELETE SET NULL,
  content         TEXT NOT NULL,
  is_internal     BOOLEAN NOT NULL DEFAULT true,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ─── document_notifications ──────────────────────────────────

CREATE TABLE IF NOT EXISTS document_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES sites(id) ON DELETE SET NULL,
  document_id     UUID REFERENCES document_records(id) ON DELETE CASCADE,
  recipient_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,        -- pending_approval|sign_request|expiring|rejected|shared|etc.
  title           TEXT NOT NULL,
  body            TEXT,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  metadata        JSONB,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ─── document_templates ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES sites(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  category        document_category NOT NULL DEFAULT 'Autre',
  module          TEXT,
  storage_key     TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  file_size       BIGINT NOT NULL DEFAULT 0,
  confidentiality document_confidentiality NOT NULL DEFAULT 'staff',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ─── INDEXES ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_doc_records_patient    ON document_records(patient_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_doc_records_entity     ON document_records(entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_doc_records_status     ON document_records(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_doc_records_category   ON document_records(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_doc_records_folder     ON document_records(folder_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_doc_records_checksum   ON document_records(checksum) WHERE checksum IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_doc_records_expires    ON document_records(expires_at) WHERE expires_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_doc_records_created    ON document_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_versions_doc       ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_folders_parent     ON document_folders(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_doc_workflows_doc      ON document_workflows(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_approvals_doc      ON document_approvals(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_approvals_approver ON document_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_doc_sigs_doc           ON document_signatures(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_shares_doc         ON document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_shares_token       ON document_shares(token) WHERE token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doc_dlogs_doc          ON document_download_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_dlogs_user         ON document_download_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_doc_notif_recipient    ON document_notifications(recipient_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_doc_comments_doc       ON document_comments(document_id) WHERE deleted_at IS NULL;

-- Full-text search
CREATE INDEX IF NOT EXISTS idx_doc_records_fts ON document_records
  USING gin(to_tsvector('french', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(document_number,'')))
  WHERE deleted_at IS NULL;

-- ─── SEED: default retention rules ───────────────────────────

INSERT INTO document_retention_rules (name, description, category, module, retention_years, warn_days_before, action_on_expire)
VALUES
  ('Dossiers patients - 10 ans',    'Dossiers médicaux patients',          'Patient',         'clinical',       10, 180, 'notify'),
  ('Analyses laboratoire - 10 ans', 'Résultats d''analyses',               'Laboratoire',     'laboratory',     10, 90,  'notify'),
  ('Imagerie médicale - 10 ans',    'Rapports radiologie',                 'Imagerie',        'imaging',        10, 90,  'notify'),
  ('Ordonnances - 5 ans',           'Prescriptions médicaments',           'Pharmacie',       'pharmacy',       5,  60,  'archive'),
  ('Factures - 10 ans',             'Factures et reçus',                   'Facturation',     'billing',        10, 90,  'notify'),
  ('Contrats assurance - 10 ans',   'Polices et bordereaux assurance',     'Assurance',       'insurance',      10, 180, 'notify'),
  ('Dossiers RH - 50 ans',          'Contrats et dossiers employés',       'RH',              'hr',             50, 365, 'legal_hold'),
  ('Documents qualité - 5 ans',     'Procédures, incidents qualité',       'Qualite',         'quality',        5,  90,  'archive'),
  ('Documents juridiques - 30 ans', 'Contrats et actes légaux',            'Juridique',       NULL,             30, 365, 'legal_hold'),
  ('Documents direction - 10 ans',  'Rapports et décisions direction',     'Direction',       NULL,             10, 180, 'notify'),
  ('Documents biomédical - 10 ans', 'Maintenances et certificats',         'Biomedical',      'biomedical',     10, 90,  'archive'),
  ('Wstock médical - 5 ans',        'Bons de commande et livraisons',      'Stock',           'medical_stock',  5,  60,  'archive')
ON CONFLICT DO NOTHING;

-- ─── SEED: default folders ───────────────────────────────────

INSERT INTO document_folders (name, path, category, is_system, confidentiality, description)
VALUES
  ('Patients',         '/Patients',          'Patient',          true, 'medical_confidential', 'Dossiers documents patients'),
  ('Médical',          '/Medical',           'Medical',          true, 'medical_confidential', 'Documents médicaux'),
  ('Laboratoire',      '/Laboratoire',       'Laboratoire',      true, 'medical_confidential', 'Résultats analyses'),
  ('Imagerie',         '/Imagerie',          'Imagerie',         true, 'medical_confidential', 'Rapports radiologie'),
  ('Pharmacie',        '/Pharmacie',         'Pharmacie',        true, 'medical_confidential', 'Ordonnances et prescriptions'),
  ('Hospitalisation',  '/Hospitalisation',   'Hospitalisation',  true, 'medical_confidential', 'Documents hospitalisation'),
  ('Bloc opératoire',  '/Bloc',              'Bloc_operatoire',  true, 'medical_confidential', 'Rapports opératoires'),
  ('Facturation',      '/Facturation',       'Facturation',      true, 'finance_confidential', 'Factures et paiements'),
  ('Assurance',        '/Assurance',         'Assurance',        true, 'finance_confidential', 'Polices et remboursements'),
  ('Ressources Humaines','/RH',              'RH',               true, 'hr_confidential',      'Dossiers employés'),
  ('Biomédical',       '/Biomedical',        'Biomedical',       true, 'confidential',         'Maintenance équipements'),
  ('Stock médical',    '/Stock',             'Stock',            true, 'confidential',         'Commandes et inventaire'),
  ('Qualité',          '/Qualite',           'Qualite',          true, 'confidential',         'Procédures et incidents'),
  ('Juridique',        '/Juridique',         'Juridique',        true, 'direction_only',       'Contrats et actes légaux'),
  ('Administratif',    '/Administratif',     'Administratif',    true, 'staff',                'Documents administratifs'),
  ('Direction',        '/Direction',         'Direction',        true, 'direction_only',       'Rapports et décisions')
ON CONFLICT DO NOTHING;

COMMIT;
