/**
 * /infrastructure — hiérarchie hospitalière réelle (PostgreSQL) :
 *   Bâtiment → Étage → (Service) → Chambre → Lit
 *
 * Lecture (admissions.view) :
 *   GET /infrastructure/tree       — bâtiments + étages + chambres (avec nb de lits)
 *   GET /infrastructure/services   — référentiel services (departments, comme les admissions)
 *   GET /infrastructure/bed-cards  — tous les lits enrichis : chambre/étage/bâtiment/service
 *                                    + si occupé : patient, MPI, n° dossier, admission, médecin
 *
 * Gestion (infrastructure.manage — rôles d'administration) :
 *   POST/PATCH /buildings, /floors, /rooms, /beds — ajout, modification, activation/désactivation
 *
 * Règles d'intégrité :
 *   • Aucune suppression physique — désactivation uniquement (active=false / statut hors_service).
 *   • Un lit occupé ou réservé ne peut être ni déplacé ni changé de statut/service ici :
 *     ces transitions passent par les flux Admissions / occupancy-beds.
 *   • Structure stricte : une chambre exige un étage ET un service (departments) ; un lit neuf
 *     exige une chambre et hérite automatiquement étage/bâtiment/service de celle-ci.
 *   • Lits historiques sans chambre : rattachement automatique à la création d'une chambre
 *     portant le même numéro (hors lits occupés/réservés), sinon action « Affecter » côté admin.
 *   • Un lit rattaché ne peut pas être « détaché » — seulement déplacé vers une autre chambre.
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../middleware/requirePermission";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { auditService } from "../services/audit";
import { safeUuid } from "../repositories/types";
import type { ActorCtx } from "../repositories/types";

const router = Router();

const DEFAULT_SITE = "9747c84b-cedd-428a-b8ba-cf5f0b3b31ee";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BED_TYPES = ["standard", "soins_intensifs", "isolement", "maternite", "pediatrie"];
const BED_ADMIN_STATUSES = ["disponible", "hors_service", "maintenance"];

function actor(req: AuthenticatedRequest): ActorCtx {
  return {
    userId:   req.auth?.userId ?? "system",
    userName: req.auth?.userId ?? "system",
    userRole: req.auth?.role   ?? "guest",
  };
}

/** "" → null : les selects/inputs vides du frontend ne doivent jamais être castés en enum/uuid/numeric. */
function nn(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
}

/** Erreurs PG courantes → réponses françaises exploitables par l'UI. */
function pgErrorResponse(err: any, res: any): boolean {
  if (err?.code === "23505") {
    res.status(409).json({ error: "Doublon détecté : un enregistrement avec ce numéro ou ce nom existe déjà." });
    return true;
  }
  if (err?.code === "22P02" || err?.code === "22007" || err?.code === "22008") {
    res.status(400).json({ error: "Valeur invalide dans le formulaire (format ou type incorrect)." });
    return true;
  }
  if (err?.code === "23503") {
    res.status(409).json({ error: "Référence invalide : l'élément lié n'existe pas ou est utilisé ailleurs." });
    return true;
  }
  return false;
}

/** Chambre + chaîne étage/bâtiment (pour dénormaliser sur le lit). */
async function resolveRoomChain(roomId: string) {
  const q = await pool.query(
    `SELECT r.id, r.number AS room_number, r.service_id, r.service_name, r.active,
            f.id AS floor_id, f.name AS floor_label,
            bl.id AS building_id, bl.name AS building_name, bl.code AS building_code
       FROM rooms r
       JOIN floors f     ON f.id  = r.floor_id
       JOIN buildings bl ON bl.id = f.building_id
      WHERE r.id = $1 AND r.deleted_at IS NULL`,
    [roomId],
  );
  return q.rows[0] ?? null;
}

/** Service : résolution stricte contre departments (même règle que les admissions). */
async function resolveDepartment(serviceId: string) {
  const q = await pool.query(
    `SELECT id, name FROM departments
      WHERE id = $1 AND deleted_at IS NULL AND is_active = true`,
    [serviceId],
  );
  return q.rows[0] ?? null;
}

function mapBedRow(b: any) {
  return {
    id:           b.id,
    number:       b.number,
    type:         b.type,
    status:       b.status,
    notes:        b.notes ?? null,
    roomId:       b.room_id ?? null,
    roomNumber:   b.room_number ?? null,
    floorId:      b.floor_id ?? null,
    floorLabel:   b.floor_label ?? null,
    buildingId:   b.building_id ?? null,
    buildingName: b.building_name ?? null,
    buildingCode: b.building_code ?? null,
    serviceId:    b.service_id ?? null,
    serviceName:  b.service_name ?? null,
    patientId:    b.patient_id ?? null,
    patientName:  b.patient_name ?? null,
    admissionId:  b.admission_id ?? null,
    occupiedAt:   b.occupied_at ?? null,
    updatedAt:    b.updated_at ?? null,
  };
}

// ═══════════════════════════════ LECTURE ═══════════════════════════════

