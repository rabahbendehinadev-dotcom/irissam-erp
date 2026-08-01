import { Router } from "express";
import { db } from "@workspace/db";
import {
  patientsTable,
  appointmentsTable,
  admissionsTable,
  dailyStatsTable,
} from "@workspace/db/schema";
import { count, isNull, sql, eq, desc, gte, lt, and } from "drizzle-orm";

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

    const [[{ totalPatients }], [{ hospitalized }], [{ admissionsToday }], [{ appointmentsToday }], todayStat] =
      await Promise.all([
        db.select({ totalPatients: count() }).from(patientsTable),
        db
          .select({ hospitalized: count() })
          .from(admissionsTable)
          .where(isNull(admissionsTable.dischargedAt)),
        db
          .select({ admissionsToday: count() })
          .from(admissionsTable)
          .where(
            and(
              gte(admissionsTable.admittedAt, start),
              lt(admissionsTable.admittedAt, end),
            ),
          ),
        db
          .select({ appointmentsToday: count() })
          .from(appointmentsTable)
          .where(
            and(
              gte(appointmentsTable.scheduledAt, start),
              lt(appointmentsTable.scheduledAt, end),
            ),
          ),
        db
          .select()
          .from(dailyStatsTable)
          .where(eq(dailyStatsTable.date, today))
          .limit(1),
      ]);

    const stats = todayStat[0];
    const bedOccupancyPercent =
      hospitalized > 0 ? Math.round((hospitalized / 420) * 100) : 0;

    res.json({
      totalPatients,
      appointmentsToday,
      hospitalized,
      admissionsToday,
      emergenciesWaiting: stats?.admissions
        ? Math.max(3, Math.round(stats.admissions * 0.3))
        : 0,
      consultationsToday: stats?.consultations ?? 0,
      analysesToday: stats?.analyses ?? 0,
      imagingToday: stats?.imaging ?? 0,
      invoicesToday: stats?.invoices ?? 0,
      revenueToday: stats?.revenueDA ?? 0,
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
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const fromDate = sevenDaysAgo.toISOString().slice(0, 10);

    const rows = await db
      .select()
      .from(dailyStatsTable)
      .where(gte(dailyStatsTable.date, fromDate))
      .orderBy(dailyStatsTable.date);

    const data = rows.map((r) => ({
      name: formatDate(r.date),
      consultations: r.consultations,
      rendezVous: r.rendezVous,
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
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const fromDate = sevenDaysAgo.toISOString().slice(0, 10);

    const rows = await db
      .select()
      .from(dailyStatsTable)
      .where(gte(dailyStatsTable.date, fromDate))
      .orderBy(dailyStatsTable.date);

    const data = rows.map((r) => ({
      name: formatDate(r.date),
      admissions: r.admissions,
      sorties: r.sorties,
    }));

    res.json(data);
  } catch (err) {
    next(err);
  }
});

/** GET /dashboard/charts/services */
router.get("/charts/services", async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        name: admissionsTable.service,
        value: count(),
      })
      .from(admissionsTable)
      .groupBy(admissionsTable.service)
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
