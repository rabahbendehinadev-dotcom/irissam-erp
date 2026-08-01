import { Router } from "express";
import { db } from "@workspace/db";
import { appointmentsTable } from "@workspace/db/schema";
import { asc, gte, lt, and, ne, desc } from "drizzle-orm";

const router = Router();

/** GET /appointments/upcoming — dashboard widget (today, non-cancelled, limit 5) */
router.get("/upcoming", async (_req, res, next) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const appointments = await db
      .select()
      .from(appointmentsTable)
      .where(
        and(
          gte(appointmentsTable.scheduledAt, start),
          lt(appointmentsTable.scheduledAt, end),
          ne(appointmentsTable.status, "cancelled"),
        ),
      )
      .orderBy(asc(appointmentsTable.scheduledAt))
      .limit(5);

    res.json(
      appointments.map((a) => ({
        id: a.id,
        patientName: a.patientName,
        service: a.service,
        doctorName: a.doctorName,
        scheduledAt: a.scheduledAt.toISOString(),
        status: a.status,
      })),
    );
  } catch (err) {
    next(err);
  }
});

/** GET /appointments — full appointment list for the Appointments page */
router.get("/", async (req, res, next) => {
  try {
    const { search, status, departmentId } = req.query as Record<string, string | undefined>;

    let rows = await db
      .select()
      .from(appointmentsTable)
      .orderBy(asc(appointmentsTable.scheduledAt));

    // Apply filters in memory
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((a) => {
        const name = `${a.patientFirstName ?? ""} ${a.patientLastName ?? a.patientName} ${a.doctorName}`.toLowerCase();
        return name.includes(q);
      });
    }
    if (status && status !== "all") {
      rows = rows.filter((a) => a.status === status);
    }
    if (departmentId && departmentId !== "all") {
      rows = rows.filter((a) => {
        const dept = a.departmentName ?? a.service;
        return dept === departmentId;
      });
    }

    res.json(rows.map(mapAppointment));
  } catch (err) {
    next(err);
  }
});

/** POST /appointments — create a new appointment */
router.post("/", async (req, res, next) => {
  try {
    const body = req.body as {
      patientName?: string;
      patientFirstName?: string;
      patientLastName?: string;
      doctorName?: string;
      departmentName?: string;
      scheduledAt?: string;
      duration?: number;
      notes?: string;
      status?: string;
    };

    if (!body.doctorName || !body.scheduledAt) {
      res.status(400).json({ error: "doctorName and scheduledAt are required" });
      return;
    }

    const patientName = body.patientName ??
      `${body.patientFirstName ?? ""} ${body.patientLastName ?? ""}`.trim();

    const [created] = await db.insert(appointmentsTable).values({
      patientName,
      patientFirstName: body.patientFirstName ?? null,
      patientLastName: body.patientLastName ?? null,
      doctorName: body.doctorName,
      service: body.departmentName ?? "Médecine générale",
      departmentName: body.departmentName ?? null,
      scheduledAt: new Date(body.scheduledAt),
      duration: body.duration ?? 30,
      notes: body.notes ?? null,
      status: (body.status as string) ?? "pending",
    }).returning();

    res.status(201).json(mapAppointment(created));
  } catch (err) {
    next(err);
  }
});

/** PATCH /appointments/:id — update appointment status */
router.patch("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid appointment id" });
      return;
    }
    const { status } = req.body as { status?: string };
    if (!status) {
      res.status(400).json({ error: "status is required" });
      return;
    }

    const { eq } = await import("drizzle-orm");
    const [updated] = await db
      .update(appointmentsTable)
      .set({ status })
      .where(eq(appointmentsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    res.json(mapAppointment(updated));
  } catch (err) {
    next(err);
  }
});

function mapAppointment(a: typeof appointmentsTable.$inferSelect) {
  const firstName = a.patientFirstName ?? a.patientName.split(" ")[0];
  const lastName = a.patientLastName ?? (a.patientName.split(" ").slice(1).join(" ") || a.patientName);
  const deptName = a.departmentName ?? a.service;
  return {
    id: `db-${a.id}`,
    patientId: a.patientId ? `db-${a.patientId}` : `db-apt-${a.id}`,
    patient: {
      id: a.patientId ? `db-${a.patientId}` : `db-apt-${a.id}`,
      firstName,
      lastName,
    },
    doctorId: "system",
    doctorName: a.doctorName,
    departmentId: deptName,
    departmentName: deptName,
    scheduledAt: a.scheduledAt.toISOString(),
    duration: a.duration,
    status: a.status,
    notes: a.notes ?? undefined,
  };
}

export default router;
