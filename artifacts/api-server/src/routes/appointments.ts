/**
 * /appointments routes — backed by AppointmentService.
 *
 * Schema alignment (appointmentsTable):
 *  - departmentName: text not null (replaces `service` + `patientFirstName/LastName`)
 *  - patientName: text not null (single field; split on read for firstName/lastName)
 *  - id: UUID (not integer)
 *  - scheduledAt: timestamp with timezone
 */
import { Router } from "express";
import { appointmentService } from "../services/appointment";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import type { ActorCtx } from "../repositories/types";
import type { DbAppointment } from "../repositories/appointment";

const router = Router();

function actor(req: AuthenticatedRequest): ActorCtx {
  return {
    userId:   req.auth?.userId ?? "system",
    userName: req.auth?.userId ?? "system",
    userRole: req.auth?.role   ?? "guest",
  };
}

function mapAppointment(a: DbAppointment) {
  const parts = a.patientName.split(" ");
  const firstName = parts[0] ?? "";
  const lastName  = parts.slice(1).join(" ") || firstName;
  const deptName  = a.departmentName;

  return {
    id:          a.id,
    patientId:   a.patientId ?? `apt-${a.id}`,
    patient: {
      id:        a.patientId ?? `apt-${a.id}`,
      firstName,
      lastName,
    },
    patientName: a.patientName,
    doctorId:    a.doctorId ?? "system",
    doctorName:  a.doctorName,
    departmentId:   deptName,
    departmentName: deptName,
    service:        deptName,       // legacy alias kept for frontend widgets
    scheduledAt: a.scheduledAt.toISOString(),
    duration:    a.duration,
    status:      a.status,
    type:        a.type,
    notes:       a.notes ?? undefined,
    cancelledReason: a.cancelledReason ?? undefined,
  };
}

/** GET /appointments/upcoming — dashboard widget (today, non-cancelled, limit 5) */
router.get("/upcoming", async (_req, res, next) => {
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
          patientId:   a.patientId ?? `apt-${a.id}`,
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
router.get("/", async (req, res, next) => {
  try {
    const { search, status, departmentId } =
      req.query as Record<string, string | undefined>;

    const result = await appointmentService.list({ limit: 200 });
    let rows = result.data;

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
      rows = rows.filter((a) => a.departmentName === departmentId);
    }

    res.json(rows.map(mapAppointment));
  } catch (err) {
    next(err);
  }
});

/** GET /appointments/:id — fetch one appointment by UUID */
router.get("/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const row = await appointmentService.findById(id);
    if (!row) { res.status(404).json({ error: "Appointment not found" }); return; }
    res.json(mapAppointment(row));
  } catch (err) {
    next(err);
  }
});

/** POST /appointments — create a new appointment */
router.post("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = req.body as {
      patientName?: string;
      patientFirstName?: string;
      patientLastName?: string;
      patientId?: string;
      doctorName?: string;
      departmentName?: string;
      scheduledAt?: string;
      duration?: number;
      notes?: string;
      status?: string;
      type?: string;
    };

    if (!body.doctorName || !body.scheduledAt) {
      res.status(400).json({ error: "doctorName and scheduledAt are required" });
      return;
    }

    const patientName =
      body.patientName ??
      (`${body.patientFirstName ?? ""} ${body.patientLastName ?? ""}`.trim() || "Patient inconnu");

    const created = await appointmentService.create({
      patientId:      body.patientId ?? null,
      patientName,
      patientMpi:     null,
      doctorName:     body.doctorName,
      departmentName: body.departmentName ?? "Médecine générale",
      scheduledAt:    new Date(body.scheduledAt),
      duration:       body.duration ?? 30,
      notes:          body.notes ?? null,
      status:         (body.status as any) ?? "pending",
      type:           (body.type as any) ?? "consultation_externe",
    }, actor(req));

    res.status(201).json(mapAppointment(created));
  } catch (err) {
    next(err);
  }
});

/** PATCH /appointments/:id — update appointment status */
router.patch("/:id", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body as { status?: string };

    if (!status) {
      res.status(400).json({ error: "status is required" });
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
