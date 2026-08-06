import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

// GET /api/documents/audit/:documentId
router.get("/:documentId", requirePermission("documents.view_audit"), async (req: AuthenticatedRequest, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const pqr = await pool.query(`
      SELECT l.*,
             u.first_name || ' ' || u.last_name AS user_name,
             u.role AS user_role
      FROM document_download_logs l
      LEFT JOIN users u ON u.id = l.user_id
      WHERE l.document_id = $1
      ORDER BY l.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.params.documentId, parseInt(limit as string), parseInt(offset as string)]);

    const countRes = await pool.query(
      "SELECT count(*) FROM document_download_logs WHERE document_id = $1",
      [req.params.documentId]
    );

    res.json({
      logs: pqr.rows,
      total: parseInt(countRes.rows[0].count)
    });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/documents/audit — global audit logs
router.get("/", requirePermission("documents.view_audit"), async (req: AuthenticatedRequest, res) => {
  try {
    const siteId = req.auth?.siteId;
    const { action, userId, from, to, limit = 100, offset = 0 } = req.query;

    const conditions: string[] = ["l.deleted_at IS NULL"];
    const params: any[] = [];
    let p = 1;

    if (siteId) { conditions.push(`(l.site_id = $${p++} OR l.site_id IS NULL)`); params.push(siteId); }
    if (action) { conditions.push(`l.action = $${p++}`); params.push(action); }
    if (userId) { conditions.push(`l.user_id = $${p++}`); params.push(userId); }
    if (from) { conditions.push(`l.created_at >= $${p++}`); params.push(from); }
    if (to) { conditions.push(`l.created_at <= $${p++}`); params.push(to); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const pqr = await pool.query(`
      SELECT l.*,
             dr.title AS document_title, dr.document_number, dr.category,
             u.first_name || ' ' || u.last_name AS user_name, u.role AS user_role
      FROM document_download_logs l
      LEFT JOIN document_records dr ON dr.id = l.document_id
      LEFT JOIN users u ON u.id = l.user_id
      ${where}
      ORDER BY l.created_at DESC
      LIMIT $${p++} OFFSET $${p++}
    `, [...params, parseInt(limit as string), parseInt(offset as string)]);

    res.json({ logs: pqr.rows });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
