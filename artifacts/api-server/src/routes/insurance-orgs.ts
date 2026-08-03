/**
 * Insurance Organizations & Plans routes
 * Prefix: /insurance
 *
 * GET    /organizations
 * POST   /organizations
 * GET    /organizations/:id
 * PATCH  /organizations/:id
 * POST   /organizations/:id/suspend
 * POST   /organizations/:id/reactivate
 *
 * GET    /plans
 * POST   /plans
 * GET    /plans/:id
 * PATCH  /plans/:id
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../middleware/requirePermission";
import { auditService } from "../services/audit";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import type { ActorCtx } from "../repositories/types";

const router = Router();

function actor(req: AuthenticatedRequest): ActorCtx {
  return {
    userId:   req.auth?.userId   ?? "system",
    userName: req.auth?.userId   ?? "system",
    userRole: req.auth?.role     ?? "guest",
    siteId:   req.auth?.siteId   ?? undefined,
  };
}

// ─── ORGANIZATIONS ────────────────────────────────────────────────────────────

// GET /organizations
router.get("/organizations", requirePermission("insurance.organizations.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { type, status, search } = req.query as Record<string, string>;
    const conds = ["o.deleted_at IS NULL"];
    const params: unknown[] = [];
    if (type)   { params.push(type);   conds.push(`o.type = $${params.length}`); }
    if (status) { params.push(status); conds.push(`o.status = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conds.push(`(o.name ILIKE $${params.length} OR o.code ILIKE $${params.length})`);
    }
    const { rows } = await pool.query(
      `SELECT o.*,
              COUNT(ip.id) FILTER (WHERE ip.statut = 'active' AND ip.deleted_at IS NULL) AS active_policies_count,
              COUNT(ic.id) FILTER (WHERE ic.status NOT IN ('paid','rejected') AND ic.deleted_at IS NULL) AS pending_claims_count
         FROM insurance_organizations o
         LEFT JOIN insurance_policies  ip ON ip.organization_id = o.id
         LEFT JOIN insurance_claims    ic ON ic.organization_id = o.id
        WHERE ${conds.join(" AND ")}
        GROUP BY o.id
        ORDER BY o.name`,
      params,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /organizations
router.post("/organizations", requirePermission("insurance.organizations.create"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const b = req.body as {
      code: string; name: string; type: string;
      address?: string; phone?: string; email?: string; contactName?: string;
      conventionNumber?: string; conventionStart?: string; conventionEnd?: string;
      avgPaymentDays?: number; defaultCoveragePercent?: number; annualCeiling?: number;
      status?: string; siteId?: string; notes?: string;
    };
    if (!b.code || !b.name || !b.type) {
      res.status(400).json({ error: "code, name, type requis" }); return;
    }
    const { rows: [org] } = await pool.query(
      `INSERT INTO insurance_organizations
         (code, name, type, address, phone, email, contact_name,
          convention_number, convention_start, convention_end,
          avg_payment_days, default_coverage_percent, annual_ceiling,
          status, site_id, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [b.code, b.name, b.type, b.address ?? null, b.phone ?? null, b.email ?? null, b.contactName ?? null,
       b.conventionNumber ?? null, b.conventionStart ?? null, b.conventionEnd ?? null,
       b.avgPaymentDays ?? 30, b.defaultCoveragePercent ?? 80, b.annualCeiling ?? null,
       b.status ?? "actif", b.siteId ?? null, b.notes ?? null, a.userId],
    );
    await auditService.log({ module: "system", action: "create", resourceType: "InsuranceOrganization", resourceId: org.id as string, newValue: { code: b.code, name: b.name } }, a);
    res.status(201).json(org);
  } catch (err) { next(err); }
});

// GET /organizations/:id
router.get("/organizations/:id", requirePermission("insurance.organizations.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { rows: [org] } = await pool.query(
      `SELECT o.*,
              COALESCE(json_agg(p) FILTER (WHERE p.id IS NOT NULL), '[]') AS plans
         FROM insurance_organizations o
         LEFT JOIN insurance_plans p ON p.organization_id = o.id AND p.deleted_at IS NULL
        WHERE o.id = $1 AND o.deleted_at IS NULL
        GROUP BY o.id`,
      [String(req.params.id)],
    );
    if (!org) { res.status(404).json({ error: "Organisme introuvable" }); return; }
    res.json(org);
  } catch (err) { next(err); }
});

// PATCH /organizations/:id
router.patch("/organizations/:id", requirePermission("insurance.organizations.update"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const b = req.body as Record<string, unknown>;
    const ALLOWED = ["name","type","address","phone","email","contact_name","convention_number",
                     "convention_start","convention_end","avg_payment_days","default_coverage_percent",
                     "annual_ceiling","notes","site_id"];
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const key of ALLOWED) {
      const camel = key.replace(/_([a-z])/g, (_,c) => c.toUpperCase());
      if (b[camel] !== undefined || b[key] !== undefined) {
        params.push(b[camel] ?? b[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (!sets.length) { res.status(400).json({ error: "Aucun champ à modifier" }); return; }
    params.push(a.userId, String(req.params.id));
    const { rows: [updated] } = await pool.query(
      `UPDATE insurance_organizations SET ${sets.join(",")}, updated_by=$${params.length-1}, updated_at=NOW(), version=version+1 WHERE id=$${params.length} AND deleted_at IS NULL RETURNING *`,
      params,
    );
    if (!updated) { res.status(404).json({ error: "Organisme introuvable" }); return; }
    await auditService.log({ module: "system", action: "update", resourceType: "InsuranceOrganization", resourceId: String(req.params.id) }, a);
    res.json(updated);
  } catch (err) { next(err); }
});

// POST /organizations/:id/suspend
router.post("/organizations/:id/suspend", requirePermission("insurance.organizations.update"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const { rows: [updated] } = await pool.query(
      `UPDATE insurance_organizations SET status='suspendu', updated_by=$1, updated_at=NOW(), version=version+1 WHERE id=$2 AND deleted_at IS NULL RETURNING *`,
      [a.userId, String(req.params.id)],
    );
    if (!updated) { res.status(404).json({ error: "Organisme introuvable" }); return; }
    await auditService.log({ module: "system", action: "update", resourceType: "InsuranceOrganization", resourceId: String(req.params.id), newValue: { status: "suspendu" } }, a);
    res.json(updated);
  } catch (err) { next(err); }
});

// POST /organizations/:id/reactivate
router.post("/organizations/:id/reactivate", requirePermission("insurance.organizations.update"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const { rows: [updated] } = await pool.query(
      `UPDATE insurance_organizations SET status='actif', updated_by=$1, updated_at=NOW(), version=version+1 WHERE id=$2 AND deleted_at IS NULL RETURNING *`,
      [a.userId, String(req.params.id)],
    );
    if (!updated) { res.status(404).json({ error: "Organisme introuvable" }); return; }
    await auditService.log({ module: "system", action: "update", resourceType: "InsuranceOrganization", resourceId: String(req.params.id), newValue: { status: "actif" } }, a);
    res.json(updated);
  } catch (err) { next(err); }
});

// ─── PLANS ────────────────────────────────────────────────────────────────────

// GET /plans
router.get("/plans", requirePermission("insurance.plans.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { organizationId } = req.query as Record<string, string>;
    const conds = ["p.deleted_at IS NULL"];
    const params: unknown[] = [];
    if (organizationId) { params.push(organizationId); conds.push(`p.organization_id = $${params.length}`); }
    const { rows } = await pool.query(
      `SELECT p.*, o.name AS organization_name, o.code AS organization_code
         FROM insurance_plans p
         LEFT JOIN insurance_organizations o ON o.id = p.organization_id
        WHERE ${conds.join(" AND ")}
        ORDER BY o.name, p.name`,
      params,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /plans
router.post("/plans", requirePermission("insurance.plans.create"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const b = req.body as {
      organizationId: string; code: string; name: string; coverageType: string;
      coveragePercent?: number; annualCeiling?: number; perActCeiling?: number;
      perDayCeiling?: number; ticketModerateur?: number; franchiseAmount?: number;
      maxActsPerYear?: number; requiresPriorAuth?: boolean; excludedServices?: string[];
      coveredServices?: string[]; tarifsConventionnes?: Record<string, number>;
      waitingPeriodDays?: number; notes?: string;
    };
    if (!b.organizationId || !b.code || !b.name || !b.coverageType) {
      res.status(400).json({ error: "organizationId, code, name, coverageType requis" }); return;
    }
    const { rows: [plan] } = await pool.query(
      `INSERT INTO insurance_plans
         (organization_id, code, name, coverage_type, coverage_percent,
          annual_ceiling, per_act_ceiling, per_day_ceiling,
          ticket_moderateur_percent, franchise_amount,
          max_acts_per_year, requires_prior_auth,
          excluded_services, covered_services, tarifs_conventionnes,
          waiting_period_days, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [b.organizationId, b.code, b.name, b.coverageType,
       b.coveragePercent ?? 80, b.annualCeiling ?? null, b.perActCeiling ?? null,
       b.perDayCeiling ?? null, b.ticketModerateur ?? 0, b.franchiseAmount ?? 0,
       b.maxActsPerYear ?? null, b.requiresPriorAuth ?? false,
       b.excludedServices ?? [], b.coveredServices ?? null,
       b.tarifsConventionnes ? JSON.stringify(b.tarifsConventionnes) : null,
       b.waitingPeriodDays ?? 0, b.notes ?? null, a.userId],
    );
    await auditService.log({ module: "system", action: "create", resourceType: "InsurancePlan", resourceId: plan.id as string }, a);
    res.status(201).json(plan);
  } catch (err) { next(err); }
});

// GET /plans/:id
router.get("/plans/:id", requirePermission("insurance.plans.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { rows: [plan] } = await pool.query(
      `SELECT p.*, o.name AS organization_name FROM insurance_plans p LEFT JOIN insurance_organizations o ON o.id = p.organization_id WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [String(req.params.id)],
    );
    if (!plan) { res.status(404).json({ error: "Plan introuvable" }); return; }
    res.json(plan);
  } catch (err) { next(err); }
});

// PATCH /plans/:id
router.patch("/plans/:id", requirePermission("insurance.plans.update"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const b = req.body as Record<string, unknown>;
    const MAP: Record<string, string> = {
      name: "name", coverageType: "coverage_type", coveragePercent: "coverage_percent",
      annualCeiling: "annual_ceiling", perActCeiling: "per_act_ceiling", perDayCeiling: "per_day_ceiling",
      ticketModerateur: "ticket_moderateur_percent", franchiseAmount: "franchise_amount",
      maxActsPerYear: "max_acts_per_year", requiresPriorAuth: "requires_prior_auth",
      excludedServices: "excluded_services", coveredServices: "covered_services",
      tarifsConventionnes: "tarifs_conventionnes", waitingPeriodDays: "waiting_period_days",
      isActive: "is_active", notes: "notes",
    };
    const sets: string[] = []; const params: unknown[] = [];
    for (const [camel, col] of Object.entries(MAP)) {
      if (b[camel] !== undefined) { params.push(b[camel]); sets.push(`${col} = $${params.length}`); }
    }
    if (!sets.length) { res.status(400).json({ error: "Aucun champ à modifier" }); return; }
    params.push(a.userId, String(req.params.id));
    const { rows: [updated] } = await pool.query(
      `UPDATE insurance_plans SET ${sets.join(",")}, updated_by=$${params.length-1}, updated_at=NOW(), version=version+1 WHERE id=$${params.length} AND deleted_at IS NULL RETURNING *`,
      params,
    );
    if (!updated) { res.status(404).json({ error: "Plan introuvable" }); return; }
    await auditService.log({ module: "system", action: "update", resourceType: "InsurancePlan", resourceId: String(req.params.id) }, a);
    res.json(updated);
  } catch (err) { next(err); }
});

export default router;