/** GET /infrastructure/tree — hiérarchie complète (y compris éléments désactivés, pour l'admin). */
router.get("/tree", requirePermission("admissions.view"), async (_req, res, next) => {
  try {
    const [blds, flrs, rms, counts] = await Promise.all([
      pool.query(`SELECT id, name, code, active, floors_count FROM buildings WHERE deleted_at IS NULL ORDER BY name`),
      pool.query(`SELECT id, building_id, name, level, active FROM floors WHERE deleted_at IS NULL ORDER BY level, name`),
      pool.query(`SELECT id, floor_id, number, name, service_id, service_name, active FROM rooms WHERE deleted_at IS NULL ORDER BY number`),
      pool.query(`SELECT room_id, COUNT(*)::int AS beds FROM occupancy_beds WHERE deleted_at IS NULL AND room_id IS NOT NULL GROUP BY room_id`),
    ]);
    const bedCount = new Map<string, number>(counts.rows.map((r: any) => [r.room_id, r.beds]));
    const roomsByFloor = new Map<string, any[]>();
    for (const r of rms.rows) {
      const arr = roomsByFloor.get(r.floor_id) ?? [];
      arr.push({
        id: r.id, number: r.number, name: r.name ?? null,
        serviceId: r.service_id ?? null, serviceName: r.service_name ?? null,
        active: r.active, bedCount: bedCount.get(r.id) ?? 0,
      });
      roomsByFloor.set(r.floor_id, arr);
    }
    const floorsByBuilding = new Map<string, any[]>();
    for (const f of flrs.rows) {
      const arr = floorsByBuilding.get(f.building_id) ?? [];
      arr.push({ id: f.id, name: f.name, level: f.level, active: f.active, rooms: roomsByFloor.get(f.id) ?? [] });
      floorsByBuilding.set(f.building_id, arr);
    }
    res.json(blds.rows.map((b: any) => ({
      id: b.id, name: b.name, code: b.code, active: b.active,
      floorsCount: b.floors_count, floors: floorsByBuilding.get(b.id) ?? [],
    })));
  } catch (err) { next(err); }
});

/** GET /infrastructure/services — référentiel services actifs (departments).
 *  Lisible par tout le personnel authentifié : ce référentiel transverse alimente
 *  les listes de services de tous les modules (admissions, consultations, urgences,
 *  stock médical…) — la gestion (CRUD) reste réservée à infrastructure.manage. */
router.get("/services", requireAuth, async (_req, res, next) => {
  try {
    const q = await pool.query(
      `SELECT id, name, code FROM departments
        WHERE deleted_at IS NULL AND is_active = true ORDER BY name`,
    );
    res.json(q.rows.map((d: any) => ({ id: d.id, name: d.name, code: d.code })));
  } catch (err) { next(err); }
});

// ═══════════════════════ SERVICES (référentiel departments) ═══════════════════
// Gestion centralisée du référentiel : la table `departments` est LA source
// unique des services hospitaliers. Aucune seconde table, aucun doublon.
// Un service utilisé par des données historiques n'est JAMAIS supprimé
// physiquement — il est désactivé (is_active = false) et reste dans l'historique.

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function mapDept(d: any) {
  return {
    id:                    d.id,
    name:                  d.name,
    code:                  d.code,
    color:                 d.color,
    isActive:              d.is_active,
    roomsCount:            d.rooms_count ?? 0,
    bedsCount:             d.beds_count ?? 0,
    activeAdmissionsCount: d.active_admissions_count ?? 0,
    staffCount:            d.staff_count ?? 0,
    createdAt:             d.created_at ?? null,
  };
}

/** GET /infrastructure/departments — liste de gestion (actifs + désactivés) avec compteurs d'usage. */
router.get("/departments", requirePermission("infrastructure.manage"), async (_req, res, next) => {
  try {
    const q = await pool.query(
      `SELECT d.id, d.name, d.code, d.color, d.is_active, d.created_at,
              (SELECT COUNT(*)::int FROM rooms r          WHERE r.service_id = d.id AND r.deleted_at IS NULL)                        AS rooms_count,
              (SELECT COUNT(*)::int FROM occupancy_beds b WHERE b.service_id = d.id AND b.deleted_at IS NULL)                        AS beds_count,
              (SELECT COUNT(*)::int FROM admissions a     WHERE a.service_id = d.id AND a.deleted_at IS NULL AND a.status = 'active') AS active_admissions_count,
              (SELECT COUNT(*)::int FROM users u          WHERE u.department_id = d.id AND u.deleted_at IS NULL)                     AS staff_count
         FROM departments d
        WHERE d.deleted_at IS NULL
        ORDER BY d.name`,
    );
    res.json(q.rows.map(mapDept));
  } catch (err) { next(err); }
});

