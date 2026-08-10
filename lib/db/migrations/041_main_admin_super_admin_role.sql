-- 041_main_admin_super_admin_role.sql
-- Bug : le compte principal admin@irissam.dz a users.role = 'super_admin' (enum),
-- mais user_roles ne le liait qu'au rôle RBAC 'administrator', qui ne possède
-- AUCUNE permission system.* → « Accès refusé » sur /super-admin (front + API),
-- alors que le rôle RBAC 'super_admin' (toutes les permissions system.*) n'était
-- attribué à personne en production.
--
-- Correctif de mapping uniquement : on ATTACHE le rôle RBAC 'super_admin' au
-- compte principal, en CONSERVANT 'administrator' (les permissions sont l'union
-- des rôles — rien n'est retiré, notamment les permissions documents.* que
-- 'super_admin' ne possède pas). Aucun autre utilisateur n'est modifié.
-- Idempotent : ON CONFLICT sur la PK (user_id, role_id).

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'super_admin'
WHERE u.email = 'admin@irissam.dz'
  AND u.role  = 'super_admin'
ON CONFLICT DO NOTHING;
