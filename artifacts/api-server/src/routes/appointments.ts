/**
 * /appointments routes — backed by AppointmentService.
 *
 * Schema alignment (appointmentsTable):
 *  - departmentName: text not null (replaces `service` + `patientFirstName/LastName`)
 *  - patientName: text not null (single field; split on read for firstName/lastName)
 *  - id: UUID (not integer)
 *  - scheduledAt: timestamp with timezone
 *
 * Intégrité référentielle (UAT Phase 2) :
 *  - POST exige un doctorId réel (users.role='doctor'); patientId/departmentId
 *    optionnels mais vérifiés en base quand fournis; les noms sont résolus
 *    côté serveur (jamais fournis par le client).
 *  - PATCH n'accepte que les statuts de l'enum appointment_status;
 *    l'annulation exige la permission appointments.cancel.
 *  - RBAC : GET → appointments.view, POST → appointments.create,
 *    PATCH → appointments.edit (+ .cancel si annulation).
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { appointmentService } from "../services/appointment";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requirePermission";
import type { ActorCtx } from "../repositories/types";
import type { DbAppointment } from "../repositories/appointment";

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valeurs autorisées — alignées sur les enums PostgreSQL (migration 001). */
const APPOINTMENT_STATUSES = ["confirmed", "pending", "cancelled", "completed", "no_show", "in_progress"] as const;
const APPOINTMENT_TYPES    = ["consultation_externe", "urgence", "hospitalier", "teleconsultation"] as const;

function actor(req: AuthenticatedRequest): ActorCtx {
  return {
    userId:   req.auth?.userId ?? "system",
    userName: req.auth?.userId ?? "system",
    userRole: req.auth?.role   ?? "guest",
  };
}

function hasPerm(req: AuthenticatedRequest, permission: string): boolean {
  if (req.auth?.role === "super_admin") return true;
  return Array.isArray(req.auth?.permissions) && req.auth!.permissions!.includes(permission);
}

function mapAppointment(a: DbAppointment) {
  const parts = a.patientName.split(" ");
  const firstName = parts[0] ?? "";
  const lastName  = parts.slice(1).join(" ") || firstName;
  const deptName  = a.departmentName;

  return {
    id:          a.id,
    patientId:   a.patientId,          // vrai UUID ou null (walk-in) — plus de `apt-…` fabriqué
    patient: {
      id:        a.patientId ?? "",
      firstName,
      lastName,
    },
    patientName: a.patientName,
    doctorId:    a.doctorId,           // vrai UUID ou null
    doctorName:  a.doctorName,
    departmentId:   a.departmentId,    // vrai UUID ou null
    departmentName: deptName,
    service:        deptName,          // legacy alias kept for frontend widgets
    scheduledAt: a.scheduledAt.toISOString(),
    duration:    a.duration,
    status:      a.status,
    type:        a.type,
    notes:       a.notes ?? undefined,
    cancelledReason: a.cancelledReason ?? undefined,
  };
}

/** GET /appointments/upcoming — dashboard widget (today, non-cancelled, limit 5) */
router.get("/upcoming", requirePermission("appointments.view"), async (_req, res, next) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const result = await appointmentService.upcoming(start, end, 5);

    res.json(
      result.data
        .filter((a) => a.status !== "cancelled")
        .map((a) => ({
          id:          a.id,
          patientId:   a.patientId,
          patientName: a.patientName,
          service:     a.departmentName,
          doctorName:  a.doctorName,
          scheduledAt: a.scheduledAt.toISOString(),
          status:      a.status,
        })),
    );
  } catch (err) {
    next(err);
  }
});

/** GET /appointments — full appointment list */
router.get("/", requirePermission("appointments.view"), async (req, res, next) => {
  try {
    const { search, status, departmentId, patientId } =
      req.query as Record<string, string | undefined>;

    const result = await appointmentService.list({ limit: 500 });
    let rows = result.data;

    if (patientId) {
      rows = rows.filter((a) => a.patientId === patientId);
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((a) =>
        `${a.patientName} ${a.doctorName} ${a.departmentName}`.toLowerCase().includes(q),
      );
    }
    if (status && status !== "all") {
      rows = rows.filter((a) => a.status === status);
    }
    if (departmentId && departmentId !== "all") {
      // Le filtre frontend envoie le NOM du département (les anciennes lignes
      // n'ont pas de departmentId) — on matche sur le nom.
      rows = rows.filter((a) => a.departmentName === departmentId);
    }

    res.json(rows.map(mapAppointment));
  } catch (err) {
    next(err);
  }
});

/** GET /appointments/:id — fetch one appointment by UUID */
router.get("/:id", requirePermission("appointments.view"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const row = await appointmentService.findById(id);
    if (!row) { res.status(404).json({ error: "Appointment not found" }); return; }
    res.json(mapAppointment(row));
  } catch (err) {
    next(err);
  }
});

