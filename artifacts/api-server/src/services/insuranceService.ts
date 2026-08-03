/**
 * InsuranceService
 *
 * Business logic for Insurance / Tiers payant module.
 * All financial operations run inside PostgreSQL transactions with full rollback.
 * Audit logged on every write operation.
 */
import { pool } from "@workspace/db";

// Minimal client interface — avoids importing pg directly
interface PgClient {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string, values?: unknown[]
  ): Promise<{ rows: R[]; rowCount: number | null }>;
  release(): void;
}
import { auditService } from "./audit";
import type { ActorCtx } from "../repositories/types";
import { coverageEngine, type CoveragePolicy, type ServiceItem } from "./insuranceCoverageEngine";

// ─── Helper ───────────────────────────────────────────────────────────────────

async function withTransaction<T>(
  fn: (client: PgClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect() as unknown as PgClient;
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function genClaimNumber(client: PgClient): Promise<string> {
  return client
    .query(`SELECT 'CLM-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('claim_number_seq')::TEXT, 6, '0') AS num`)
    .then((r) => r.rows[0].num as string);
}

// ─── InsuranceService ─────────────────────────────────────────────────────────

export class InsuranceService {
  // ── Create claim from invoice ─────────────────────────────────────────────

  async createClaimFromInvoice(
    input: {
      invoiceId: string;
      patientId: string;
      policyId: string;
      organizationId: string;
      notes?: string;
    },
    actor: ActorCtx,
  ) {
    return withTransaction(async (client) => {
      // 1. Load policy (must be active, not expired)
      const { rows: [policy] } = await client.query(
        `SELECT ip.*, io.name AS org_name
           FROM insurance_policies ip
           LEFT JOIN insurance_organizations io ON io.id = ip.organization_id
          WHERE ip.id = $1 AND ip.deleted_at IS NULL`,
        [input.policyId],
      );
      if (!policy) throw Object.assign(new Error("Police introuvable"), { status: 404 });
      if (policy.statut === "expiree" || (policy.valid_until && new Date(String(policy.valid_until)) < new Date())) {
        throw Object.assign(new Error("Cette police d'assurance est expirée"), { status: 422 });
      }
      if (policy.statut !== "active") {
        throw Object.assign(new Error(`Police non active (statut: ${policy.statut})`), { status: 422 });
      }

      // 2. Load invoice with items
      const { rows: [invoice] } = await client.query(
        `SELECT * FROM invoices WHERE id = $1`,
        [input.invoiceId],
      );
      if (!invoice) throw Object.assign(new Error("Facture introuvable"), { status: 404 });

      const { rows: invoiceItems } = await client.query(
        `SELECT * FROM invoice_items WHERE invoice_id = $1`,
        [input.invoiceId],
      );

      // 3. Calculate coverage
      const policyData: CoveragePolicy = {
        coveragePercent: Number(policy.coverage_percent_num ?? policy.coverage_percent ?? 80),
        ceilingAmount: policy.ceiling_amount_num ? Number(policy.ceiling_amount_num) : null,
        ceilingConsumed: Number(policy.plafond_consomme ?? 0),
        ticketModerateur: Number(policy.ticket_moderateur_percent ?? 0),
        franchiseAmount: Number(policy.franchise_amount ?? 0),
        excludedServices: [],
        coveredServices: null,
        tarifsConventionnes: null,
        maxActsPerYear: null,
        requiresPriorAuth: false,
        waitingPeriodDays: 0,
        policyStartDate: policy.valid_from ? new Date(String(policy.valid_from)) : null,
      };

      // Load plan rules if available
      if (policy.plan_id) {
        const { rows: [plan] } = await client.query(
          `SELECT * FROM insurance_plans WHERE id = $1`,
          [policy.plan_id],
        );
        if (plan) {
          policyData.coveragePercent    = Number(plan.coverage_percent           ?? policyData.coveragePercent);
          // Policy-specific ceiling takes precedence; plan ceiling is only a fallback
          if (policyData.ceilingAmount == null && plan.annual_ceiling) {
            policyData.ceilingAmount = Number(plan.annual_ceiling);
          }
          policyData.ticketModerateur   = Number(plan.ticket_moderateur_percent  ?? 0);
          policyData.franchiseAmount    = Number(plan.franchise_amount           ?? 0);
          policyData.excludedServices   = (plan.excluded_services as string[])   ?? [];
          policyData.coveredServices    = (plan.covered_services  as string[] | null) ?? null;
          policyData.tarifsConventionnes = (plan.tarifs_conventionnes as Record<string, number> | null) ?? null;
          policyData.maxActsPerYear     = plan.max_acts_per_year  != null ? Number(plan.max_acts_per_year) : null;
          policyData.requiresPriorAuth  = Boolean(plan.requires_prior_auth ?? false);
          policyData.waitingPeriodDays  = Number(plan.waiting_period_days  ?? 0);
        }
      }

      const services: ServiceItem[] = invoiceItems.map((item: Record<string, unknown>) => ({
        serviceCode: (item.service_code as string) ?? "DIVERS",
        description: (item.description as string) ?? "",
        amountBilled: Number(item.total_price ?? item.unit_price ?? 0),
        quantity: Number(item.quantity ?? 1),
      }));

      const coverage = coverageEngine.calculate(policyData, services);

      // 4. Check plafond
      const plafondCheck = coverageEngine.checkPlafond(
        policyData.ceilingAmount,
        policyData.ceilingConsumed,
        coverage.partOrganisme,
      );

      // 5. Create claim
      const claimNumber = await genClaimNumber(client);
      const { rows: [claim] } = await client.query(
        `INSERT INTO insurance_claims (
           claim_number, invoice_id, patient_id, policy_id,
           organization_id, insurer_name,
           amount_requested, amount_requested_num,
           patient_share, amount_rejected,
           amount_paid_num, status,
           notes, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,0,'draft',$10,$11)
         RETURNING *`,
        [
          claimNumber, input.invoiceId, input.patientId, input.policyId,
          input.organizationId,
          policy.org_name ?? policy.insurer_name ?? "Organisme",
          coverage.partOrganisme,           // REAL column (backward compat)
          coverage.partOrganismeStr,        // NUMERIC column
          coverage.partPatientStr,          // patient_share
          input.notes ?? null, actor.userId,
        ],
      );

      // 6. Create claim items
      for (const svcResult of coverage.services) {
        const invoiceItem = invoiceItems.find(
          (i: Record<string, unknown>) => (i.service_code as string) === svcResult.serviceCode,
        );
        await client.query(
          `INSERT INTO insurance_claim_items (
             claim_id, invoice_item_id, service_code, description,
             amount_billed, amount_requested, amount_approved, amount_rejected,
             rejection_reason, status, created_by
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            claim.id,
            invoiceItem?.id ?? null,
            svcResult.serviceCode,
            svcResult.description,
            svcResult.amountBilled.toFixed(2),
            svcResult.covered ? svcResult.amountOrganisme.toFixed(2) : "0.00",
            svcResult.covered ? svcResult.amountOrganisme.toFixed(2) : null,
            svcResult.covered ? "0.00" : svcResult.amountBilled.toFixed(2),
            svcResult.exclusionReason,
            svcResult.covered ? "pending" : "rejected",
            actor.userId,
          ],
        );
      }

      // 7. Update invoice with insurance shares
      await client.query(
        `UPDATE invoices
           SET insurer_share    = $1,
               patient_share    = $2,
               remaining_amount = GREATEST(0, total_amount - $2),
               updated_at       = NOW()
         WHERE id = $3`,
        [coverage.partOrganismeStr, coverage.partPatientStr, input.invoiceId],
      );

      await auditService.log({
        module: "system", action: "create",
        resourceType: "InsuranceClaim", resourceId: claim.id as string,
        patientId: input.patientId,
        newValue: { claimNumber, partOrganisme: coverage.partOrganismeStr, partPatient: coverage.partPatientStr },
      }, actor);

      return { claim, coverage, plafondCheck };
    });
  }

  // ── Partial approval ──────────────────────────────────────────────────────

  async approvePartial(
    claimId: string,
    items: Array<{ itemId: string; amountApproved: number; notes?: string }>,
    actor: ActorCtx,
  ) {
    return withTransaction(async (client) => {
      const { rows: [claim] } = await client.query(
        `SELECT * FROM insurance_claims WHERE id = $1 AND deleted_at IS NULL`,
        [claimId],
      );
      if (!claim) throw Object.assign(new Error("Dossier introuvable"), { status: 404 });
      if (!["submitted", "under_review", "draft"].includes(claim.status as string)) {
        throw Object.assign(new Error("Ce dossier ne peut pas être approuvé dans son statut actuel"), { status: 422 });
      }

      let totalApproved = 0;
      let totalRejected = 0;

      for (const item of items) {
        const approved = Math.round(item.amountApproved * 100) / 100;
        await client.query(
          `UPDATE insurance_claim_items
             SET amount_approved = $1,
                 amount_rejected = GREATEST(0, amount_requested - $1),
                 status = CASE WHEN $1 = 0 THEN 'rejected'
                               WHEN $1 >= amount_requested THEN 'approved'
                               ELSE 'partially_approved' END,
                 rejection_reason = CASE WHEN $1 = 0 THEN $2 ELSE rejection_reason END,
                 updated_by = $3, updated_at = NOW()
           WHERE id = $4 AND claim_id = $5`,
          [approved.toFixed(2), item.notes ?? "Montant réduit", actor.userId, item.itemId, claimId],
        );
        const { rows: [updatedItem] } = await client.query(
          `SELECT amount_approved, amount_rejected FROM insurance_claim_items WHERE id = $1`,
          [item.itemId],
        );
        totalApproved += Number(updatedItem.amount_approved ?? 0);
        totalRejected += Number(updatedItem.amount_rejected ?? 0);
      }

      totalApproved = Math.round(totalApproved * 100) / 100;
      totalRejected = Math.round(totalRejected * 100) / 100;

      // Determine claim status
      const { rows: allItems } = await client.query(
        `SELECT status FROM insurance_claim_items WHERE claim_id = $1`,
        [claimId],
      );
      const statuses = allItems.map((i: Record<string, unknown>) => i.status as string);
      let newStatus = "partially_approved";
      if (statuses.every((s) => s === "approved")) newStatus = "approved";
      if (statuses.every((s) => s === "rejected")) newStatus = "rejected";

      const { rows: [updatedClaim] } = await client.query(
        `UPDATE insurance_claims
           SET status = $1,
               amount_approved = $2, amount_approved_num = $3,
               amount_rejected = $4,
               patient_share = patient_share + $4,
               decision_date = NOW(), decision_by = $5,
               updated_by = $5, updated_at = NOW(), version = version + 1
         WHERE id = $6 RETURNING *`,
        [newStatus, totalApproved, totalApproved.toFixed(2), totalRejected.toFixed(2), actor.userId, claimId],
      );

      // Record approval
      await client.query(
        `INSERT INTO insurance_approvals (claim_id, approval_type, approved_amount, approved_by, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [claimId, newStatus === "approved" ? "full" : "partial", totalApproved.toFixed(2), actor.userId, null],
      );

      await auditService.log({
        module: "system", action: "update",
        resourceType: "InsuranceClaim", resourceId: claimId,
        newValue: { status: newStatus, totalApproved, totalRejected },
      }, actor);

      return updatedClaim;
    });
  }

  // ── Reject claim ──────────────────────────────────────────────────────────

  async rejectClaim(
    claimId: string,
    reason: string,
    actor: ActorCtx,
  ) {
    if (!reason?.trim()) {
      throw Object.assign(new Error("Le motif de rejet est obligatoire"), { status: 400 });
    }
    return withTransaction(async (client) => {
      const { rows: [claim] } = await client.query(
        `SELECT * FROM insurance_claims WHERE id = $1 AND deleted_at IS NULL`,
        [claimId],
      );
      if (!claim) throw Object.assign(new Error("Dossier introuvable"), { status: 404 });

      const totalRequested = Number(claim.amount_requested_num ?? claim.amount_requested ?? 0);

      const { rows: [updated] } = await client.query(
        `UPDATE insurance_claims
           SET status = 'rejected',
               rejection_reason = $1,
               amount_rejected = $2,
               decision_date = NOW(), decision_by = $3,
               updated_by = $3, updated_at = NOW(), version = version + 1
         WHERE id = $4 RETURNING *`,
        [reason, totalRequested.toFixed(2), actor.userId, claimId],
      );

      // Mark all pending items as rejected
      await client.query(
        `UPDATE insurance_claim_items
           SET status = 'rejected', rejection_reason = $1, updated_by = $2, updated_at = NOW()
         WHERE claim_id = $3 AND status = 'pending'`,
        [reason, actor.userId, claimId],
      );

      // Record rejection
      await client.query(
        `INSERT INTO insurance_rejections (claim_id, rejection_type, rejection_reason, rejected_amount, created_by)
         VALUES ($1, 'complete', $2, $3, $4)`,
        [claimId, reason, totalRequested.toFixed(2), actor.userId],
      );

      await auditService.log({
        module: "system", action: "update",
        resourceType: "InsuranceClaim", resourceId: claimId,
        newValue: { status: "rejected", reason },
      }, actor);

      return updated;
    });
  }

  // ── Add claims to bordereau ───────────────────────────────────────────────

  async addClaimsToBordereau(
    bordereauId: string,
    claimIds: string[],
    actor: ActorCtx,
  ) {
    return withTransaction(async (client) => {
      const { rows: [bordereau] } = await client.query(
        `SELECT * FROM insurance_bordereaux WHERE id = $1 AND deleted_at IS NULL`,
        [bordereauId],
      );
      if (!bordereau) throw Object.assign(new Error("Bordereau introuvable"), { status: 404 });
      if (["soumis", "paye"].includes(bordereau.status as string)) {
        throw Object.assign(new Error("Ce bordereau est déjà soumis"), { status: 422 });
      }

      const added: string[] = [];
      const duplicates: string[] = [];

      for (const claimId of claimIds) {
        // Check claim is not already in ANY active bordereau
        const { rows: existing } = await client.query(
          `SELECT bi.bordereau_id FROM insurance_bordereau_items bi
             JOIN insurance_bordereaux b ON b.id = bi.bordereau_id
            WHERE bi.claim_id = $1
              AND b.status NOT IN ('paye', 'rejete')
              AND b.deleted_at IS NULL`,
          [claimId],
        );
        if (existing.length > 0) {
          duplicates.push(claimId);
          continue;
        }

        await client.query(
          `INSERT INTO insurance_bordereau_items (bordereau_id, claim_id, added_by)
           VALUES ($1, $2, $3)
           ON CONFLICT (bordereau_id, claim_id) DO NOTHING`,
          [bordereauId, claimId, actor.userId],
        );

        // Link claim → bordereau
        await client.query(
          `UPDATE insurance_claims SET bordereau_id = $1 WHERE id = $2`,
          [bordereauId, claimId],
        );
        added.push(claimId);
      }

      // Recalculate bordereau totals
      await client.query(
        `UPDATE insurance_bordereaux
           SET claim_count    = (SELECT COUNT(*) FROM insurance_bordereau_items WHERE bordereau_id = $1),
               total_requested = (
                 SELECT COALESCE(SUM(COALESCE(c.amount_requested_num, c.amount_requested::NUMERIC)), 0)
                   FROM insurance_bordereau_items bi
                   JOIN insurance_claims c ON c.id = bi.claim_id
                  WHERE bi.bordereau_id = $1
               ),
               updated_by = $2, updated_at = NOW(), version = version + 1
         WHERE id = $1`,
        [bordereauId, actor.userId],
      );

      await auditService.log({
        module: "system", action: "update",
        resourceType: "InsuranceBordereau", resourceId: bordereauId,
        newValue: { added, duplicates },
      }, actor);

      if (duplicates.length > 0 && added.length === 0) {
        throw Object.assign(
          new Error("Ces dossiers sont déjà dans un bordereau actif"),
          { status: 409, duplicates },
        );
      }

      return { added, duplicates };
    });
  }

  // ── Register organisation payment ─────────────────────────────────────────

  async registerOrgPayment(
    input: {
      organizationId: string;
      bordereauId?: string;
      claimId?: string;
      amount: number;
      paymentDate: string;
      method: string;
      bankReference?: string;
      notes?: string;
    },
    actor: ActorCtx,
  ) {
    return withTransaction(async (client) => {
      // Generate payment number
      const { rows: [numRow] } = await client.query(
        `SELECT 'ORG-PAY-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('org_payment_number_seq')::TEXT, 6, '0') AS num`,
      );

      const { rows: [payment] } = await client.query(
        `INSERT INTO insurance_org_payments (
           payment_number, organization_id, bordereau_id, claim_id,
           amount, payment_date, method, bank_reference, notes,
           received_by, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          numRow.num, input.organizationId, input.bordereauId ?? null, input.claimId ?? null,
          input.amount.toFixed(2), input.paymentDate, input.method,
          input.bankReference ?? null, input.notes ?? null,
          actor.userId, actor.userId,
        ],
      );

      // Distribute payment across claims
      let remaining = Math.round(input.amount * 100) / 100;

      // Validate amount > 0
      if (input.amount <= 0) {
        throw Object.assign(new Error("Le montant doit être positif"), { status: 400 });
      }

      if (input.bordereauId) {
        // Lock all unpaid/partially-paid claims in this bordereau to prevent concurrent payments
        const { rows: claims } = await client.query(
          `SELECT c.id,
                  COALESCE(c.amount_approved_num, c.amount_approved::NUMERIC, 0) AS approved,
                  c.amount_paid_num
             FROM insurance_bordereau_items bi
             JOIN insurance_claims c ON c.id = bi.claim_id
            WHERE bi.bordereau_id = $1
              AND c.status NOT IN ('paid')
            ORDER BY c.created_at
            FOR UPDATE OF c`,
          [input.bordereauId],
        );

        for (const clm of claims) {
          if (remaining <= 0) break;
          const approved = Math.round(Number(clm.approved) * 100) / 100;
          const alreadyPaid = Math.round(Number(clm.amount_paid_num ?? 0) * 100) / 100;
          const owedToThisClaim = Math.round((approved - alreadyPaid) * 100) / 100;
          if (owedToThisClaim <= 0) continue;

          const toApply = Math.min(remaining, owedToThisClaim);
          const newPaid = Math.round((alreadyPaid + toApply) * 100) / 100;
          remaining = Math.round((remaining - toApply) * 100) / 100;

          const newStatus = newPaid >= approved ? "paid" : "partially_paid";

          await client.query(
            `UPDATE insurance_claims
               SET amount_paid = $1, amount_paid_num = $2,
                   status = $3,
                   paid_at = CASE WHEN $3 = 'paid' THEN NOW() ELSE paid_at END,
                   updated_by = $4, updated_at = NOW(), version = version + 1
             WHERE id = $5`,
            [newPaid, newPaid.toFixed(2), newStatus, actor.userId, clm.id],
          );

          // Update invoice insurer share paid
          await client.query(
            `UPDATE invoices
               SET paid_amount     = paid_amount + $1,
                   remaining_amount = GREATEST(0, remaining_amount - $1),
                   status = (CASE
                     WHEN (remaining_amount - $1) <= 0.01 THEN 'paid'
                     ELSE 'partially_paid'
                   END)::invoice_status,
                   updated_at = NOW()
             WHERE id = (SELECT invoice_id FROM insurance_claims WHERE id = $2)`,
            [toApply, clm.id],
          );
        }

        // Update bordereau totals
        await client.query(
          `UPDATE insurance_bordereaux
             SET total_paid = (
                   SELECT COALESCE(SUM(c.amount_paid_num), 0)
                     FROM insurance_bordereau_items bi
                     JOIN insurance_claims c ON c.id = bi.claim_id
                    WHERE bi.bordereau_id = $1
                 ),
                 status = CASE
                   WHEN (SELECT COUNT(*) FROM insurance_bordereau_items bi
                           JOIN insurance_claims c ON c.id = bi.claim_id
                          WHERE bi.bordereau_id = $1 AND c.status != 'paid') = 0 THEN 'paye'
                   ELSE 'partiellement_paye'
                 END,
                 updated_by = $2, updated_at = NOW()
           WHERE id = $1`,
          [input.bordereauId, actor.userId],
        );
      } else if (input.claimId) {
        // Direct claim payment — lock claim row to prevent concurrent payments
        const { rows: [clm] } = await client.query(
          `SELECT id, status,
                  COALESCE(amount_approved_num, amount_approved::NUMERIC, 0) AS approved,
                  COALESCE(amount_paid_num, 0) AS already_paid,
                  invoice_id
             FROM insurance_claims WHERE id = $1
             FOR UPDATE`,
          [input.claimId],
        );
        if (!clm) throw Object.assign(new Error("Sinistre introuvable"), { status: 404 });
        if (clm.status === "paid") {
          throw Object.assign(new Error("Ce sinistre est déjà entièrement payé"), {
            status: 409, code: "OVERPAYMENT",
            amountRequested: input.amount, remainingAmount: 0,
            entityType: "insurance_claim", entityId: input.claimId,
          });
        }

        const approved    = Math.round(Number(clm.approved)     * 100) / 100;
        const alreadyPaid = Math.round(Number(clm.already_paid) * 100) / 100;
        const owed        = Math.round((approved - alreadyPaid) * 100) / 100;

        if (remaining > owed + 0.01) {
          throw Object.assign(
            new Error(`Le montant (${remaining.toFixed(2)}) dépasse le reste approuvé (${owed.toFixed(2)} DZD)`),
            { status: 409, code: "OVERPAYMENT",
              amountRequested: remaining, remainingAmount: owed,
              entityType: "insurance_claim", entityId: input.claimId },
          );
        }

        const toApply  = Math.min(remaining, owed);
        const newPaid  = Math.round((alreadyPaid + toApply) * 100) / 100;
        const newStatus = newPaid >= approved ? "paid" : "partially_paid";

        await client.query(
          `UPDATE insurance_claims
             SET amount_paid = $1, amount_paid_num = $2,
                 status = $3,
                 paid_at = CASE WHEN $3 = 'paid' THEN NOW() ELSE paid_at END,
                 updated_by = $4, updated_at = NOW(), version = version + 1
           WHERE id = $5`,
          [newPaid, newPaid.toFixed(2), newStatus, actor.userId, input.claimId],
        );

        // Lock invoice row then update insurer share paid
        if (clm.invoice_id) {
          await client.query(`SELECT id FROM invoices WHERE id = $1 FOR UPDATE`, [clm.invoice_id]);
        }
        await client.query(
          `UPDATE invoices
             SET paid_amount      = paid_amount + $1,
                 remaining_amount = GREATEST(0, remaining_amount - $1),
                 status = (CASE
                   WHEN (remaining_amount - $1) <= 0.01 THEN 'paid'
                   ELSE 'partially_paid'
                 END)::invoice_status,
                 updated_at = NOW()
           WHERE id = (SELECT invoice_id FROM insurance_claims WHERE id = $2)`,
          [toApply, input.claimId],
        );
      }

      await auditService.log({
        module: "system", action: "create",
        resourceType: "InsuranceOrgPayment", resourceId: payment.id as string,
        newValue: { amount: input.amount, method: input.method, orgId: input.organizationId },
      }, actor);

      return payment;
    });
  }

  // ── Transfer rejected amount to patient ───────────────────────────────────

  async transferRejectedToPatient(claimId: string, actor: ActorCtx) {
    return withTransaction(async (client) => {
      const { rows: [claim] } = await client.query(
        `SELECT * FROM insurance_claims WHERE id = $1 AND deleted_at IS NULL`,
        [claimId],
      );
      if (!claim) throw Object.assign(new Error("Dossier introuvable"), { status: 404 });
      if (!["rejected", "partially_approved"].includes(claim.status as string)) {
        throw Object.assign(new Error("Transfert possible seulement sur dossier rejeté ou partiellement approuvé"), { status: 422 });
      }

      const rejectedAmount = Number(claim.amount_rejected ?? 0);
      if (rejectedAmount <= 0) throw Object.assign(new Error("Aucun montant rejeté à transférer"), { status: 422 });

      // Transfer rejected amount to patient share
      await client.query(
        `UPDATE insurance_claims
           SET patient_share = patient_share + $1,
               updated_by = $2, updated_at = NOW(), version = version + 1
         WHERE id = $3`,
        [rejectedAmount.toFixed(2), actor.userId, claimId],
      );

      // Update invoice: patient share increases
      await client.query(
        `UPDATE invoices
           SET patient_share = patient_share + $1,
               insurer_share = GREATEST(0, insurer_share - $1),
               updated_at = NOW()
         WHERE id = $2`,
        [rejectedAmount.toFixed(2), claim.invoice_id],
      );

      // Record transfer in rejections table
      await client.query(
        `UPDATE insurance_rejections
           SET transfer_to_patient = TRUE,
               transfer_approved_by = $1,
               transfer_approved_at = NOW()
         WHERE claim_id = $2 AND transfer_to_patient = FALSE`,
        [actor.userId, claimId],
      );

      await auditService.log({
        module: "system", action: "update",
        resourceType: "InsuranceClaim", resourceId: claimId,
        newValue: { action: "transfer_rejected_to_patient", amount: rejectedAmount },
      }, actor);

      return { transferred: rejectedAmount };
    });
  }
}

export const insuranceService = new InsuranceService();
