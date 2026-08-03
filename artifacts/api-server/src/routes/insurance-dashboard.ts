/**
 * Insurance Dashboard & Reports routes
 * Prefix: /insurance
 *
 * GET /dashboard   — KPI cards + chart data
 * GET /reports     — exportable tabular data
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../middleware/requirePermission";
import { auditService } from "../services/audit";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import type { ActorCtx } from "../repositories/types";

const router = Router();

function actor(req: AuthenticatedRequest): ActorCtx {
  return { userId: req.auth?.userId ?? "system", userName: req.auth?.userId ?? "system", userRole: req.auth?.role ?? "guest" };
}

// GET /dashboard
router.get("/dashboard", requirePermission("insurance.reports.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const [kpis, byOrg, byStatus, monthlyPayments, rejectionReasons, topRejectedServices, urgentClaims, expiringPolicies, unpaidBordereaux] = await Promise.all([
      // KPI Cards
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status NOT IN ('paid','rejected','cancelled') AND deleted_at IS NULL) AS pending_claims,
          COALESCE(SUM(COALESCE(amount_requested_num, amount_requested::NUMERIC)) FILTER (WHERE deleted_at IS NULL), 0) AS total_requested,
          COALESCE(SUM(COALESCE(amount_approved_num,  amount_approved::NUMERIC))  FILTER (WHERE deleted_at IS NULL), 0) AS total_approved,
          COALESCE(SUM(amount_rejected) FILTER (WHERE deleted_at IS NULL), 0) AS total_rejected,
          COALESCE(SUM(amount_paid_num) FILTER (WHERE deleted_at IS NULL), 0) AS total_paid,
          COALESCE(SUM(COALESCE(amount_approved_num, amount_approved::NUMERIC) - COALESCE(amount_paid_num, 0))
            FILTER (WHERE status NOT IN ('paid','rejected','cancelled') AND deleted_at IS NULL), 0) AS remaining_to_collect,
          COUNT(*) FILTER (WHERE submitted_at IS NOT NULL AND status NOT IN ('paid','rejected') AND submitted_at < NOW() - INTERVAL '30 days' AND deleted_at IS NULL) AS overdue_claims
        FROM insurance_claims`),
      // By organisation
      pool.query(`
        SELECT io.name AS organization_name, io.code,
               COUNT(c.id) AS claim_count,
               COALESCE(SUM(COALESCE(c.amount_requested_num, c.amount_requested::NUMERIC)), 0) AS total_requested,
               COALESCE(SUM(COALESCE(c.amount_approved_num,  c.amount_approved::NUMERIC)),  0) AS total_approved,
               COALESCE(SUM(c.amount_paid_num), 0) AS total_paid
          FROM insurance_organizations io
          LEFT JOIN insurance_claims c ON c.organization_id = io.id AND c.deleted_at IS NULL
         WHERE io.deleted_at IS NULL
         GROUP BY io.id, io.name, io.code
         ORDER BY total_requested DESC LIMIT 10`),
      // By status
      pool.query(`
        SELECT status,
               COUNT(*) AS count,
               COALESCE(SUM(COALESCE(amount_requested_num, amount_requested::NUMERIC)), 0) AS total
          FROM insurance_claims WHERE deleted_at IS NULL GROUP BY status ORDER BY count DESC`),
      // Monthly payments (last 12 months)
      pool.query(`
        SELECT TO_CHAR(DATE_TRUNC('month', payment_date), 'YYYY-MM') AS month,
               COALESCE(SUM(amount), 0) AS total_paid
          FROM insurance_org_payments
         WHERE payment_date >= CURRENT_DATE - INTERVAL '12 months' AND deleted_at IS NULL
         GROUP BY DATE_TRUNC('month', payment_date)
         ORDER BY month`),
      // Rejection reasons
      pool.query(`
        SELECT rejection_reason AS reason, COUNT(*) AS count,
               COALESCE(SUM(rejected_amount), 0) AS total_amount
          FROM insurance_rejections
         GROUP BY rejection_reason ORDER BY count DESC LIMIT 10`),
      // Top rejected services
      pool.query(`
        SELECT service_code, description,
               COUNT(*) AS rejection_count,
               COALESCE(SUM(amount_rejected), 0) AS total_rejected
          FROM insurance_claim_items
         WHERE status = 'rejected' AND service_code IS NOT NULL
         GROUP BY service_code, description
         ORDER BY rejection_count DESC LIMIT 10`),
      // Urgent claims (overdue > 30 days)
      pool.query(`
        SELECT c.id, c.claim_number, c.status,
               COALESCE(c.amount_requested_num, c.amount_requested::NUMERIC) AS amount_requested,
               c.submitted_at,
               EXTRACT(DAY FROM NOW() - c.submitted_at) AS days_overdue,
               p.first_name || ' ' || p.last_name AS patient_name, p.mrn,
               io.name AS organization_name
          FROM insurance_claims c
          LEFT JOIN patients p ON p.id = c.patient_id
          LEFT JOIN insurance_organizations io ON io.id = c.organization_id
         WHERE c.submitted_at IS NOT NULL
           AND c.status NOT IN ('paid','rejected','cancelled')
           AND c.submitted_at < NOW() - INTERVAL '30 days'
           AND c.deleted_at IS NULL
         ORDER BY days_overdue DESC LIMIT 10`),
      // Expiring policies (next 30 days)
      pool.query(`
        SELECT ip.id, ip.policy_number, ip.valid_until,
               ip.valid_until - CURRENT_DATE AS days_until_expiry,
               p.first_name || ' ' || p.last_name AS patient_name, p.mrn,
               io.name AS organization_name
          FROM insurance_policies ip
          LEFT JOIN patients p ON p.id = ip.patient_id
          LEFT JOIN insurance_organizations io ON io.id = ip.organization_id
         WHERE ip.statut = 'active'
           AND ip.valid_until IS NOT NULL
           AND ip.valid_until BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
           AND ip.deleted_at IS NULL
         ORDER BY ip.valid_until LIMIT 20`),
      // Unpaid bordereaux
      pool.query(`
        SELECT b.id, b.bordereau_number, b.status, b.submitted_at,
               b.total_requested, b.total_approved, b.total_paid,
               io.name AS organization_name
          FROM insurance_bordereaux b
          LEFT JOIN insurance_organizations io ON io.id = b.organization_id
         WHERE b.status IN ('soumis','recu','en_cours','partiellement_paye')
           AND b.deleted_at IS NULL
         ORDER BY b.submitted_at NULLS LAST LIMIT 10`),
    ]);

    // Pending bordereaux count
    const { rows: [bordCount] } = await pool.query(`SELECT COUNT(*) AS pending_bordereaux FROM insurance_bordereaux WHERE status IN ('brouillon','pret','soumis','recu','en_cours','partiellement_paye') AND deleted_at IS NULL`);

    res.json({
      kpis: {
        ...kpis.rows[0],
        pending_bordereaux: bordCount.pending_bordereaux,
      },
      charts: {
        byOrganization: byOrg.rows,
        byStatus: byStatus.rows,
        monthlyPayments: monthlyPayments.rows,
        rejectionReasons: rejectionReasons.rows,
        topRejectedServices: topRejectedServices.rows,
      },
      widgets: {
        urgentClaims: urgentClaims.rows,
        expiringPolicies: expiringPolicies.rows,
        unpaidBordereaux: unpaidBordereaux.rows,
      },
    });
  } catch (err) { next(err); }
});

// GET /reports
router.get("/reports", requirePermission("insurance.reports.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const a = actor(req);
    const { organizationId, status, dateFrom, dateTo, type = "claims" } = req.query as Record<string, string>;
    const conds = ["c.deleted_at IS NULL"];
    const params: unknown[] = [];
    if (organizationId) { params.push(organizationId); conds.push(`c.organization_id = $${params.length}`); }
    if (status)         { params.push(status);         conds.push(`c.status = $${params.length}`); }
    if (dateFrom)       { params.push(dateFrom);       conds.push(`c.created_at >= $${params.length}`); }
    if (dateTo)         { params.push(dateTo);         conds.push(`c.created_at <= $${params.length}::timestamptz + INTERVAL '1 day'`); }

    let rows: unknown[] = [];
    if (type === "claims") {
      const result = await pool.query(
        `SELECT c.claim_number, c.status, c.submitted_at, c.created_at,
                COALESCE(c.amount_requested_num, c.amount_requested::NUMERIC) AS amount_requested,
                COALESCE(c.amount_approved_num,  c.amount_approved::NUMERIC)  AS amount_approved,
                c.amount_paid_num, c.amount_rejected, c.patient_share, c.rejection_reason,
                p.first_name || ' ' || p.last_name AS patient_name, p.mrn,
                i.invoice_number, i.total_amount AS invoice_total,
                io.name AS organization_name, io.code AS organization_code,
                b.bordereau_number
           FROM insurance_claims c
           LEFT JOIN patients p ON p.id=c.patient_id
           LEFT JOIN invoices i ON i.id=c.invoice_id
           LEFT JOIN insurance_organizations io ON io.id=c.organization_id
           LEFT JOIN insurance_bordereaux b ON b.id=c.bordereau_id
          WHERE ${conds.join(" AND ")}
          ORDER BY c.created_at DESC LIMIT 1000`,
        params,
      );
      rows = result.rows;
    } else if (type === "payments") {
      const result = await pool.query(
        `SELECT op.payment_number, op.amount, op.payment_date, op.method, op.bank_reference,
                io.name AS organization_name, b.bordereau_number
           FROM insurance_org_payments op
           LEFT JOIN insurance_organizations io ON io.id=op.organization_id
           LEFT JOIN insurance_bordereaux b ON b.id=op.bordereau_id
          WHERE op.deleted_at IS NULL ORDER BY op.payment_date DESC LIMIT 1000`,
      );
      rows = result.rows;
    }

    await auditService.logActivity({ module: "system", action: "export", resourceType: "InsuranceReport", description: `Export rapport assurance type=${type}` }, a);
    res.json({ type, count: rows.length, data: rows });
  } catch (err) { next(err); }
});

export default router;
