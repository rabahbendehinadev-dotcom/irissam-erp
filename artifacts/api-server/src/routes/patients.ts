import { Router } from "express";
import { db } from "@workspace/db";
import { patientsTable } from "@workspace/db/schema";
import { desc } from "drizzle-orm";

const router = Router();

/** GET /patients/recent */
router.get("/recent", async (_req, res, next) => {
  try {
    const patients = await db
      .select()
      .from(patientsTable)
      .orderBy(desc(patientsTable.registeredAt))
      .limit(5);

    res.json(
      patients.map((p) => ({
        id: p.id,
        name: p.name,
        age: p.age,
        fileNumber: p.fileNumber,
        service: p.service,
        registeredAt: p.registeredAt.toISOString(),
      })),
    );
  } catch (err) {
    next(err);
  }
});

export default router;
