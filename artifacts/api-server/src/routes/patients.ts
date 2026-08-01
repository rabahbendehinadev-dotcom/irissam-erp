import { Router } from "express";
import { db } from "@workspace/db";
import { patientsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";

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

/** POST /patients — create a new patient */
router.post("/", async (req, res, next) => {
  try {
    const body = req.body as PatientPayload;

    const dobYear = body.dateOfBirth ? parseInt(body.dateOfBirth.slice(0, 4), 10) : null;
    const age = dobYear ? new Date().getFullYear() - dobYear : 0;
    const fullName = [body.firstName, body.lastName].filter(Boolean).join(" ") || body.lastName || "Inconnu";

    const [inserted] = await db
      .insert(patientsTable)
      .values({
        name: fullName,
        age,
        fileNumber: body.fileNumber || generateFileNumber(),
        service: body.departmentId || "",
        firstName: body.firstName,
        lastName: body.lastName,
        maidenName: body.maidenName || null,
        mpiId: body.mpiId || null,
        internalNumber: body.internalNumber || null,
        gender: body.gender,
        dateOfBirth: body.dateOfBirth,
        placeOfBirth: body.placeOfBirth || null,
        nationality: body.nationality || "Algérienne",
        maritalStatus: body.maritalStatus || null,
        idDocumentType: body.idDocumentType || null,
        idDocumentNumber: body.idDocumentNumber || null,
        socialSecurityNumber: body.socialSecurityNumber || null,
        phone: body.phone,
        phoneSecondary: body.phoneSecondary || null,
        email: body.email || null,
        address: body.address || null,
        commune: body.commune || null,
        wilaya: body.wilaya || null,
        postalCode: body.postalCode || null,
        country: body.country || "Algérie",
        bloodType: body.bloodType || null,
        rhesus: body.rhesus || null,
        medicalJson: body.medical ? JSON.stringify(body.medical) : null,
        emergencyContactJson: body.emergencyContact ? JSON.stringify(body.emergencyContact) : null,
        insuranceJson: body.insurance ? JSON.stringify(body.insurance) : null,
        departmentId: body.departmentId || null,
        status: (body.status as string) || "active",
        syncStatus: "synced",
        isIncomplete: false,
        potentialDuplicate: false,
      })
      .returning();

    res.status(201).json(mapPatient(inserted));
  } catch (err) {
    next(err);
  }
});

/** PUT /patients/:id — update an existing patient */
router.put("/:id", async (req, res, next) => {
  try {
    const rawId = req.params.id;
    // IDs from the ERP may be prefixed with "db-"
    const numId = parseInt(rawId.replace(/^db-/, ""), 10);
    if (isNaN(numId)) {
      res.status(400).json({ message: "Invalid patient ID" });
      return;
    }

    const body = req.body as PatientPayload;

    const dobYear = body.dateOfBirth ? parseInt(body.dateOfBirth.slice(0, 4), 10) : null;
    const age = dobYear ? new Date().getFullYear() - dobYear : 0;
    const fullName = [body.firstName, body.lastName].filter(Boolean).join(" ") || body.lastName || "Inconnu";

    const [updated] = await db
      .update(patientsTable)
      .set({
        name: fullName,
        age,
        firstName: body.firstName,
        lastName: body.lastName,
        maidenName: body.maidenName || null,
        gender: body.gender,
        dateOfBirth: body.dateOfBirth,
        placeOfBirth: body.placeOfBirth || null,
        nationality: body.nationality || "Algérienne",
        maritalStatus: body.maritalStatus || null,
        idDocumentType: body.idDocumentType || null,
        idDocumentNumber: body.idDocumentNumber || null,
        socialSecurityNumber: body.socialSecurityNumber || null,
        phone: body.phone,
        phoneSecondary: body.phoneSecondary || null,
        email: body.email || null,
        address: body.address || null,
        commune: body.commune || null,
        wilaya: body.wilaya || null,
        postalCode: body.postalCode || null,
        country: body.country || "Algérie",
        bloodType: body.bloodType || null,
        rhesus: body.rhesus || null,
        medicalJson: body.medical ? JSON.stringify(body.medical) : null,
        emergencyContactJson: body.emergencyContact ? JSON.stringify(body.emergencyContact) : null,
        insuranceJson: body.insurance ? JSON.stringify(body.insurance) : null,
        departmentId: body.departmentId || null,
        updatedAt: new Date(),
      })
      .where(eq(patientsTable.id, numId))
      .returning();

    if (!updated) {
      res.status(404).json({ message: "Patient not found" });
      return;
    }

    res.json(mapPatient(updated));
  } catch (err) {
    next(err);
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface PatientPayload {
  firstName?: string;
  lastName?: string;
  maidenName?: string;
  gender?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  nationality?: string;
  maritalStatus?: string;
  idDocumentType?: string;
  idDocumentNumber?: string;
  socialSecurityNumber?: string;
  fileNumber?: string;
  mpiId?: string;
  internalNumber?: string;
  phone?: string;
  phoneSecondary?: string;
  email?: string;
  address?: string;
  commune?: string;
  wilaya?: string;
  postalCode?: string;
  country?: string;
  bloodType?: string;
  rhesus?: string;
  medical?: Record<string, unknown>;
  emergencyContact?: Record<string, unknown>;
  insurance?: Record<string, unknown>;
  departmentId?: string;
  status?: string;
}

function generateFileNumber() {
  return `${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
}

function mapPatient(p: typeof patientsTable.$inferSelect) {
  const firstName = p.firstName ?? (p.name.split(" ")[0] ?? "");
  const lastName = p.lastName ?? (p.name.split(" ").slice(1).join(" ") ?? "");

  let medical = { allergies: [], chronicDiseases: [], majorHistory: [] };
  if (p.medicalJson) {
    try { medical = JSON.parse(p.medicalJson); } catch { /* ignore */ }
  }

  let emergencyContact: unknown = undefined;
  if (p.emergencyContactJson) {
    try { emergencyContact = JSON.parse(p.emergencyContactJson); } catch { /* ignore */ }
  }

  let insurance: unknown = undefined;
  if (p.insuranceJson) {
    try { insurance = JSON.parse(p.insuranceJson); } catch { /* ignore */ }
  }

  return {
    id: `db-${p.id}`,
    mpiId: p.mpiId ?? `MPI-${String(p.id).padStart(6, "0")}`,
    fileNumber: p.fileNumber,
    internalNumber: p.internalNumber ?? `INT-${String(p.id).padStart(3, "0")}`,
    firstName,
    lastName,
    maidenName: p.maidenName ?? undefined,
    gender: p.gender ?? "M",
    dateOfBirth: p.dateOfBirth ?? "1980-01-01",
    placeOfBirth: p.placeOfBirth ?? undefined,
    nationality: p.nationality ?? "Algérienne",
    maritalStatus: p.maritalStatus ?? undefined,
    idDocumentType: p.idDocumentType ?? undefined,
    idDocumentNumber: p.idDocumentNumber ?? undefined,
    socialSecurityNumber: p.socialSecurityNumber ?? undefined,
    phone: p.phone ?? "",
    phoneSecondary: p.phoneSecondary ?? undefined,
    email: p.email ?? undefined,
    address: p.address ?? undefined,
    commune: p.commune ?? undefined,
    wilaya: p.wilaya ?? undefined,
    postalCode: p.postalCode ?? undefined,
    country: p.country ?? "Algérie",
    bloodType: p.bloodType ?? null,
    rhesus: p.rhesus ?? undefined,
    medical,
    emergencyContact,
    insurance,
    departmentId: p.departmentId ?? undefined,
    status: p.status,
    syncStatus: p.syncStatus,
    isIncomplete: p.isIncomplete,
    potentialDuplicate: p.potentialDuplicate,
    createdAt: p.registeredAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    nationality_backup: undefined,
    country_backup: undefined,
    createdById: "system",
    siteId: "site-1",
    service: p.service,
  };
}

export default router;
