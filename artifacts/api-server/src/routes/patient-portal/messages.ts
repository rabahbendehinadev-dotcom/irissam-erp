/**
 * Patient Portal — Secure Messaging (NOT for emergencies)
 * GET  /patient-portal/messages
 * POST /patient-portal/messages
 * GET  /patient-portal/messages/:id
 * POST /patient-portal/messages/:id/close
 */
import { Router } from "express";
import type { Response } from "express";
import { pool } from "@workspace/db";
import { requirePatientAuth, type PatientRequest } from "../../middleware/requirePatientAuth.js";

const router = Router();

async function auditLog(accountId: string, patientId: string, resId: string, ip: string | undefined) {
  try {
    await pool.query(
      `INSERT INTO patient_portal_access_logs (account_id,patient_id,action,resource,resource_id,ip)
       VALUES ($1,$2,'send_message','message',$3::uuid,$4)`,
      [accountId, patientId, resId, ip ?? null],
    );
  } catch { /* non-blocking */ }
}

router.get("/", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { accountId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT id, type, subject, status, reply, replied_at, created_at
       FROM patient_portal_messages
       WHERE account_id=$1
       ORDER BY created_at DESC`,
      [accountId],
    );
    res.json({ messages: rows });
  } catch (err) {
    console.error("[portal/messages]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.post("/", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { accountId, patientId } = req.patient!;
  const { type = "other", subject, body } = req.body ?? {};
  if (!subject || !body) {
    res.status(400).json({ message: "Sujet et message requis." });
    return;
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO patient_portal_messages (account_id, patient_id, type, subject, body)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, type, subject, status, created_at`,
      [accountId, patientId, type, subject, body],
    );
    await auditLog(accountId, patientId, rows[0].id, req.ip);
    res.status(201).json({ message: rows[0] });
  } catch (err) {
    console.error("[portal/messages POST]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.get("/:id", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { accountId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT id, type, subject, body, status, reply, replied_at, closed_at, created_at
       FROM patient_portal_messages
       WHERE id=$1 AND account_id=$2`,
      [req.params.id, accountId],
    );
    if (!rows[0]) {
      res.status(404).json({ message: "Message introuvable." });
      return;
    }
    res.json({ message: rows[0] });
  } catch (err) {
    console.error("[portal/messages/:id]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.post("/:id/close", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { accountId } = req.patient!;
  try {
    await pool.query(
      `UPDATE patient_portal_messages
       SET status='closed', closed_at=now(), updated_at=now()
       WHERE id=$1 AND account_id=$2`,
      [req.params.id, accountId],
    );
    res.json({ message: "Message fermé." });
  } catch (err) {
    console.error("[portal/messages/:id/close]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
