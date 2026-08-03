import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

router.get("/documents", requirePermission("quality.documents.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { q, status, doc_type, limit = "20", page = "1" } = req.query as Record<string,string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const conds: string[] = []; const params: unknown[] = []; let pi = 1;
      if (q)        { conds.push(`(title ILIKE $${pi} OR reference ILIKE $${pi} OR department ILIKE $${pi})`); params.push(`%${q}%`); pi++; }
      if (status)   { conds.push(`status = $${pi++}::quality_doc_status`); params.push(status); }
      if (doc_type) { conds.push(`doc_type = $${pi++}::quality_doc_type`); params.push(doc_type); }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const [{ rows }, { rows: [{ count }] }] = await Promise.all([
        pool.query(`SELECT * FROM quality_documents ${where} ORDER BY created_at DESC LIMIT $${pi} OFFSET $${pi+1}`, [...params, limit, offset]),
        pool.query(`SELECT COUNT(*) FROM quality_documents ${where}`, params),
      ]);
      res.json({ data: rows, total: parseInt(count), page: parseInt(page) });
    } catch (err) { next(err); }
  }
);

router.get("/documents/:id", requirePermission("quality.documents.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { rows: [doc] } = await pool.query("SELECT * FROM quality_documents WHERE id = $1", [req.params.id]);
      if (!doc) { res.status(404).json({ error: "Document introuvable" }); return; }
      const { rows: versions } = await pool.query(
        "SELECT * FROM quality_document_versions WHERE document_id = $1 ORDER BY created_at DESC", [req.params.id]);
      const { rows: approvals } = await pool.query(
        "SELECT * FROM quality_document_approvals WHERE document_id = $1 ORDER BY created_at DESC", [req.params.id]);
      res.json({ ...doc, versions, approvals });
    } catch (err) { next(err); }
  }
);

router.post("/documents", requirePermission("quality.documents.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const {
        title, doc_type = "procedure", department, process_ref, current_version = "1.0",
        owner_name, summary, keywords, review_date, expiry_date,
      } = req.body;
      if (!title) { res.status(400).json({ error: "title requis" }); return; }
      const userId = req.auth?.userId;
      const { rows: [doc] } = await pool.query(`
        INSERT INTO quality_documents
          (title, doc_type, department, process_ref, current_version,
           owner_id, owner_name, summary, keywords, review_date, expiry_date)
        VALUES ($1,$2::quality_doc_type,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *`,
        [title, doc_type, department, process_ref, current_version,
         userId, owner_name, summary, keywords ? keywords.split(",").map((k: string) => k.trim()) : [],
         review_date || null, expiry_date || null]);
      // Create initial version
      await pool.query(
        "INSERT INTO quality_document_versions (document_id, version, changes_summary, created_by) VALUES ($1,$2,'Version initiale',$3)",
        [doc.id, current_version, userId]);
      res.status(201).json(doc);
    } catch (err) { next(err); }
  }
);

router.patch("/documents/:id", requirePermission("quality.documents.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const allowed = ["title","doc_type","department","process_ref","owner_name",
                       "summary","review_date","expiry_date","status"];
      const sets: string[] = []; const params: unknown[] = []; let pi = 1;
      for (const k of allowed) {
        if (req.body[k] !== undefined) {
          if (k === "doc_type") sets.push(`${k} = $${pi++}::quality_doc_type`);
          else if (k === "status") sets.push(`${k} = $${pi++}::quality_doc_status`);
          else sets.push(`${k} = $${pi++}`);
          params.push(req.body[k]);
        }
      }
      if (!sets.length) { res.status(400).json({ error: "Aucun champ" }); return; }
      if (req.body.status === "publie") { sets.push(`published_at = now()`); }
      if (req.body.status === "archive") { sets.push(`archived_at = now()`); }
      params.push(req.params.id);
      const { rows: [doc] } = await pool.query(
        `UPDATE quality_documents SET ${sets.join(",")} WHERE id = $${pi} RETURNING *`, params);
      if (!doc) { res.status(404).json({ error: "Introuvable" }); return; }
      res.json(doc);
    } catch (err) { next(err); }
  }
);

// POST /documents/:id/new-version
router.post("/documents/:id/new-version", requirePermission("quality.documents.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { version, changes_summary, content } = req.body;
      if (!version) { await client.query("ROLLBACK"); res.status(400).json({ error: "version requis" }); return; }
      const userId = req.auth?.userId;
      await client.query(
        "INSERT INTO quality_document_versions (document_id, version, changes_summary, content, created_by) VALUES ($1,$2,$3,$4,$5)",
        [req.params.id, version, changes_summary, content || null, userId]);
      const { rows: [doc] } = await client.query(
        "UPDATE quality_documents SET current_version = $1, status = 'en_revision' WHERE id = $2 RETURNING *",
        [version, req.params.id]);
      await client.query("COMMIT");
      res.json(doc);
    } catch (err) { await client.query("ROLLBACK"); next(err); }
    finally { client.release(); }
  }
);

// POST /documents/:id/approvals
router.post("/documents/:id/approvals", requirePermission("quality.documents.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { version, approver_name, approver_role, status = "en_attente", comments } = req.body;
      const userId = req.auth?.userId;
      const { rows: [a] } = await pool.query(`
        INSERT INTO quality_document_approvals
          (document_id, version, approver_id, approver_name, approver_role, status, comments, approved_at)
        VALUES ($1,$2,$3,$4,$5,$6::quality_approval_status,$7,$8)
        RETURNING *`,
        [req.params.id, version, userId, approver_name, approver_role, status, comments,
         status === "approuve" ? new Date().toISOString() : null]);
      if (status === "approuve") {
        // check if all pending approvals for this version are done
        const { rows: [{ pending }] } = await pool.query(
          "SELECT COUNT(*) AS pending FROM quality_document_approvals WHERE document_id=$1 AND version=$2 AND status='en_attente'",
          [req.params.id, version]);
        if (parseInt(pending) === 0) {
          await pool.query("UPDATE quality_documents SET status='en_approbation' WHERE id=$1", [req.params.id]);
        }
      }
      res.status(201).json(a);
    } catch (err) { next(err); }
  }
);

export default router;
