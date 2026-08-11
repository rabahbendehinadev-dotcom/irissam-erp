/**
 * /dashboard routes — aggregate stats and chart data.
 *
 * Schema alignment:
 *  admissionsTable:
 *   - status: "active" | "discharged" | ... (replaces dischargedAt IS NULL)
 *   - admissionDate: date string YYYY-MM-DD (replaces admittedAt timestamp)
 *   - serviceName: text (replaces `service`)
 *
 *  dailyStatsTable:
 *   - statDate: date (replaces `date`)
 *   - newAdmissions: integer (replaces `admissions`)
 *   - discharges: integer (replaces `sorties`)
 *   - consultations: integer ✓
 *   - No rendezVous / analyses / imaging / invoices / revenueDA columns
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  patientsTable,
  appointmentsTable,
  admissionsTable,
  dailyStatsTable,
  occupancyBedsTable,
} from "@workspace/db/schema";
import { count, isNull, eq, gte, lt, and, desc } from "drizzle-orm";

const router = Router();

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

/** GET /dashboard/stats */
router.get("/stats", async (_req, res, next) => {
  try {
    const { start, end } = todayRange();
    const today = todayDateString();

    const [
      [{ totalPatients }],
      [{ hospitalized }],
      [{ admissionsToday }],
      [{ appointmentsToday }],
      todayStat,
      bedStatusRows,
    ] = await Promise.all([
      db.select({ totalPatients: count() })
        .from(patientsTable)
        .where(isNull(patientsTable.deletedAt)),

      // "Currently hospitalized" = active admissions (not yet discharged)
      db.select({ hospitalized: count() })
        .from(admissionsTable)
        .where(
          and(
            eq(admissionsTable.status, "active"),
            isNull(admissionsTable.deletedAt),
          ),
        ),

      // Admissions today: admissionDate = today (date string)
      db.select({ admissionsToday: count() })
        .from(admissionsTable)
        .where(
          and(
            eq(admissionsTable.admissionDate, today),
            isNull(admissionsTable.deletedAt),
          ),
        ),

      db.select({ appointmentsToday: count() })
        .from(appointmentsTable)
        .where(
          and(
            gte(appointmentsTable.scheduledAt, start),
            lt(appointmentsTable.scheduledAt, end),
            isNull(appointmentsTable.deletedAt),
          ),
        ),

      db.select()
        .from(dailyStatsTable)
        .where(eq(dailyStatsTable.statDate, today))
        .limit(1),

      // Occupation réelle des lits — occupancy_beds (même source que le module
      // Admissions), convention occupe / total. Remplace le dénominateur 420 codé en dur.
      db.select({ status: occupancyBedsTable.status, n: count() })
        .from(occupancyBedsTable)
        .groupBy(occupancyBedsTable.status),
    ]);

    const stats = todayStat[0];
    const occupiedBeds = bedStatusRows
      .filter((r) => r.status === "occupe")
      .reduce((acc, r) => acc + Number(r.n), 0);
    const totalBeds = bedStatusRows.reduce((acc, r) => acc + Number(r.n), 0);
    const bedOccupancyPercent =
      totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    res.json({
      totalPatients,
      appointmentsToday,
      hospitalized,
      admissionsToday,
      emergenciesWaiting: stats?.emergencyVisits
        ? Math.max(3, Math.round(stats.emergencyVisits * 0.3))
        : 0,
      consultationsToday: stats?.consultations ?? 0,
      analysesToday:      0,   // not tracked in dailyStatsTable v2
      imagingToday:       0,
      invoicesToday:      0,
      revenueToday:       0,
      bedOccupancyPercent,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /dashboard/charts/consultations */
router.get("/charts/consultations", async (_req, res, next) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const fromDate = sevenDaysAgo.toISOString().slice(0, 10);

    const rows = await db
      .select()
      .from(dailyStatsTable)
      .where(gte(dailyStatsTable.statDate, fromDate))
      .orderBy(dailyStatsTable.statDate);

    const data = rows.map((r) => ({
      name:         formatDate(r.statDate),
      consultations: r.consultations,
      rendezVous:   0,   // not tracked in v2 schema
    }));

    res.json(data);
  } catch (err) {
    next(err);
  }
});

/** GET /dashboard/charts/admissions */
router.get("/charts/admissions", async (_req, res, next) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const fromDate = sevenDaysAgo.toISOString().slice(0, 10);

    const rows = await db
      .select()
      .from(dailyStatsTable)
      .where(gte(dailyStatsTable.statDate, fromDate))
      .orderBy(dailyStatsTable.statDate);

    const data = rows.map((r) => ({
      name:       formatDate(r.statDate),
      admissions: r.newAdmissions,   // newAdmissions replaces legacy `admissions`
      sorties:    r.discharges,       // discharges replaces legacy `sorties`
    }));

    res.json(data);
  } catch (err) {
    next(err);
  }
});

/** GET /dashboard/charts/services — top services by admission count */
router.get("/charts/services", async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        name:  admissionsTable.serviceName,  // serviceName replaces legacy `service`
        value: count(),
      })
      .from(admissionsTable)
      .where(isNull(admissionsTable.deletedAt))
      .groupBy(admissionsTable.serviceName)
      .orderBy(desc(count()));

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

function formatDate(dateStr: string): string {
  const months = [
    "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
    "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc",
  ];
  const [, month, day] = dateStr.split("-");
  return `${parseInt(day)} ${months[parseInt(month) - 1]}`;
}

export default router;
