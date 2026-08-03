-- =============================================================================
-- Migration 011: Insurance module permissions + insurance_agent role
-- Idempotent — ON CONFLICT DO NOTHING
-- =============================================================================

-- ── 1. New insurance_agent role ───────────────────────────────────────────────
INSERT INTO roles (name, display_name, description)
VALUES ('insurance_agent', 'Insurance Agent', 'Agent assurance — gestion des dossiers tiers payant')
ON CONFLICT (name) DO NOTHING;

-- ── 2. Full granular insurance permissions ────────────────────────────────────
INSERT INTO permissions (name, module, description) VALUES
  -- Organization management
  ('insurance.organizations.view',     'insurance', 'Voir les organismes payeurs'),
  ('insurance.organizations.create',   'insurance', 'Créer un organisme payeur'),
  ('insurance.organizations.update',   'insurance', 'Modifier un organisme payeur'),
  -- Plans
  ('insurance.plans.view',             'insurance', 'Voir les plans d''assurance'),
  ('insurance.plans.create',           'insurance', 'Créer un plan d''assurance'),
  ('insurance.plans.update',           'insurance', 'Modifier un plan d''assurance'),
  -- Policies
  ('insurance.policies.view',          'insurance', 'Voir les polices d''assurance'),
  ('insurance.policies.create',        'insurance', 'Créer une police d''assurance'),
  ('insurance.policies.update',        'insurance', 'Modifier une police d''assurance'),
  ('insurance.policies.renew',         'insurance', 'Renouveler une police d''assurance'),
  -- Coverage requests
  ('insurance.coverage_requests.view',   'insurance', 'Voir les prises en charge'),
  ('insurance.coverage_requests.create', 'insurance', 'Créer une demande de prise en charge'),
  ('insurance.coverage_requests.update', 'insurance', 'Mettre à jour une prise en charge'),
  -- Claims
  ('insurance.claims.view',            'insurance', 'Voir les dossiers assurance'),
  ('insurance.claims.create',          'insurance', 'Créer un dossier assurance'),
  ('insurance.claims.submit',          'insurance', 'Soumettre un dossier assurance'),
  ('insurance.claims.approve',         'insurance', 'Approuver un dossier assurance'),
  ('insurance.claims.partial_approve', 'insurance', 'Approuver partiellement un dossier'),
  ('insurance.claims.reject',          'insurance', 'Rejeter un dossier assurance'),
  ('insurance.claims.mark_paid',       'insurance', 'Marquer un dossier comme payé'),
  -- Bordereaux
  ('insurance.bordereaux.view',        'insurance', 'Voir les bordereaux'),
  ('insurance.bordereaux.create',      'insurance', 'Créer un bordereau'),
  ('insurance.bordereaux.submit',      'insurance', 'Soumettre un bordereau'),
  -- Payments
  ('insurance.payments.view',          'insurance', 'Voir les paiements organismes'),
  ('insurance.payments.create',        'insurance', 'Enregistrer un paiement organisme'),
  -- Reports / Export
  ('insurance.reports.view',           'insurance', 'Voir les rapports assurance'),
  ('insurance.export',                 'insurance', 'Exporter les données assurance')
ON CONFLICT (name) DO NOTHING;

-- ── 3. Grant all insurance permissions to super_admin + directeur ─────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name IN ('super_admin', 'directeur', 'medecin_chef', 'admin')
   AND p.module = 'insurance'
ON CONFLICT DO NOTHING;

-- ── 4. Grant billing_manager + comptable claim/bordereau/payment perms ─────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name IN ('comptable', 'billing_manager')
   AND p.name IN (
     'insurance.organizations.view',
     'insurance.plans.view',
     'insurance.policies.view', 'insurance.policies.create', 'insurance.policies.update', 'insurance.policies.renew',
     'insurance.coverage_requests.view', 'insurance.coverage_requests.create', 'insurance.coverage_requests.update',
     'insurance.claims.view', 'insurance.claims.create', 'insurance.claims.submit',
     'insurance.claims.approve', 'insurance.claims.partial_approve', 'insurance.claims.reject', 'insurance.claims.mark_paid',
     'insurance.bordereaux.view', 'insurance.bordereaux.create', 'insurance.bordereaux.submit',
     'insurance.payments.view', 'insurance.payments.create',
     'insurance.reports.view', 'insurance.export'
   )
ON CONFLICT DO NOTHING;

-- ── 4b. Grant ALL insurance permissions to super_admin and administrator ──────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name IN ('super_admin', 'administrator')
   AND p.name LIKE 'insurance.%'
ON CONFLICT DO NOTHING;

-- ── 5. Grant insurance_agent role targeted permissions ────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name = 'insurance_agent'
   AND p.name IN (
     'insurance.organizations.view',
     'insurance.plans.view',
     'insurance.policies.view', 'insurance.policies.create', 'insurance.policies.update', 'insurance.policies.renew',
     'insurance.coverage_requests.view', 'insurance.coverage_requests.create', 'insurance.coverage_requests.update',
     'insurance.claims.view', 'insurance.claims.create', 'insurance.claims.submit',
     'insurance.claims.approve', 'insurance.claims.partial_approve', 'insurance.claims.reject', 'insurance.claims.mark_paid',
     'insurance.bordereaux.view', 'insurance.bordereaux.create', 'insurance.bordereaux.submit',
     'insurance.payments.view', 'insurance.payments.create',
     'insurance.reports.view', 'insurance.export'
   )
ON CONFLICT DO NOTHING;

-- ── 6. Keep backward compat: map old permissions to new names ─────────────────
-- insurance.view         → insurance.claims.view
-- insurance.create_claim → insurance.claims.create
-- insurance.approve_claim→ insurance.claims.approve
-- insurance.reject_claim → insurance.claims.reject
-- (old permissions kept in DB; routes now check new granular names)