/** POST /infrastructure/departments — ajouter un service (code auto-généré si absent). */
router.post("/departments", requirePermission("infrastructure.manage"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { name, code, color } = req.body ?? {};
    if (!nn(name)) return void res.status(400).json({ error: "Le nom du service est obligatoire." });
    const cleanName = String(name).trim();
    if (nn(color) !== null && !HEX_COLOR_RE.test(String(color).trim())) {
      return void res.status(400).json({ error: "Couleur invalide (format #RRGGBB)." });
    }

    const dup = await pool.query(
      `SELECT id FROM departments WHERE lower(name) = lower($1) AND deleted_at IS NULL`,
      [cleanName],
    );
    if (dup.rows.length > 0) return void res.status(409).json({ error: "Un service portant ce nom existe déjà." });

    let cleanCode = nn(code) ? String(code).trim().toUpperCase() : "";
    if (cleanCode) {
      const codeDup = await pool.query(
        `SELECT id FROM departments WHERE site_id = $1 AND upper(code) = $2 AND deleted_at IS NULL`,
        [DEFAULT_SITE, cleanCode],
      );
      if (codeDup.rows.length > 0) return void res.status(409).json({ error: "Ce code est déjà utilisé par un autre service." });
    } else {
      // Auto-génération : 4 lettres du nom sans accents, suffixe numérique si pris
      const base = cleanName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4) || "SVC";
      const taken = new Set(
        (await pool.query(`SELECT upper(code) AS code FROM departments WHERE site_id = $1 AND deleted_at IS NULL`, [DEFAULT_SITE]))
          .rows.map((r: any) => r.code),
      );
      cleanCode = base;
      for (let i = 2; taken.has(cleanCode); i++) cleanCode = `${base}${i}`;
    }

    const a = actor(req);
    const q = await pool.query(
      `INSERT INTO departments (site_id, name, code, color, created_by)
       VALUES ($1, $2, $3, COALESCE($4, '#6366F1'), $5) RETURNING *`,
      [DEFAULT_SITE, cleanName, cleanCode, nn(color) ? String(color).trim() : null, safeUuid(a.userId)],
    );
    const d = q.rows[0];
    await auditService.log({
      module: "hospitalisation", action: "department_created",
      resourceType: "department", resourceId: d.id,
      newValue: { name: d.name, code: d.code, color: d.color },
    }, a);
    res.status(201).json(mapDept({ ...d, rooms_count: 0, beds_count: 0, active_admissions_count: 0, staff_count: 0 }));
  } catch (err: any) {
    if (pgErrorResponse(err, res)) return;
    next(err);
  }
});

/** PATCH /infrastructure/departments/:id — nom, code, couleur, activation/désactivation.
 *  Renommage : propagation du nom dénormalisé aux chambres et lits liés (même transaction).
 *  Pas de DELETE : un service utilisé se désactive, l'historique est préservé. */
