/**
 * Doctor Portal — Clinical Notes
 * POST /clinical-notes          — create
 * GET  /clinical-notes          — list (scoped)
 * PATCH /clinical-notes/:id     — update draft
 * POST /clinical-notes/:id/sign — sign (locks)
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission.js";
import type { AuthenticatedRequest } from "../../middleware/requireAuth.js";
import crypto from "crypto";

const router = Router();

router.post("/", requirePermission("doctor_portal.notes.create"), async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth!;
  const { patientId, encounterId, type, content } = req.body as Record<string, string>;
  const validTypes = ["note_consultation","note_evolution","note_visite","note_garde","avis_specialiste","addendum","resume_medical"];
  if (!patientId || !type || !validTypes.includes(type)) {
    res.status(400).json({ message: "patientId et type valide requis" });
    return;
  }
  try {
    const result = await pool.query(
      `INSERT INTO clinical_notes (patient_id, encounter_id, author_id, type, content, status)
       VALUES ($1,$2,$3,$4,$5,'draft') RETURNING *`,
      [patientId, encounterId ?? null, auth.userId, type, content ?? ""]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("[dp/clinical-notes POST]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.get("/", requirePermission("doctor_portal.notes.create"), async (req, res) => {
  const doctorId = (req as AuthenticatedRequest).auth!.userId;
  const { patientId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const params: unknown[] = [doctorId];
  const conds = ["cn.author_id=$1","cn.status!='cancelled'"];
  if (patientId) { params.push(patientId); conds.push(`cn.patient_id=$${params.length}`); }
  params.push(Number(limit), (Number(page)-1)*Number(limit));
  try {
    const result = await pool.query(
      `SELECT cn.*, p.first_name||' '||p.last_name AS patient_name, p.mrn
       FROM clinical_notes cn JOIN patients p ON p.id=cn.patient_id
       WHERE ${conds.join(" AND ")}
       ORDER BY cn.created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );
    res.json({ notes: result.rows });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.patch("/:id", requirePermission("doctor_portal.notes.create"), async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth!;
  const { content } = req.body as { content?: string };
  if (!content) { res.status(400).json({ message: "content requis" }); return; }
  try {
    const result = await pool.query(
      `UPDATE clinical_notes SET content=$1, updated_at=now()
       WHERE id=$2 AND author_id=$3 AND status='draft' RETURNING *`,
      [content, req.params.id, auth.userId]
    );
    if (!result.rowCount) { res.status(404).json({ message: "Note introuvable ou déjà signée" }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.post("/:id/sign", requirePermission("doctor_portal.notes.sign"), async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth!;
  const { reason } = req.body as { reason?: string };
  try {
    const note = await pool.query(
      `SELECT * FROM clinical_notes WHERE id=$1 AND author_id=$2 AND status='draft'`,
      [req.params.id, auth.userId]
    );
    if (!note.rowCount) { res.status(404).json({ message: "Note introuvable ou déjà signée" }); return; }
    const contentHash = crypto.createHash("sha256").update(note.rows[0].content ?? "").digest("hex");
    await pool.query(
      `UPDATE clinical_notes SET status='signed', signed_at=now(), locked_at=now(), content_hash=$1, updated_at=now()
       WHERE id=$2`,
      [contentHash, req.params.id]
    );
    await pool.query(
      `INSERT INTO medical_signatures
         (doctor_id, role, resource_type, resource_id, signature_type, content_hash, reason, ip_address, device)
       VALUES ($1,$2,'clinical_note',$3,'signature',$4,$5,$6,$7)`,
      [auth.userId, auth.role, req.params.id, contentHash, reason ?? null, req.ip, req.headers["user-agent"] ?? ""]
    );
    res.json({ id: req.params.id, status: "signed", contentHash });
  } catch (err) {
    console.error("[dp/clinical-notes/sign]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;
