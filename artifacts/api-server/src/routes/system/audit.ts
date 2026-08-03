import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";

const router = Router();

async function auditLog(pool: any, userId: string, module: string, description: string, ip?: string) {
  try {
    await pool.query(
      "INSERT INTO user_activity_logs (user_id, user_name, user_role, action, module, description, ip) SELECT $1, u.first_name||' '||u.last_name, u.role, 'view'::user_activity_action, $2, $3, $4 FROM users u WHERE u.id=$1",
      [userId, module, description, ip ?? null]
    );
  } catch { /* non-blocking */ }
}

// GET /export-csv — must be before /:id to avoid conflict
router.get(
  "/export-csv",
  requireAuth,
  requirePermission("system.audit.view"),
  async (req, res) => {
    const conditions: string[] = [];
    const params: any[] = [];

    if (req.query.user_id) {
      params.push(req.query.user_id);
      conditions.push(`l.user_id=$${params.length}`);
    }
    if (req.query.module) {
      params.push(req.query.module);
      conditions.push(`l.module=$${params.length}`);
    }
    if (req.query.action) {
      params.push(req.query.action);
      conditions.push(`l.action=$${params.length}`);
    }
    if (req.query.date_from) {
      params.push(req.query.date_from);
      conditions.push(`l.timestamp>=$${params.length}`);
    }
    if (req.query.date_to) {
      params.push(req.query.date_to);
      conditions.push(`l.timestamp<=$${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
      const { rows } = await pool.query(
        `SELECT l.id, l.user_name, l.user_role, l.action, l.module, l.description, l.ip, l.timestamp
         FROM user_activity_logs l
         ${where}
         ORDER BY l.timestamp DESC
         LIMIT 10000`,
        params
      );

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="audit-logs.csv"');

      const csvHeader = "id,user_name,user_role,action,module,description,ip,created_at\n";
      const csvRows = rows.map((r: any) => {
        const description = String(r.description ?? "").replace(/"/g, '""');
        return [
          r.id,
          `"${(r.user_name ?? "").replace(/"/g, '""')}"`,
          r.user_role ?? "",
          r.action ?? "",
          r.module ?? "",
          `"${description}"`,
          r.ip ?? "",
          r.created_at ? new Date(r.created_at).toISOString() : "",
        ].join(",");
      });

      res.send(csvHeader + csvRows.join("\n"));
    } catch {
      res.status(500).json({ message: "Erreur lors de l'export CSV." });
    }
  }
);

// GET /
router.get(
  "/",
  requireAuth,
  requirePermission("system.audit.view"),
  async (req: AuthenticatedRequest, res) => {
    const conditions: string[] = [];
    const params: any[] = [];

    if (req.query.user_id) {
      params.push(req.query.user_id);
      conditions.push(`l.user_id=$${params.length}`);
    }
    if (req.query.module) {
      params.push(req.query.module);
      conditions.push(`l.module=$${params.length}`);
    }
    if (req.query.action) {
      params.push(req.query.action);
      conditions.push(`l.action=$${params.length}`);
    }
    if (req.query.date_from) {
      params.push(req.query.date_from);
      conditions.push(`l.timestamp>=$${params.length}`);
    }
    if (req.query.date_to) {
      params.push(req.query.date_to);
      conditions.push(`l.timestamp<=$${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
      const { rows } = await pool.query(
        `SELECT l.*, u.first_name||' '||u.last_name as user_display
         FROM user_activity_logs l
         LEFT JOIN users u ON u.id=l.user_id
         ${where}
         ORDER BY l.timestamp DESC LIMIT 200`,
        params
      );
      // Audit the access itself (non-blocking, after fetch)
      auditLog(pool, req.auth!.userId, "audit", "Consultation des logs d'audit", req.ip).catch(() => {});
      res.json({ logs: rows });
    } catch {
      res.status(500).json({ message: "Erreur lors de la récupération des logs d'audit." });
    }
  }
);

// GET /:id
router.get(
  "/:id",
  requireAuth,
  requirePermission("system.audit.view"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT l.*, u.first_name||' '||u.last_name as user_display FROM user_activity_logs l LEFT JOIN users u ON u.id=l.user_id WHERE l.id=$1",
        [req.params.id]
      );
      if (!rows[0]) {
        res.status(404).json({ message: "Entrée d'audit introuvable." });
        return;
      }
      auditLog(pool, req.auth!.userId, "audit", `Consultation détail log d'audit: ${req.params.id}`, req.ip).catch(() => {});
      res.json({ log: rows[0] });
    } catch {
      res.status(500).json({ message: "Erreur lors de la récupération de l'entrée d'audit." });
    }
  }
);

export default router;