router.patch("/departments/:id", requirePermission("infrastructure.manage"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  const client = await pool.connect();
  try {
    const id = String(req.params.id);
    if (!UUID_RE.test(id)) return void res.status(400).json({ error: "Identifiant invalide." });
    const body = req.body ?? {};

    const existingQ = await client.query(`SELECT * FROM departments WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (existingQ.rows.length === 0) return void res.status(404).json({ error: "Service introuvable." });
    const existing = existingQ.rows[0];

    const newName = nn(body.name) ? String(body.name).trim() : null;
    if (newName && newName.toLowerCase() !== String(existing.name).toLowerCase()) {
      const dup = await client.query(
        `SELECT id FROM departments WHERE lower(name) = lower($1) AND deleted_at IS NULL AND id <> $2`,
        [newName, id],
      );
      if (dup.rows.length > 0) return void res.status(409).json({ error: "Un service portant ce nom existe déjà." });
    }
    const newCode = nn(body.code) ? String(body.code).trim().toUpperCase() : null;
    if (newCode && newCode !== String(existing.code).toUpperCase()) {
      const dup = await client.query(
        `SELECT id FROM departments WHERE site_id = $1 AND upper(code) = $2 AND deleted_at IS NULL AND id <> $3`,
        [existing.site_id, newCode, id],
      );
      if (dup.rows.length > 0) return void res.status(409).json({ error: "Ce code est déjà utilisé par un autre service." });
    }
    if (nn(body.color) !== null && !HEX_COLOR_RE.test(String(body.color).trim())) {
      return void res.status(400).json({ error: "Couleur invalide (format #RRGGBB)." });
    }
    const newActive = typeof body.active === "boolean" ? body.active : null;
    const a = actor(req);

    await client.query("BEGIN");
    const q = await client.query(
      `UPDATE departments SET
         name       = COALESCE($2, name),
         code       = COALESCE($3, code),
         color      = COALESCE($4, color),
         is_active  = COALESCE($5, is_active),
         updated_at = now(),
         updated_by = COALESCE($6, updated_by)
       WHERE id = $1 RETURNING *`,
      [id, newName, newCode, nn(body.color) ? String(body.color).trim() : null, newActive, safeUuid(a.userId)],
    );
    const d = q.rows[0];

    // Renommage → propager le nom dénormalisé (chambres + lits) dans la même transaction
    let propagatedRooms = 0, propagatedBeds = 0;
    if (newName && newName !== existing.name) {
      const r1 = await client.query(
        `UPDATE rooms SET service_name = $1, updated_at = now() WHERE service_id = $2 AND deleted_at IS NULL`,
        [newName, id],
      );
      const r2 = await client.query(
        `UPDATE occupancy_beds SET service_name = $1, updated_at = now() WHERE service_id = $2 AND deleted_at IS NULL`,
        [newName, id],
      );
      propagatedRooms = r1.rowCount ?? 0;
      propagatedBeds  = r2.rowCount ?? 0;
    }
    await client.query("COMMIT");

    const activeChanged = newActive !== null && newActive !== existing.is_active;
    const onlyToggle = activeChanged && newName === null && newCode === null && nn(body.color) === null;
    await auditService.log({
      module: "hospitalisation",
      action: onlyToggle ? (newActive ? "department_activated" : "department_deactivated") : "department_updated",
      resourceType: "department", resourceId: id,
      oldValue: { name: existing.name, code: existing.code, isActive: existing.is_active },
      newValue: { name: d.name, code: d.code, color: d.color, isActive: d.is_active, propagatedRooms, propagatedBeds },
    }, a);
    res.json(mapDept(d));
  } catch (err: any) {
    try { await client.query("ROLLBACK"); } catch { /* pas de transaction ouverte */ }
    if (pgErrorResponse(err, res)) return;
    next(err);
  } finally {
    client.release();
  }
});

/** GET /infrastructure/bed-cards — tous les lits, enrichis occupant + admission + médecin. */
router.get("/bed-cards", requirePermission("admissions.view"), async (_req, res, next) => {
  try {
    const q = await pool.query(
      `SELECT b.id, b.number, b.type::text AS type, b.status::text AS status, b.notes,
              b.room_id, b.room_number, b.floor_id, b.floor_label,
              b.building_id, b.building_name, b.building_code,
              b.service_id, b.service_name,
              b.patient_id, b.patient_name, b.admission_id, b.occupied_at, b.updated_at,
              a.admission_number, a.admission_date, a.doctor_name,
              a.service_name AS admission_service_name,
              p.mpi_id, p.file_number,
              NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), '') AS patient_full_name
         FROM occupancy_beds b
         LEFT JOIN admissions a ON a.id = b.admission_id AND a.deleted_at IS NULL
         LEFT JOIN patients p   ON p.id = b.patient_id   AND p.deleted_at IS NULL
        WHERE b.deleted_at IS NULL
        ORDER BY b.building_name NULLS LAST, b.floor_label NULLS LAST, b.room_number NULLS LAST, b.number`,
    );
    res.json(q.rows.map((b: any) => ({
      ...mapBedRow(b),
      admissionNumber:      b.admission_number ?? null,
      admissionDate:        b.admission_date ?? null,
      doctorName:           b.doctor_name ?? null,
      admissionServiceName: b.admission_service_name ?? null,
      mpiId:                b.mpi_id ?? null,
      fileNumber:           b.file_number ?? null,
      patientFullName:      b.patient_full_name ?? null,
    })));
  } catch (err) { next(err); }
});

// ═══════════════════════════════ BÂTIMENTS ═══════════════════════════════

/** POST /infrastructure/buildings */
router.post("/buildings", requirePermission("infrastructure.manage"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { name, code } = req.body ?? {};
    if (!nn(name)) return void res.status(400).json({ error: "Le nom du bâtiment est obligatoire." });
    if (!nn(code)) return void res.status(400).json({ error: "Le code du bâtiment est obligatoire." });
    const q = await pool.query(
      `INSERT INTO buildings (site_id, name, code, floors_count)
       VALUES ($1, $2, $3, 0) RETURNING *`,
      [DEFAULT_SITE, String(name).trim(), String(code).trim()],
    );
    const b = q.rows[0];
    await auditService.log({
      module: "hospitalisation", action: "building_created",
      resourceType: "building", resourceId: b.id, newValue: { name: b.name, code: b.code },
    }, actor(req));
    res.status(201).json({ id: b.id, name: b.name, code: b.code, active: b.active, floorsCount: b.floors_count });
  } catch (err: any) {
    if (pgErrorResponse(err, res)) return;
    next(err);
  }
});

/** PATCH /infrastructure/buildings/:id — nom, code, activation/désactivation */
router.patch("/buildings/:id", requirePermission("infrastructure.manage"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!UUID_RE.test(id)) return void res.status(400).json({ error: "Identifiant invalide." });
    const { name, code, active } = req.body ?? {};
    const q = await pool.query(
      `UPDATE buildings SET
         name = COALESCE($2, name),
         code = COALESCE($3, code),
         active = COALESCE($4, active),
         updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id, nn(name), nn(code), typeof active === "boolean" ? active : null],
    );
    if (q.rows.length === 0) return void res.status(404).json({ error: "Bâtiment introuvable." });
    const b = q.rows[0];
    await auditService.log({
      module: "hospitalisation", action: "building_updated",
      resourceType: "building", resourceId: id, newValue: { name: b.name, code: b.code, active: b.active },
    }, actor(req));
    res.json({ id: b.id, name: b.name, code: b.code, active: b.active, floorsCount: b.floors_count });
  } catch (err: any) {
    if (pgErrorResponse(err, res)) return;
    next(err);
  }
});

