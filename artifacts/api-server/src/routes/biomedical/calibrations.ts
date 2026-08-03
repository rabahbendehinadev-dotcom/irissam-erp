import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();
function actor(req: AuthenticatedRequest) { return { userId: req.user!.userId }; }

// ── List ──────────────────────────────────────────────────────────────────
router.get("/", requirePermission("biomed.calibration.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { status, equipment_id, from_date, to_date, limit = "25", page = "1" } = req.query as Record<string,string>;
      const lim = Math.min(Number(limit)||25,100);
      const off = (Math.max(Number(page)||1,1)-1)*lim;
      const conds: string[] = [];
      const vals: unknown[] = [];
      if (status)      { vals.push(status);      conds.push(`c.status=$${vals.length}`); }
      if (equipment_id){ vals.push(equipment_id);conds.push(`c.equipment_id=$${vals.length}::uuid`); }
      if (from_date)   { vals.push(from_date);   conds.push(`c.planned_date>=$${vals.length}`); }
      if (to_date)     { vals.push(to_date);     conds.push(`c.planned_date<=$${vals.length}`); }
      const where = conds.length ? "WHERE "+conds.join(" AND ") : "";
      const [rows, cnt] = await Promise.all([
        pool.query(`SELECT c.*, e.name AS equipment_name, e.internal_code
          FROM biomedical_calibrations c
          LEFT JOIN biomedical_equipment e ON e.id = c.equipment_id
          ${where} ORDER BY c.planned_date DESC LIMIT ${lim} OFFSET ${off}`, vals),
        pool.query(`SELECT COUNT(*) FROM biomedical_calibrations c ${where}`, vals),
      ]);
      res.json({ data: rows.rows, total: Number(cnt.rows[0].count), page: Number(page), limit: lim });
    } catch (err) { next(err); }
  }
);

// ── Create ────────────────────────────────────────────────────────────────
router.post("/", requirePermission("biomed.calibration.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { equipment_id, planned_date, calibration_type, assigned_to, external_lab,
              tolerance_percent, notes } = req.body;
      if (!equipment_id || !planned_date) return void res.status(400).json({ error: "equipment_id et planned_date requis" });
      const { rows } = await pool.query(
        `INSERT INTO biomedical_calibrations
          (equipment_id, planned_date, calibration_type, performed_by, external_lab,
           tolerance_percent, notes, created_by)
         VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,$7,$8::uuid) RETURNING *`,
        [equipment_id, planned_date, calibration_type??"interne",
         assigned_to??null, external_lab??null,
         tolerance_percent??null, notes??null, act.userId]);
      // Update next_calibration_date on equipment
      await pool.query(
        `UPDATE biomedical_equipment SET next_calibration_date=LEAST(next_calibration_date,$1) WHERE id=$2::uuid`,
        [planned_date, equipment_id]);
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// ── Record result ─────────────────────────────────────────────────────────
router.post("/:id/record", requirePermission("biomed.calibration.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const act = actor(req);
      const { performed_date, is_compliant, measurements, reference_standards,
              next_due_date, result, uncertainty, notes } = req.body;
      const status = is_compliant ? "conforme" : "non_conforme";
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rows } = await client.query(
          `UPDATE biomedical_calibrations SET
            status=$1, performed_date=$2, is_compliant=$3,
            measurements=$4::jsonb, reference_standards=$5::jsonb,
            next_due_date=$6, result=$7, uncertainty=$8, notes=$9,
            performed_by=$10::uuid, updated_at=now()
           WHERE id=$11::uuid RETURNING *`,
          [status, performed_date??new Date().toISOString().split("T")[0],
           !!is_compliant, JSON.stringify(measurements??[]), JSON.stringify(reference_standards??[]),
           next_due_date??null, result??status, uncertainty??null, notes??null,
           act.userId, req.params.id]);
        if (!rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Calibration non trouvée" }); }

        // Update equipment calibration dates
        await client.query(
          `UPDATE biomedical_equipment SET
            last_calibration_date=$1,
            next_calibration_date=$2,
            calibration_expired=($2 IS NOT NULL AND $2 < CURRENT_DATE)
           WHERE id=$3::uuid`,
          [performed_date??CURRENT_DATE, next_due_date??null, rows[0].equipment_id]);

        await client.query("COMMIT");
        res.json(rows[0]);
      } catch (e) { await client.query("ROLLBACK"); throw e; }
      finally { client.release(); }
    } catch (err) { next(err); }
  }
);

// ── Get one ───────────────────────────────────────────────────────────────
router.get("/:id", requirePermission("biomed.calibration.view"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const [cal, certs] = await Promise.all([
        pool.query(`SELECT c.*, e.name AS equipment_name, e.internal_code FROM biomedical_calibrations c LEFT JOIN biomedical_equipment e ON e.id=c.equipment_id WHERE c.id=$1::uuid`, [req.params.id]),
        pool.query(`SELECT * FROM biomedical_calibration_certificates WHERE calibration_id=$1::uuid`, [req.params.id]),
      ]);
      if (!cal.rows[0]) return void res.status(404).json({ error: "Calibration non trouvée" });
      res.json({ ...cal.rows[0], certificates: certs.rows });
    } catch (err) { next(err); }
  }
);

// ── Add certificate ────────────────────────────────────────────────────────
router.post("/:id/certificates", requirePermission("biomed.calibration.manage"),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { certificate_number, issued_date, valid_until, issued_by, file_url } = req.body;
      if (!certificate_number || !issued_date) return void res.status(400).json({ error: "certificate_number et issued_date requis" });
      const { rows } = await pool.query(
        `INSERT INTO biomedical_calibration_certificates (calibration_id, certificate_number, issued_date, valid_until, issued_by, file_url)
         VALUES ($1::uuid,$2,$3,$4,$5,$6) RETURNING *`,
        [req.params.id, certificate_number, issued_date, valid_until??null, issued_by??null, file_url??null]);
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

const CURRENT_DATE = new Date().toISOString().split("T")[0];
export default router;
