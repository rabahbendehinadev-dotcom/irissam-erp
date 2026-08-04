/**
 * Patient Portal — Sessions (Device management)
 * GET    /patient-portal/sessions
 * DELETE /patient-portal/sessions/:id
 */
import { Router } from "express";
import type { Response } from "express";
import { pool } from "@workspace/db";
import { requirePatientAuth, type PatientRequest } from "../../middleware/requirePatientAuth.js";

const router = Router();

router.get("/", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { accountId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT id, ip, user_agent, expires_at, created_at,
              (revoked_at IS NOT NULL OR expires_at < now()) AS revoked
       FROM patient_portal_sessions
       WHERE account_id=$1
       ORDER BY created_at DESC
       LIMIT 50`,
      [accountId],
    );
    res.json({ sessions: rows });
  } catch (err) {
    console.error("[portal/sessions]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.delete("/:id", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { accountId, patientId } = req.patient!;
  try {
    const { rowCount } = await pool.query(
      `UPDATE patient_portal_sessions SET revoked_at=now()
       WHERE id=$1 AND account_id=$2 AND revoked_at IS NULL`,
      [req.params.id, accountId],
    );
    if (!rowCount) {
      res.status(404).json({ message: "Session introuvable." });
      return;
    }
    await pool.query(
      `INSERT INTO patient_portal_access_logs (account_id,patient_id,action,ip)
       VALUES ($1,$2,'revoke_session',$3)`,
      [accountId, patientId, req.ip ?? null],
    ).catch(() => {});
    res.json({ message: "Session révoquée." });
  } catch (err) {
    console.error("[portal/sessions/:id]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
