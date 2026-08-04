/**
 * Doctor Portal — Prescriptions
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission.js";
import type { AuthenticatedRequest } from "../../middleware/requireAuth.js";
import crypto from "crypto";

const router = Router();

router.post("/", requirePermission("doctor_portal.prescriptions.create"), async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth!;
  const { patientId, encounterId, drug, dosage, route, frequency, duration, notes } = req.body as Record<string, string>;
  if (!patientId || !encounterId || !drug || !dosage || !route || !frequency) {
    res.status(400).json({ message: "patientId, encounterId, drug, dosage, route et frequency requis" });
    return;
  }
  try {
    const [enc, patient] = await Promise.all([
      pool.query(`SELECT id FROM encounters WHERE id=$1 AND patient_id=$2 AND deleted_at IS NULL`, [encounterId, patientId]),
      pool.query(`SELECT first_name||' '||last_name AS full_name FROM patients WHERE id=$1`, [patientId]),
    ]);
    if (!enc.rowCount) { res.status(400).json({ message: "Encounter invalide" }); return; }

    const doctorName = `${auth.firstName ?? ""} ${auth.lastName ?? ""}`.trim();
    const result = await pool.query(
      `INSERT INTO prescriptions
         (patient_id, encounter_id, patient_name,
          prescribed_by_id, prescribed_by_name,
          drug, dosage, route, frequency, duration, notes,
          status, source_module, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'prescrit','pharmacie',now(),now())
       RETURNING *`,
      [patientId, encounterId, patient.rows[0]?.full_name ?? "",
       auth.userId, doctorName,
       drug, dosage, route, frequency, duration ?? null, notes ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("[dp/prescriptions POST]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.get("/", requirePermission("doctor_portal.prescriptions.create"), async (req, res) => {
  const doctorId = (req as AuthenticatedRequest).auth!.userId;
  const { page = "1", limit = "20", status } = req.query as Record<string, string>;
  const params: unknown[] = [doctorId];
  const conds = ["pr.prescribed_by_id=$1", "pr.deleted_at IS NULL"];
  if (status) { params.push(status); conds.push(`pr.status=$${params.length}`); }
  params.push(Number(limit), (Number(page) - 1) * Number(limit));
  try {
    const result = await pool.query(
      `SELECT pr.*, p.first_name||' '||p.last_name AS patient_full_name, p.mrn
       FROM prescriptions pr JOIN patients p ON p.id=pr.patient_id
       WHERE ${conds.join(" AND ")}
       ORDER BY pr.prescribed_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ prescriptions: result.rows });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.post("/:id/sign", requirePermission("doctor_portal.prescriptions.sign"), async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth!;
  const { reason } = req.body as { reason?: string };
  try {
    const row = await pool.query(
      `SELECT * FROM prescriptions WHERE id=$1 AND prescribed_by_id=$2 AND deleted_at IS NULL`,
      [req.params.id, auth.userId]
    );
    if (!row.rowCount) { res.status(404).json({ message: "Ordonnance introuvable" }); return; }
    if ((row.rows[0] as Record<string, unknown>)["locked_at"]) {
      res.status(409).json({ message: "Ordonnance déjà signée" }); return;
    }
    const contentHash = crypto.createHash("sha256").update(JSON.stringify(row.rows[0])).digest("hex");
    await pool.query(
      `UPDATE prescriptions SET signed_at=now(), locked_at=now(), content_hash=$1, updated_at=now() WHERE id=$2`,
      [contentHash, req.params.id]
    );
    await pool.query(
      `INSERT INTO medical_signatures
         (doctor_id, role, resource_type, resource_id, signature_type, content_hash, reason, ip_address, device)
       VALUES ($1,$2,'prescription',$3,'signature',$4,$5,$6,$7)`,
      [auth.userId, auth.role, req.params.id, contentHash, reason ?? null, req.ip, req.headers["user-agent"] ?? ""]
    );
    await pool.query(
      `INSERT INTO audit_logs (module,action,user_id,user_name,user_role,patient_id,resource_id,resource_type,ip,severity)
       VALUES ('prescriptions','sign_prescription',$1,$2,$3,$4,$5,'prescription',$6,'info')`,
      [auth.userId, `${auth.firstName ?? ""} ${auth.lastName ?? ""}`.trim(),
       auth.role, (row.rows[0] as Record<string, unknown>)["patient_id"], req.params.id, req.ip]
    ).catch(() => {});
    res.json({ id: req.params.id, signed: true, contentHash });
  } catch (err) {
    console.error("[dp/prescriptions/sign]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;
