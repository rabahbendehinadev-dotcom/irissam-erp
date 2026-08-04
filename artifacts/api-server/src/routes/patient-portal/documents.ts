/**
 * Patient Portal — Documents (GED — published only)
 * GET /patient-portal/documents
 * GET /patient-portal/documents/:id
 */
import { Router } from "express";
import type { Response } from "express";
import { pool } from "@workspace/db";
import { requirePatientAuth, type PatientRequest } from "../../middleware/requirePatientAuth.js";

const router = Router();

async function auditLog(accountId: string, patientId: string, action: string, resId: string, ip: string | undefined) {
  try {
    await pool.query(
      `INSERT INTO patient_portal_access_logs (account_id,patient_id,action,resource,resource_id,ip)
       VALUES ($1,$2,$3,'document',$4::uuid,$5)`,
      [accountId, patientId, action, resId, ip ?? null],
    );
  } catch { /* non-blocking */ }
}

router.get("/", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId } = req.patient!;
  const { category } = req.query as { category?: string };

  const vals: unknown[] = [patientId];
  let categoryFilter = "";
  if (category) {
    vals.push(category);
    categoryFilter = `AND d.category=$${vals.length}::document_category`;
  }

  try {
    const { rows } = await pool.query(
      `SELECT d.id, d.title, d.category, d.mime_type AS file_type, d.file_size,
              d.created_at, d.description
       FROM document_records d
       WHERE d.patient_id=$1
         AND d.published_to_patient = TRUE
         ${categoryFilter}
       ORDER BY d.created_at DESC
       LIMIT 200`,
      vals,
    );
    res.json({ documents: rows });
  } catch (err) {
    console.error("[portal/documents]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.get("/:id", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId, accountId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT d.id, d.title, d.category, d.mime_type AS file_type, d.file_size,
              d.storage_key, d.created_at, d.description, d.original_file_name
       FROM document_records d
       WHERE d.id=$1 AND d.patient_id=$2
         AND d.published_to_patient = TRUE`,
      [req.params.id, patientId],
    );
    if (!rows[0]) {
      res.status(404).json({ message: "Document introuvable ou accès refusé." });
      return;
    }
    await auditLog(accountId, patientId, "view_document", req.params.id, req.ip);
    res.json({ document: rows[0] });
  } catch (err) {
    console.error("[portal/documents/:id]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// GET /:id/download — audit download separately
router.get("/:id/download", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId, accountId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT id, title, storage_key, mime_type AS file_type, original_file_name
       FROM document_records
       WHERE id=$1 AND patient_id=$2
         AND published_to_patient = TRUE`,
      [req.params.id, patientId],
    );
    if (!rows[0]) {
      res.status(404).json({ message: "Document introuvable." });
      return;
    }
    await auditLog(accountId, patientId, "download_document", req.params.id, req.ip);
    res.json({ storageKey: rows[0].storage_key, title: rows[0].title, fileType: rows[0].file_type, fileName: rows[0].original_file_name });
  } catch (err) {
    console.error("[portal/documents/:id/download]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
