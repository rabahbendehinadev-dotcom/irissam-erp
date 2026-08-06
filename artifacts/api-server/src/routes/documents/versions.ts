import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

// GET /api/documents/versions/:documentId — list all versions
router.get("/:documentId", requirePermission("documents.view"), async (req: AuthenticatedRequest, res) => {
  try {
    const pqr = await pool.query(`
      SELECT v.*, u.first_name || ' ' || u.last_name AS created_by_name
      FROM document_versions v
      LEFT JOIN users u ON u.id = v.created_by
      WHERE v.document_id = $1 AND v.deleted_at IS NULL
      ORDER BY v.version_number DESC
    `, [req.params.documentId]);
    res.json({ versions: pqr.rows });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/documents/versions/:documentId — create new version
router.post("/:documentId", requirePermission("documents.new_version"), async (req: AuthenticatedRequest, res) => {
  const { storageKey, fileName, fileSize, mimeType, checksum, changeReason } = req.body;
  if (!storageKey || !fileName || !mimeType) {
    return res.status(400).json({ error: "storageKey, fileName et mimeType sont requis" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get current version number
    const docRes = await client.query(
      "SELECT version_number, title FROM document_records WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [req.params.documentId]
    );
    if (!docRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Document introuvable" });
    }

    // Duplicate checksum detection
    if (checksum) {
      const dup = await client.query(
        "SELECT id FROM document_versions WHERE document_id = $1 AND checksum = $2 LIMIT 1",
        [req.params.documentId, checksum]
      );
      if (dup.rows.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Ce fichier est identique à une version existante (checksum identique)" });
      }
    }

    const newVersionNumber = docRes.rows[0].version_number + 1;

    // Snapshot current metadata
    const metaSnap = await client.query(
      "SELECT title, description, category, tags, metadata FROM document_records WHERE id = $1",
      [req.params.documentId]
    );

    // Create version record
    const versionRes = await client.query(`
      INSERT INTO document_versions
        (document_id, version_number, file_name, storage_key, file_size, mime_type, checksum, change_reason, metadata_snapshot, site_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      req.params.documentId, newVersionNumber, fileName, storageKey,
      fileSize || 0, mimeType, checksum || null, changeReason || null,
      JSON.stringify(metaSnap.rows[0]),
      req.auth?.siteId || null, req.auth?.userId
    ]);

    // Update document record to new version
    await client.query(`
      UPDATE document_records
      SET version_number = $1, storage_key = $2, file_name = $3,
          file_size = $4, mime_type = $5, checksum = $6,
          status = 'uploaded', updated_at = now(), updated_by = $7, version = version + 1
      WHERE id = $8
    `, [newVersionNumber, storageKey, fileName, fileSize || 0, mimeType,
        checksum || null, req.auth?.userId, req.params.documentId]);

    await client.query("COMMIT");

    // Log audit
    await pool.query(`
      INSERT INTO document_download_logs (document_id, user_id, action, ip_address, site_id, created_by)
      VALUES ($1, $2, 'new_version', $3, $4, $2)
    `, [req.params.documentId, req.auth?.userId, req.ip, req.auth?.siteId]);

    res.status(201).json(versionRes.rows[0]);
  } catch (err: any) {
    await client.query("ROLLBACK");
    req.log?.error(err);
    res.status(500).json({ error: "Erreur lors de la création de version" });
  } finally {
    client.release();
  }
});

// POST /api/documents/versions/:documentId/restore/:versionNumber
router.post("/:documentId/restore/:versionNumber", requirePermission("documents.restore"), async (req: AuthenticatedRequest, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const verRes = await client.query(
      "SELECT * FROM document_versions WHERE document_id = $1 AND version_number = $2",
      [req.params.documentId, parseInt(req.params.versionNumber)]
    );
    if (!verRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Version introuvable" });
    }

    const ver = verRes.rows[0];

    // Get current doc to snapshot it first
    const docRes = await client.query(
      "SELECT * FROM document_records WHERE id = $1 AND deleted_at IS NULL",
      [req.params.documentId]
    );
    if (!docRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Document introuvable" });
    }

    const doc = docRes.rows[0];
    const newVersionNumber = doc.version_number + 1;

    // Save current as a version snapshot before restoring
    await client.query(`
      INSERT INTO document_versions
        (document_id, version_number, file_name, storage_key, file_size, mime_type, checksum, change_reason, metadata_snapshot, site_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      doc.id, newVersionNumber, doc.file_name, doc.storage_key,
      doc.file_size, doc.mime_type, doc.checksum,
      `Snapshot avant restauration vers v${ver.version_number}`,
      JSON.stringify({ title: doc.title, description: doc.description }),
      req.auth?.siteId, req.auth?.userId
    ]);

    // Restore
    await client.query(`
      UPDATE document_records
      SET storage_key = $1, file_name = $2, file_size = $3, mime_type = $4,
          checksum = $5, version_number = $6,
          updated_at = now(), updated_by = $7, version = version + 1
      WHERE id = $8
    `, [ver.storage_key, ver.file_name, ver.file_size, ver.mime_type,
        ver.checksum, newVersionNumber + 1, req.auth?.userId, req.params.documentId]);

    await client.query("COMMIT");
    res.json({ success: true, restoredVersion: ver.version_number });
  } catch (err: any) {
    await client.query("ROLLBACK");
    req.log?.error(err);
    res.status(500).json({ error: "Erreur lors de la restauration" });
  } finally {
    client.release();
  }
});

export default router;