// ═══════════════════════════════ ÉTAGES ═══════════════════════════════

/** POST /infrastructure/floors */
router.post("/floors", requirePermission("infrastructure.manage"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { buildingId, name, level } = req.body ?? {};
    if (!buildingId || !UUID_RE.test(String(buildingId))) return void res.status(400).json({ error: "Bâtiment invalide." });
    if (!nn(name)) return void res.status(400).json({ error: "Le nom de l'étage est obligatoire." });
    const lvl = Number(level);
    if (!Number.isInteger(lvl)) return void res.status(400).json({ error: "Le niveau doit être un nombre entier (0 = rez-de-chaussée)." });
    const bld = await pool.query(`SELECT id FROM buildings WHERE id = $1 AND deleted_at IS NULL`, [buildingId]);
    if (bld.rows.length === 0) return void res.status(404).json({ error: "Bâtiment introuvable." });

    const q = await pool.query(
      `INSERT INTO floors (building_id, name, level) VALUES ($1, $2, $3) RETURNING *`,
      [buildingId, String(name).trim(), lvl],
    );
    await pool.query(
      `UPDATE buildings SET floors_count = (SELECT COUNT(*) FROM floors WHERE building_id = $1 AND deleted_at IS NULL), updated_at = now() WHERE id = $1`,
      [buildingId],
    );
    const f = q.rows[0];
    await auditService.log({
      module: "hospitalisation", action: "floor_created",
      resourceType: "floor", resourceId: f.id, newValue: { name: f.name, level: f.level, buildingId },
    }, actor(req));
    res.status(201).json({ id: f.id, buildingId: f.building_id, name: f.name, level: f.level, active: f.active });
  } catch (err: any) {
    if (pgErrorResponse(err, res)) return;
    next(err);
  }
});

/** PATCH /infrastructure/floors/:id — nom, niveau, activation/désactivation */
router.patch("/floors/:id", requirePermission("infrastructure.manage"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!UUID_RE.test(id)) return void res.status(400).json({ error: "Identifiant invalide." });
    const { name, level, active } = req.body ?? {};
    let lvl: number | null = null;
    if (nn(level) !== null) {
      lvl = Number(level);
      if (!Number.isInteger(lvl)) return void res.status(400).json({ error: "Le niveau doit être un nombre entier." });
    }
    const q = await pool.query(
      `UPDATE floors SET
         name = COALESCE($2, name),
         level = COALESCE($3, level),
         active = COALESCE($4, active),
         updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id, nn(name), lvl, typeof active === "boolean" ? active : null],
    );
    if (q.rows.length === 0) return void res.status(404).json({ error: "Étage introuvable." });
    const f = q.rows[0];
    // Dénormalisation : rafraîchir le libellé d'étage sur les lits rattachés
    if (nn(name) !== null) {
      await pool.query(
        `UPDATE occupancy_beds SET floor_label = $2, updated_at = now() WHERE floor_id = $1 AND deleted_at IS NULL`,
        [id, f.name],
      );
    }
    await auditService.log({
      module: "hospitalisation", action: "floor_updated",
      resourceType: "floor", resourceId: id, newValue: { name: f.name, level: f.level, active: f.active },
    }, actor(req));
    res.json({ id: f.id, buildingId: f.building_id, name: f.name, level: f.level, active: f.active });
  } catch (err: any) {
    if (pgErrorResponse(err, res)) return;
    next(err);
  }
});

// ═══════════════════════════════ CHAMBRES ═══════════════════════════════

/** POST /infrastructure/rooms */
router.post("/rooms", requirePermission("infrastructure.manage"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { floorId, number, name, serviceId } = req.body ?? {};
    if (!floorId || !UUID_RE.test(String(floorId))) return void res.status(400).json({ error: "Étage invalide." });
    if (!nn(number)) return void res.status(400).json({ error: "Le numéro de la chambre est obligatoire." });
    if (nn(serviceId) === null) return void res.status(400).json({ error: "Le service de la chambre est obligatoire." });
    if (!UUID_RE.test(String(serviceId))) return void res.status(400).json({ error: "Service invalide." });
    const flr = await pool.query(`SELECT id FROM floors WHERE id = $1 AND deleted_at IS NULL`, [floorId]);
    if (flr.rows.length === 0) return void res.status(404).json({ error: "Étage introuvable." });
    const dept = await resolveDepartment(String(serviceId));
    if (!dept) return void res.status(400).json({ error: "Service/département introuvable." });

    const q = await pool.query(
      `INSERT INTO rooms (floor_id, number, name, service_id, service_name)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [floorId, String(number).trim(), nn(name), dept.id, dept.name],
    );
    const r = q.rows[0];

    // Rattachement automatique des lits historiques « Non affecté » portant ce numéro de chambre
    // (jamais les lits occupés/réservés — leurs mouvements restent gérés via Admissions / ADT).
    const chain = await resolveRoomChain(r.id);
    const attached = await pool.query(
      `UPDATE occupancy_beds SET
         room_id = $1, room_number = $2,
         floor_id = $3, floor_label = $4,
         building_id = $5, building_name = $6, building_code = $7,
         service_id = $8, service_name = $9,
         updated_at = now()
       WHERE deleted_at IS NULL AND room_id IS NULL AND room_number IS NOT NULL
         AND lower(trim(room_number)) = lower(trim($2))
         AND status NOT IN ('occupe', 'reserve')
       RETURNING id, number`,
      [
        r.id, chain.room_number, chain.floor_id, chain.floor_label,
        chain.building_id, chain.building_name, chain.building_code,
        chain.service_id, chain.service_name,
      ],
    );

    const a = actor(req);
    await auditService.log({
      module: "hospitalisation", action: "room_created",
      resourceType: "room", resourceId: r.id,
      newValue: { number: r.number, floorId, serviceName: dept.name, attachedBeds: attached.rows.map((b: any) => b.number) },
    }, a);
    for (const bedRow of attached.rows) {
      await auditService.log({
        module: "hospitalisation", action: "bed_attached_to_room",
        resourceType: "occupancy_bed", resourceId: bedRow.id,
        newValue: { number: bedRow.number, roomNumber: r.number, serviceName: dept.name },
      }, a);
    }
    res.status(201).json({
      id: r.id, floorId: r.floor_id, number: r.number, name: r.name ?? null,
      serviceId: r.service_id ?? null, serviceName: r.service_name ?? null, active: r.active,
      attachedBeds: attached.rows.map((b: any) => b.number),
    });
  } catch (err: any) {
    if (pgErrorResponse(err, res)) return;
    next(err);
  }
});

