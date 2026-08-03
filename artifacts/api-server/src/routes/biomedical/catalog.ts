// Categories, manufacturers, models, locations
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";

const router = Router();

// ── Categories ─────────────────────────────────────────────────────────────
router.get("/categories", requirePermission("biomed.equipment.view"),
  async (_req, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(`SELECT * FROM biomedical_categories WHERE is_active ORDER BY name`);
      res.json({ data: rows });
    } catch (err) { next(err); }
  }
);
router.post("/categories", requirePermission("biomed.equipment.create"),
  async (req, res, next): Promise<void> => {
    try {
      const { code, name, description, color } = req.body;
      if (!code||!name) return void res.status(400).json({ error: "code et name requis" });
      const { rows } = await pool.query(
        `INSERT INTO biomedical_categories (code,name,description,color) VALUES ($1,$2,$3,$4) RETURNING *`,
        [code, name, description??null, color??"#6366F1"]);
      res.status(201).json(rows[0]);
    } catch (err: any) {
      if (err.code==="23505") return void res.status(409).json({ error: "Code catégorie déjà utilisé" });
      next(err);
    }
  }
);

// ── Manufacturers ──────────────────────────────────────────────────────────
router.get("/manufacturers", requirePermission("biomed.equipment.view"),
  async (_req, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(`SELECT * FROM biomedical_manufacturers WHERE is_active ORDER BY name`);
      res.json({ data: rows });
    } catch (err) { next(err); }
  }
);
router.post("/manufacturers", requirePermission("biomed.equipment.create"),
  async (req, res, next): Promise<void> => {
    try {
      const { code, name, country, contact_name, phone, email, website } = req.body;
      if (!code||!name) return void res.status(400).json({ error: "code et name requis" });
      const { rows } = await pool.query(
        `INSERT INTO biomedical_manufacturers (code,name,country,contact_name,phone,email,website)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [code,name,country??null,contact_name??null,phone??null,email??null,website??null]);
      res.status(201).json(rows[0]);
    } catch (err: any) {
      if (err.code==="23505") return void res.status(409).json({ error: "Code fabricant déjà utilisé" });
      next(err);
    }
  }
);

// ── Models ─────────────────────────────────────────────────────────────────
router.get("/models", requirePermission("biomed.equipment.view"),
  async (req, res, next): Promise<void> => {
    try {
      const { manufacturer_id } = req.query as Record<string,string>;
      const cond = manufacturer_id ? "WHERE m.manufacturer_id=$1::uuid" : "";
      const { rows } = await pool.query(
        `SELECT m.*, mf.name AS manufacturer_name FROM biomedical_models m
         LEFT JOIN biomedical_manufacturers mf ON mf.id=m.manufacturer_id
         ${cond} ORDER BY m.name`,
        manufacturer_id ? [manufacturer_id] : []);
      res.json({ data: rows });
    } catch (err) { next(err); }
  }
);
router.post("/models", requirePermission("biomed.equipment.create"),
  async (req, res, next): Promise<void> => {
    try {
      const { manufacturer_id, name, reference, category_id, description,
              expected_life_years, maintenance_interval_days, calibration_interval_days } = req.body;
      if (!manufacturer_id||!name) return void res.status(400).json({ error: "manufacturer_id et name requis" });
      const { rows } = await pool.query(
        `INSERT INTO biomedical_models (manufacturer_id,name,reference,category_id,description,
           expected_life_years,maintenance_interval_days,calibration_interval_days)
         VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,$7,$8) RETURNING *`,
        [manufacturer_id,name,reference??null,category_id??null,description??null,
         expected_life_years??null,maintenance_interval_days??null,calibration_interval_days??null]);
      res.status(201).json(rows[0]);
    } catch (err: any) {
      if (err.code==="23505") return void res.status(409).json({ error: "Ce modèle existe déjà pour ce fabricant" });
      next(err);
    }
  }
);

// ── Locations ──────────────────────────────────────────────────────────────
router.get("/locations", requirePermission("biomed.equipment.view"),
  async (_req, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(`SELECT * FROM biomedical_locations WHERE is_active ORDER BY name`);
      res.json({ data: rows });
    } catch (err) { next(err); }
  }
);
router.post("/locations", requirePermission("biomed.equipment.create"),
  async (req, res, next): Promise<void> => {
    try {
      const { code, name, department, building, floor, room } = req.body;
      if (!code||!name) return void res.status(400).json({ error: "code et name requis" });
      const { rows } = await pool.query(
        `INSERT INTO biomedical_locations (code,name,department,building,floor,room)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [code,name,department??null,building??null,floor??null,room??null]);
      res.status(201).json(rows[0]);
    } catch (err: any) {
      if (err.code==="23505") return void res.status(409).json({ error: "Code localisation déjà utilisé" });
      next(err);
    }
  }
);

export default router;