/** POST /appointments — create a new appointment (referential integrity enforced) */
router.post("/", requirePermission("appointments.create"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = req.body as {
      patientId?: string;
      patientName?: string;
      doctorId?: string;
      departmentId?: string;
      departmentName?: string;
      scheduledAt?: string;
      duration?: number;
      notes?: string;
      status?: string;
      type?: string;
    };

    // ── doctorId : obligatoire, UUID, médecin réel ──────────────────────────
    if (!body.doctorId || !UUID_RE.test(body.doctorId)) {
      res.status(400).json({ error: "doctorId (UUID) est requis — sélectionnez un médecin réel" });
      return;
    }
    const doctorQ = await pool.query(
      `SELECT id, first_name, last_name FROM users
        WHERE id = $1 AND role = 'doctor' AND deleted_at IS NULL`,
      [body.doctorId],
    );
    if (doctorQ.rows.length === 0) {
      res.status(400).json({ error: "Médecin introuvable" });
      return;
    }
    const doctorName = `${doctorQ.rows[0].first_name} ${doctorQ.rows[0].last_name}`;

    // ── patientId : optionnel (walk-in), mais vérifié quand fourni ─────────
    let patientId: string | null = null;
    let patientName: string;
    let patientMpi: string | null = null;
    if (body.patientId) {
      if (!UUID_RE.test(body.patientId)) {
        res.status(400).json({ error: "patientId invalide (UUID attendu)" });
        return;
      }
      const patientQ = await pool.query(
        `SELECT id, first_name, last_name, mpi_id FROM patients
          WHERE id = $1 AND deleted_at IS NULL`,
        [body.patientId],
      );
      if (patientQ.rows.length === 0) {
        res.status(400).json({ error: "Patient introuvable" });
        return;
      }
      patientId   = patientQ.rows[0].id;
      patientName = `${patientQ.rows[0].first_name} ${patientQ.rows[0].last_name}`;
      patientMpi  = patientQ.rows[0].mpi_id ?? null;
    } else {
      const name = (body.patientName ?? "").trim();
      if (!name) {
        res.status(400).json({ error: "patientId ou patientName est requis" });
        return;
      }
      patientName = name;
    }

    // ── departmentId : optionnel, vérifié quand fourni ─────────────────────
    let departmentId: string | null = null;
    let departmentName = (body.departmentName ?? "").trim() || "Médecine générale";
    if (body.departmentId) {
      if (!UUID_RE.test(body.departmentId)) {
        res.status(400).json({ error: "departmentId invalide (UUID attendu)" });
        return;
      }
      const deptQ = await pool.query(
        `SELECT id, name FROM departments
          WHERE id = $1 AND deleted_at IS NULL AND is_active = true`,
        [body.departmentId],
      );
      if (deptQ.rows.length === 0) {
        res.status(400).json({ error: "Département introuvable" });
        return;
      }
      departmentId   = deptQ.rows[0].id;
      departmentName = deptQ.rows[0].name;
    }

    // ── scheduledAt : date ISO valide ───────────────────────────────────────
    if (!body.scheduledAt) {
      res.status(400).json({ error: "scheduledAt est requis" });
      return;
    }
    const scheduledAt = new Date(body.scheduledAt);
    if (isNaN(scheduledAt.getTime())) {
      res.status(400).json({ error: "scheduledAt invalide (date ISO attendue)" });
      return;
    }

    // ── status / type : enum allow-list ────────────────────────────────────
    const status = body.status ?? "pending";
    if (!APPOINTMENT_STATUSES.includes(status as any)) {
      res.status(400).json({ error: `status invalide — valeurs autorisées : ${APPOINTMENT_STATUSES.join(", ")}` });
      return;
    }
    const type = body.type ?? "consultation_externe";
    if (!APPOINTMENT_TYPES.includes(type as any)) {
      res.status(400).json({ error: `type invalide — valeurs autorisées : ${APPOINTMENT_TYPES.join(", ")}` });
      return;
    }

    const duration = Number.isFinite(body.duration) && body.duration! >= 5 && body.duration! <= 480
      ? Math.round(body.duration!)
      : 30;

    const created = await appointmentService.create({
      patientId,
      patientName,
      patientMpi,
      doctorId:       body.doctorId,
      doctorName,
      departmentId,
      departmentName,
      scheduledAt,
      duration,
      notes:          body.notes?.trim() || null,
      status:         status as any,
      type:           type as any,
    }, actor(req));

    res.status(201).json(mapAppointment(created));
  } catch (err) {
    next(err);
  }
});

/** PATCH /appointments/:id — update appointment status (enum allow-list + RBAC) */
router.patch("/:id", requirePermission("appointments.edit"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body as { status?: string };

    if (!status) {
      res.status(400).json({ error: "status is required" });
      return;
    }
    if (!APPOINTMENT_STATUSES.includes(status as any)) {
      res.status(400).json({ error: `status invalide — valeurs autorisées : ${APPOINTMENT_STATUSES.join(", ")}` });
      return;
    }
    // L'annulation exige la permission dédiée appointments.cancel
    if (status === "cancelled" && !hasPerm(req, "appointments.cancel")) {
      res.status(403).json({ message: "Permission refusée", required: "appointments.cancel" });
      return;
    }

    const updated = await appointmentService.updateStatus(id, status, actor(req));

    if (!updated) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    res.json(mapAppointment(updated));
  } catch (err) {
    next(err);
  }
});

export default router;
