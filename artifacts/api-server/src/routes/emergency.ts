/**
 * /emergencies routes — backed by emergency_visits, emergency_rooms, ambulances tables.
 *
 * GET /emergencies/patients  — active emergency visits with patient demographics + latest vitals
 * GET /emergencies/rooms     — emergency room list with occupancy
 * GET /emergencies/ambulances — ambulance fleet with current status
 */
import { Router } from "express";
import { isNull, and, desc, inArray, sql } from "drizzle-orm";
import {
  db,
  emergencyVisitsTable,
  emergencyRoomsTable,
  emergencyVitalsTable,
  ambulancesTable,
  patientsTable,
} from "@workspace/db";

const router = Router();

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

export default router;
