/**
 * Patient Portal — Privacy & Security
 * GET  /patient-portal/privacy/activity-log
 * POST /patient-portal/privacy/change-password
 * POST /patient-portal/privacy/request-data-export
 * POST /patient-portal/privacy/request-correction
 * POST /patient-portal/privacy/request-account-closure
 */
import { Router } from "express";
import type { Response } from "express";
import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";
import { requirePatientAuth, type PatientRequest } from "../../middleware/requirePatientAuth.js";

const router = Router();

// Activity log
router.get("/activity-log", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { accountId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT id, action, resource, ip, success, created_at
       FROM patient_portal_access_logs
       WHERE account_id=$1
       ORDER BY created_at DESC
       LIMIT 100`,
      [accountId],
    );
    res.json({ activities: rows });
  } catch (err) {
    console.error("[portal/privacy/activity-log]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// Change password
router.post("/change-password", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { accountId, patientId } = req.patient!;
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    res.status(400).json({ message: "Mot de passe actuel et nouveau mot de passe requis." });
    return;
  }
  try {
    const { rows } = await pool.query(
      `SELECT password_hash FROM patient_portal_accounts WHERE id=$1 AND deleted_at IS NULL`,
      [accountId],
    );
    if (!rows[0]) {
      res.status(404).json({ message: "Compte introuvable." });
      return;
    }
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash ?? "");
    if (!valid) {
      res.status(400).json({ message: "Mot de passe actuel incorrect." });
      return;
    }
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      `UPDATE patient_portal_accounts
       SET password_hash=$1, force_password_change=FALSE, updated_at=now()
       WHERE id=$2`,
      [hash, accountId],
    );
    await pool.query(
      `INSERT INTO patient_portal_access_logs (account_id,patient_id,action,ip)
       VALUES ($1,$2,'change_password',$3)`,
      [accountId, patientId, req.ip ?? null],
    ).catch(() => {});
    res.json({ message: "Mot de passe modifié." });
  } catch (err) {
    console.error("[portal/privacy/change-password]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// Request data export
router.post("/request-data-export", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { accountId, patientId } = req.patient!;
  try {
    await pool.query(
      `INSERT INTO patient_portal_messages
         (account_id, patient_id, type, subject, body, status)
       VALUES ($1,$2,'administrative','Demande d''export de données personnelles',
               'Le patient demande une copie de ses données personnelles.',
               'open')`,
      [accountId, patientId],
    );
    res.json({ message: "Demande enregistrée. Vous serez contacté dans 30 jours." });
  } catch (err) {
    console.error("[portal/privacy/request-data-export]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// Request data correction
router.post("/request-correction", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { accountId, patientId } = req.patient!;
  const { field, currentValue, correctValue } = req.body ?? {};
  try {
    const body = `Champ: ${field ?? "non spécifié"}\nValeur actuelle: ${currentValue ?? ""}\nValeur correcte: ${correctValue ?? ""}`;
    await pool.query(
      `INSERT INTO patient_portal_messages
         (account_id, patient_id, type, subject, body, status)
       VALUES ($1,$2,'administrative','Demande de correction de données',$3,'open')`,
      [accountId, patientId, body],
    );
    res.json({ message: "Demande de correction enregistrée." });
  } catch (err) {
    console.error("[portal/privacy/request-correction]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// Request account closure (does NOT delete medical record)
router.post("/request-account-closure", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { accountId, patientId } = req.patient!;
  const { reason } = req.body ?? {};
  try {
    await pool.query(
      `UPDATE patient_portal_accounts SET status='archived', updated_at=now() WHERE id=$1`,
      [accountId],
    );
    // Revoke all active sessions
    await pool.query(
      `UPDATE patient_portal_sessions SET revoked_at=now()
       WHERE account_id=$1 AND revoked_at IS NULL`,
      [accountId],
    );
    await pool.query(
      `INSERT INTO patient_portal_messages
         (account_id, patient_id, type, subject, body, status)
       VALUES ($1,$2,'administrative','Demande de fermeture de compte',$3,'open')`,
      [accountId, patientId, reason ?? "Pas de raison fournie."],
    );
    await pool.query(
      `INSERT INTO patient_portal_access_logs (account_id,patient_id,action,ip)
       VALUES ($1,$2,'request_account_closure',$3)`,
      [accountId, patientId, req.ip ?? null],
    ).catch(() => {});
    res.json({ message: "Demande de fermeture enregistrée. Votre accès au portail est suspendu." });
  } catch (err) {
    console.error("[portal/privacy/request-account-closure]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
