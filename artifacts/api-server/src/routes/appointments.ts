import { Router } from "express";
import { db } from "@workspace/db";
import { appointmentsTable } from "@workspace/db/schema";
import { asc, gte, lt, and, ne } from "drizzle-orm";

const router = Router();

/** GET /appointments/upcoming */
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

export default router;
