/**
 * /consultations routes — backed by ConsultationService.
 *
 * Intégrité référentielle (durcissement UAT Phase 3) :
 *  - RBAC : GET → consultations.view, POST → consultations.create,
 *    PATCH → consultations.edit (montage requireAuth dans routes/index.ts).
 *  - POST exige patientId + doctorId réels (UUID vérifiés en base).  Les
 *    champs dénormalisés (patientName / patientMpi / doctorName) sont résolus
 *    CÔTÉ SERVEUR à partir des lignes réelles — jamais acceptés du client.
 *  - serviceName est résolu strictement contre les départements réels
 *    (insensible à la casse) → 400 « Service inconnu » sinon.
 *  - encounterId fourni doit appartenir au MÊME patient et être ouvert ;
 *    absent → l'encounter ouvert le plus récent du patient est rattaché
 *    automatiquement (aucune création d'encounter ici).
 *  - type / origin / status validés contre les enums PostgreSQL → 400.
 *  - PATCH limité à status / notes / diagnosis.  patientId / encounterId /
 *    doctorId / number sont IMMUABLES : leur présence dans le body → 400
 *    (protection IDOR — on ne « déplace » jamais une consultation).
 *  - Numéro CONS-YYYY-NNNNN via compteur atomique par année (migration 039).
 *
 * Schema alignment (consultationsTable):
 *  - id: UUID (not integer)
 *  - No `date` column: use scheduledAt / startedAt for date-based fields
 *  - reason / motif: `reason` is the DB column; `motif` is accepted as an alias
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { consultationService, EncounterStateError } from "../services/consultation";
import { requirePermission } from "../middleware/requirePermission";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import type { ActorCtx } from "../repositories/types";
import type { DbConsultation } from "../repositories/consultation";

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Enums PostgreSQL (consultation_type / consultation_origin / consultation_status)
const CONSULTATION_TYPES    = ["consultation_externe", "urgence", "hospitalier", "teleconsultation"] as const;
const CONSULTATION_ORIGINS  = ["hospitalisation", "urgence", "rdv", "walk_in"] as const;
const CONSULTATION_STATUSES = ["en_attente", "en_cours", "terminee", "planifiee", "annulee"] as const;

function actor(req: AuthenticatedRequest): ActorCtx {
  return {
    userId:   req.auth?.userId ?? "system",
    userName: req.auth?.userId ?? "system",
    userRole: req.auth?.role   ?? "guest",
  };
}

/** Normalize legacy DB type values to the frontend ConsultationType enum. */
const TYPE_NORMALIZE: Record<string, string> = {
  consultation_externe: "ambulatoire",
  urgence:              "urgences",
  hospitalier:          "hospitalisation",
};

function normalizeType(raw: string): string {
  return TYPE_NORMALIZE[raw] ?? raw;
}

function mapConsultation(c: DbConsultation) {
  // Derive a date string from scheduledAt or startedAt
  const dateStr = c.scheduledAt
    ? c.scheduledAt.toISOString().slice(0, 10)
    : c.startedAt
    ? c.startedAt.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return {
    id:          c.id,
    number:      c.number,
    encounterId: c.encounterId ?? null,
    patientId:   c.patientId ?? `cons-${c.id}`,
    patientName: c.patientName,
    patientMpi:  c.patientMpi,
    doctorId:    c.doctorId ?? "system",
    doctorName:  c.doctorName,
    specialty:   c.specialty,
    serviceId:   c.serviceId ?? "system",
    serviceName: c.serviceName,
    siteId:      "site-1",
    siteName:    "Site Principal",
    date:        dateStr,
    scheduledAt: c.scheduledAt?.toISOString() ?? `${dateStr}T08:00:00.000Z`,
    startedAt:   c.startedAt?.toISOString(),
    endedAt:     c.endedAt?.toISOString(),
    duration:    c.duration ?? undefined,
    type:        normalizeType(c.type),
    origin:      c.origin,
    // motif is the primary name; reason is the DB column (kept as alias)
    motif:       c.reason,
    reason:      c.reason,
    status:      c.status,
    syncStatus:  c.syncStatus,
    diagnosis:   c.diagnosis ?? undefined,
    notes:       c.notes     ?? undefined,
    createdAt:   c.createdAt.toISOString(),
    updatedAt:   c.updatedAt.toISOString(),
    createdById: "system",
    medical:     { allergies: [], chronicDiseases: [], majorHistory: [] },
  };
}

