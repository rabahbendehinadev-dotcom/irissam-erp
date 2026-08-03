import { Router } from "express";
import { pool } from "@workspace/db";
import crypto from "crypto";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

// GET /api/documents/shares/:documentId
router.get("/:documentId", requirePermission("documents.view"), async (req: AuthenticatedRequest, res) => {
  try {
    const { data } = await pool.query(`
      SELECT s.*, u.first_name || ' ' || u.last_name AS shared_with_name
      FROM document_shares s
      LEFT JOIN users u ON u.id = s.shared_with_user
      WHERE s.document_id = $1 AND s.deleted_at IS NULL
        AND (s.expires_at IS NULL OR s.expires_at > now())
      ORDER BY s.created_at DESC
    `, [req.params.documentId]);
    res.json({ shares: data.rows });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/documents/shares
router.post("/", requirePermission("documents.share"), async (req: AuthenticatedRequest, res) => {
  const { documentId, shareType, sharedWithUser, sharedWithRole, allowedActions, expiresAt, message } = req.body;
  if (!documentId || !shareType) {
    return res.status(400).json({ error: "documentId et shareType requis" });
  }

  try {
    // Verify document exists and user can share it
    const docRes = await pool.query(
      "SELECT id, title, confidentiality FROM document_records WHERE id = $1 AND deleted_at IS NULL",
      [documentId]
    );
    if (!docRes.data.rows.length) return res.status(404).json({ error: "Document introuvable" });

    let token: string | null = null;
    if (shareType === "public_link") {
      token = crypto.randomBytes(32).toString("hex");
    }

    const { data } = await pool.query(`
      INSERT INTO document_shares
        (document_id, share_type, shared_with_user, shared_with_role, token,
         allowed_actions, expires_at, message, site_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      documentId, shareType, sharedWithUser || null, sharedWithRole || null,
      token, allowedActions || ["view", "download"],
      expiresAt || null, message || null,
      req.auth?.siteId, req.auth?.userId
    ]);

    // Notify recipient
    if (sharedWithUser) {
      await pool.query(`
        INSERT INTO document_notifications
          (document_id, recipient_id, notification_type, title, body, site_id, created_by)
        VALUES ($1, $2, 'shared', 'Document partagé avec vous',
                'Un document a été partagé avec vous', $3, $4)
      `, [documentId, sharedWithUser, req.auth?.siteId, req.auth?.userId]);
    }

    // Audit log
    await pool.query(`
      INSERT INTO document_download_logs (document_id, user_id, action, ip_address, site_id, created_by)
      VALUES ($1, $2, 'share', $3, $4, $2)
    `, [documentId, req.auth?.userId, req.ip, req.auth?.siteId]);

    res.status(201).json({ ...data.rows[0], token });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur lors du partage" });
  }
});

// DELETE /api/documents/shares/:shareId
router.delete("/:shareId", requirePermission("documents.share"), async (req: AuthenticatedRequest, res) => {
  try {
    const { data } = await pool.query(`
      UPDATE document_shares SET deleted_at = now(), updated_by = $1
      WHERE id = $2 AND created_by = $3
      RETURNING id
    `, [req.auth?.userId, req.params.shareId, req.auth?.userId]);
    if (!data.rows.length) return res.status(404).json({ error: "Partage introuvable" });
    res.json({ success: true });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
