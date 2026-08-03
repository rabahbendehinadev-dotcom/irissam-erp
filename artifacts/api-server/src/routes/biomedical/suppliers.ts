import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

router.get("/", requirePermission("biomed.equipment.view"),
  async (_req, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(`SELECT * FROM biomedical_suppliers WHERE is_active ORDER BY name`);
      res.json({ data: rows, total: rows.length });
    } catch (err) { next(err); }
  }
);

router.post("/", requirePermission("biomed.contract.manage"),
  async (req, res, next): Promise<void> => {
    try {
      const { code, name, address, city, phone, email, contact_name, payment_terms_days, notes } = req.body;
      if (!code||!name) return void res.status(400).json({ error: "code et name requis" });
      const { rows } = await pool.query(
        `INSERT INTO biomedical_suppliers (code,name,address,city,phone,email,contact_name,payment_terms_days,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [code,name,address??null,city??null,phone??null,email??null,contact_name??null,payment_terms_days??30,notes??null]);
      res.status(201).json(rows[0]);
    } catch (err: any) {
      if (err.code==="23505") return void res.status(409).json({ error: "Code fournisseur déjà utilisé" });
      next(err);
    }
  }
);

router.patch("/:id", requirePermission("biomed.contract.manage"),
  async (req, res, next): Promise<void> => {
    try {
      const { name,address,city,phone,email,contact_name,is_active,notes } = req.body;
      const { rows } = await pool.query(
        `UPDATE biomedical_suppliers SET name=COALESCE($1,name),address=COALESCE($2,address),
          city=COALESCE($3,city),phone=COALESCE($4,phone),email=COALESCE($5,email),
          contact_name=COALESCE($6,contact_name),is_active=COALESCE($7,is_active),notes=COALESCE($8,notes),updated_at=now()
         WHERE id=$9::uuid RETURNING *`,
        [name??null,address??null,city??null,phone??null,email??null,contact_name??null,is_active??null,notes??null,req.params.id]);
      if (!rows[0]) return void res.status(404).json({ error: "Fournisseur non trouvé" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

export default router;
