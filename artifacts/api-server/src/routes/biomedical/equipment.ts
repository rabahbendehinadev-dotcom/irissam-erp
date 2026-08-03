import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) { return { userId: req.user!.userId }; }

// ── List ──────────────────────────────────────────────────────────────────
router.get("/", requirePermission("biomed.equipment.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { status, category_id, location_id, criticality, q,
              limit = "25", page = "1" } = req.query as Record<string,string>;
      const lim = Math.min(Number(limit) || 25, 100);
      const off = (Math.max(Number(page) || 1, 1) - 1) * lim;
      const conds: string[] = ["e.deleted_at IS NULL"];
      const vals:  unknown[] = [];
      if (status)      { vals.push(status);      conds.push(`e.status=$${vals.length}`); }
      if (category_id) { vals.push(category_id); conds.push(`e.category_id=$${vals.length}::uuid`); }
      if (location_id) { vals.push(location_id); conds.push(`e.location_id=$${vals.length}::uuid`); }
      if (criticality) { vals.push(criticality); conds.push(`e.criticality=$${vals.length}`); }
      if (q)           { vals.push(`%${q}%`);    conds.push(`(e.name ILIKE $${vals.length} OR e.internal_code ILIKE $${vals.length} OR e.serial_number ILIKE $${vals.length})`); }
      const where = conds.join(" AND ");
      const [rows, cnt] = await Promise.all([
        pool.query(`SELECT e.*, c.name AS category_name, c.color AS category_color,
            m.name AS manufacturer_name, mo.name AS model_name, l.name AS location_name
          FROM biomedical_equipment e
          LEFT JOIN biomedical_categories   c  ON c.id = e.category_id
          LEFT JOIN biomedical_manufacturers m  ON m.id = e.manufacturer_id
          LEFT JOIN biomedical_models        mo ON mo.id = e.model_id
          LEFT JOIN biomedical_locations     l  ON l.id = e.location_id
          WHERE ${where} ORDER BY e.created_at DESC LIMIT ${lim} OFFSET ${off}`, vals),
        pool.query(`SELECT COUNT(*) FROM biomedical_equipment e WHERE ${where}`, vals),
      ]);
      res.json({ data: rows.rows, total: Number(cnt.rows[0].count), page: Number(page), limit: lim });
    } catch (err) { next(err); }
  }
);

