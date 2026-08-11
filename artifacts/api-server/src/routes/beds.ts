import { Router } from "express";
import { db } from "@workspace/db";
import { bedsTable, occupancyBedsTable } from "@workspace/db/schema";
import { count } from "drizzle-orm";

const router = Router();

/**
 * GET /beds/summary — agrégat live des lits d'hospitalisation.
 * Source de vérité : occupancy_beds (la même que le module Admissions via
 * useOccupancyBedsApi), et NON l'ancienne table statique `beds`.
 * Convention identique au module Admissions : occupancyPercent = occupe / total.
 */
router.get("/summary", async (_req, res, next) => {
  try {
    const rows = await db
      .select({ status: occupancyBedsTable.status, n: count() })
      .from(occupancyBedsTable)
      .groupBy(occupancyBedsTable.status);

    const by = new Map<string, number>(rows.map((r) => [r.status as string, Number(r.n)]));
    const occupied     = by.get("occupe") ?? 0;
    const free         = by.get("disponible") ?? 0;
    const cleaning     = by.get("nettoyage") ?? 0;
    const outOfService = (by.get("hors_service") ?? 0) + (by.get("maintenance") ?? 0);
    const total        = rows.reduce((acc, r) => acc + Number(r.n), 0);
    const occupancyPercent = total > 0 ? Math.round((occupied / total) * 100) : 0;

    res.json({ occupied, free, cleaning, outOfService, total, occupancyPercent });
  } catch (err) {
    next(err);
  }
});

/** GET /beds/by-service */
router.get("/by-service", async (_req, res, next) => {
  try {
    const rows = await db.select().from(bedsTable);

    const services = rows.map((r) => {
      const free = r.totalBeds - r.occupiedBeds - r.cleaningBeds - r.outOfServiceBeds;
      const occupancyPercent =
        r.totalBeds > 0 ? Math.round((r.occupiedBeds / r.totalBeds) * 100) : 0;
      return {
        service: r.service,
        totalBeds: r.totalBeds,
        occupiedBeds: r.occupiedBeds,
        freeBeds: free,
        cleaningBeds: r.cleaningBeds,
        outOfServiceBeds: r.outOfServiceBeds,
        occupancyPercent,
      };
    });

    res.json({ services });
  } catch (err) {
    next(err);
  }
});

export default router;
