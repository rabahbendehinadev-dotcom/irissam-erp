/**
 * /emergencies routes — backed by emergency_visits, emergency_rooms, ambulances tables.
 *
 * GET  /emergencies/patients                     — active emergency visits with patient demographics + latest vitals
 * GET  /emergencies/visits/by-patient/:patientId — active visit for a patient (for dossier page)
 * PATCH /emergencies/visits/:visitId             — update priority, status, triageNotes
 * POST  /emergencies/vitals                      — record a new vitals reading for a visit
 * GET  /emergencies/rooms                        — emergency room list with occupancy
 * GET  /emergencies/ambulances                   — ambulance fleet with current status
 */
import { Router } from "express";
import { isNull, and, desc, inArray, sql, eq, isNotNull } from "drizzle-orm";
import {
  db,
  emergencyVisitsTable,
  emergencyRoomsTable,
  emergencyVitalsTable,
  ambulancesTable,
  patientsTable,
} from "@workspace/db";
import { requirePermission } from "../middleware/requirePermission";

const router = Router();

// ─── Allowed enum values (mirrors the DB enums) ───────────────────────────────

const ALLOWED_PRIORITIES = new Set(["P1","P2","P3","P4","P5","non_classe"]);
const ALLOWED_STATUSES   = new Set([
  "attente_triage","en_triage","attente_soins","en_soins",
  "observation","hospitalise","sorti","transfere","decede",
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcAge(dob: string | Date): number {
  const d = dob instanceof Date ? dob : new Date(dob);
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

// ─── GET /emergencies/patients ───────────────────────────────────────────────

router.get("/patients", async (_req, res, next) => {
  try {
    // Active emergency visits only — exclude terminal statuses and closed visits
    const visits = await db
      .select()
      .from(emergencyVisitsTable)
      .where(
        and(
          isNull(emergencyVisitsTable.deletedAt),
          isNull(emergencyVisitsTable.closedAt),
          sql`${emergencyVisitsTable.status} NOT IN ('sorti', 'transfere', 'decede')`,
        )
      )
      .orderBy(desc(emergencyVisitsTable.arrivalTime))
      .limit(200);

    if (visits.length === 0) {
      res.json({ visits: [], todayStats: { sorties: 0, hospitalisations: 0, transferts: 0 } });
      return;
    }

    // Fetch all related patients in one query
    const patientIds = [...new Set(visits.map((v) => v.patientId))];
    const patients = await db
      .select()
      .from(patientsTable)
      .where(and(inArray(patientsTable.id, patientIds), isNull(patientsTable.deletedAt)));

    const patientMap = new Map(patients.map((p) => [p.id, p]));

    // Latest vitals per visit (one row per visitId)
    const visitIds = visits.map((v) => v.id);
    const vitalsRows = await db
      .select()
      .from(emergencyVitalsTable)
      .where(inArray(emergencyVitalsTable.visitId, visitIds))
      .orderBy(desc(emergencyVitalsTable.recordedAt));

    // Keep only the most-recent vitals per visit
    const vitalsMap = new Map<string, typeof vitalsRows[0]>();
    for (const row of vitalsRows) {
      if (!vitalsMap.has(row.visitId)) vitalsMap.set(row.visitId, row);
    }

    // Today's closed-visit counts
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const closedToday = await db
      .select({
        closeReason: emergencyVisitsTable.closeReason,
        count: sql<number>`count(*)::int`,
      })
      .from(emergencyVisitsTable)
      .where(
        and(
          isNull(emergencyVisitsTable.deletedAt),
          sql`${emergencyVisitsTable.closedAt} >= ${todayStart}`,
        )
      )
      .groupBy(emergencyVisitsTable.closeReason);

    const todayStats = {
      sorties:          closedToday.find((r) => r.closeReason === "domicile")?.count       ?? 0,
      hospitalisations: closedToday.find((r) => r.closeReason === "hospitalisation")?.count ?? 0,
      transferts:       closedToday.find((r) => r.closeReason === "transfert")?.count       ?? 0,
    };

    const result = visits.map((v) => {
      const patient = patientMap.get(v.patientId);
      const vitals = vitalsMap.get(v.id);

      return {
        id:             v.id,          // visit UUID — used for dossier navigation
        patientId:      v.patientId,   // real DB patient UUID — used for encounter creation
        mpiId:          patient?.mrn ?? v.patientId,
        lastName:       patient?.lastName  ?? "—",
        firstName:      patient?.firstName ?? "—",
        age:            patient?.dateOfBirth ? calcAge(patient.dateOfBirth) : 0,
        gender:         patient?.gender ?? "M",
        priority:       v.priority === "non_classe" ? "P5" : v.priority,
        status:         v.status,
        arrivalTime:    v.arrivalTime.toISOString(),
        chiefComplaint: v.chiefComplaint,
        mechanism:      v.mechanism ?? null,
        assignedDoctor: v.assignedDoctorName ?? null,
        assignedNurse:  v.assignedNurseName  ?? null,
        assignedRoom:   v.assignedRoomName   ?? null,
        triageNotes:    v.triageNotes ?? null,
        byAmbulance:    v.byAmbulance,
        isMinor:        v.isMinor,
        tags:           v.tags ?? [],
        bloodType:      patient?.bloodType ?? null,
        allergies:      patient?.allergies ?? [],
        vitals: vitals
          ? {
              hr:         vitals.heartRate       ?? undefined,
              bp:         vitals.bloodPressure    ?? undefined,
              spo2:       vitals.spo2             ?? undefined,
              temp:       vitals.temperature      ?? undefined,
              rr:         vitals.respiratoryRate  ?? undefined,
              gcs:        vitals.gcs              ?? undefined,
              painLevel:  vitals.painLevel        ?? undefined,
              glucose:    vitals.glucose          ?? undefined,
            }
          : null,
      };
    });

    res.json({ visits: result, todayStats });
  } catch (err) {
    next(err);
  }
});

// ─── GET /emergencies/rooms ───────────────────────────────────────────────────

router.get("/rooms", async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(emergencyRoomsTable)
      .where(isNull(emergencyRoomsTable.deletedAt))
      .orderBy(emergencyRoomsTable.name);

    const result = rows.map((r) => ({
      id:        r.id,
      name:      r.name,
      shortName: r.shortName,
      type:      r.type,
      capacity:  r.capacity,
      occupied:  r.occupied,
      status:    r.status,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── GET /emergencies/ambulances ──────────────────────────────────────────────

router.get("/ambulances", async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(ambulancesTable)
      .where(isNull(ambulancesTable.deletedAt))
      .orderBy(ambulancesTable.callSign);

    const result = rows.map((a) => ({
      id:              a.id,
      callSign:        a.callSign,
      status:          a.status,
      crew:            a.crew ?? "",
      etaMinutes:      a.etaMinutes        ?? undefined,
      patientId:       a.currentPatientId  ?? undefined,
      patientName:     a.currentPatientName ?? undefined,
      patientPriority: a.currentPatientPriority ?? undefined,
      chiefComplaint:  a.chiefComplaint    ?? undefined,
      location:        a.location          ?? undefined,
      dispatchedAt:    a.dispatchedAt?.toISOString() ?? undefined,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── GET /emergencies/visits/by-patient/:patientId ───────────────────────────
// Returns the most-recent open emergency visit for a patient (used by the dossier page).
// Requires emergencies.view — the same permission needed to open the urgences board.

router.get(
  "/visits/by-patient/:patientId",
  requirePermission("emergencies.view"),
  async (req, res, next) => {
    try {
      const { patientId } = req.params as { patientId: string };

      const rows = await db
        .select()
        .from(emergencyVisitsTable)
        .where(
          and(
            eq(emergencyVisitsTable.patientId, patientId),
            isNull(emergencyVisitsTable.deletedAt),
            isNull(emergencyVisitsTable.closedAt),
          )
        )
        .orderBy(desc(emergencyVisitsTable.arrivalTime))
        .limit(1);

      if (!rows[0]) {
        // 200 + null : « pas de visite active » est un état normal, pas une erreur.
        // Un 404 ici générait un "Failed to load resource: 404" dans la console
        // du navigateur sur chaque fiche patient sans passage aux urgences.
        res.json(null);
        return;
      }

      const v = rows[0];
      res.json({
        visitId:          v.id,
        patientId:        v.patientId,
        encounterId:      v.encounterId,
        priority:         v.priority === "non_classe" ? "P5" : v.priority,
        status:           v.status,
        chiefComplaint:   v.chiefComplaint,
        mechanism:        v.mechanism ?? null,
        triageNotes:      v.triageNotes ?? null,
        byAmbulance:      v.byAmbulance,
        isMinor:          v.isMinor,
        tags:             v.tags ?? [],
        arrivalTime:      v.arrivalTime.toISOString(),
        assignedDoctorName: v.assignedDoctorName ?? null,
        assignedNurseName:  v.assignedNurseName  ?? null,
        assignedRoomName:   v.assignedRoomName   ?? null,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /emergencies/visits/:visitId ──────────────────────────────────────
// Allows triage nurses / doctors to update priority, status, triage notes, or
// assigned room.  Requires emergencies.triage — the dedicated triage permission.
// Refuses updates to closed or deleted visits (returns 409).

router.patch(
  "/visits/:visitId",
  requirePermission("emergencies.triage"),
  async (req, res, next) => {
    try {
      const { visitId } = req.params as { visitId: string };
      const { priority, status, triageNotes, assignedRoomName } = req.body as {
        priority?: string;
        status?: string;
        triageNotes?: string;
        assignedRoomName?: string;
      };

      // Validate enum values before touching the DB
      if (priority !== undefined && !ALLOWED_PRIORITIES.has(priority)) {
        res.status(400).json({ error: `Invalid priority value: ${priority}` });
        return;
      }
      if (status !== undefined && !ALLOWED_STATUSES.has(status)) {
        res.status(400).json({ error: `Invalid status value: ${status}` });
        return;
      }

      // Fetch the visit first — reject if not found, deleted, or already closed
      const existing = await db
        .select({ id: emergencyVisitsTable.id, closedAt: emergencyVisitsTable.closedAt })
        .from(emergencyVisitsTable)
        .where(
          and(
            eq(emergencyVisitsTable.id, visitId),
            isNull(emergencyVisitsTable.deletedAt),
          )
        )
        .limit(1);

      if (!existing[0]) {
        res.status(404).json({ error: "Emergency visit not found" });
        return;
      }
      if (existing[0].closedAt !== null) {
        res.status(409).json({ error: "Cannot update a closed emergency visit" });
        return;
      }

      // Build update object — only touch provided fields
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (priority         !== undefined) updates.priority         = priority;
      if (status           !== undefined) updates.status           = status;
      if (triageNotes      !== undefined) updates.triageNotes      = triageNotes;
      if (assignedRoomName !== undefined) updates.assignedRoomName = assignedRoomName;

      const rows = await db
        .update(emergencyVisitsTable)
        .set(updates)
        .where(eq(emergencyVisitsTable.id, visitId))
        .returning({
          id:       emergencyVisitsTable.id,
          priority: emergencyVisitsTable.priority,
          status:   emergencyVisitsTable.status,
        });

      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /emergencies/vitals ─────────────────────────────────────────────────
// Records a new vitals reading for an open visit.
// Requires emergencies.update — same permission as general dossier updates.
// encounterId is derived server-side from the visit row (not trusted from the caller)
// to prevent mismatched clinical lineage.

router.post(
  "/vitals",
  requirePermission("emergencies.update"),
  async (req, res, next) => {
    try {
      const {
        visitId,
        heartRate, bloodPressure, spo2, temperature, respiratoryRate,
        gcs, painLevel, glucose, notes,
      } = req.body as {
        visitId:          string;
        heartRate?:       number;
        bloodPressure?:   string;
        spo2?:            number;
        temperature?:     number;
        respiratoryRate?: number;
        gcs?:             number;
        painLevel?:       number;
        glucose?:         number;
        notes?:           string;
      };

      if (!visitId) {
        res.status(400).json({ error: "visitId is required" });
        return;
      }

      // Resolve the canonical encounterId from the visit — reject unknown/closed visits
      const visitRow = await db
        .select({
          encounterId: emergencyVisitsTable.encounterId,
          closedAt:    emergencyVisitsTable.closedAt,
        })
        .from(emergencyVisitsTable)
        .where(
          and(
            eq(emergencyVisitsTable.id, visitId),
            isNull(emergencyVisitsTable.deletedAt),
            isNotNull(emergencyVisitsTable.encounterId),
          )
        )
        .limit(1);

      if (!visitRow[0]) {
        res.status(404).json({ error: "Emergency visit not found or has no linked encounter" });
        return;
      }
      if (visitRow[0].closedAt !== null) {
        res.status(409).json({ error: "Cannot record vitals for a closed emergency visit" });
        return;
      }

      const encounterId = visitRow[0].encounterId;

      const inserted = await db
        .insert(emergencyVitalsTable)
        .values({
          visitId,
          encounterId,
          heartRate:       heartRate       ?? null,
          bloodPressure:   bloodPressure   ?? null,
          spo2:            spo2            ?? null,
          temperature:     temperature     ?? null,
          respiratoryRate: respiratoryRate ?? null,
          gcs:             gcs             ?? null,
          painLevel:       painLevel       ?? null,
          glucose:         glucose         ?? null,
          notes:           notes           ?? null,
        })
        .returning({
          id:         emergencyVitalsTable.id,
          recordedAt: emergencyVitalsTable.recordedAt,
        });

      res.status(201).json(inserted[0]);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
