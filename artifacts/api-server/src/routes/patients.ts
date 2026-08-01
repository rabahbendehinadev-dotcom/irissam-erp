import { Router } from "express";
import { db } from "@workspace/db";
import { patientsTable } from "@workspace/db/schema";
import { desc, ilike, or, eq } from "drizzle-orm";

const router = Router();

/** GET /patients/recent — dashboard widget (5 newest) */
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

/** GET /patients — full patient list for the Patients page */
router.get("/", async (req, res, next) => {
  try {
    const { search, status, gender, bloodType } = req.query as Record<string, string | undefined>;

    let rows = await db.select().from(patientsTable).orderBy(patientsTable.lastName, patientsTable.firstName);

    // Apply filters in memory (dataset is modest)
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((p) => {
        const fields = [p.firstName, p.lastName, p.mpiId, p.fileNumber, p.phone, p.internalNumber, p.name];
        return fields.some((f) => f?.toLowerCase().includes(q));
      });
    }
    if (status && status !== "all") {
      rows = rows.filter((p) => p.status === status);
    }
    if (gender && gender !== "all") {
      rows = rows.filter((p) => p.gender === gender);
    }
    if (bloodType && bloodType !== "all") {
      rows = rows.filter((p) => p.bloodType === bloodType);
    }

    res.json(rows.map(mapPatient));
  } catch (err) {
    next(err);
  }
});

function mapPatient(p: typeof patientsTable.$inferSelect) {
  const [firstName, ...rest] = (p.firstName ?? p.name).split(" ");
  const lastName = p.lastName ?? rest.join(" ") ?? "";
  return {
    id: `db-${p.id}`,
    mpiId: p.mpiId ?? `MPI-${String(p.id).padStart(6, "0")}`,
    fileNumber: p.fileNumber,
    internalNumber: p.internalNumber ?? `INT-${String(p.id).padStart(3, "0")}`,
    firstName,
    lastName,
    gender: p.gender ?? "M",
    dateOfBirth: p.dateOfBirth ?? "1980-01-01",
    phone: p.phone ?? "",
    bloodType: p.bloodType ?? null,
    status: p.status,
    syncStatus: p.syncStatus,
    isIncomplete: p.isIncomplete,
    potentialDuplicate: p.potentialDuplicate,
    createdAt: p.registeredAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    // Provide required ERP Patient fields with sensible defaults
    nationality: "Algérienne",
    country: "Algérie",
    medical: { allergies: [], chronicDiseases: [], majorHistory: [] },
    createdById: "system",
    siteId: "site-1",
    service: p.service,
  };
}

export default router;