/** PATCH /infrastructure/rooms/:id — numéro, nom, étage, service, activation.
 *  Les modifications sont propagées aux lits rattachés (dénormalisation). */
router.patch("/rooms/:id", requirePermission("infrastructure.manage"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!UUID_RE.test(id)) return void res.status(400).json({ error: "Identifiant invalide." });
    const body = req.body ?? {};
    const existing = await pool.query(`SELECT * FROM rooms WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (existing.rows.length === 0) return void res.status(404).json({ error: "Chambre introuvable." });

    let floorId: string | null = null;
    if (nn(body.floorId) !== null) {
      if (!UUID_RE.test(String(body.floorId))) return void res.status(400).json({ error: "Étage invalide." });
      const flr = await pool.query(`SELECT id FROM floors WHERE id = $1 AND deleted_at IS NULL`, [body.floorId]);
      if (flr.rows.length === 0) return void res.status(404).json({ error: "Étage introuvable." });
      floorId = String(body.floorId);
    }

    // serviceId : clé absente → inchangé ; "" / null → refusé (le service d'une chambre est obligatoire) ; uuid → résolu
    const serviceTouched = Object.prototype.hasOwnProperty.call(body, "serviceId");
    if (serviceTouched && nn(body.serviceId) === null) {
      return void res.status(400).json({ error: "Le service de la chambre est obligatoire — choisissez un autre service au lieu de le retirer." });
    }
    let svcId: string | null = null, svcName: string | null = null;
    if (serviceTouched && nn(body.serviceId) !== null) {
      if (!UUID_RE.test(String(body.serviceId))) return void res.status(400).json({ error: "Service invalide." });
      const dept = await resolveDepartment(String(body.serviceId));
      if (!dept) return void res.status(400).json({ error: "Service/département introuvable." });
      svcId = dept.id; svcName = dept.name;
    }

    const q = await pool.query(
      `UPDATE rooms SET
         number = COALESCE($2, number),
         name = CASE WHEN $6 THEN $3 ELSE name END,
         floor_id = COALESCE($4, floor_id),
         active = COALESCE($5, active),
         service_id = CASE WHEN $7 THEN $8::uuid ELSE service_id END,
         service_name = CASE WHEN $7 THEN $9 ELSE service_name END,
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [
        id, nn(body.number),
        nn(body.name),
        floorId,
        typeof body.active === "boolean" ? body.active : null,
        Object.prototype.hasOwnProperty.call(body, "name"),
        serviceTouched, svcId, svcName,
      ],
    );
    const r = q.rows[0];

    // Propagation aux lits de la chambre : localisation + service hérité
    await pool.query(
      `UPDATE occupancy_beds b SET
         room_number   = r.number,
         floor_id      = f.id,
         floor_label   = f.name,
         building_id   = bl.id,
         building_name = bl.name,
         building_code = bl.code,
         service_id    = COALESCE(r.service_id, b.service_id),
         service_name  = CASE WHEN r.service_id IS NOT NULL THEN r.service_name ELSE b.service_name END,
         updated_at    = now()
       FROM rooms r
       JOIN floors f     ON f.id  = r.floor_id
       JOIN buildings bl ON bl.id = f.building_id
      WHERE b.room_id = r.id AND r.id = $1 AND b.deleted_at IS NULL`,
      [id],
    );

    await auditService.log({
      module: "hospitalisation", action: "room_updated",
      resourceType: "room", resourceId: id,
      newValue: { number: r.number, active: r.active, serviceName: r.service_name ?? null },
    }, actor(req));
    res.json({
      id: r.id, floorId: r.floor_id, number: r.number, name: r.name ?? null,
      serviceId: r.service_id ?? null, serviceName: r.service_name ?? null, active: r.active,
    });
  } catch (err: any) {
    if (pgErrorResponse(err, res)) return;
    next(err);
  }
});

