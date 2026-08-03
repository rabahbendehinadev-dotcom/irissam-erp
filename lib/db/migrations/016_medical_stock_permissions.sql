-- =============================================================================
-- Migration 016: Medical Stock Permissions & RBAC
-- Idempotent — ON CONFLICT DO NOTHING throughout
-- =============================================================================

BEGIN;

-- ── 1. Permissions ─────────────────────────────────────────────────────────
INSERT INTO permissions (name, module, description) VALUES
  ('stock.view',                   'stock', 'Accéder au module stock médical'),
  ('stock.dashboard.view',         'stock', 'Voir le tableau de bord stock'),
  ('stock.items.view',             'stock', 'Consulter les articles'),
  ('stock.items.create',           'stock', 'Créer un article'),
  ('stock.items.update',           'stock', 'Modifier un article'),
  ('stock.items.delete',           'stock', 'Supprimer un article'),
  ('stock.categories.manage',      'stock', 'Gérer les catégories'),
  ('stock.suppliers.view',         'stock', 'Voir les fournisseurs'),
  ('stock.suppliers.manage',       'stock', 'Gérer les fournisseurs'),
  ('stock.manufacturers.manage',   'stock', 'Gérer les fabricants'),
  ('stock.batches.view',           'stock', 'Voir les lots'),
  ('stock.batches.manage',         'stock', 'Gérer les lots'),
  ('stock.movements.view',         'stock', 'Voir les mouvements de stock'),
  ('stock.movements.create',       'stock', 'Enregistrer un mouvement'),
  ('stock.purchase_orders.view',   'stock', 'Voir les bons de commande'),
  ('stock.purchase_orders.create', 'stock', 'Créer un bon de commande'),
  ('stock.purchase_orders.approve','stock', 'Approuver un bon de commande'),
  ('stock.purchase_orders.receive','stock', 'Réceptionner une commande'),
  ('stock.transfers.view',         'stock', 'Voir les transferts'),
  ('stock.transfers.create',       'stock', 'Créer un transfert'),
  ('stock.transfers.approve',      'stock', 'Approuver un transfert'),
  ('stock.adjustments.view',       'stock', 'Voir les ajustements'),
  ('stock.adjustments.create',     'stock', 'Créer un ajustement'),
  ('stock.adjustments.approve',    'stock', 'Approuver un ajustement'),
  ('stock.inventory.view',         'stock', 'Voir les inventaires'),
  ('stock.inventory.manage',       'stock', 'Gérer les inventaires'),
  ('stock.consumptions.view',      'stock', 'Voir les consommations'),
  ('stock.consumptions.create',    'stock', 'Enregistrer une consommation'),
  ('stock.consumptions.validate',  'stock', 'Valider une consommation'),
  ('stock.reports.view',           'stock', 'Voir les rapports stock'),
  ('stock.export',                 'stock', 'Exporter les données stock')
ON CONFLICT (name) DO NOTHING;

-- ── 2. super_admin & administrator — full stock access ─────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('super_admin', 'administrator')
  AND p.module = 'stock'
ON CONFLICT DO NOTHING;

-- ── 3. pharmacist — full stock operational access ──────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'pharmacist'
  AND p.name IN (
    'stock.view','stock.dashboard.view',
    'stock.items.view','stock.items.create','stock.items.update',
    'stock.categories.manage','stock.suppliers.view','stock.suppliers.manage',
    'stock.manufacturers.manage',
    'stock.batches.view','stock.batches.manage',
    'stock.movements.view','stock.movements.create',
    'stock.purchase_orders.view','stock.purchase_orders.create','stock.purchase_orders.receive',
    'stock.transfers.view','stock.transfers.create',
    'stock.adjustments.view','stock.adjustments.create',
    'stock.inventory.view','stock.inventory.manage',
    'stock.consumptions.view','stock.consumptions.create','stock.consumptions.validate',
    'stock.reports.view','stock.export'
  )
ON CONFLICT DO NOTHING;

-- ── 4. director — read-only stock access ──────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'director'
  AND p.name IN (
    'stock.view','stock.dashboard.view',
    'stock.items.view','stock.batches.view','stock.movements.view',
    'stock.purchase_orders.view','stock.transfers.view',
    'stock.adjustments.view','stock.inventory.view',
    'stock.consumptions.view','stock.reports.view'
  )
ON CONFLICT DO NOTHING;

-- ── 5. nurse — consumption + view ─────────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'nurse'
  AND p.name IN (
    'stock.view','stock.items.view','stock.batches.view',
    'stock.movements.view','stock.consumptions.view','stock.consumptions.create'
  )
ON CONFLICT DO NOTHING;

-- ── 6. doctor — consumption view ──────────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'doctor'
  AND p.name IN ('stock.view','stock.items.view','stock.consumptions.view')
ON CONFLICT DO NOTHING;

COMMIT;
