import { Router } from "express";
import { db } from "@workspace/db";
import { consultationsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";

const router = Router();

/** GET /consultations — full consultation list */
router.get("/", async (req, res, next) => {
  try {
    const { search, status, type, origin, doctor, specialty, dateFrom, dateTo } =
      req.query as Record<string, string | undefined>;

    let rows = await db
      .select()
      .from(consultationsTable)
      .orderBy(desc(consultationsTable.createdAt));

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((c) =>
        [c.patientName, c.patientMpi, c.number, c.doctorName, c.reason, c.serviceName, c.specialty].some(
          (f) => f?.toLowerCase().includes(q),
        ),
      );
    }
    if (status && status !== "all") rows = rows.filter((c) => c.status === status);
    if (type && type !== "all") rows = rows.filter((c) => c.type === type);
    if (origin && origin !== "all") rows = rows.filter((c) => c.origin === origin);
    if (doctor && doctor !== "all") rows = rows.filter((c) => c.doctorName === doctor);
    if (specialty && specialty !== "all") rows = rows.filter((c) => c.specialty === specialty);
    if (dateFrom) rows = rows.filter((c) => c.date >= dateFrom);
    if (dateTo) rows = rows.filter((c) => c.date <= dateTo);

    res.json(rows.map(mapConsultation));
  } catch (err) {
    next(err);
  }
});

/** POST /consultations — create a new consultation */
router.post("/", async (req, res, next) => {
  try {
    const body = req.body as {
      patientName?: string;
      patientMpi?: string;
      patientId?: number;
      doctorName?: string;
      specialty?: string;
      serviceName?: string;
      date?: string;
      type?: string;
      origin?: string;
      reason?: string;
      status?: string;
      duration?: number;
    };

    if (!body.patientName || !body.doctorName || !body.reason) {
      res.status(400).json({ error: "patientName, doctorName and reason are required" });
      return;
    }

    const date = body.date ?? new Date().toISOString().slice(0, 10);
    const count = await db.$count(consultationsTable);
    const number = `CON-${date.slice(0, 4)}-${String(count + 1).padStart(4, "0")}`;

    const [created] = await db
      .insert(consultationsTable)
      .values({
        number,
        patientId: body.patientId ?? null,
        patientName: body.patientName,
        patientMpi: body.patientMpi ?? `MPI-NEW-${Date.now()}`,
        doctorName: body.doctorName,
        specialty: body.specialty ?? "Médecine générale",
        serviceName: body.serviceName ?? "Médecine générale",
        date,
        type: (body.type as any) ?? "consultation_externe",
        origin: (body.origin as any) ?? "rdv",
        reason: body.reason,
        status: (body.status as any) ?? "en_attente",
        duration: body.duration ?? null,
      })
      .returning();

    res.status(201).json(mapConsultation(created));
  } catch (err) {
    next(err);
  }
});

/** PATCH /consultations/:id — update consultation status */
router.patch("/:id", async (req, res, next) => {
  try {
    const rawId = req.params.id.replace(/^db-/, "");
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid consultation id" });
      return;
    }

    const { status } = req.body as { status?: string };
    if (!status) {
      res.status(400).json({ error: "status is required" });
      return;
    }

    const [updated] = await db
      .update(consultationsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(consultationsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    res.json(mapConsultation(updated));
  } catch (err) {
    next(err);
  }
});

/** Normalize legacy DB type values to the frontend ConsultationType enum. */
const TYPE_NORMALIZE: Record<string, string> = {
  consultation_externe: "ambulatoire",
  urgence: "urgences",
  hospitalier: "hospitalisation",
  // Values already matching the frontend enum pass through unchanged
};

function normalizeType(raw: string): string {
  return TYPE_NORMALIZE[raw] ?? raw;
}

function mapConsultation(c: typeof consultationsTable.$inferSelect) {
  return {
    id: `db-${c.id}`,
    number: c.number,
    patientId: c.patientId ? `db-${c.patientId}` : `db-c-${c.id}`,
    patientName: c.patientName,
    patientMpi: c.patientMpi,
    doctorId: "system",
    doctorName: c.doctorName,
    specialty: c.specialty,
    serviceId: "system",
    serviceName: c.serviceName,
    siteId: "site-1",
    siteName: "Site Principal",
    date: c.date,
    scheduledAt: c.scheduledAt?.toISOString() ?? `${c.date}T08:00:00.000Z`,
    startedAt: c.startedAt?.toISOString(),
    endedAt: c.endedAt?.toISOString(),
    duration: c.duration ?? undefined,
    type: normalizeType(c.type),
    origin: c.origin,
    reason: c.reason,
    status: c.status,
    syncStatus: c.syncStatus,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    createdById: "system",
    medical: { allergies: [], chronicDiseases: [], majorHistory: [] },
  };
}

export default router;