// ═══════════════════════════════ LITS ═══════════════════════════════

/** POST /infrastructure/beds — création d'un lit (statut initial : disponible). */
router.post("/beds", requirePermission("infrastructure.manage"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { number, type, roomId, serviceId, notes } = req.body ?? {};
    if (!nn(number)) return void res.status(400).json({ error: "Le numéro du lit est obligatoire." });
    const bedType = nn(type) === null ? "standard" : String(type);
    if (!BED_TYPES.includes(bedType)) {
      return void res.status(400).json({ error: `Type de lit invalide — autorisés : ${BED_TYPES.join(", ")}.` });
    }
    if (nn(serviceId) !== null) {
      return void res.status(400).json({ error: "Le service d'un lit est hérité de sa chambre — définissez le service sur la chambre." });
    }
    if (nn(roomId) === null) {
      return void res.status(400).json({ error: "La chambre est obligatoire : le lit hérite automatiquement de son étage, de son bâtiment et de son service." });
    }
    if (!UUID_RE.test(String(roomId))) return void res.status(400).json({ error: "Chambre invalide." });
    const chain = await resolveRoomChain(String(roomId));
    if (!chain) return void res.status(404).json({ error: "Chambre introuvable." });
    if (!chain.service_id) {
      return void res.status(409).json({ error: "Cette chambre n'a pas de service défini — affectez d'abord un service à la chambre." });
    }
    const dup = await pool.query(
      `SELECT 1 FROM occupancy_beds WHERE lower(number) = lower($1) AND deleted_at IS NULL`,
      [String(number).trim()],
    );
    if (dup.rows.length > 0) return void res.status(409).json({ error: "Un lit portant ce numéro existe déjà." });

    // Service : strictement hérité de la chambre
    const svcId: string | null = chain.service_id;
    const svcName: string | null = chain.service_name;

    const a = actor(req);
    const q = await pool.query(
      `INSERT INTO occupancy_beds
         (number, type, status, site_id,
          room_id, room_number, floor_id, floor_label,
          building_id, building_name, building_code,
          service_id, service_name, notes,
          created_at, updated_at, created_by, updated_by)
       VALUES ($1, $2::bed_type, 'disponible', $3,
               $4, $5, $6, $7,
               $8, $9, $10,
               $11, $12, $13,
               now(), now(), $14, $14)
       RETURNING *`,
      [
        String(number).trim(), bedType, DEFAULT_SITE,
        chain?.id ?? null, chain?.room_number ?? null, chain?.floor_id ?? null, chain?.floor_label ?? null,
        chain?.building_id ?? null, chain?.building_name ?? null, chain?.building_code ?? null,
        svcId, svcName, nn(notes),
        safeUuid(a.userId),
      ],
    );
    const b = q.rows[0];
    await auditService.log({
      module: "hospitalisation", action: "bed_created",
      resourceType: "occupancy_bed", resourceId: b.id,
      newValue: { number: b.number, type: b.type, roomNumber: b.room_number ?? null, serviceName: svcName },
    }, a);
    res.status(201).json(mapBedRow(b));
  } catch (err: any) {
    if (pgErrorResponse(err, res)) return;
    next(err);
  }
});

/** PATCH /infrastructure/beds/:id — numéro, type, chambre, service, statut admin.
 *  Un lit occupé/réservé : seuls numéro, type et notes sont modifiables. */
