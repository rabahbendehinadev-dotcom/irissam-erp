/**
 * Doctor Portal — Internal Messages
 * GET  /messages        — inbox
 * POST /messages        — send
 * PATCH /messages/:id/read — mark as read
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission.js";
import type { AuthenticatedRequest } from "../../middleware/requireAuth.js";

const router = Router();

router.get("/", requirePermission("doctor_portal.messages.use"), async (req, res) => {
  const doctorId = (req as AuthenticatedRequest).auth!.userId;
  const { box = "inbox", page = "1", limit = "20" } = req.query as Record<string, string>;
  const cond = box === "sent" ? "dm.sender_id=$1" : "dm.recipient_id=$1";
  try {
    const result = await pool.query(
      `SELECT dm.*,
              s.first_name||' '||s.last_name AS sender_name, s.role AS sender_role,
              r.first_name||' '||r.last_name AS recipient_name
       FROM doctor_messages dm
       JOIN users s ON s.id=dm.sender_id
       JOIN users r ON r.id=dm.recipient_id
       WHERE ${cond}
       ORDER BY dm.created_at DESC LIMIT $2 OFFSET $3`,
      [doctorId, Number(limit), (Number(page)-1)*Number(limit)]
    );
    const unread = box === "inbox"
      ? await pool.query(`SELECT COUNT(*) FROM doctor_messages WHERE recipient_id=$1 AND is_read=false`, [doctorId])
      : null;
    res.json({ messages: result.rows, unread: unread ? Number(unread.rows[0].count) : 0 });
  } catch (err) {
    console.error("[dp/messages GET]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.post("/", requirePermission("doctor_portal.messages.use"), async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth!;
  const { recipientId, subject, body, patientId, encounterId } = req.body as Record<string, string>;
  if (!recipientId || !subject || !body) {
    res.status(400).json({ message: "recipientId, subject et body requis" });
    return;
  }
  try {
    const recipient = await pool.query(`SELECT id FROM users WHERE id=$1 AND is_active=true`, [recipientId]);
    if (!recipient.rowCount) { res.status(400).json({ message: "Destinataire introuvable" }); return; }
    const result = await pool.query(
      `INSERT INTO doctor_messages (sender_id, recipient_id, subject, body, patient_id, encounter_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at`,
      [auth.userId, recipientId, subject, body, patientId ?? null, encounterId ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("[dp/messages POST]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.patch("/:id/read", requirePermission("doctor_portal.messages.use"), async (req, res) => {
  const doctorId = (req as AuthenticatedRequest).auth!.userId;
  try {
    await pool.query(
      `UPDATE doctor_messages SET is_read=true, read_at=now()
       WHERE id=$1 AND recipient_id=$2`,
      [req.params.id, doctorId]
    );
    res.json({ id: req.params.id, read: true });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;