/** GET /consultations */
router.get("/", requirePermission("consultations.view"), async (req, res, next) => {
  try {
    const { search, status, type, origin, doctor, specialty, dateFrom, dateTo, patientId } =
      req.query as Record<string, string | undefined>;

    const result = await consultationService.list({ patientId: patientId || undefined, limit: 300 });
    let rows = result.data;

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((c) =>
        [c.patientName, c.patientMpi, c.number, c.doctorName, c.reason, c.serviceName, c.specialty]
          .some((f) => f?.toLowerCase().includes(q)),
      );
    }
    if (status && status !== "all")    rows = rows.filter((c) => c.status === status);
    if (type   && type   !== "all")    rows = rows.filter((c) => c.type === type || normalizeType(c.type) === type);
    if (origin && origin !== "all")    rows = rows.filter((c) => c.origin === origin);
    if (doctor && doctor !== "all")    rows = rows.filter((c) => c.doctorName === doctor);
    if (specialty && specialty !== "all") rows = rows.filter((c) => c.specialty === specialty);
    if (dateFrom) {
      rows = rows.filter((c) => {
        const d = c.scheduledAt?.toISOString().slice(0, 10) ?? "";
        return d >= dateFrom;
      });
    }
    if (dateTo) {
      rows = rows.filter((c) => {
        const d = c.scheduledAt?.toISOString().slice(0, 10) ?? "";
        return d <= dateTo;
      });
    }

    res.json(rows.map(mapConsultation));
  } catch (err) {
    next(err);
  }
});

/** GET /consultations/:id — fetch one consultation by UUID */
router.get("/:id", requirePermission("consultations.view"), async (req, res, next) => {
  try {
    const id = String(req.params.id).replace(/^db-/, "");
    // Garde UUID : un id malformé ne doit jamais atteindre le cast uuid de
    // PostgreSQL (500) — c'est un 404 propre.
    if (!UUID_RE.test(id)) { res.status(404).json({ error: "Consultation not found" }); return; }
    const row = await consultationService.findById(id);
    if (!row) { res.status(404).json({ error: "Consultation not found" }); return; }
    res.json(mapConsultation(row));
  } catch (err) {
    next(err);
  }
});

