---
name: Infrastructure & lits (bâtiment→étage→chambre→lit)
description: Hiérarchie physique hospitalière, référentiel services, garde lits occupés, propagation dénormalisée, page Gestion des lits
---

# Infrastructure hospitalière & Gestion des lits

## Règles durables
- **Référentiel service = table `departments`** (WHERE deleted_at IS NULL AND is_active) — la table `services` existe mais est VIDE, ne jamais l'utiliser. Les admissions valident serviceId contre departments.
- Hiérarchie physique : `buildings` → `floors` → `rooms` → `occupancy_beds` (room_id/floor_id/building_id ; service_id sur chambres ET lits, le lit hérite du service de la chambre si non fourni).
- **Dénormalisation propagée** : les lits portent building_name/floor_label/room_number/service_name en texte. Tout rename bâtiment/étage/chambre ou changement de service DOIT propager aux lits liés (les PATCH /infrastructure/* le font) — sinon les cartes affichent des données périmées.
- **Garde lits occupés** : PATCH bed refuse chambre/service/statut si status occupe|reserve (409 français « géré via Admissions »). Statuts administrables limités à disponible/hors_service/maintenance — nettoyage reste géré par les routes occupancy-beds. Désactiver un lit = status hors_service (pas de colonne active) ; buildings/floors/rooms ont un boolean `active`.
- Permission `infrastructure.manage` (module 'admissions' en DB) grantée à super_admin/system_administrator/administrator ; lecture (tree/services/bed-cards) = admissions.view. **Nouvelle permission DB ⇒ re-login requis** pour les rôles non-super_admin (perms embarquées dans le JWT).
- ROLE_PERMISSIONS statique frontend contient des rôles legacy français (administrateur, directeur…) ET anglais (super_admin, administrator…) : ne granter côté statique QUE les rôles réellement grantés en DB, sinon can()=true mais 403 backend.

**Why:** les lits historiques (101–110) n'avaient que room_number texte avec room_id NULL — l'arborescence réelle (rooms) est arrivée après ; le texte dénormalisé reste la source d'affichage rapide (bed-cards sans multi-JOIN à chaud).

**How to apply:** toute nouvelle écriture qui déplace/renomme un élément de la hiérarchie doit mettre à jour la chaîne dénormalisée des lits ; toute nouvelle vue lit passe par /infrastructure/bed-cards (LEFT JOIN admissions+patients : patientFullName, mpiId, fileNumber, admissionNumber/Date, doctorName).
