/**
 * /patients routes — backed by PatientService + PatientRepository.
 *
 * JSON shape is preserved for frontend compatibility.
 *
 * Schema alignment (patientsTable):
 *  - No `name` / `age` / `service` / `registeredAt` / `medicalJson` /
 *    `emergencyContactJson` / `insuranceJson` columns (legacy).
 *  - firstName + lastName replace name; createdAt replaces registeredAt.
 *  - medical data is stored as arrays (allergies, chronicDiseases, majorHistory).
 *  - emergency contact is stored as separate columns.
 *  - insurance is stored as separate columns.
 *  - id: UUID (not integer).
 */
import { Router } from "express";
import { desc, isNull } from "drizzle-orm";
import { db, patientsTable } from "@workspace/db";
import { patientService } from "../services/patient";
import { repos } from "../repositories";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import type { ActorCtx } from "../repositories/types";
import type { DbPatient } from "../repositories/patient";

const router = Router();

function actor(req: AuthenticatedRequest): ActorCtx {
  return {
    userId:   req.auth?.userId ?? "system",
    userName: req.auth?.userId ?? "system",
    userRole: req.auth?.role   ?? "guest",
  };
}

function calcAge(dob: string): number {
  const year = parseInt(dob.slice(0, 4), 10);
  return isNaN(year) ? 0 : new Date().getFullYear() - year;
}

function mapPatient(p: DbPatient) {
  const emergencyContact = (
    p.emergencyContactName || p.emergencyContactPhone
  ) ? {
    name:     p.emergencyContactName    ?? undefined,
    relation: p.emergencyContactRelation ?? undefined,
    phone:    p.emergencyContactPhone   ?? undefined,
    address:  p.emergencyContactAddress ?? undefined,
  } : undefined;

  const insurance = p.insuranceType ? {
    type:         p.insuranceType         ?? undefined,
    orgName:      p.insuranceOrgName      ?? undefined,
    memberNumber: p.insuranceMemberNumber ?? undefined,
    validUntil:   p.insuranceValidUntil   ?? undefined,
  } : undefined;

  return {
    id:             p.id,
    mpiId:          p.mpiId,
    mrn:            p.mrn,
    fileNumber:     p.fileNumber,
    internalNumber: p.internalNumber ?? undefined,
    firstName:      p.firstName,
    lastName:       p.lastName,
    maidenName:     p.maidenName ?? undefined,
    gender:         p.gender,
    dateOfBirth:    p.dateOfBirth,
    age:            calcAge(p.dateOfBirth),
    placeOfBirth:   p.placeOfBirth   ?? undefined,
    nationality:    p.nationality,
    maritalStatus:  p.maritalStatus  ?? undefined,
    idDocumentType: p.idDocumentType ?? undefined,
    idDocumentNumber: p.idDocumentNumber ?? undefined,
    socialSecurityNumber: p.socialSecurityNumber ?? undefined,
    phone:          p.phone,
    phoneSecondary: p.phoneSecondary ?? undefined,
    email:          p.email    ?? undefined,
    address:        p.address  ?? undefined,
    commune:        p.commune  ?? undefined,
    wilaya:         p.wilaya   ?? undefined,
    postalCode:     p.postalCode ?? undefined,
    country:        p.country,
    bloodType:      p.bloodType ?? null,
    rhesus:         p.rhesus   ?? undefined,
    medical: {
      allergies:       p.allergies       ?? [],
      chronicDiseases: p.chronicDiseases ?? [],
      majorHistory:    p.majorHistory    ?? [],
    },
    emergencyContact,
    insurance,
    departmentId:       p.departmentId ?? undefined,
    status:             p.status,
    syncStatus:         p.syncStatus,
    isIncomplete:       p.isIncomplete,
    potentialDuplicate: p.potentialDuplicate,
    createdAt:   p.createdAt.toISOString(),
    updatedAt:   p.updatedAt.toISOString(),
    createdById: "system",
    siteId:      "site-1",
  };
}

/** GET /patients/recent — dashboard widget (5 newest) */
router.get("/recent", async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(patientsTable)
      .where(isNull(patientsTable.deletedAt))
      .orderBy(desc(patientsTable.createdAt))
      .limit(5);

    res.json(rows.map((p) => ({
      id:          p.id,
      firstName:   p.firstName,
      lastName:    p.lastName,
      name:        `${p.firstName} ${p.lastName}`,
      age:         calcAge(p.dateOfBirth),
      fileNumber:  p.fileNumber,
      mrn:         p.mrn,
      createdAt:   p.createdAt.toISOString(),
    })));
  } catch (err) {
    next(err);
  }
});

