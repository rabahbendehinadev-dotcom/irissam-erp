/**
 * Doctor Portal — Consultations
 *
 * POST /consultations              — create (status: en_attente)
 * GET  /consultations/:id          — read (scoped to doctor)
 * PATCH /consultations/:id         — update fields
 * POST /consultations/:id/finalize — set status=terminee
 * POST /consultations/:id/sign     — sign + lock
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission.js";
import type { AuthenticatedRequest } from "../../middleware/requireAuth.js";
import crypto from "crypto";

const router = Router();

function doctorCtx(req: AuthenticatedRequest) {
  return {
    id:   req.auth!.userId,
    name: req.auth!.userId,   // firstName/lastName not in auth middleware payload; use userId as fallback
    role: req.auth!.role,
    ip:   req.ip ?? "",
    ua:   req.headers["user-agent"] ?? "",
  };
}

async function nextConsultationNumber(client: typeof pool): Promise<string> {
  const year = new Date().getFullYear();
  const row = await client.query(
    `SELECT COUNT(*) FROM consultations WHERE EXTRACT(YEAR FROM created_at)=$1`, [year]
  );
  const seq = Number(row.rows[0].count) + 1;
  return `CONS-${year}-${String(seq).padStart(5, "0")}`;
}

// POST /consultations
router.post("/", requirePermission("doctor_portal.consultations.create"), async (req, res) => {
  const doc = doctorCtx(req as AuthenticatedRequest);
  const { patientId, encounterId, reason, serviceName } = req.body as Record<string, string>;
  if (!patientId || !encounterId || !reason) {
    res.status(400).json({ message: "patientId, encounterId et reason sont requis" });
    return;
  }
  try {
    const [enc, patient, doctor] = await Promise.all([
      pool.query(`SELECT id FROM encounters WHERE id=$1 AND patient_id=$2 AND deleted_at IS NULL`, [encounterId, patientId]),
      pool.query(`SELECT first_name||' '||last_name AS full_name, mpi_id FROM patients WHERE id=$1`, [patientId]),
      pool.query(`SELECT specialty FROM users WHERE id=$1`, [doc.id]).catch(() => ({ rows: [{ specialty: "" }] })),
    ]);
    if (!enc.rowCount) {
      res.status(400).json({ message: "Encounter invalide ou inaccessible" });
      return;
    }
    const number   = await nextConsultationNumber(pool);
    const patName  = patient.rows[0]?.full_name ?? "";
    const patMpi   = patient.rows[0]?.mpi_id    ?? "";
    const specialty = (doctor.rows[0] as { specialty?: string })?.specialty ?? "";

    const result = await pool.query(
      `INSERT INTO consultations
         (number, patient_id, patient_name, patient_mpi, encounter_id,
          doctor_id, doctor_name, specialty, service_name,
          reason, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'en_attente',now(),now())
       RETURNING *`,
      [number, patientId, patName, patMpi, encounterId,
       doc.id, doc.name, specialty, serviceName ?? "", reason]
    );
    await pool.query(
      `INSERT INTO audit_logs (module,action,user_id,user_name,user_role,patient_id,resource_id,resource_type,ip,severity)
       VALUES ('consultations','create_consultation',$1,$2,$3,$4,$5,'consultation',$6,'info')`,
      [doc.id, doc.name, doc.role, patientId, result.rows[0].id, doc.ip]
    ).catch(() => {});
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("[dp/consultations POST]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET /consultations/:id
router.get("/:id", requirePermission("doctor_portal.consultations.update"), async (req, res) => {
  const doctorId = (req as AuthenticatedRequest).auth!.userId;
  try {
    const result = await pool.query(
      `SELECT c.*, p.mrn, p.first_name||' '||p.last_name AS patient_full_name,
              p.date_of_birth, p.allergies, p.chronic_diseases
       FROM consultations c
       JOIN patients p ON p.id=c.patient_id
       WHERE c.id=$1 AND c.doctor_id=$2`,
      [req.params.id, doctorId]
    );
    if (!result.rowCount) { res.status(404).json({ message: "Consultation introuvable" }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[dp/consultations GET/:id]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// PATCH /consultations/:id
router.patch("/:id", requirePermission("doctor_portal.consultations.update"), async (req, res) => {
  const doctorId = (req as AuthenticatedRequest).auth!.userId;
  const fields = req.body as Record<string, unknown>;
  const allowed = ["reason", "notes", "diagnosis", "status"];
  const setClauses = ["updated_at=now()"];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) {
      params.push(v);
      setClauses.push(`${k}=$${params.length}`);
    }
  }
  if (setClauses.length === 1) { res.status(400).json({ message: "Aucun champ valide" }); return; }
  params.push(req.params.id, doctorId);
  try {
    const result = await pool.query(
      `UPDATE consultations SET ${setClauses.join(",")}
       WHERE id=$${params.length - 1} AND doctor_id=$${params.length}
         AND status IN ('en_attente','en_cours') AND locked_at IS NULL
       RETURNING id, status, updated_at`,
      params
    );
    if (!result.rowCount) { res.status(404).json({ message: "Consultation introuvable ou verrouillée" }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[dp/consultations PATCH]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// POST /consultations/:id/finalize
router.post("/:id/finalize", requirePermission("doctor_portal.consultations.finalize"), async (req, res) => {
  const doc = doctorCtx(req as AuthenticatedRequest);
  try {
    const result = await pool.query(
      `UPDATE consultations SET status='terminee', updated_at=now()
       WHERE id=$1 AND doctor_id=$2 AND status IN ('en_attente','en_cours') AND locked_at IS NULL
       RETURNING *`,
      [req.params.id, doc.id]
    );
    if (!result.rowCount) { res.status(404).json({ message: "Consultation introuvable ou déjà finalisée" }); return; }
    await pool.query(
      `UPDATE encounters SET
         linked_records = linked_records || $1::jsonb, updated_at=now()
       WHERE id=$2`,
      [JSON.stringify([{ recordType:"consultation", recordId:req.params.id, summary:"Consultation finalisée", createdAt:new Date() }]),
       result.rows[0].encounter_id]
    ).catch(() => {});
    await pool.query(
      `INSERT INTO audit_logs (module,action,user_id,user_name,user_role,patient_id,resource_id,resource_type,ip,severity)
       VALUES ('consultations','finalize_consultation',$1,$2,$3,$4,$5,'consultation',$6,'info')`,
      [doc.id, doc.name, doc.role, result.rows[0].patient_id, req.params.id, doc.ip]
    ).catch(() => {});
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[dp/consultations/finalize]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// POST /consultations/:id/sign
router.post("/:id/sign", requirePermission("doctor_portal.consultations.sign"), async (req, res) => {
  const doc = doctorCtx(req as AuthenticatedRequest);
  const { reason } = req.body as { reason?: string };
  try {
    const consultation = await pool.query(
      `SELECT * FROM consultations WHERE id=$1 AND doctor_id=$2`,
      [req.params.id, doc.id]
    );
    if (!consultation.rowCount) { res.status(404).json({ message: "Consultation introuvable" }); return; }
    const row = consultation.rows[0] as Record<string, unknown>;
    if (row["status"] === "en_attente") { res.status(400).json({ message: "Finalisez d'abord la consultation" }); return; }
    if (row["locked_at"]) { res.status(409).json({ message: "Consultation déjà signée" }); return; }

    const contentHash = crypto.createHash("sha256").update(JSON.stringify(row)).digest("hex");

    await pool.query(
      `UPDATE consultations SET signed_at=now(), locked_at=now(), content_hash=$1, updated_at=now()
       WHERE id=$2`,
      [contentHash, req.params.id]
    );
    await pool.query(
      `INSERT INTO medical_signatures
         (doctor_id, role, resource_type, resource_id, signature_type, content_hash, reason, ip_address, device)
       VALUES ($1,$2,'consultation',$3,'signature',$4,$5,$6,$7)`,
      [doc.id, doc.role, req.params.id, contentHash, reason ?? null, doc.ip, doc.ua]
    );
    await pool.query(
      `INSERT INTO audit_logs (module,action,user_id,user_name,user_role,patient_id,resource_id,resource_type,ip,severity)
       VALUES ('consultations','sign_consultation',$1,$2,$3,$4,$5,'consultation',$6,'info')`,
      [doc.id, doc.name, doc.role, row["patient_id"], req.params.id, doc.ip]
    ).catch(() => {});

    res.json({ id: req.params.id, signed: true, contentHash });
  } catch (err) {
    console.error("[dp/consultations/sign]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// POST /consultations/:id/addendum — create a separate addendum (original locked)
router.post("/:id/addendum", requirePermission("doctor_portal.consultations.create"), async (req, res) => {
  const doc = doctorCtx(req as AuthenticatedRequest);
  const { content } = req.body as { content?: string };
  if (!content) { res.status(400).json({ message: "content de l'addendum requis" }); return; }
  try {
    const orig = await pool.query(
      `SELECT * FROM consultations WHERE id=$1 AND doctor_id=$2`,
      [req.params.id, doc.id]
    );
    if (!orig.rowCount) { res.status(404).json({ message: "Consultation introuvable" }); return; }
    const origRow = orig.rows[0] as Record<string, unknown>;
    if (!origRow["locked_at"]) {
      res.status(400).json({ message: "Signez d'abord la consultation avant d'ajouter un addendum" });
      return;
    }
    // Create addendum as a clinical_note of type 'addendum' linked to same encounter/patient
    const result = await pool.query(
      `INSERT INTO clinical_notes
         (patient_id, encounter_id, author_id, type, content, parent_note_id, status, created_at, updated_at)
       VALUES ($1,$2,$3,'addendum',$4,NULL,'draft',now(),now())
       RETURNING *`,
      [origRow["patient_id"], origRow["encounter_id"], doc.id,
       `[Addendum à ${req.params.id}]\n\n${content}`]
    );
    await pool.query(
      `INSERT INTO audit_logs (module,action,user_id,user_name,user_role,patient_id,resource_id,resource_type,ip,severity)
       VALUES ('consultations','create_addendum',$1,$2,$3,$4,$5,'clinical_note',$6,'info')`,
      [doc.id, doc.name, doc.role, origRow["patient_id"], result.rows[0].id, doc.ip]
    ).catch(() => {});
    res.status(201).json({ addendum: result.rows[0], parentConsultationId: req.params.id });
  } catch (err) {
    console.error("[dp/consultations/addendum]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;
