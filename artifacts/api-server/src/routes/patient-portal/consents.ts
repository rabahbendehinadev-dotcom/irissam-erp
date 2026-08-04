/**
 * Patient Portal — Consents
 * GET  /patient-portal/consents
 * POST /patient-portal/consents/:id/sign
 * POST /patient-portal/consents/:id/refuse
 */
import crypto from "node:crypto";
import { Router } from "express";
import type { Response } from "express";
import { pool } from "@workspace/db";
import { requirePatientAuth, type PatientRequest } from "../../middleware/requirePatientAuth.js";

const router = Router();

async function auditLog(accountId: string, patientId: string, action: string, resId: string, ip: string | undefined) {
  try {
    await pool.query(
      `INSERT INTO patient_portal_access_logs (account_id,patient_id,action,resource,resource_id,ip)
       VALUES ($1,$2,$3,'consent',$4::uuid,$5)`,
      [accountId, patientId, action, resId, ip ?? null],
    );
  } catch { /* non-blocking */ }
}

router.get("/", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { accountId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT id, title, description, document_url, status,
              signed_at, refused_at, refusal_reason, expires_at, created_at
       FROM patient_portal_consents
       WHERE account_id=$1
       ORDER BY created_at DESC`,
      [accountId],
    );
    res.json({ consents: rows });
  } catch (err) {
    console.error("[portal/consents]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.post("/:id/sign", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { accountId, patientId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT id, document_url, document_hash, status
       FROM patient_portal_consents
       WHERE id=$1 AND account_id=$2`,
      [req.params.id, accountId],
    );
    if (!rows[0]) {
      res.status(404).json({ message: "Consentement introuvable." });
      return;
    }
    if (rows[0].status !== "pending") {
      res.status(400).json({ message: "Ce consentement ne peut plus être signé." });
      return;
    }
    // Compute signature record (internal — not a legal eSignature)
    const signatureData = JSON.stringify({
      consentId: req.params.id,
      patientId,
      accountId,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.headers["user-agent"] ?? "",
      documentHash: rows[0].document_hash ?? "",
    });
    const signatureHash = crypto.createHash("sha256").update(signatureData).digest("hex");

    await pool.query(
      `UPDATE patient_portal_consents
       SET status='signed', signed_at=now(), ip=$1, user_agent=$2,
           document_hash=$3, updated_at=now()
       WHERE id=$4`,
      [req.ip ?? null, req.headers["user-agent"] ?? null, signatureHash, req.params.id],
    );
    await auditLog(accountId, patientId, "sign_consent", req.params.id, req.ip);
    res.json({ message: "Consentement signé.", signatureHash });
  } catch (err) {
    console.error("[portal/consents/:id/sign]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.post("/:id/refuse", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { accountId, patientId } = req.patient!;
  const { reason } = req.body ?? {};
  try {
    const { rows } = await pool.query(
      `UPDATE patient_portal_consents
       SET status='refused', refused_at=now(), refusal_reason=$1,
           ip=$2, user_agent=$3, updated_at=now()
       WHERE id=$4 AND account_id=$5 AND status='pending'
       RETURNING id`,
      [reason ?? null, req.ip ?? null, req.headers["user-agent"] ?? null, req.params.id, accountId],
    );
    if (!rows[0]) {
      res.status(404).json({ message: "Consentement introuvable ou déjà traité." });
      return;
    }
    await auditLog(accountId, patientId, "refuse_consent", req.params.id, req.ip);
    res.json({ message: "Refus enregistré." });
  } catch (err) {
    console.error("[portal/consents/:id/refuse]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
