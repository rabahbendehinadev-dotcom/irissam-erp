-- 046 — Infrastructure hospitalière : Bâtiment → Étage → Service → Chambre → Lit
--
-- Existant conservé : buildings, floors, occupancy_beds (avec room_id uuid jamais relié,
-- room_number/floor_label/building_* dénormalisés), departments comme référentiel services.
-- Ajouts :
--   • table rooms (chambres) — n'existait pas
--   • drapeaux active sur buildings / floors (désactivation sans suppression)
--   • occupancy_beds.service_id/service_name (même référentiel que les admissions : departments)
--   • FK occupancy_beds.room_id → rooms
--   • permission infrastructure.manage attribuée aux rôles d'administration

-- 1) Chambres
CREATE TABLE IF NOT EXISTS rooms (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id     uuid NOT NULL REFERENCES floors(id),
  service_id   uuid REFERENCES departments(id),
  service_name text,
  number       text NOT NULL,
  name         text,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rooms_floor_number
  ON rooms (floor_id, lower(number)) WHERE deleted_at IS NULL;

-- 2) Désactivation sans suppression
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE floors    ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- 3) Lits : rattachement à un service (référentiel departments, comme les admissions)
ALTER TABLE occupancy_beds ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES departments(id);
ALTER TABLE occupancy_beds ADD COLUMN IF NOT EXISTS service_name text;

-- 4) FK room_id → rooms (colonne héritée, aucune valeur non nulle au moment de la migration)
DO $$
BEGIN
  ALTER TABLE occupancy_beds
    ADD CONSTRAINT fk_occ_beds_room FOREIGN KEY (room_id) REFERENCES rooms(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN foreign_key_violation THEN
    RAISE WARNING '046: FK occupancy_beds.room_id non ajoutée (valeurs orphelines existantes)';
END $$;

-- 5) Permission de gestion de l'infrastructure
INSERT INTO permissions (name, module, description)
SELECT 'infrastructure.manage', 'admissions',
       'Gérer l''infrastructure hospitalière : bâtiments, étages, chambres et lits'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'infrastructure.manage');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
  JOIN permissions p ON p.name = 'infrastructure.manage'
 WHERE r.name IN ('super_admin', 'system_administrator', 'administrator')
   AND NOT EXISTS (
     SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
   );
