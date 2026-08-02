/**
 * /service-catalog routes
 *
 * GET  /service-catalog          — list all active entries
 * GET  /service-catalog/:code    — single entry by service_code
 * POST /service-catalog          — create (billing.manual_price)
 * PATCH /service-catalog/:id     — update price/active flag
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../middleware/requirePermission";
import type { AuthenticatedRequest } from "../middleware/requireAuth";

const router = Router();

function map(r: Record<string, unknown>) {
  return {
    id:           r.id,
    serviceCode:  r.service_code,
    name:         r.name,
    category:     r.category,
    sourceModule: r.source_module,
    defaultPrice: Number(r.default_price ?? 0),
    currency:     r.currency ?? "DZD",
    siteId:       r.site_id,
    validFrom:    r.valid_from,
    validTo:      r.valid_to,
    active:       r.active,
    createdAt:    r.created_at,
    updatedAt:    r.updated_at,
  };
}

router.get("/", requirePermission("billing.view"), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM service_catalog WHERE active = TRUE ORDER BY category, name`,
    );
    res.json(rows.map(map));
  } catch (err) { next(err); }
});

router.get("/:code", requirePermission("billing.view"), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM service_catalog WHERE service_code = $1 AND site_id IS NULL AND active = TRUE LIMIT 1`,
      [req.params.code],
    );
    if (!rows[0]) { res.status(404).json({ error: "Code non trouvé" }); return; }
    res.json(map(rows[0]));
  } catch (err) { next(err); }
});

router.post("/", requirePermission("billing.manual_price"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const b = req.body as {
      serviceCode: string; name: string; category: string; sourceModule?: string;
      defaultPrice?: number; siteId?: string; validFrom?: string; validTo?: string;
    };
    const { rows: [row] } = await pool.query(
      `INSERT INTO service_catalog (service_code, name, category, source_module, default_price, site_id, valid_from, valid_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.serviceCode, b.name, b.category, b.sourceModule ?? null,
       b.defaultPrice ?? 0, b.siteId ?? null, b.validFrom ?? null, b.validTo ?? null],
    );
    res.status(201).json(map(row));
  } catch (err) { next(err); }
});

router.patch("/:id", requirePermission("billing.manual_price"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { defaultPrice, active, name } = req.body as { defaultPrice?: number; active?: boolean; name?: string };
    const { rows: [row] } = await pool.query(
      `UPDATE service_catalog
          SET default_price = COALESCE($1::numeric, default_price),
              active        = COALESCE($2, active),
              name          = COALESCE($3, name),
              updated_at    = NOW()
        WHERE id = $4 RETURNING *`,
      [defaultPrice ?? null, active ?? null, name ?? null, req.params.id],
    );
    if (!row) { res.status(404).json({ error: "Entrée introuvable" }); return; }
    res.json(map(row));
  } catch (err) { next(err); }
});

export default router;
