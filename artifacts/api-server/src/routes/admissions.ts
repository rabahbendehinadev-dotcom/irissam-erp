/**
 * /admissions routes
 * CRUD for admissions — backed by AdmissionService from the DAL layer.
 *
 * Schema alignment (admissionsTable):
 *  - status: "active" | "discharged" | "transferred" | "cancelled"
 *  - admissionDate: DATE string YYYY-MM-DD
 *  - admissionTime: TEXT "HH:MM"
 *  - serviceName, doctorName: denormalised TEXT (not FK columns)
 *  - patientName: denormalised TEXT
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { admissionsTable } from "@workspace/db/schema";
import {
  eq,
  isNull,
  and,
  desc,
  ilike,
  or,
} from "drizzle-orm";
import { admissionService } from "../services";
import type { ActorCtx } from "../repositories/types";

interface AuthenticatedRequest extends Request {
  auth?: { userId: string; role: string };
}

function actor(req: AuthenticatedRequest): ActorCtx {
  return {
    userId:   req.auth?.userId ?? "system",
    userName: req.auth?.userId ?? "system",
    userRole: req.auth?.role   ?? "guest",
  };
}

const router = Router();

/** Map DB row → JSON response shape expected by the frontend */
function mapAdmission(a: typeof admissionsTable.$inferSelect) {
  return {
    id:                 a.id,
    admissionNumber:    a.admissionNumber,
    encounterId:        a.encounterId,
    patientId:          a.patientId,
    patientName:        a.patientName,
    patientMpiId:       a.patientMpiId,
    patientDob:         a.patientDob,
    patientPhone:       a.patientPhone,
    type:               a.type,
    status:             a.status,
    priority:           a.priority,
    serviceId:          a.serviceId,
    serviceName:        a.serviceName,
    doctorId:           a.doctorId,
    doctorName:         a.doctorName,
    motif:              a.motif,
    diagnosis:          a.diagnosis,
    bedId:              a.bedId,
    bedNumber:          a.bedNumber,
    roomNumber:         a.roomNumber,
    floorLabel:         a.floorLabel,
    buildingName:       a.buildingName,
    admissionDate:      a.admissionDate,
    admissionTime:      a.admissionTime,
    expectedDischargeDate: a.expectedDischargeDate,
    actualDischargeDate:   a.actualDischargeDate,
    actualDischargeTime:   a.actualDischargeTime,
    dischargeType:      a.dischargeType,
    dischargeNotes:     a.dischargeNotes,
    notes:              a.notes,
    siteId:             a.siteId,
    createdAt:          a.createdAt,
    updatedAt:          a.updatedAt,
  };
}

/** GET /admissions */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, search, date } = req.query as {
      status?: string;
      search?: string;
      date?: string;
    };

    let query = db
      .select()
      .from(admissionsTable)
      .where(isNull(admissionsTable.deletedAt))
      .orderBy(desc(admissionsTable.createdAt))
      .$dynamic();

    if (status && status !== "all") {
      query = query.where(
        and(
          isNull(admissionsTable.deletedAt),
          eq(admissionsTable.status, status as "active" | "discharged" | "transferred" | "cancelled"),
        ),
      );
    }

    if (date) {
      query = query.where(
        and(
          isNull(admissionsTable.deletedAt),
          eq(admissionsTable.admissionDate, date),
        ),
      );
    }

    if (search) {
      query = query.where(
        and(
          isNull(admissionsTable.deletedAt),
          or(
            ilike(admissionsTable.patientName, `%${search}%`),
            ilike(admissionsTable.admissionNumber, `%${search}%`),
            ilike(admissionsTable.doctorName, `%${search}%`),
            ilike(admissionsTable.serviceName, `%${search}%`),
          ),
        ),
      );
    }

    const rows = await query;
    res.json(rows.map(mapAdmission));
  } catch (err) {
    next(err);
  }
});

/** GET /admissions/:id */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const [row] = await db
      .select()
      .from(admissionsTable)
      .where(and(eq(admissionsTable.id, id), isNull(admissionsTable.deletedAt)))
      .limit(1);

    if (!row) { res.status(404).json({ message: "Admission not found" }); return; }
    res.json(mapAdmission(row));
  } catch (err) {
    next(err);
  }
});

/** POST /admissions */
router.post("/", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as {
      encounterId?: string;
      patientId: string;
      patientName: string;
      patientMpiId?: string;
      type: "hospitalisation" | "preadmission" | "transfert_interne" | "transfert_externe";
      priority?: "normal" | "urgent" | "critique";
      serviceId?: string;
      serviceName: string;
      doctorId?: string;
      doctorName: string;
      motif: string;
      bedId?: string;
      bedNumber?: string;
      admissionDate: string;
      admissionTime: string;
      expectedDischargeDate?: string;
      notes?: string;
    };

    const bedId = body.bedId ?? "";   // admit() requires bedId
    const { admission } = await admissionService.admit(
      {
        patientId:            body.patientId,
        patientName:          body.patientName,
        patientMpiId:         body.patientMpiId,
        type:                 body.type,
        serviceName:          body.serviceName,
        doctorId:             body.doctorId,
        doctorName:           body.doctorName,
        motif:                body.motif,
        bedId,
        bedNumber:            body.bedNumber,
        expectedDischargeDate: body.expectedDischargeDate,
        notes:                body.notes,
        siteId:               undefined,
      },
      actor(req),
    );

    res.status(201).json(mapAdmission(admission));
  } catch (err) {
    next(err);
  }
});

/** PATCH /admissions/:id */
router.patch("/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const body = req.body as {
      status?: string;
      diagnosis?: string;
      notes?: string;
      bedId?: string;
      bedNumber?: string;
      expectedDischargeDate?: string;
    };

    const [updated] = await db
      .update(admissionsTable)
      .set({
        ...(body.status     && { status:      body.status as "active" | "discharged" | "transferred" | "cancelled" }),
        ...(body.diagnosis  && { diagnosis:   body.diagnosis }),
        ...(body.notes      && { notes:       body.notes }),
        ...(body.bedId      && { bedId:       body.bedId }),
        ...(body.bedNumber  && { bedNumber:   body.bedNumber }),
        ...(body.expectedDischargeDate && { expectedDischargeDate: body.expectedDischargeDate }),
        updatedAt: new Date(),
        updatedBy: req.auth?.userId ?? undefined,
      })
      .where(and(eq(admissionsTable.id, id), isNull(admissionsTable.deletedAt)))
      .returning();

    if (!updated) { res.status(404).json({ message: "Admission not found" }); return; }
    res.json(mapAdmission(updated));
  } catch (err) {
    next(err);
  }
});

/** POST /admissions/:id/discharge */
router.post("/:id/discharge", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const body = req.body as {
      dischargeType?: "guerison" | "amelioration" | "stationnaire" | "transfert" | "deces" | "contre_avis_medical";
      dischargeNotes?: string;
    };

    const admission = await admissionService.discharge(
      id,
      { dischargeType: body.dischargeType ?? "guerison", dischargeNotes: body.dischargeNotes },
      actor(req),
    );

    res.json(mapAdmission(admission));
  } catch (err) {
    next(err);
  }
});

export default router;
