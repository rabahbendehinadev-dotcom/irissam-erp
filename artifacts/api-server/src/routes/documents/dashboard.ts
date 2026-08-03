import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

// GET /api/documents/dashboard/kpis
router.get("/kpis", requirePermission("documents.view"), async (req: AuthenticatedRequest, res) => {
  const siteId = req.auth?.siteId;
  const siteFilter = siteId ? "AND (site_id = $1 OR site_id IS NULL)" : "";
  const siteParam = siteId ? [siteId] : [];

  try {
    const [total, today, pending, toSign, expiring, archived, sensitiveViewed] = await Promise.allSettled([
      pool.query(`SELECT count(*) FROM document_records WHERE deleted_at IS NULL ${siteFilter}`, siteParam),
      pool.query(`SELECT count(*) FROM document_records WHERE deleted_at IS NULL AND created_at >= current_date ${siteFilter}`, siteParam),
      pool.query(`SELECT count(*) FROM document_records WHERE status = 'under_review' AND deleted_at IS NULL ${siteFilter}`, siteParam),
      pool.query(`SELECT count(*) FROM document_records WHERE status IN ('approved','under_review') AND deleted_at IS NULL ${siteFilter}`, siteParam),
      pool.query(`SELECT count(*) FROM document_records WHERE expires_at <= now() + interval '30 days' AND expires_at > now() AND deleted_at IS NULL ${siteFilter}`, siteParam),
      pool.query(`SELECT count(*) FROM document_records WHERE status = 'archived' AND deleted_at IS NULL ${siteFilter}`, siteParam),
      pool.query(`SELECT count(*) FROM document_download_logs l JOIN document_records dr ON dr.id = l.document_id WHERE dr.confidentiality IN ('confidential','medical_confidential','hr_confidential','finance_confidential','direction_only') AND l.created_at >= current_date ${siteFilter.replace("site_id", "l.site_id")}`, siteParam),
    ]);

    const get = (r: any) => r.status === "fulfilled" ? parseInt(r.value?.data?.rows?.[0]?.count ?? 0) : 0;

    res.json({
      total: get(total),
      uploadedToday: get(today),
      pendingApproval: get(pending),
      toSign: get(toSign),
      expiringIn30Days: get(expiring),
      archived: get(archived),
      sensitiveViewedToday: get(sensitiveViewed),
    });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/documents/dashboard/charts
router.get("/charts", requirePermission("documents.view"), async (req: AuthenticatedRequest, res) => {
  const siteId = req.auth?.siteId;
  const siteFilter = siteId ? "AND (site_id = $1 OR site_id IS NULL)" : "";
  const siteParam = siteId ? [siteId] : [];

  try {
    const [byCategory, byStatus, uploadsMonthly, storageByCategory] = await Promise.allSettled([
      pool.query(`
        SELECT category, count(*) AS count
        FROM document_records WHERE deleted_at IS NULL ${siteFilter}
        GROUP BY category ORDER BY count DESC
      `, siteParam),
      pool.query(`
        SELECT status, count(*) AS count
        FROM document_records WHERE deleted_at IS NULL ${siteFilter}
        GROUP BY status ORDER BY count DESC
      `, siteParam),
      pool.query(`
        SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
               count(*) AS count
        FROM document_records WHERE deleted_at IS NULL
          AND created_at >= now() - interval '12 months' ${siteFilter}
        GROUP BY 1 ORDER BY 1
      `, siteParam),
      pool.query(`
        SELECT category,
               sum(file_size) AS total_bytes,
               count(*) AS count
        FROM document_records WHERE deleted_at IS NULL ${siteFilter}
        GROUP BY category ORDER BY total_bytes DESC
      `, siteParam),
    ]);

    const get = (r: any) => r.status === "fulfilled" ? (r.value?.data?.rows ?? []) : [];

    res.json({
      byCategory: get(byCategory),
      byStatus: get(byStatus),
      uploadsMonthly: get(uploadsMonthly),
      storageByCategory: get(storageByCategory),
    });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/documents/dashboard/recent
router.get("/recent", requirePermission("documents.view"), async (req: AuthenticatedRequest, res) => {
  const siteId = req.auth?.siteId;
  try {
    const { data } = await pool.query(`
      SELECT dr.id, dr.document_number, dr.title, dr.category, dr.status,
             dr.confidentiality, dr.mime_type, dr.file_size, dr.created_at,
             u.first_name || ' ' || u.last_name AS created_by_name
      FROM document_records dr
      LEFT JOIN users u ON u.id = dr.created_by
      WHERE dr.deleted_at IS NULL
        ${siteId ? "AND (dr.site_id = $1 OR dr.site_id IS NULL)" : ""}
      ORDER BY dr.created_at DESC
      LIMIT 20
    `, siteId ? [siteId] : []);
    res.json({ documents: data.rows });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/documents/dashboard/notifications
router.get("/notifications", requirePermission("documents.view"), async (req: AuthenticatedRequest, res) => {
  try {
    const { data } = await pool.query(`
      SELECT n.*, dr.title AS document_title, dr.document_number
      FROM document_notifications n
      LEFT JOIN document_records dr ON dr.id = n.document_id
      WHERE n.recipient_id = $1 AND n.deleted_at IS NULL
        AND (n.expires_at IS NULL OR n.expires_at > now())
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [req.auth?.userId]);
    res.json({ notifications: data.rows });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// PATCH /api/documents/dashboard/notifications/:id/read
router.patch("/notifications/:id/read", requirePermission("documents.view"), async (req: AuthenticatedRequest, res) => {
  try {
    await pool.query(
      "UPDATE document_notifications SET is_read = true, read_at = now() WHERE id = $1 AND recipient_id = $2",
      [req.params.id, req.auth?.userId]
    );
    res.json({ success: true });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
