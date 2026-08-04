import { Router } from "express";
import crypto from "crypto";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import {
  localStorageService,
  ALLOWED_MIMES,
  FileNotFoundError,
  StorageSecurityError,
} from "../../lib/localStorageService";

const router = Router();

const MAX_FILE_SIZE = parseInt(process.env.MAX_DOC_FILE_SIZE ?? "52428800", 10); // 50 MB default

// ─── Upload URL ───────────────────────────────────────────────

// POST /api/documents/records/upload-url — returns local upload config
// On VPS: clients should POST multipart to POST /api/storage/upload instead.
// This endpoint now validates the file metadata and returns the upload endpoint info.
router.post("/upload-url", requirePermission("documents.upload"), async (req: AuthenticatedRequest, res) => {
  const { fileName, mimeType, fileSize } = req.body;
  if (!fileName || !mimeType || !fileSize) {
    return res.status(400).json({ error: "fileName, mimeType et fileSize requis" });
  }
  if (!ALLOWED_MIMES.has(mimeType)) {
    return res.status(400).json({ error: `Type de fichier non autorisé: ${mimeType}` });
  }
  if (fileSize > MAX_FILE_SIZE) {
    return res.status(400).json({ error: `Fichier trop volumineux (max ${MAX_FILE_SIZE / 1048576} MB)` });
  }
  // Sanitize display name (never used as a storage path)
  const safeName = fileName.replace(/[^a-zA-Z0-9._\-\s]/g, "_").slice(0, 255);
  // Return local upload config — client should POST multipart/form-data to uploadURL
  res.json({
    uploadURL:       "/api/storage/upload",
    objectPath:      null,               // will be returned in the upload response as storageKey
    method:          "POST",
    fieldName:       "file",
    storageProvider: "local",
    fileName:        safeName,
  });
});

// ─── LIST ─────────────────────────────────────────────────────

