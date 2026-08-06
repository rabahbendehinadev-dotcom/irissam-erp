import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

// GET /api/documents/folders — folder tree
router.get("/", requirePermission("documents.view"), async (req: AuthenticatedRequest, res) => {
  try {
    const siteId = req.auth?.siteId;
    const pqr = await pool.query(`
      SELECT f.*,
        (SELECT count(*) FROM document_records dr
         WHERE dr.folder_id = f.id AND dr.deleted_at IS NULL) AS document_count,
        (SELECT count(*) FROM document_folders cf
         WHERE cf.parent_id = f.id AND cf.deleted_at IS NULL) AS children_count
      FROM document_folders f
      WHERE f.deleted_at IS NULL
        ${siteId ? "AND (f.site_id = $1 OR f.site_id IS NULL)" : ""}
      ORDER BY f.path ASC
    `, siteId ? [siteId] : []);
    res.json({ folders: pqr.rows });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur lors du chargement des dossiers" });
  }
});

// GET /api/documents/folders/:id
router.get("/:id", requirePermission("documents.view"), async (req: AuthenticatedRequest, res) => {
  try {
    const pqr = await pool.query(
      "SELECT * FROM document_folders WHERE id = $1 AND deleted_at IS NULL",
      [req.params.id]
    );
    if (!pqr.rows.length) return res.status(404).json({ error: "Dossier introuvable" });
    res.json(pqr.rows[0]);
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/documents/folders
router.post("/", requirePermission("documents.create_folder"), async (req: AuthenticatedRequest, res) => {
  const { name, parentId, category, description, confidentiality, color, icon } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Nom du dossier requis" });

  try {
    let path = `/${name.trim()}`;
    if (parentId) {
      const parent = await pool.query(
        "SELECT path FROM document_folders WHERE id = $1 AND deleted_at IS NULL",
        [parentId]
      );
      if (!parent.rows.length) return res.status(404).json({ error: "Dossier parent introuvable" });
      path = `${parent.rows[0].path}/${name.trim()}`;
    }

    const pqr = await pool.query(`
      INSERT INTO document_folders (name, path, parent_id, category, description, confidentiality, color, icon, site_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [name.trim(), path, parentId || null, category || null, description || null,
        confidentiality || "staff", color || null, icon || null,
        req.auth?.siteId || null, req.auth?.userId]);

    res.status(201).json(pqr.rows[0]);
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur lors de la création du dossier" });
  }
});

// PATCH /api/documents/folders/:id
router.patch("/:id", requirePermission("documents.create_folder"), async (req: AuthenticatedRequest, res) => {
  const { name, description, confidentiality, color, icon } = req.body;
  try {
    const pqr = await pool.query(`
      UPDATE document_folders
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          confidentiality = COALESCE($3, confidentiality),
          color = COALESCE($4, color),
          icon = COALESCE($5, icon),
          updated_at = now(), updated_by = $6
      WHERE id = $7 AND deleted_at IS NULL AND is_system = false
      RETURNING *
    `, [name, description, confidentiality, color, icon, req.auth?.userId, req.params.id]);
    if (!pqr.rows.length) return res.status(404).json({ error: "Dossier introuvable ou système" });
    res.json(pqr.rows[0]);
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// DELETE /api/documents/folders/:id (soft)
router.delete("/:id", requirePermission("documents.delete_soft"), async (req: AuthenticatedRequest, res) => {
  try {
    const pqr = await pool.query(`
      UPDATE document_folders
      SET deleted_at = now(), updated_by = $1
      WHERE id = $2 AND deleted_at IS NULL AND is_system = false
      RETURNING id
    `, [req.auth?.userId, req.params.id]);
    if (!pqr.rows.length) return res.status(404).json({ error: "Dossier introuvable ou système" });
    res.json({ success: true });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
