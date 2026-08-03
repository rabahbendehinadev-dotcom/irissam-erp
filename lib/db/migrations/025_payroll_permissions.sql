-- =============================================================================
-- Migration 025 — PAYROLL Permissions & Roles
-- =============================================================================

-- ── Permissions ───────────────────────────────────────────────────────────────
INSERT INTO permissions (name, description, module) VALUES
  ('payroll.view',                    'Accéder au module paie',                           'payroll'),
  ('payroll.dashboard.view',          'Voir le tableau de bord paie',                     'payroll'),
  ('payroll.periods.view',            'Consulter les périodes de paie',                   'payroll'),
  ('payroll.periods.create',          'Créer une période de paie',                        'payroll'),
  ('payroll.periods.update',          'Modifier une période de paie',                     'payroll'),
  ('payroll.runs.create',             'Créer un run de paie',                             'payroll'),
  ('payroll.runs.calculate',          'Calculer les salaires',                            'payroll'),
  ('payroll.runs.review',             'Réviser les anomalies',                            'payroll'),
  ('payroll.runs.hr_approve',         'Approbation RH du run',                            'payroll'),
  ('payroll.runs.finance_approve',    'Approbation Finance du run',                       'payroll'),
  ('payroll.runs.lock',               'Verrouiller un run de paie',                       'payroll'),
  ('payroll.runs.mark_paid',          'Marquer le run comme payé',                        'payroll'),
  ('payroll.payslips.view',           'Consulter les bulletins de paie',                  'payroll'),
  ('payroll.payslips.print',          'Imprimer les bulletins de paie',                   'payroll'),
  ('payroll.components.view',         'Consulter les composants salariaux',               'payroll'),
  ('payroll.components.manage',       'Gérer les composants salariaux',                   'payroll'),
  ('payroll.advances.view',           'Consulter les avances',                            'payroll'),
  ('payroll.advances.manage',         'Gérer les avances sur salaire',                    'payroll'),
  ('payroll.loans.view',              'Consulter les prêts',                              'payroll'),
  ('payroll.loans.manage',            'Gérer les prêts',                                  'payroll'),
  ('payroll.payment_orders.view',     'Consulter les ordres de paiement',                 'payroll'),
  ('payroll.payment_orders.create',   'Créer des ordres de paiement',                     'payroll'),
  ('payroll.payment_orders.approve',  'Approuver les ordres de paiement',                 'payroll'),
  ('payroll.bank_export',             'Exporter fichier bancaire',                        'payroll'),
  ('payroll.reports.view',            'Accéder aux rapports paie',                        'payroll'),
  ('payroll.settings.manage',         'Gérer les paramètres de paie',                     'payroll'),
  ('payroll.view_sensitive',          'Voir les détails sensibles (salaires individuels)', 'payroll')
ON CONFLICT (name) DO NOTHING;

-- ── Role helpers ──────────────────────────────────────────────────────────────
-- Ensure payroll-specific roles exist
INSERT INTO roles (name, display_name, description) VALUES
  ('payroll_manager', 'Gestionnaire de Paie', 'Accès complet au module paie'),
  ('payroll_officer', 'Agent de Paie',        'Saisie et calcul des salaires')
ON CONFLICT (name) DO NOTHING;

-- ── Grants ─────────────────────────────────────────────────────────────────
-- Helper: grant ALL payroll.* to a role
DO $$
DECLARE
  r_payroll_manager UUID;
  r_payroll_officer UUID;
  r_finance         UUID;
  r_hr              UUID;
  r_admin           UUID;
  r_dg              UUID;
  p UUID;
BEGIN
  SELECT id INTO r_payroll_manager FROM roles WHERE name = 'payroll_manager';
  SELECT id INTO r_payroll_officer FROM roles WHERE name = 'payroll_officer';
  SELECT id INTO r_finance         FROM roles WHERE name = 'responsable_facturation';
  SELECT id INTO r_hr              FROM roles WHERE name = 'responsable_rh';
  SELECT id INTO r_admin           FROM roles WHERE name = 'admin';
  SELECT id INTO r_dg              FROM roles WHERE name = 'directeur_general';

  -- payroll_manager: everything
  FOR p IN SELECT id FROM permissions WHERE module = 'payroll' LOOP
    IF r_payroll_manager IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id) VALUES (r_payroll_manager, p) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- admin: everything
  FOR p IN SELECT id FROM permissions WHERE module = 'payroll' LOOP
    IF r_admin IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id) VALUES (r_admin, p) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- payroll_officer: view, create period, create run, calculate, review, view payslips, view components
  FOR p IN SELECT id FROM permissions WHERE name IN (
    'payroll.view','payroll.dashboard.view','payroll.periods.view','payroll.periods.create',
    'payroll.runs.create','payroll.runs.calculate','payroll.runs.review',
    'payroll.payslips.view','payroll.payslips.print',
    'payroll.components.view','payroll.advances.view','payroll.loans.view',
    'payroll.reports.view','payroll.view_sensitive'
  ) LOOP
    IF r_payroll_officer IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id) VALUES (r_payroll_officer, p) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- responsable_rh: hr_approve + view
  FOR p IN SELECT id FROM permissions WHERE name IN (
    'payroll.view','payroll.dashboard.view','payroll.periods.view',
    'payroll.runs.hr_approve','payroll.runs.review',
    'payroll.payslips.view','payroll.advances.view','payroll.advances.manage',
    'payroll.loans.view','payroll.loans.manage','payroll.reports.view','payroll.view_sensitive'
  ) LOOP
    IF r_hr IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id) VALUES (r_hr, p) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- responsable_facturation: finance_approve + payment orders
  FOR p IN SELECT id FROM permissions WHERE name IN (
    'payroll.view','payroll.dashboard.view','payroll.periods.view',
    'payroll.runs.finance_approve','payroll.runs.lock','payroll.runs.mark_paid',
    'payroll.payslips.view','payroll.payment_orders.view','payroll.payment_orders.create',
    'payroll.payment_orders.approve','payroll.bank_export','payroll.reports.view','payroll.view_sensitive'
  ) LOOP
    IF r_finance IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id) VALUES (r_finance, p) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- directeur_general: view everything
  FOR p IN SELECT id FROM permissions WHERE name IN (
    'payroll.view','payroll.dashboard.view','payroll.periods.view',
    'payroll.payslips.view','payroll.reports.view','payroll.view_sensitive'
  ) LOOP
    IF r_dg IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id) VALUES (r_dg, p) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
