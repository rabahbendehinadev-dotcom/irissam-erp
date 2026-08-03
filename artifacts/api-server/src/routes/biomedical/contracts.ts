import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) { return { userId: req.user!.userId }; }

router.get("/", requirePermission("biomed.contract.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { status, supplier_id, limit = "25", page = "1" } = req.query as Record<string,string>;
      const lim = Math.min(Number(limit)||25,100);
      const off = (Math.max(Number(page)||1,1)-1)*lim;
      const conds: string[] = [];
      const vals: unknown[] = [];
      if (status)     { vals.push(status);     conds.push(`c.status=$${vals.length}`); }
      if (supplier_id){ vals.push(supplier_id);conds.push(`c.supplier_id=$${vals.length}::uuid`); }
      const where = conds.length ? "WHERE "+conds.join(" AND ") : "";
      const [rows, cnt] = await Promise.all([
        pool.query(`SELECT c.*, s.name AS supplier_name
          FROM biomedical_contracts c LEFT JOIN biomedical_suppliers s ON s.id=c.supplier_id
          ${where} ORDER BY c.end_date ASC LIMIT ${lim} OFFSET ${off}`, vals),
        pool.query(`SELECT COUNT(*) FROM biomedical_contracts c ${where}`, vals),
      ]);
      res.json({ data: rows.rows, total: Number(cnt.rows[0].count), page: Number(page), limit: lim });
    } catch (err) { next(err); }
  }
);

router.get("/:id", requirePermission("biomed.contract.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT c.*, s.name AS supplier_name FROM biomedical_contracts c
         LEFT JOIN biomedical_suppliers s ON s.id=c.supplier_id WHERE c.id=$1::uuid`, [req.params.id]);
      if (!rows[0]) return void res.status(404).json({ error: "Contrat non trouvé" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

router.post("/", requirePermission("biomed.contract.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { contract_number, supplier_id, contract_type, title, description,
              start_date, end_date, value, currency, scope,
              sla_response_hours, sla_resolution_hours, covered_equipment,
              renewal_reminder_days, notes } = req.body;
      if (!contract_number||!supplier_id||!start_date||!end_date||!title)
        return void res.status(400).json({ error: "contract_number, supplier_id, title, start_date, end_date requis" });
      const { rows } = await pool.query(
        `INSERT INTO biomedical_contracts
          (contract_number, supplier_id, contract_type, status, title, description,
           start_date, end_date, value, currency, scope,
           sla_response_hours, sla_resolution_hours, covered_equipment,
           renewal_reminder_days, notes, created_by)
         VALUES ($1,$2::uuid,$3,'brouillon',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16::uuid)
         RETURNING *`,
        [contract_number, supplier_id, contract_type??"maintenance", title, description??null,
         start_date, end_date, value??null, currency??"DZD", scope??null,
         sla_response_hours??null, sla_resolution_hours??null,
         JSON.stringify(covered_equipment??[]),
         renewal_reminder_days??30, notes??null, act.userId]);
      res.status(201).json(rows[0]);
    } catch (err: any) {
      if (err.code === "23505") return void res.status(409).json({ error: "Numéro de contrat déjà existant" });
      next(err);
    }
  }
);

router.patch("/:id", requirePermission("biomed.contract.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const allowed = ["status","title","description","start_date","end_date","value",
                       "scope","sla_response_hours","sla_resolution_hours","notes","renewal_reminder_days"];
      const sets = ["updated_at=now()"];
      const vals: unknown[] = [];
      for (const k of allowed) {
        if (req.body[k] !== undefined) { vals.push(req.body[k]??null); sets.push(`${k}=$${vals.length}`); }
      }
      vals.push(req.params.id);
      const { rows } = await pool.query(
        `UPDATE biomedical_contracts SET ${sets.join(",")} WHERE id=$${vals.length}::uuid RETURNING *`, vals);
      if (!rows[0]) return void res.status(404).json({ error: "Contrat non trouvé" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

export default router;
