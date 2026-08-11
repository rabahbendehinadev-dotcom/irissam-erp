/**
 * /api/hr/positions — Postes & Départements RH (référentiels d'affectation).
 *
 * Ces référentiels alimentent l'assistant « Nouvel employé » (étape
 * Affectation) et la page RH « Postes / Dép. ». Aucune valeur de
 * démonstration : tout est créé par l'administration depuis l'interface.
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

/** "" → null : les selects/inputs vides du frontend ne doivent jamais être castés en enum/uuid/numeric. */
function nn(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
}

/** Erreurs PG courantes → réponses françaises exploitables par l'UI. */
function pgErrorResponse(err: any, res: any): boolean {
  if (err?.code === "23505") {
    res.status(409).json({ error: "Doublon détecté : un enregistrement avec ce code ou ce nom existe déjà." });
    return true;
  }
  if (err?.code === "22P02" || err?.code === "22007" || err?.code === "22008") {
    res.status(400).json({ error: "Valeur invalide dans le formulaire (format ou type incorrect)." });
    return true;
  }
  if (err?.code === "23503") {
    res.status(409).json({ error: "Référence invalide : l'élément lié n'existe pas ou est utilisé ailleurs." });
    return true;
  }
  return false;
}

// GET /hr/positions
router.get("/", requirePermission("hr.employees.view"), async (_req, res, next) => {
  try {
    const rows = await pool.query(`
      SELECT p.*,
        d.name AS department_name,
        COUNT(ep.employee_id)::int AS headcount,
        GREATEST(0, COALESCE(p.max_headcount, 0) - COUNT(ep.employee_id)::int) AS vacancies
      FROM employee_positions p
      LEFT JOIN hr_departments d ON d.id = p.department_id
      LEFT JOIN employee_profiles ep ON ep.position_id = p.id AND ep.deleted_at IS NULL
      WHERE p.deleted_at IS NULL
      GROUP BY p.id, d.name
      ORDER BY p.name`);
    res.json(rows.rows);
  } catch (err) { next(err); }
});

// POST /hr/positions
router.post("/", requirePermission("hr.employees.create"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const act = { userId: req.auth?.userId ?? "system" };
    const { code, name, category, departmentId, description, requiredQualification, maxHeadcount } = req.body;
    if (!nn(name)) return void res.status(400).json({ error: "Le nom du poste est obligatoire." });
    const row = await pool.query(`
      INSERT INTO employee_positions (code, name, category, department_id, description, required_qualification, max_headcount, created_by, updated_by)
      VALUES ($1,$2,$3::personnel_category,$4::uuid,$5,$6,$7,$8::uuid,$8::uuid) RETURNING *`,
      [nn(code), name, nn(category), nn(departmentId), nn(description), nn(requiredQualification), nn(maxHeadcount), act.userId]);
    res.status(201).json(row.rows[0]);
  } catch (err: any) {
    if (pgErrorResponse(err, res)) return;
    next(err);
  }
});

// PATCH /hr/positions/:id
router.patch("/:id", requirePermission("hr.employees.update"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const act = { userId: req.auth?.userId ?? "system" };
    const { name, description, category, departmentId, requiredQualification, maxHeadcount, active } = req.body;
    await pool.query(`
      UPDATE employee_positions SET
        name=COALESCE($1,name), description=COALESCE($2,description),
        category=COALESCE($3::personnel_category,category),
        department_id=COALESCE($4::uuid,department_id),
        required_qualification=COALESCE($5,required_qualification),
        max_headcount=COALESCE($6,max_headcount), active=COALESCE($7,active),
        updated_at=NOW(), updated_by=$8::uuid
      WHERE id=$9::uuid AND deleted_at IS NULL`,
      [nn(name), nn(description), nn(category), nn(departmentId), nn(requiredQualification),
       nn(maxHeadcount), active ?? null, act.userId, String(req.params.id)]);
    const row = await pool.query("SELECT * FROM employee_positions WHERE id=$1::uuid", [String(req.params.id)]);
    res.json(row.rows[0]);
  } catch (err: any) {
    if (pgErrorResponse(err, res)) return;
    next(err);
  }
});

// GET /hr/positions/departments
router.get("/departments", requirePermission("hr.employees.view"), async (_req, res, next) => {
  try {
    const rows = await pool.query(`
      SELECT d.*,
        mgr.first_name || ' ' || mgr.last_name AS manager_name,
        COUNT(ep.employee_id)::int AS headcount
      FROM hr_departments d
      LEFT JOIN employees mgr ON mgr.id = d.manager_id
      LEFT JOIN employee_profiles ep ON ep.department_id = d.id AND ep.deleted_at IS NULL
      WHERE d.deleted_at IS NULL
      GROUP BY d.id, mgr.first_name, mgr.last_name
      ORDER BY d.name`);
    res.json(rows.rows);
  } catch (err) { next(err); }
});

// POST /hr/positions/departments
router.post("/departments", requirePermission("hr.employees.create"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const act = { userId: req.auth?.userId ?? "system" };
    const { code, name, parentId, siteId, managerId, description } = req.body;
    if (!nn(name)) return void res.status(400).json({ error: "Le nom du département est obligatoire." });
    const row = await pool.query(`
      INSERT INTO hr_departments (code, name, parent_id, site_id, manager_id, description, created_by, updated_by)
      VALUES ($1,$2,$3::uuid,$4,$5::uuid,$6,$7::uuid,$7::uuid) RETURNING *`,
      [nn(code), name, nn(parentId), nn(siteId), nn(managerId), nn(description), act.userId]);
    res.status(201).json(row.rows[0]);
  } catch (err: any) {
    if (pgErrorResponse(err, res)) return;
    next(err);
  }
});

// PATCH /hr/positions/departments/:id
router.patch("/departments/:id", requirePermission("hr.employees.update"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const act = { userId: req.auth?.userId ?? "system" };
    const { name, managerId, description, active } = req.body;
    await pool.query(`
      UPDATE hr_departments SET
        name=COALESCE($1,name), manager_id=COALESCE($2::uuid,manager_id),
        description=COALESCE($3,description), active=COALESCE($4,active),
        updated_at=NOW(), updated_by=$5::uuid
      WHERE id=$6::uuid AND deleted_at IS NULL`,
      [nn(name), nn(managerId), nn(description), active ?? null, act.userId, String(req.params.id)]);
    const row = await pool.query("SELECT * FROM hr_departments WHERE id=$1::uuid", [String(req.params.id)]);
    res.json(row.rows[0]);
  } catch (err: any) {
    if (pgErrorResponse(err, res)) return;
    next(err);
  }
});

export default router;
