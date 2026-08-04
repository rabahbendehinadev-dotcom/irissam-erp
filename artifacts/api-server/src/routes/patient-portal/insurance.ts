/**
 * Patient Portal — Insurance
 * GET /patient-portal/insurance
 */
import { Router } from "express";
import type { Response } from "express";
import { pool } from "@workspace/db";
import { requirePatientAuth, type PatientRequest } from "../../middleware/requirePatientAuth.js";

const router = Router();

router.get("/", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId } = req.patient!;
  try {
    const [insuranceRes, claimsRes] = await Promise.all([
      pool.query(
        `SELECT
           ip.id, ip.insurer_name,
           OVERLAY(COALESCE(ip.numero_adherent, ip.subscriber_number,'') PLACING '****'
             FROM 1 FOR GREATEST(0, LENGTH(COALESCE(ip.numero_adherent, ip.subscriber_number,''))-4))
             AS member_number_masked,
           ip.valid_until AS expiry_date,
           ip.is_active AS active,
           ip.coverage_percent,
           ip.ceiling_amount,
           (ip.ceiling_amount - ip.plafond_consomme) AS remaining_ceiling,
           ip.coverage_type
         FROM insurance_policies ip
         WHERE ip.patient_id=$1
         ORDER BY ip.is_active DESC, ip.created_at DESC`,
        [patientId],
      ),
      pool.query(
        `SELECT ic.id, ic.claim_number, ic.status,
                ic.amount_requested AS total_amount,
                ic.amount_approved AS covered_amount,
                ic.rejection_reason, ic.created_at
         FROM insurance_claims ic
         WHERE ic.patient_id=$1
         ORDER BY ic.created_at DESC
         LIMIT 50`,
        [patientId],
      ),
    ]);

    const claimCounts = claimsRes.rows.reduce(
      (acc: Record<string, number>, c) => {
        acc[c.status as string] = (acc[c.status as string] ?? 0) + 1;
        return acc;
      },
      {},
    );

    res.json({
      insurance: insuranceRes.rows[0] ?? null,
      allPolicies: insuranceRes.rows,
      claims: claimsRes.rows,
      claimSummary: claimCounts,
    });
  } catch (err) {
    console.error("[portal/insurance]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
