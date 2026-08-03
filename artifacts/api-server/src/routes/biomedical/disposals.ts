import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) { return { userId: req.user!.userId }; }

router.get("/", requirePermission("biomed.disposal.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { status, limit = "25", page = "1" } = req.query as Record<string,string>;
      const lim = Math.min(Number(limit)||25,100);
      const off = (Math.max(Number(page)||1,1)-1)*lim;
      const conds: string[] = [];
      const vals: unknown[] = [];
      if (status) { vals.push(status); conds.push(`d.status=$${vals.length}`); }
      const where = conds.length ? "WHERE "+conds.join(" AND ") : "";
      const [rows, cnt] = await Promise.all([
        pool.query(`SELECT d.*, e.name AS equipment_name, e.internal_code, e.purchase_price
          FROM biomedical_disposals d LEFT JOIN biomedical_equipment e ON e.id=d.equipment_id
          ${where} ORDER BY d.created_at DESC LIMIT ${lim} OFFSET ${off}`, vals),
        pool.query(`SELECT COUNT(*) FROM biomedical_disposals d ${where}`, vals),
      ]);
      res.json({ data: rows.rows, total: Number(cnt.rows[0].count), page: Number(page), limit: lim });
    } catch (err) { next(err); }
  }
);

router.post("/", requirePermission("biomed.disposal.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { equipment_id, method, reason, sale_value, notes } = req.body;
      if (!equipment_id||!reason) return void res.status(400).json({ error: "equipment_id et reason requis" });
      const { rows } = await pool.query(
        `INSERT INTO biomedical_disposals (equipment_id, method, reason, sale_value, notes, proposed_by)
         VALUES ($1::uuid,$2,$3,$4,$5,$6::uuid) RETURNING *`,
        [equipment_id, method??"autre", reason, sale_value??null, notes??null, act.userId]);
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

router.post("/:id/approve", requirePermission("biomed.disposal.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rows } = await client.query(
          `UPDATE biomedical_disposals SET status='approuve', approved_by=$1::uuid, approved_at=now(), updated_at=now()
           WHERE id=$2::uuid AND status='propose' RETURNING *`,
          [act.userId, req.params.id]);
        if (!rows[0]) { await client.query("ROLLBACK"); return void res.status(400).json({ error: "Réforme non proposée" }); }
        // Mark equipment as retired
        await client.query(`UPDATE biomedical_equipment SET status='retire', updated_at=now() WHERE id=$1::uuid`, [rows[0].equipment_id]);
        await client.query("COMMIT");
        res.json(rows[0]);
      } catch (e) { await client.query("ROLLBACK"); throw e; }
      finally { client.release(); }
    } catch (err) { next(err); }
  }
);

router.post("/:id/finalize", requirePermission("biomed.disposal.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { disposal_date, sale_value, notes } = req.body;
      const { rows } = await pool.query(
        `UPDATE biomedical_disposals SET status='finalise', disposal_date=$1, sale_value=COALESCE($2,sale_value), notes=COALESCE($3,notes), updated_at=now()
         WHERE id=$4::uuid AND status IN ('approuve','en_cours') RETURNING *`,
        [disposal_date??new Date().toISOString().split("T")[0], sale_value??null, notes??null, req.params.id]);
      if (!rows[0]) return void res.status(400).json({ error: "Réforme ne peut pas être finalisée" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

export default router;