/** GET /patients — full patient list */
router.get("/", async (req, res, next) => {
  try {
    const { search, status, gender, bloodType } =
      req.query as Record<string, string | undefined>;

    const result = await repos.patient.search({ query: search, status, limit: 500 });
    let rows = result.data;

    // gender and bloodType filters are not in PatientRepository.search() — apply in-memory
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

/** GET /patients/:id — fetch one patient by UUID */
router.get("/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const row = await repos.patient.findById(id);
    if (!row) { res.status(404).json({ message: "Patient not found" }); return; }
    res.json(mapPatient(row));
  } catch (err) {
    next(err);
  }
});

/** POST /patients — create a new patient */
router.post("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = req.body as PatientPayload;

    if (!body.firstName && !body.lastName) {
      res.status(400).json({ message: "firstName or lastName is required" });
      return;
    }
    if (!body.gender) {
      res.status(400).json({ message: "gender is required" });
      return;
    }
    if (!body.dateOfBirth) {
      res.status(400).json({ message: "dateOfBirth is required" });
      return;
    }
    if (!body.phone) {
      res.status(400).json({ message: "phone is required" });
      return;
    }

    const firstName = body.firstName || "";
    const lastName  = body.lastName  || "Inconnu";
    const timestamp = Date.now().toString().slice(-6);

    const patient = await patientService.create({
      mpiId:          body.mpiId        || `MPI-${timestamp}`,
      fileNumber:     body.fileNumber   || `${new Date().getFullYear()}-${timestamp}`,
      internalNumber: body.internalNumber || null,
      firstName,
      lastName,
      maidenName:     body.maidenName   || null,
      gender:         body.gender as any,
      dateOfBirth:    body.dateOfBirth,
      placeOfBirth:   body.placeOfBirth || null,
      nationality:    body.nationality  || "DZ",
      maritalStatus:  (body.maritalStatus as any) || null,
      idDocumentType:       (body.idDocumentType as any) || null,
      idDocumentNumber:     body.idDocumentNumber || null,
      socialSecurityNumber: body.socialSecurityNumber || null,
      phone:          body.phone,
      phoneSecondary: body.phoneSecondary || null,
      email:          body.email   || null,
      address:        body.address || null,
      commune:        body.commune || null,
      wilaya:         body.wilaya  || null,
      postalCode:     body.postalCode || null,
      country:        body.country || "DZ",
      bloodType:      (body.bloodType as any) || null,
      rhesus:         (body.rhesus as any)    || null,
      allergies:      body.medical?.allergies       ?? [],
      chronicDiseases: body.medical?.chronicDiseases ?? [],
      majorHistory:   body.medical?.majorHistory    ?? [],
      emergencyContactName:     body.emergencyContact?.name     || null,
      emergencyContactRelation: body.emergencyContact?.relation || null,
      emergencyContactPhone:    body.emergencyContact?.phone    || null,
      emergencyContactAddress:  body.emergencyContact?.address  || null,
      insuranceType:         (body.insurance?.type as any) || null,
      insuranceOrgName:      body.insurance?.orgName      || null,
      insuranceMemberNumber: body.insurance?.memberNumber || null,
      insuranceValidUntil:   body.insurance?.validUntil   || null,
      departmentId:  body.departmentId || null,
      status:        (body.status as any) || "active",
      syncStatus:    "synced",
      isIncomplete:  false,
      potentialDuplicate: false,
    }, actor(req));

    res.status(201).json(mapPatient(patient));
  } catch (err) {
    next(err);
  }
});

/** PUT /patients/:id — update patient */
router.put("/:id", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const body = req.body as PatientPayload;

    const updated = await patientService.update(id, {
      firstName:      body.firstName,
      lastName:       body.lastName,
      maidenName:     body.maidenName   || null,
      gender:         body.gender as any,
      dateOfBirth:    body.dateOfBirth,
      placeOfBirth:   body.placeOfBirth || null,
      nationality:    body.nationality  || "DZ",
      maritalStatus:  (body.maritalStatus as any) || null,
      idDocumentType:       (body.idDocumentType as any) || null,
      idDocumentNumber:     body.idDocumentNumber || null,
      socialSecurityNumber: body.socialSecurityNumber || null,
      phone:          body.phone,
      phoneSecondary: body.phoneSecondary || null,
      email:          body.email   || null,
      address:        body.address || null,
      commune:        body.commune || null,
      wilaya:         body.wilaya  || null,
      postalCode:     body.postalCode || null,
      country:        body.country || "DZ",
      bloodType:      (body.bloodType as any) || null,
      rhesus:         (body.rhesus as any)    || null,
      allergies:      body.medical?.allergies       ?? undefined,
      chronicDiseases: body.medical?.chronicDiseases ?? undefined,
      majorHistory:   body.medical?.majorHistory    ?? undefined,
      emergencyContactName:     body.emergencyContact?.name     || null,
      emergencyContactRelation: body.emergencyContact?.relation || null,
      emergencyContactPhone:    body.emergencyContact?.phone    || null,
      emergencyContactAddress:  body.emergencyContact?.address  || null,
      insuranceType:         (body.insurance?.type as any) || null,
      insuranceOrgName:      body.insurance?.orgName      || null,
      insuranceMemberNumber: body.insurance?.memberNumber || null,
      insuranceValidUntil:   body.insurance?.validUntil   || null,
      departmentId:  body.departmentId || null,
    }, actor(req));

    if (!updated) {
      res.status(404).json({ message: "Patient not found" });
      return;
    }

    res.json(mapPatient(updated));
  } catch (err) {
    next(err);
  }
});

// ─── Types ────────────────────────────────────────────────────────────────────

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
  medical?: { allergies?: string[]; chronicDiseases?: string[]; majorHistory?: string[] };
  emergencyContact?: { name?: string; relation?: string; phone?: string; address?: string };
  insurance?: { type?: string; orgName?: string; memberNumber?: string; validUntil?: string };
  departmentId?: string;
  status?: string;
}

export default router;