/** POST /consultations — create a new consultation (referentially validated) */
router.post("/", requirePermission("consultations.create"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = req.body as {
      patientId?:   string;
      doctorId?:    string;
      specialty?:   string;
      serviceName?: string;
      scheduledAt?: string;
      type?:        string;
      origin?:      string;
      reason?:      string;  // DB column name
      motif?:       string;  // primary alias accepted from frontend
      encounterId?: string;
      status?:      string;
      duration?:    number;
    };

    // Accept `motif` as primary field, `reason` as fallback alias
    const reason = (body.motif ?? body.reason ?? "").trim();

    // ── 1. Champs obligatoires : identifiants réels, pas de texte libre ──
    if (!body.patientId || !UUID_RE.test(body.patientId)) {
      res.status(400).json({ error: "patientId (UUID) est requis — sélectionnez un patient réel" });
      return;
    }
    if (!body.doctorId || !UUID_RE.test(body.doctorId)) {
      res.status(400).json({ error: "doctorId (UUID) est requis — sélectionnez un médecin réel" });
      return;
    }
    if (!reason) {
      res.status(400).json({ error: "motif (ou reason) est requis" });
      return;
    }
    const serviceNameInput = (body.serviceName ?? "").trim();
    if (!serviceNameInput) {
      res.status(400).json({ error: "serviceName est requis" });
      return;
    }

    // ── 2. Enums PostgreSQL ──
    const type = body.type ?? "consultation_externe";
    if (!(CONSULTATION_TYPES as readonly string[]).includes(type)) {
      res.status(400).json({ error: `type invalide : "${type}". Valeurs acceptées : ${CONSULTATION_TYPES.join(", ")}` });
      return;
    }
    const origin = body.origin ?? "rdv";
    if (!(CONSULTATION_ORIGINS as readonly string[]).includes(origin)) {
      res.status(400).json({ error: `origin invalide : "${origin}". Valeurs acceptées : ${CONSULTATION_ORIGINS.join(", ")}` });
      return;
    }
    const status = body.status ?? "en_attente";
    if (!(CONSULTATION_STATUSES as readonly string[]).includes(status)) {
      res.status(400).json({ error: `status invalide : "${status}". Valeurs acceptées : ${CONSULTATION_STATUSES.join(", ")}` });
      return;
    }
    let scheduledAt = new Date();
    if (body.scheduledAt !== undefined) {
      scheduledAt = new Date(body.scheduledAt);
      if (isNaN(scheduledAt.getTime())) {
        res.status(400).json({ error: "scheduledAt invalide (date/heure illisible)" });
        return;
      }
    }
    if (body.duration !== undefined && (typeof body.duration !== "number" || !Number.isFinite(body.duration) || body.duration < 0)) {
      res.status(400).json({ error: "duration invalide (nombre de minutes attendu)" });
      return;
    }

    // ── 3. Patient réel — nom et MPI résolus côté serveur ──
    const patientQ = await pool.query(
      `SELECT id, first_name, last_name, mrn, mpi_id
         FROM patients
        WHERE id = $1 AND deleted_at IS NULL`,
      [body.patientId],
    );
    if (patientQ.rows.length === 0) {
      res.status(400).json({ error: "Patient introuvable" });
      return;
    }
    const patientRow = patientQ.rows[0] as { id: string; first_name: string; last_name: string; mrn: string; mpi_id: string | null };

    // ── 4. Médecin réel (compte utilisateur avec le rôle doctor) ──
    const doctorQ = await pool.query(
      `SELECT id, first_name, last_name, specialty
         FROM users
        WHERE id = $1 AND role = 'doctor' AND deleted_at IS NULL`,
      [body.doctorId],
    );
    if (doctorQ.rows.length === 0) {
      res.status(400).json({ error: "Médecin introuvable" });
      return;
    }
    const doctorRow = doctorQ.rows[0] as { id: string; first_name: string; last_name: string; specialty: string | null };

    // ── 5. Service réel (résolution stricte, insensible à la casse) ──
    const serviceQ = await pool.query(
      `SELECT id, name
         FROM departments
        WHERE lower(name) = lower($1) AND deleted_at IS NULL AND is_active = true`,
      [serviceNameInput],
    );
    if (serviceQ.rows.length === 0) {
      res.status(400).json({ error: `Service inconnu : "${serviceNameInput}" ne correspond à aucun département réel` });
      return;
    }
    const serviceRow = serviceQ.rows[0] as { id: string; name: string };

    // ── 6. Encounter : fourni → même patient + ouvert ; absent → rattachement
    //       automatique de l'encounter ouvert du patient (aucune création) ──
    let encounterId: string | null = null;
    if (body.encounterId) {
      if (!UUID_RE.test(body.encounterId)) {
        res.status(400).json({ error: "encounterId invalide (UUID attendu)" });
        return;
      }
      const encQ = await pool.query(
        `SELECT id, patient_id, status FROM encounters WHERE id = $1 AND deleted_at IS NULL`,
        [body.encounterId],
      );
      if (encQ.rows.length === 0) {
        res.status(400).json({ error: "Encounter introuvable" });
        return;
      }
      const enc = encQ.rows[0] as { id: string; patient_id: string; status: string };
      if (enc.patient_id !== body.patientId) {
        res.status(400).json({ error: "L'encounter fourni appartient à un autre patient" });
        return;
      }
      if (enc.status !== "open") {
        res.status(400).json({ error: "Encounter clôturé — impossible d'y rattacher une consultation" });
        return;
      }
      encounterId = enc.id;
    } else {
      const openEncQ = await pool.query(
        `SELECT id
           FROM encounters
          WHERE patient_id = $1 AND status = 'open' AND deleted_at IS NULL
          ORDER BY opened_at DESC
          LIMIT 1`,
        [body.patientId],
      );
      encounterId = (openEncQ.rows[0] as { id: string } | undefined)?.id ?? null;
    }

    const consultation = await consultationService.create({
      patientId:   patientRow.id,
      patientName: `${patientRow.first_name} ${patientRow.last_name}`,
      patientMpi:  patientRow.mpi_id ?? patientRow.mrn,
      doctorId:    doctorRow.id,
      doctorName:  `Dr ${doctorRow.first_name} ${doctorRow.last_name}`,
      specialty:   (body.specialty ?? "").trim() || doctorRow.specialty || serviceRow.name,
      serviceId:   serviceRow.id,
      serviceName: serviceRow.name,
      scheduledAt,
      type:        type   as (typeof CONSULTATION_TYPES)[number],
      origin:      origin as (typeof CONSULTATION_ORIGINS)[number],
      reason,
      encounterId,
      status:      status as (typeof CONSULTATION_STATUSES)[number],
      duration:    body.duration ?? null,
    }, actor(req));

    res.status(201).json(mapConsultation(consultation));
  } catch (err) {
    // Course TOCTOU : l'encounter s'est fermé/déplacé entre la validation et
    // l'INSERT transactionnel → 400 propre, pas un 500.
    if (err instanceof EncounterStateError) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

/** PATCH /consultations/:id — update status / notes / diagnosis */
router.patch("/:id", requirePermission("consultations.edit"), async (req: AuthenticatedRequest, res, next) => {
  try {
    // IDs may be bare UUIDs; strip any legacy `db-` prefix
    const id = String(req.params.id).replace(/^db-/, "");
    if (!UUID_RE.test(id)) { res.status(404).json({ error: "Consultation not found" }); return; }

    const body = req.body as Record<string, unknown>;

    // Protection IDOR : le rattachement patient / encounter / médecin et le
    // numéro sont immuables.  Toute tentative de les modifier → 400 explicite.
    const IMMUTABLE_FIELDS = [
      "patientId", "patient_id", "patientName", "patientMpi",
      "encounterId", "encounter_id",
      "doctorId", "doctor_id", "doctorName",
      "number", "id",
    ];
    const forbidden = IMMUTABLE_FIELDS.filter((k) => body[k] !== undefined);
    if (forbidden.length > 0) {
      res.status(400).json({ error: `Champs non modifiables : ${forbidden.join(", ")}` });
      return;
    }

    const status    = body.status;
    const notes     = body.notes;
    const diagnosis = body.diagnosis;

    if (status === undefined && notes === undefined && diagnosis === undefined) {
      res.status(400).json({ error: "Aucun champ modifiable fourni (status, notes ou diagnosis)" });
      return;
    }
    if (status !== undefined && !(CONSULTATION_STATUSES as readonly string[]).includes(String(status))) {
      res.status(400).json({ error: `status invalide : "${String(status)}". Valeurs acceptées : ${CONSULTATION_STATUSES.join(", ")}` });
      return;
    }
    if (notes !== undefined && notes !== null && typeof notes !== "string") {
      res.status(400).json({ error: "notes invalide (texte attendu)" });
      return;
    }
    if (diagnosis !== undefined && diagnosis !== null && typeof diagnosis !== "string") {
      res.status(400).json({ error: "diagnosis invalide (texte attendu)" });
      return;
    }

    const updated = await consultationService.update(id, {
      status:    status as DbConsultation["status"] | undefined,
      notes:     notes as string | null | undefined,
      diagnosis: diagnosis as string | null | undefined,
    }, actor(req));

    if (!updated) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    res.json(mapConsultation(updated));
  } catch (err) {
    next(err);
  }
});

export default router;
