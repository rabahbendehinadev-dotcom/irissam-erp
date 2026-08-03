/**
 * Insurance Policies routes
 * Prefix: /insurance
 *
 * GET    /policies
 * POST   /policies
 * GET    /policies/:id
 * PATCH  /policies/:id
 * POST   /policies/:id/renew
 * POST   /policies/:id/archive
 * POST   /policies/:id/suspend
 * POST   /policies/:id/validate
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

// GET /policies
router.get("/policies", requirePermission("insurance.policies.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { patientId, organizationId, statut, includeArchived } = req.query as Record<string, string>;
    const conds = ["ip.deleted_at IS NULL"];
    const params: unknown[] = [];
    if (patientId)      { params.push(patientId);      conds.push(`ip.patient_id = $${params.length}`); }
    if (organizationId) { params.push(organizationId); conds.push(`ip.organization_id = $${params.length}`); }
    if (statut)         { params.push(statut);         conds.push(`ip.statut = $${params.length}`); }
    if (!includeArchived || includeArchived === "false") {
      conds.push(`ip.statut != 'archivee'`);
    }
    const { rows } = await pool.query(
      `SELECT ip.*,
              io.name  AS organization_name,
              io.code  AS organization_code,
              io.type  AS organization_type,
              ipl.name AS plan_name,
              ipl.coverage_type AS plan_coverage_type,
              ipl.annual_ceiling AS plan_annual_ceiling,
              ipl.excluded_services AS plan_excluded_services,
              ipl.requires_prior_auth AS plan_requires_prior_auth,
              -- Computed columns
              CASE WHEN ip.valid_until < CURRENT_DATE THEN TRUE ELSE FALSE END AS is_expired,
              CASE WHEN ip.valid_until IS NOT NULL
                   THEN ip.valid_until - CURRENT_DATE END AS days_until_expiry,
              CASE WHEN ip.ceiling_amount_num IS NOT NULL
                   THEN GREATEST(0, ip.ceiling_amount_num - ip.plafond_consomme) END AS plafond_restant
         FROM insurance_policies ip
         LEFT JOIN insurance_organizations io  ON io.id  = ip.organization_id
         LEFT JOIN insurance_plans         ipl ON ipl.id = ip.plan_id
        WHERE ${conds.join(" AND ")}
        ORDER BY ip.priorite ASC, ip.created_at DESC`,
      params,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /policies
router.post("/policies", requirePermission("insurance.policies.create"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const b = req.body as {
      patientId: string; organizationId?: string; planId?: string;
      insurerName?: string; policyNumber: string; subscriberNumber?: string;
      numeroAdherent?: string; beneficiairePrincipal?: string; ayantDroit?: boolean;
      coverageType?: string; coveragePercent?: number; ceilingAmount?: number;
      ticketModerateur?: number; franchiseAmount?: number;
      validFrom?: string; validUntil?: string;
      priorite?: number; statut?: string; notes?: string;
    };
    if (!b.patientId || !b.policyNumber) {
      res.status(400).json({ error: "patientId, policyNumber requis" }); return;
    }
    // Check for expired date
    if (b.validUntil && new Date(b.validUntil) < new Date()) {
      res.status(422).json({ error: "La date d'expiration est déjà dépassée. Créez une police valide." }); return;
    }
    const { rows: [pol] } = await pool.query(
      `INSERT INTO insurance_policies
         (patient_id, organization_id, plan_id,
          insurer_name, policy_number, subscriber_number,
          numero_adherent, beneficiaire_principal, ayant_droit,
          coverage_type, coverage_percent, coverage_percent_num, ceiling_amount, ceiling_amount_num,
          ticket_moderateur_percent, franchise_amount,
          valid_from, valid_until,
          priorite, statut, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING *`,
      [b.patientId, b.organizationId ?? null, b.planId ?? null,
       b.insurerName ?? null, b.policyNumber, b.subscriberNumber ?? null,
       b.numeroAdherent ?? null, b.beneficiairePrincipal ?? null, b.ayantDroit ?? false,
       b.coverageType ?? "maladie",
       b.coveragePercent ?? 80, (b.coveragePercent ?? 80).toFixed(2),
       b.ceilingAmount ?? null, b.ceilingAmount != null ? b.ceilingAmount.toFixed(2) : null,
       b.ticketModerateur ?? 0, b.franchiseAmount ?? 0,
       b.validFrom ?? null, b.validUntil ?? null,
       b.priorite ?? 1, b.statut ?? "active", b.notes ?? null, a.userId],
    );
    await auditService.log({ module: "system", action: "create", resourceType: "InsurancePolicy", resourceId: pol.id as string, patientId: b.patientId, newValue: { policyNumber: b.policyNumber } }, a);
    res.status(201).json(pol);
  } catch (err) { next(err); }
});

// GET /policies/:id
router.get("/policies/:id", requirePermission("insurance.policies.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { rows: [pol] } = await pool.query(
      `SELECT ip.*,
              io.name AS organization_name, io.code AS organization_code,
              ipl.name AS plan_name,
              CASE WHEN ip.valid_until < CURRENT_DATE THEN TRUE ELSE FALSE END AS is_expired,
              CASE WHEN ip.ceiling_amount_num IS NOT NULL
                   THEN GREATEST(0, ip.ceiling_amount_num - ip.plafond_consomme) END AS plafond_restant
         FROM insurance_policies ip
         LEFT JOIN insurance_organizations io  ON io.id  = ip.organization_id
         LEFT JOIN insurance_plans         ipl ON ipl.id = ip.plan_id
        WHERE ip.id = $1 AND ip.deleted_at IS NULL`,
      [String(req.params.id)],
    );
    if (!pol) { res.status(404).json({ error: "Police introuvable" }); return; }
    res.json(pol);
  } catch (err) { next(err); }
});

// PATCH /policies/:id
router.patch("/policies/:id", requirePermission("insurance.policies.update"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const b = req.body as Record<string, unknown>;
    const MAP: Record<string, string> = {
      organizationId: "organization_id", planId: "plan_id",
      insurerName: "insurer_name", policyNumber: "policy_number",
      subscriberNumber: "subscriber_number", numeroAdherent: "numero_adherent",
      beneficiairePrincipal: "beneficiaire_principal", ayantDroit: "ayant_droit",
      coverageType: "coverage_type", coveragePercent: "coverage_percent",
      ceilingAmount: "ceiling_amount", ticketModerateur: "ticket_moderateur_percent",
      franchiseAmount: "franchise_amount", validFrom: "valid_from", validUntil: "valid_until",
      priorite: "priorite", statut: "statut", notes: "notes",
    };
    const sets: string[] = []; const params: unknown[] = [];
    for (const [camel, col] of Object.entries(MAP)) {
      if (b[camel] !== undefined) {
        params.push(b[camel]); sets.push(`${col} = $${params.length}`);
        if (camel === "coveragePercent") { params.push(Number(b[camel]).toFixed(2)); sets.push(`coverage_percent_num = $${params.length}`); }
        if (camel === "ceilingAmount" && b[camel] != null) { params.push(Number(b[camel]).toFixed(2)); sets.push(`ceiling_amount_num = $${params.length}`); }
      }
    }
    if (!sets.length) { res.status(400).json({ error: "Aucun champ à modifier" }); return; }
    params.push(a.userId, String(req.params.id));
    const { rows: [updated] } = await pool.query(
      `UPDATE insurance_policies SET ${sets.join(",")}, updated_by=$${params.length-1}, updated_at=NOW(), version=version+1 WHERE id=$${params.length} AND deleted_at IS NULL RETURNING *`,
      params,
    );
    if (!updated) { res.status(404).json({ error: "Police introuvable" }); return; }
    await auditService.log({ module: "system", action: "update", resourceType: "InsurancePolicy", resourceId: String(req.params.id) }, a);
    res.json(updated);
  } catch (err) { next(err); }
});

// POST /policies/:id/renew
router.post("/policies/:id/renew", requirePermission("insurance.policies.renew"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const { validUntil, validFrom } = req.body as { validUntil: string; validFrom?: string };
    if (!validUntil) { res.status(400).json({ error: "validUntil requis pour le renouvellement" }); return; }
    if (new Date(validUntil) < new Date()) { res.status(422).json({ error: "La nouvelle date d'expiration doit être dans le futur" }); return; }
    const { rows: [updated] } = await pool.query(
      `UPDATE insurance_policies
         SET valid_until = $1,
             valid_from  = COALESCE($2, valid_from),
             statut      = 'active',
             plafond_consomme = 0,
             updated_by  = $3, updated_at = NOW(), version = version + 1
       WHERE id = $4 AND deleted_at IS NULL RETURNING *`,
      [validUntil, validFrom ?? null, a.userId, String(req.params.id)],
    );
    if (!updated) { res.status(404).json({ error: "Police introuvable" }); return; }
    await auditService.log({ module: "system", action: "update", resourceType: "InsurancePolicy", resourceId: String(req.params.id), newValue: { action: "renew", validUntil } }, a);
    res.json(updated);
  } catch (err) { next(err); }
});

// POST /policies/:id/archive
router.post("/policies/:id/archive", requirePermission("insurance.policies.update"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const { rows: [updated] } = await pool.query(
      `UPDATE insurance_policies SET statut='archivee', updated_by=$1, updated_at=NOW(), version=version+1 WHERE id=$2 AND deleted_at IS NULL RETURNING *`,
      [a.userId, String(req.params.id)],
    );
    if (!updated) { res.status(404).json({ error: "Police introuvable" }); return; }
    await auditService.log({ module: "system", action: "update", resourceType: "InsurancePolicy", resourceId: String(req.params.id), newValue: { statut: "archivee" } }, a);
    res.json(updated);
  } catch (err) { next(err); }
});

// POST /policies/:id/suspend
router.post("/policies/:id/suspend", requirePermission("insurance.policies.update"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const { rows: [updated] } = await pool.query(
      `UPDATE insurance_policies SET statut='suspendue', updated_by=$1, updated_at=NOW(), version=version+1 WHERE id=$2 AND deleted_at IS NULL RETURNING *`,
      [a.userId, String(req.params.id)],
    );
    if (!updated) { res.status(404).json({ error: "Police introuvable" }); return; }
    await auditService.log({ module: "system", action: "update", resourceType: "InsurancePolicy", resourceId: String(req.params.id), newValue: { statut: "suspendue" } }, a);
    res.json(updated);
  } catch (err) { next(err); }
});

// POST /policies/:id/validate  (en_attente_validation → active)
router.post("/policies/:id/validate", requirePermission("insurance.policies.update"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const { rows: [updated] } = await pool.query(
      `UPDATE insurance_policies SET statut='active', updated_by=$1, updated_at=NOW(), version=version+1 WHERE id=$2 AND deleted_at IS NULL RETURNING *`,
      [a.userId, String(req.params.id)],
    );
    if (!updated) { res.status(404).json({ error: "Police introuvable" }); return; }
    await auditService.log({ module: "system", action: "update", resourceType: "InsurancePolicy", resourceId: String(req.params.id), newValue: { statut: "active" } }, a);
    res.json(updated);
  } catch (err) { next(err); }
});

export default router;