router.patch("/beds/:id", requirePermission("infrastructure.manage"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!UUID_RE.test(id)) return void res.status(400).json({ error: "Identifiant invalide." });
    const body = req.body ?? {};
    const existingQ = await pool.query(`SELECT * FROM occupancy_beds WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (existingQ.rows.length === 0) return void res.status(404).json({ error: "Lit introuvable." });
    const bed = existingQ.rows[0];

    const roomTouched   = Object.prototype.hasOwnProperty.call(body, "roomId");
    const statusTouched = nn(body.status) !== null;

    if (nn(body.serviceId) !== null) {
      return void res.status(400).json({
        error: "Le service d'un lit est hérité de sa chambre — modifiez le service de la chambre (tous ses lits suivront).",
      });
    }
    if ((bed.status === "occupe" || bed.status === "reserve") && (roomTouched || statusTouched)) {
      return void res.status(409).json({
        error: "Lit occupé ou réservé — libérez-le d'abord (sortie/transfert via Admissions) avant de le déplacer, changer de service ou de statut.",
      });
    }

    let newStatus: string | null = null;
    if (statusTouched) {
      newStatus = String(body.status);
      if (!BED_ADMIN_STATUSES.includes(newStatus)) {
        return void res.status(400).json({ error: `Statut invalide — autorisés ici : ${BED_ADMIN_STATUSES.join(", ")}.` });
      }
    }

    let bedType: string | null = null;
    if (nn(body.type) !== null) {
      bedType = String(body.type);
      if (!BED_TYPES.includes(bedType)) {
        return void res.status(400).json({ error: `Type de lit invalide — autorisés : ${BED_TYPES.join(", ")}.` });
      }
    }

    if (nn(body.number) !== null) {
      const dup = await pool.query(
        `SELECT 1 FROM occupancy_beds WHERE lower(number) = lower($1) AND id <> $2 AND deleted_at IS NULL`,
        [String(body.number).trim(), id],
      );
      if (dup.rows.length > 0) return void res.status(409).json({ error: "Un lit portant ce numéro existe déjà." });
    }

    // Chambre : clé absente → inchangée ; "" / null → refusé si le lit est rattaché (pas de retour en arrière) ;
    // uuid → chaîne résolue, la chambre cible doit avoir un service défini.
    let chain: any = null;
    let detachRoom = false;
    if (roomTouched) {
      if (nn(body.roomId) === null) {
        if (bed.room_id) {
          return void res.status(400).json({
            error: "Un lit rattaché doit rester dans une chambre — déplacez-le vers une autre chambre au lieu de le détacher.",
          });
        }
        detachRoom = true;
      } else {
        if (!UUID_RE.test(String(body.roomId))) return void res.status(400).json({ error: "Chambre invalide." });
        chain = await resolveRoomChain(String(body.roomId));
        if (!chain) return void res.status(404).json({ error: "Chambre introuvable." });
        if (!chain.service_id) {
          return void res.status(409).json({ error: "Cette chambre n'a pas de service défini — affectez d'abord un service à la chambre." });
        }
      }
    }

    // Service : strictement hérité de la chambre — tout changement de chambre aligne le service du lit.
    let svcTouched = false;
    let svcId: string | null = null, svcName: string | null = null;
    if (chain) {
      svcTouched = true; svcId = chain.service_id; svcName = chain.service_name;
    }

    const a = actor(req);
    const q = await pool.query(
      `UPDATE occupancy_beds SET
         number = COALESCE($2, number),
         type   = COALESCE($3::bed_type, type),
         status = COALESCE($4::occupancy_bed_status, status),
         notes  = CASE WHEN $5 THEN $6 ELSE notes END,
         room_id       = CASE WHEN $7 THEN $8::uuid  ELSE room_id END,
         room_number   = CASE WHEN $7 THEN $9        ELSE room_number END,
         floor_id      = CASE WHEN $7 THEN $10::uuid ELSE floor_id END,
         floor_label   = CASE WHEN $7 THEN $11       ELSE floor_label END,
         building_id   = CASE WHEN $7 THEN $12::uuid ELSE building_id END,
         building_name = CASE WHEN $7 THEN $13       ELSE building_name END,
         building_code = CASE WHEN $7 THEN $14       ELSE building_code END,
         service_id    = CASE WHEN $15 THEN $16::uuid ELSE service_id END,
         service_name  = CASE WHEN $15 THEN $17       ELSE service_name END,
         updated_at = now(),
         updated_by = $18
       WHERE id = $1 RETURNING *`,
      [
        id,
        nn(body.number) === null ? null : String(body.number).trim(),
        bedType,
        newStatus,
        Object.prototype.hasOwnProperty.call(body, "notes"), nn(body.notes),
        roomTouched,
        detachRoom ? null : (chain?.id ?? null),
        detachRoom ? null : (chain?.room_number ?? null),
        detachRoom ? null : (chain?.floor_id ?? null),
        detachRoom ? null : (chain?.floor_label ?? null),
        detachRoom ? null : (chain?.building_id ?? null),
        detachRoom ? null : (chain?.building_name ?? null),
        detachRoom ? null : (chain?.building_code ?? null),
        svcTouched, svcId, svcName,
        safeUuid(a.userId),
      ],
    );
    const b = q.rows[0];
    await auditService.log({
      module: "hospitalisation", action: "bed_updated",
      resourceType: "occupancy_bed", resourceId: id,
      newValue: { number: b.number, type: b.type, status: b.status, roomNumber: b.room_number ?? null, serviceName: b.service_name ?? null },
    }, a);
    res.json(mapBedRow(b));
  } catch (err: any) {
    if (pgErrorResponse(err, res)) return;
    next(err);
  }
});

export default router;
