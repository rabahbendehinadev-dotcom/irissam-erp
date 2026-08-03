-- =============================================================================
-- Migration 027 — Super Administration Permissions & Role Grants
-- =============================================================================

-- ── Insert system.* permissions ───────────────────────────────────────────
INSERT INTO permissions (name, description, module) VALUES
  ('system.view',                  'Accéder au centre de contrôle système',             'system'),
  ('system.health.view',           'Voir les health checks système',                    'system'),
  ('system.database.view',         'Consulter les statistiques de la base de données',  'system'),
  ('system.database.manage',       'Gérer la base de données (cancel query, analyze)',  'system'),
  ('system.migrations.view',       'Consulter l''historique des migrations',            'system'),
  ('system.migrations.apply',      'Appliquer les migrations en attente',               'system'),
  ('system.backups.view',          'Consulter les sauvegardes',                         'system'),
  ('system.backups.create',        'Créer des sauvegardes',                             'system'),
  ('system.backups.restore',       'Restaurer depuis une sauvegarde',                   'system'),
  ('system.jobs.view',             'Consulter les jobs en arrière-plan',                'system'),
  ('system.jobs.retry',            'Relancer un job échoué',                            'system'),
  ('system.jobs.cancel',           'Annuler un job',                                    'system'),
  ('system.logs.view',             'Consulter les logs système',                        'system'),
  ('system.audit.view',            'Consulter les logs d''audit',                       'system'),
  ('system.sessions.view',         'Consulter les sessions actives',                    'system'),
  ('system.sessions.revoke',       'Révoquer des sessions utilisateur',                 'system'),
  ('system.security.view',         'Consulter le tableau de bord sécurité',             'system'),
  ('system.security.manage',       'Gérer les incidents de sécurité',                   'system'),
  ('system.api_keys.view',         'Consulter les clés API',                            'system'),
  ('system.api_keys.create',       'Créer des clés API',                                'system'),
  ('system.api_keys.revoke',       'Révoquer des clés API',                             'system'),
  ('system.webhooks.view',         'Consulter les webhooks',                            'system'),
  ('system.webhooks.manage',       'Gérer les webhooks',                                'system'),
  ('system.integrations.view',     'Consulter les intégrations',                        'system'),
  ('system.integrations.manage',   'Gérer les intégrations',                            'system'),
  ('system.feature_flags.view',    'Consulter les feature flags',                       'system'),
  ('system.feature_flags.manage',  'Gérer les feature flags',                           'system'),
  ('system.maintenance.view',      'Consulter le mode maintenance',                     'system'),
  ('system.maintenance.manage',    'Activer/désactiver le mode maintenance',            'system'),
  ('system.settings.view',         'Consulter les paramètres système',                  'system'),
  ('system.settings.manage',       'Modifier les paramètres système',                   'system'),
  ('system.release_notes.view',    'Consulter les notes de version',                    'system')
ON CONFLICT (name) DO NOTHING;

-- ── Grant all system.* permissions to super_admin ─────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'super_admin'
  AND p.name LIKE 'system.%'
ON CONFLICT DO NOTHING;

-- ── Grant all system.* permissions to system_administrator ───────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'system_administrator'
  AND p.name LIKE 'system.%'
ON CONFLICT DO NOTHING;