// GET /api/documents/records
router.get("/", requirePermission("documents.view"), async (req: AuthenticatedRequest, res) => {
  const {
    folderId, category, status, confidentiality, patientId, entityType, entityId,
    search, tags, module: mod, favorite, shared,
    limit = 50, offset = 0, sort = "created_at", order = "desc"
  } = req.query;

  const siteId = req.auth?.siteId;
  const userId = req.auth?.userId;
  const userRole = req.auth?.role;

  const conditions: string[] = ["dr.deleted_at IS NULL"];
  const params: any[] = [];
  let p = 1;

  if (siteId) { conditions.push(`(dr.site_id = $${p++} OR dr.site_id IS NULL)`); params.push(siteId); }
  if (folderId) { conditions.push(`dr.folder_id = $${p++}`); params.push(folderId); }
  if (category) { conditions.push(`dr.category = $${p++}`); params.push(category); }
  if (status) { conditions.push(`dr.status = $${p++}`); params.push(status); }
  if (patientId) { conditions.push(`dr.patient_id = $${p++}`); params.push(patientId); }
  if (entityType) { conditions.push(`dr.entity_type = $${p++}`); params.push(entityType); }
  if (entityId) { conditions.push(`dr.entity_id = $${p++}`); params.push(entityId); }
  if (mod) { conditions.push(`dr.module = $${p++}`); params.push(mod); }
  if (favorite === "true") { conditions.push(`dr.is_favorite = true AND dr.created_by = $${p++}`); params.push(userId); }
  if (search) {
    conditions.push(`to_tsvector('french', coalesce(dr.title,'') || ' ' || coalesce(dr.description,'') || ' ' || coalesce(dr.document_number,'')) @@ plainto_tsquery('french', $${p++})`);
    params.push(search);
  }
  if (tags) {
    const tagArr = Array.isArray(tags) ? tags : [tags];
    conditions.push(`dr.tags && $${p++}`);
    params.push(tagArr);
  }

  // Confidentiality filter: direction_only only for director roles
  const directorRoles = ["admin", "directeur_general", "directeur_medical", "directeur_financier", "directeur_rh", "directeur_soins", "responsable_qualite", "medecin_chef"];
  if (!directorRoles.includes(userRole ?? "")) {
    conditions.push(`dr.confidentiality != 'direction_only'`);
  }
  // hr_confidential only for HR/admin
  if (!["admin", "responsable_rh", "directeur_rh"].includes(userRole ?? "")) {
    conditions.push(`dr.confidentiality != 'hr_confidential'`);
  }
  // finance_confidential only for finance roles
  if (!["admin", "responsable_facturation", "directeur_financier", "directeur_general"].includes(userRole ?? "")) {
    conditions.push(`dr.confidentiality != 'finance_confidential'`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const sortCol = ["created_at", "title", "file_size", "updated_at", "document_number"].includes(sort as string) ? sort : "created_at";
  const sortDir = order === "asc" ? "ASC" : "DESC";

  try {
    const countRes = await pool.query(`SELECT count(*) FROM document_records dr ${where}`, params);
    const { data } = await pool.query(`
      SELECT dr.*,
             df.name AS folder_name, df.path AS folder_path,
             u.first_name || ' ' || u.last_name AS created_by_name
      FROM document_records dr
      LEFT JOIN document_folders df ON df.id = dr.folder_id
      LEFT JOIN users u ON u.id = dr.created_by
      ${where}
      ORDER BY dr.${sortCol} ${sortDir}
      LIMIT $${p++} OFFSET $${p++}
    `, [...params, parseInt(limit as string), parseInt(offset as string)]);

    res.json({
      documents: data.rows,
      total: parseInt(countRes.data.rows[0].count),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur lors du chargement des documents" });
  }
});

// ─── GET ONE ──────────────────────────────────────────────────

// GET /api/documents/records/:id
router.get("/:id", requirePermission("documents.view"), async (req: AuthenticatedRequest, res) => {
  const userRole = req.auth?.role ?? "";
  try {
    const { data } = await pool.query(`
      SELECT dr.*,
             df.name AS folder_name, df.path AS folder_path,
             p.first_name || ' ' || p.last_name AS patient_name,
             uc.first_name || ' ' || uc.last_name AS created_by_name,
             uu.first_name || ' ' || uu.last_name AS updated_by_name,
             (SELECT json_agg(json_build_object('id',dv.id,'version_number',dv.version_number,'created_at',dv.created_at,'change_reason',dv.change_reason,'created_by',ucv.first_name||' '||ucv.last_name) ORDER BY dv.version_number DESC)
              FROM document_versions dv LEFT JOIN users ucv ON ucv.id = dv.created_by WHERE dv.document_id = dr.id) AS versions,
             (SELECT json_agg(json_build_object('id',dc.id,'content',dc.content,'created_at',dc.created_at,'created_by',ucc.first_name||' '||ucc.last_name,'is_internal',dc.is_internal) ORDER BY dc.created_at)
              FROM document_comments dc LEFT JOIN users ucc ON ucc.id = dc.created_by WHERE dc.document_id = dr.id AND dc.deleted_at IS NULL) AS comments,
             (SELECT json_agg(json_build_object('id',ds.id,'signer_name',ds.signer_name,'signer_role',ds.signer_role,'signature_type',ds.signature_type,'signed_at',ds.signed_at,'reason',ds.reason))
              FROM document_signatures ds WHERE ds.document_id = dr.id AND ds.deleted_at IS NULL) AS signatures,
             (SELECT json_agg(json_build_object('id',da.id,'action',da.action,'comment',da.comment,'decided_at',da.decided_at,'approver_id',da.approver_id,'approver_name',uap.first_name||' '||uap.last_name))
              FROM document_approvals da LEFT JOIN users uap ON uap.id = da.approver_id WHERE da.document_id = dr.id AND da.deleted_at IS NULL) AS approvals
      FROM document_records dr
      LEFT JOIN document_folders df ON df.id = dr.folder_id
      LEFT JOIN patients p ON p.id = dr.patient_id
      LEFT JOIN users uc ON uc.id = dr.created_by
      LEFT JOIN users uu ON uu.id = dr.updated_by
      WHERE dr.id = $1 AND dr.deleted_at IS NULL
    `, [req.params.id]);

    if (!data.rows.length) return res.status(404).json({ error: "Document introuvable" });

    const doc = data.rows[0];

    // Confidentiality check
    if (doc.confidentiality === "direction_only" && !["admin","directeur_general","directeur_medical","directeur_financier","directeur_rh","directeur_soins"].includes(userRole)) {
      // Log denied access
      await pool.query(`INSERT INTO document_download_logs (document_id,user_id,action,ip_address,denied,deny_reason,site_id,created_by) VALUES ($1,$2,'view',$3,true,'confidentiality',$4,$2)`,
        [req.params.id, req.auth?.userId, req.ip, req.auth?.siteId]);
      return res.status(403).json({ error: "Accès refusé: niveau de confidentialité insuffisant" });
    }

    // Log view
    await pool.query(`INSERT INTO document_download_logs (document_id,user_id,action,ip_address,site_id,created_by) VALUES ($1,$2,'view',$3,$4,$2)`,
      [req.params.id, req.auth?.userId, req.ip, req.auth?.siteId]);

    // Remove internal storage_key from response
    const { storage_key: _sk, ...safeDoc } = doc;
    res.json(safeDoc);
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ─── CREATE ───────────────────────────────────────────────────

// POST /api/documents/records
router.post("/", requirePermission("documents.upload"), async (req: AuthenticatedRequest, res) => {
  const {
    title, description, category, module: mod, entityType, entityId,
    patientId, employeeId, encounterId, invoiceId,
    fileName, mimeType, fileSize, storageKey, checksum,
    confidentiality, folderId, tags, metadata, retentionUntil, expiresAt
  } = req.body;

  if (!title?.trim() || !fileName || !mimeType || !storageKey) {
    return res.status(400).json({ error: "title, fileName, mimeType et storageKey requis" });
  }
  if (!ALLOWED_MIMES.has(mimeType)) {
    return res.status(400).json({ error: `Type MIME non autorisé: ${mimeType}` });
  }

  try {
    // Duplicate checksum detection (cross-document)
    if (checksum) {
      const dup = await pool.query(
        "SELECT id, title FROM document_records WHERE checksum = $1 AND deleted_at IS NULL LIMIT 1",
        [checksum]
      );
      if (dup.data.rows.length) {
        return res.status(409).json({
          error: "Ce fichier est identique à un document existant (checksum identique)",
          duplicate: { id: dup.data.rows[0].id, title: dup.data.rows[0].title }
        });
      }
    }

    const docNumber = `DOC-${Date.now().toString(36).toUpperCase()}`;

    const { data } = await pool.query(`
      INSERT INTO document_records (
        document_number, title, description, category, module, entity_type, entity_id,
        patient_id, employee_id, encounter_id, invoice_id,
        file_name, original_file_name, mime_type, file_size, storage_key, checksum,
        confidentiality, folder_id, tags, metadata, retention_until, expires_at,
        status, site_id, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,'uploaded',$23,$24)
      RETURNING id, document_number, title, category, status, confidentiality, mime_type, file_size, created_at
    `, [
      docNumber, title.trim(), description || null, category || "Autre", mod || null,
      entityType || null, entityId || null, patientId || null,
      employeeId || null, encounterId || null, invoiceId || null,
      fileName, mimeType, fileSize || 0, storageKey, checksum || null,
      confidentiality || "staff", folderId || null,
      tags || [], metadata ? JSON.stringify(metadata) : null,
      retentionUntil || null, expiresAt || null,
      req.auth?.siteId, req.auth?.userId
    ]);

    // Create version 1 record
    await pool.query(`
      INSERT INTO document_versions (document_id, version_number, file_name, storage_key, file_size, mime_type, checksum, change_reason, site_id, created_by)
      VALUES ($1, 1, $2, $3, $4, $5, $6, 'Version initiale', $7, $8)
    `, [data.rows[0].id, fileName, storageKey, fileSize || 0, mimeType, checksum || null, req.auth?.siteId, req.auth?.userId]);

    res.status(201).json(data.rows[0]);
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur lors de l'enregistrement du document" });
  }
});

// ─── UPDATE METADATA ──────────────────────────────────────────

// PATCH /api/documents/records/:id
router.patch("/:id", requirePermission("documents.update_metadata"), async (req: AuthenticatedRequest, res) => {
  const { title, description, category, confidentiality, folderId, tags, metadata, retentionUntil, expiresAt } = req.body;
  try {
    const { data } = await pool.query(`
      UPDATE document_records SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        category = COALESCE($3, category),
        confidentiality = COALESCE($4, confidentiality),
        folder_id = COALESCE($5, folder_id),
        tags = COALESCE($6, tags),
        metadata = COALESCE($7, metadata),
        retention_until = COALESCE($8, retention_until),
        expires_at = COALESCE($9, expires_at),
        updated_at = now(), updated_by = $10, version = version + 1
      WHERE id = $11 AND deleted_at IS NULL
      RETURNING id, document_number, title, status, updated_at
    `, [title, description, category, confidentiality, folderId,
        tags, metadata ? JSON.stringify(metadata) : null,
        retentionUntil, expiresAt, req.auth?.userId, req.params.id]);
    if (!data.rows.length) return res.status(404).json({ error: "Document introuvable" });
    res.json(data.rows[0]);
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

// ─── SIGN ─────────────────────────────────────────────────────

// POST /api/documents/records/:id/sign
router.post("/:id/sign", requirePermission("documents.sign"), async (req: AuthenticatedRequest, res) => {
  const { reason, signatureType } = req.body;
  if (!reason?.trim()) return res.status(400).json({ error: "La raison de signature est requise" });

  try {
    const docRes = await pool.query(
      "SELECT storage_key, status FROM document_records WHERE id = $1 AND deleted_at IS NULL",
      [req.params.id]
    );
    if (!docRes.data.rows.length) return res.status(404).json({ error: "Document introuvable" });

    const userRes = await pool.query(
      "SELECT first_name, last_name, role FROM users WHERE id = $1",
      [req.auth?.userId]
    );
    const user = userRes.data.rows[0];

    const docHash = crypto.createHash("sha256")
      .update(docRes.data.rows[0].storage_key + req.auth?.userId + Date.now())
      .digest("hex");

    const { data } = await pool.query(`
      INSERT INTO document_signatures
        (document_id, signer_id, signer_name, signer_role, signature_type, doc_hash, reason, ip_address, site_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $2)
      RETURNING *
    `, [
      req.params.id, req.auth?.userId,
      `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim(),
      user?.role ?? req.auth?.role, signatureType || "signature",
      docHash, reason.trim(), req.ip, req.auth?.siteId
    ]);

    // Update document signed_at
    await pool.query(
      "UPDATE document_records SET signed_at = now(), status = 'signed', updated_at = now(), updated_by = $1 WHERE id = $2",
      [req.auth?.userId, req.params.id]
    );

    // Audit log
    await pool.query(
      "INSERT INTO document_download_logs (document_id,user_id,action,ip_address,site_id,created_by) VALUES ($1,$2,'sign',$3,$4,$2)",
      [req.params.id, req.auth?.userId, req.ip, req.auth?.siteId]
    );

    res.status(201).json(data.rows[0]);
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur lors de la signature" });
  }
});

// ─── APPROVE / REJECT ─────────────────────────────────────────

// POST /api/documents/records/:id/approve
router.post("/:id/approve", requirePermission("documents.approve"), async (req: AuthenticatedRequest, res) => {
  const { comment } = req.body;
  try {
    await pool.query(
      "UPDATE document_records SET status = 'approved', updated_at = now(), updated_by = $1 WHERE id = $2 AND deleted_at IS NULL",
      [req.auth?.userId, req.params.id]
    );
    await pool.query(`
      INSERT INTO document_approvals (document_id, approver_id, action, comment, decided_at, site_id, created_by)
      VALUES ($1, $2, 'approved', $3, now(), $4, $2)
    `, [req.params.id, req.auth?.userId, comment || null, req.auth?.siteId]);

    await pool.query(
      "INSERT INTO document_download_logs (document_id,user_id,action,ip_address,site_id,created_by) VALUES ($1,$2,'approve',$3,$4,$2)",
      [req.params.id, req.auth?.userId, req.ip, req.auth?.siteId]
    );
    res.json({ success: true });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur lors de l'approbation" });
  }
});

// POST /api/documents/records/:id/reject
router.post("/:id/reject", requirePermission("documents.reject"), async (req: AuthenticatedRequest, res) => {
  const { comment } = req.body;
  if (!comment?.trim()) return res.status(400).json({ error: "Un commentaire est requis pour un rejet" });
  try {
    await pool.query(
      "UPDATE document_records SET status = 'rejected', updated_at = now(), updated_by = $1 WHERE id = $2 AND deleted_at IS NULL",
      [req.auth?.userId, req.params.id]
    );
    await pool.query(`
      INSERT INTO document_approvals (document_id, approver_id, action, comment, decided_at, site_id, created_by)
      VALUES ($1, $2, 'rejected', $3, now(), $4, $2)
    `, [req.params.id, req.auth?.userId, comment.trim(), req.auth?.siteId]);
    res.json({ success: true });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur lors du rejet" });
  }
});

// ─── ARCHIVE / RESTORE ────────────────────────────────────────

// POST /api/documents/records/:id/archive
router.post("/:id/archive", requirePermission("documents.archive"), async (req: AuthenticatedRequest, res) => {
  try {
    const { data } = await pool.query(`
      UPDATE document_records SET status = 'archived', archived_at = now(), updated_at = now(), updated_by = $1
      WHERE id = $2 AND deleted_at IS NULL RETURNING id
    `, [req.auth?.userId, req.params.id]);
    if (!data.rows.length) return res.status(404).json({ error: "Document introuvable" });
    await pool.query("INSERT INTO document_download_logs (document_id,user_id,action,ip_address,site_id,created_by) VALUES ($1,$2,'archive',$3,$4,$2)",
      [req.params.id, req.auth?.userId, req.ip, req.auth?.siteId]);
    res.json({ success: true });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur lors de l'archivage" });
  }
});

// POST /api/documents/records/:id/restore
router.post("/:id/restore", requirePermission("documents.restore"), async (req: AuthenticatedRequest, res) => {
  try {
    const { data } = await pool.query(`
      UPDATE document_records SET status = 'uploaded', archived_at = NULL, deleted_at = NULL, updated_at = now(), updated_by = $1
      WHERE id = $2 RETURNING id
    `, [req.auth?.userId, req.params.id]);
    if (!data.rows.length) return res.status(404).json({ error: "Document introuvable" });
    res.json({ success: true });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur lors de la restauration" });
  }
});

// ─── SOFT DELETE ─────────────────────────────────────────────

// DELETE /api/documents/records/:id
router.delete("/:id", requirePermission("documents.delete_soft"), async (req: AuthenticatedRequest, res) => {
  try {
    const { data } = await pool.query(`
      UPDATE document_records SET deleted_at = now(), status = 'deleted_soft', updated_by = $1
      WHERE id = $2 AND deleted_at IS NULL AND legal_hold = false RETURNING id
    `, [req.auth?.userId, req.params.id]);
    if (!data.rows.length) return res.status(404).json({ error: "Document introuvable ou sous legal hold" });
    res.json({ success: true });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// ─── DOWNLOAD / PREVIEW URLs ─────────────────────────────────

// GET /api/documents/records/:id/download-url
router.get("/:id/download-url", requirePermission("documents.download"), async (req: AuthenticatedRequest, res) => {
  try {
    const { data } = await pool.query(
      "SELECT storage_key, file_name, mime_type, confidentiality, legal_hold FROM document_records WHERE id = $1 AND deleted_at IS NULL",
      [req.params.id]
    );
    if (!data.rows.length) return res.status(404).json({ error: "Document introuvable" });

    const doc = data.rows[0];
    const userRole = req.auth?.role ?? "";

    // Confidentiality guard
    if (doc.confidentiality === "direction_only" && !["admin","directeur_general","directeur_medical"].includes(userRole)) {
      await pool.query("INSERT INTO document_download_logs (document_id,user_id,action,ip_address,denied,deny_reason,site_id,created_by) VALUES ($1,$2,'download',$3,true,'confidentiality',$4,$2)",
        [req.params.id, req.auth?.userId, req.ip, req.auth?.siteId]);
      return res.status(403).json({ error: "Accès refusé" });
    }

    // Serve the file directly — all access proxied through backend (storage_key never exposed)
    try {
      const { stream, size } = await localStorageService.streamFile(doc.storage_key);

      // Audit
      await pool.query(
        "INSERT INTO document_download_logs (document_id,user_id,action,ip_address,site_id,created_by) VALUES ($1,$2,'download',$3,$4,$2)",
        [req.params.id, req.auth?.userId, req.ip, req.auth?.siteId],
      );

      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.file_name)}"`);
      res.setHeader("Content-Type", doc.mime_type);
      res.setHeader("Content-Length", size);
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate"); // never cache medical files
      res.setHeader("X-Content-Type-Options", "nosniff");

      stream.on("error", () => { if (!res.headersSent) res.status(500).end(); });
      stream.pipe(res);
    } catch (err) {
      if (err instanceof FileNotFoundError) {
        return res.status(404).json({ error: "Fichier introuvable sur le serveur" });
      }
      throw err; // bubble up to outer catch
    }
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur lors de la génération du lien" });
  }
});

// GET /api/documents/records/:id/preview-url — same but for inline preview (no download header)
router.get("/:id/preview-url", requirePermission("documents.view"), async (req: AuthenticatedRequest, res) => {
  try {
    const { data } = await pool.query(
      "SELECT storage_key, file_name, mime_type, confidentiality FROM document_records WHERE id = $1 AND deleted_at IS NULL",
      [req.params.id]
    );
    if (!data.rows.length) return res.status(404).json({ error: "Document introuvable" });

    const doc = data.rows[0];

    try {
      const { stream, size } = await localStorageService.streamFile(doc.storage_key);

      await pool.query(
        "INSERT INTO document_download_logs (document_id,user_id,action,ip_address,site_id,created_by) VALUES ($1,$2,'view',$3,$4,$2)",
        [req.params.id, req.auth?.userId, req.ip, req.auth?.siteId],
      );

      res.setHeader("Content-Type", doc.mime_type);
      res.setHeader("Content-Length", size);
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.file_name)}"`);
      res.setHeader("Cache-Control", "no-store, must-revalidate");
      res.setHeader("X-Content-Type-Options", "nosniff");

      stream.on("error", () => { if (!res.headersSent) res.status(500).end(); });
      stream.pipe(res);
    } catch (err) {
      if (err instanceof FileNotFoundError) {
        return res.status(404).json({ error: "Fichier introuvable sur le serveur" });
      }
      res.status(500).json({ error: "Fichier temporairement indisponible" });
    }
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ─── COMMENT ─────────────────────────────────────────────────

// POST /api/documents/records/:id/comments
router.post("/:id/comments", requirePermission("documents.view"), async (req: AuthenticatedRequest, res) => {
  const { content, parentId, isInternal } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "Contenu du commentaire requis" });
  try {
    const { data } = await pool.query(`
      INSERT INTO document_comments (document_id, content, parent_id, is_internal, site_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [req.params.id, content.trim(), parentId || null, isInternal !== false, req.auth?.siteId, req.auth?.userId]);
    res.status(201).json(data.rows[0]);
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur lors de l'ajout du commentaire" });
  }
});

// ─── FAVORITE ────────────────────────────────────────────────

// POST /api/documents/records/:id/favorite
router.post("/:id/favorite", requirePermission("documents.view"), async (req: AuthenticatedRequest, res) => {
  try {
    await pool.query(
      "UPDATE document_records SET is_favorite = NOT is_favorite, updated_at = now() WHERE id = $1 AND created_by = $2",
      [req.params.id, req.auth?.userId]
    );
    res.json({ success: true });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