// ── Get one ───────────────────────────────────────────────────────────────
router.get("/:id", requirePermission("biomed.equipment.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT e.*, c.name AS category_name, m.name AS manufacturer_name,
            mo.name AS model_name, l.name AS location_name
          FROM biomedical_equipment e
          LEFT JOIN biomedical_categories   c  ON c.id = e.category_id
          LEFT JOIN biomedical_manufacturers m  ON m.id = e.manufacturer_id
          LEFT JOIN biomedical_models        mo ON mo.id = e.model_id
          LEFT JOIN biomedical_locations     l  ON l.id = e.location_id
          WHERE e.id=$1::uuid AND e.deleted_at IS NULL`, [req.params.id]);
      if (!rows[0]) return void res.status(404).json({ error: "Équipement non trouvé" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

// ── Create ────────────────────────────────────────────────────────────────
router.post("/", requirePermission("biomed.equipment.create"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const {
        name, category_id, model_id, manufacturer_id, supplier_id,
        location_id, department, responsible_user_id, status, criticality,
        serial_number, barcode, qr_code,
        purchase_date, installation_date, commissioning_date, warranty_end_date,
        expected_life_years, purchase_price, current_value,
        maintenance_interval_days, calibration_interval_days,
        next_maintenance_date, next_calibration_date, notes,
      } = req.body;
      if (!name) return void res.status(400).json({ error: "name requis" });
      const { rows } = await pool.query(
        `INSERT INTO biomedical_equipment (
          name, category_id, model_id, manufacturer_id, supplier_id,
          location_id, department, responsible_user_id, status, criticality,
          serial_number, barcode, qr_code,
          purchase_date, installation_date, commissioning_date, warranty_end_date,
          expected_life_years, purchase_price, current_value,
          maintenance_interval_days, calibration_interval_days,
          next_maintenance_date, next_calibration_date, notes,
          created_by, updated_by
        ) VALUES (
          $1,$2::uuid,$3::uuid,$4::uuid,$5::uuid,
          $6::uuid,$7,$8::uuid,$9,$10,
          $11,$12,$13,
          $14,$15,$16,$17,
          $18,$19,$20,
          $21,$22,
          $23,$24,$25,
          $26::uuid,$26::uuid
        ) RETURNING *`,
        [name, category_id??null, model_id??null, manufacturer_id??null, supplier_id??null,
         location_id??null, department??null, responsible_user_id??null,
         status??"en_attente_installation", criticality??"normale",
         serial_number??null, barcode??null, qr_code??null,
         purchase_date??null, installation_date??null, commissioning_date??null, warranty_end_date??null,
         expected_life_years??null, purchase_price??null, current_value??null,
         maintenance_interval_days??null, calibration_interval_days??null,
         next_maintenance_date??null, next_calibration_date??null, notes??null,
         act.userId]);
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// ── Update ────────────────────────────────────────────────────────────────
router.patch("/:id", requirePermission("biomed.equipment.edit"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const allowed = [
        "name","status","criticality","category_id","model_id","manufacturer_id","supplier_id",
        "location_id","department","responsible_user_id","serial_number","barcode","qr_code",
        "purchase_date","installation_date","commissioning_date","warranty_end_date",
        "expected_life_years","purchase_price","current_value","notes",
        "maintenance_interval_days","calibration_interval_days",
        "next_maintenance_date","next_calibration_date","last_maintenance_date","last_calibration_date",
      ];
      const sets: string[] = ["updated_by=$1::uuid","version=version+1","updated_at=now()"];
      const vals: unknown[] = [act.userId];
      for (const k of allowed) {
        if (req.body[k] !== undefined) { vals.push(req.body[k] ?? null); sets.push(`${k}=$${vals.length}`); }
      }
      vals.push(req.params.id);
      const { rows } = await pool.query(
        `UPDATE biomedical_equipment SET ${sets.join(",")} WHERE id=$${vals.length}::uuid AND deleted_at IS NULL RETURNING *`,
        vals);
      if (!rows[0]) return void res.status(404).json({ error: "Équipement non trouvé" });

      // If status changed to hors_service, log a failure
      if (req.body.status === "hors_service" && req.body.failure_description) {
        await pool.query(
          `INSERT INTO biomedical_equipment_failures (equipment_id, description, severity, reported_by)
           VALUES ($1::uuid,$2,$3,$4::uuid)`,
          [req.params.id, req.body.failure_description, req.body.failure_severity??"modere", act.userId]);
      }
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

// ── Soft delete ───────────────────────────────────────────────────────────
router.delete("/:id", requirePermission("biomed.equipment.delete"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { rowCount } = await pool.query(
        `UPDATE biomedical_equipment SET deleted_at=now() WHERE id=$1::uuid AND deleted_at IS NULL`,
        [req.params.id]);
      if (!rowCount) return void res.status(404).json({ error: "Équipement non trouvé" });
      res.status(204).send();
    } catch (err) { next(err); }
  }
);

// ── History ───────────────────────────────────────────────────────────────
router.get("/:id/history", requirePermission("biomed.equipment.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const [wo, calib, fail, insp] = await Promise.all([
        pool.query(`SELECT id, order_number, order_type, status, title, scheduled_date, end_date, total_cost FROM biomedical_work_orders WHERE equipment_id=$1::uuid ORDER BY created_at DESC LIMIT 20`, [req.params.id]),
        pool.query(`SELECT id, calibration_number, status, planned_date, performed_date, is_compliant FROM biomedical_calibrations WHERE equipment_id=$1::uuid ORDER BY planned_date DESC LIMIT 10`, [req.params.id]),
        pool.query(`SELECT id, failure_date, severity, description, downtime_hours FROM biomedical_equipment_failures WHERE equipment_id=$1::uuid ORDER BY failure_date DESC LIMIT 10`, [req.params.id]),
        pool.query(`SELECT id, inspection_date, inspection_type, result FROM biomedical_inspections WHERE equipment_id=$1::uuid ORDER BY inspection_date DESC LIMIT 10`, [req.params.id]),
      ]);
      res.json({ work_orders: wo.rows, calibrations: calib.rows, failures: fail.rows, inspections: insp.rows });
    } catch (err) { next(err); }
  }
);

export default router;
