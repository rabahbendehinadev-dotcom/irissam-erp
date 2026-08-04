/**
 * Patient Portal — Notifications
 * GET  /patient-portal/notifications
 * POST /patient-portal/notifications/:id/read
 * POST /patient-portal/notifications/read-all
 */
import { Router } from "express";
import type { Response } from "express";
import { pool } from "@workspace/db";
import { requirePatientAuth, type PatientRequest } from "../../middleware/requirePatientAuth.js";

const router = Router();

router.get("/", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { accountId } = req.patient!;
  const { unreadOnly } = req.query as { unreadOnly?: string };
  try {
    const { rows } = await pool.query(
      `SELECT id, type, title, body, link, read, read_at, created_at
       FROM patient_portal_notifications
       WHERE account_id=$1
         ${unreadOnly === "true" ? "AND read=FALSE" : ""}
       ORDER BY created_at DESC
       LIMIT 100`,
      [accountId],
    );
    const unreadCount = rows.filter(r => !r.read).length;
    res.json({ notifications: rows, unreadCount });
  } catch (err) {
    console.error("[portal/notifications]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.post("/:id/read", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { accountId } = req.patient!;
  try {
    await pool.query(
      `UPDATE patient_portal_notifications
       SET read=TRUE, read_at=now()
       WHERE id=$1 AND account_id=$2`,
      [req.params.id, accountId],
    );
    res.json({ message: "Notification marquée comme lue." });
  } catch (err) {
    console.error("[portal/notifications/:id/read]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.post("/read-all", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { accountId } = req.patient!;
  try {
    await pool.query(
      `UPDATE patient_portal_notifications
       SET read=TRUE, read_at=now()
       WHERE account_id=$1 AND read=FALSE`,
      [accountId],
    );
    res.json({ message: "Toutes les notifications lues." });
  } catch (err) {
    console.error("[portal/notifications/read-all]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
