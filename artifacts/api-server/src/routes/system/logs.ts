import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";

const router = Router();

function redactObj(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => {
      const sensitive = ["password", "token", "cookie", "secret", "authorization", "key", "credential", "passwd", "pwd"];
      return [
        k,
        sensitive.some((s) => k.toLowerCase().includes(s))
          ? "***REDACTED***"
          : v && typeof v === "object"
          ? redactObj(v)
          : v,
      ];
    })
  );
}

function buildFilters(query: any): { conditions: string[]; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];

  if (query.level) {
    params.push(query.level);
    conditions.push(`l.level=$${params.length}`);
  }
  if (query.module) {
    params.push(`%${query.module}%`);
    conditions.push(`l.module ILIKE $${params.length}`);
  }
  if (query.date_from) {
    params.push(query.date_from);
    conditions.push(`l.created_at>=$${params.length}`);
  }
  if (query.date_to) {
    params.push(query.date_to);
    conditions.push(`l.created_at<=$${params.length}`);
  }
  if (query.user_id) {
    params.push(query.user_id);
    conditions.push(`l.user_id=$${params.length}`);
  }
  if (query.request_id) {
    params.push(query.request_id);
    conditions.push(`l.request_id=$${params.length}`);
  }
  if (query.status_code) {
    params.push(parseInt(query.status_code as string, 10));
    conditions.push(`l.status_code=$${params.length}`);
  }
  if (query.environment) {
    params.push(query.environment);
    conditions.push(`l.environment=$${params.length}`);
  }

  return { conditions, params };
}

// GET /
router.get(
  "/",
  requireAuth,
  requirePermission("system.logs.view"),
  async (req, res) => {
    const { before_id, limit } = req.query;
    const { conditions, params } = buildFilters(req.query);

    const maxLimit = Math.min(parseInt(limit as string || "100", 10), 200);

    if (before_id) {
      params.push(before_id);
      conditions.push(`l.id < $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
      const { rows } = await pool.query(
        `SELECT l.id, l.level, l.module, l.message, l.context, l.request_id, l.user_id, l.ip, l.status_code, l.environment, l.created_at
         FROM system_logs l
         ${where}
         ORDER BY l.created_at DESC
         LIMIT ${maxLimit}`,
        params
      );
      const redacted = rows.map((r) => ({ ...r, context: redactObj(r.context) }));
      res.json({ logs: redacted });
    } catch {
      res.status(500).json({ message: "Erreur lors de la récupération des logs." });
    }
  }
);

// GET /export-csv
router.get(
  "/export-csv",
  requireAuth,
  requirePermission("system.logs.view"),
  async (req, res) => {
    const { conditions, params } = buildFilters(req.query);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
      const { rows } = await pool.query(
        `SELECT l.id, l.level, l.module, l.message, l.request_id, l.user_id, l.ip, l.status_code, l.created_at
         FROM system_logs l
         ${where}
         ORDER BY l.created_at DESC
         LIMIT 5000`,
        params
      );

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="system-logs.csv"');

      const csvHeader = "id,level,module,message,request_id,user_id,ip,status_code,created_at\n";
      const csvRows = rows.map((r) => {
        const message = String(r.message ?? "").substring(0, 500).replace(/"/g, '""');
        return [
          r.id,
          r.level,
          r.module,
          `"${message}"`,
          r.request_id ?? "",
          r.user_id ?? "",
          r.ip ?? "",
          r.status_code ?? "",
          r.created_at ? new Date(r.created_at).toISOString() : "",
        ].join(",");
      });

      res.send(csvHeader + csvRows.join("\n"));
    } catch {
      res.status(500).json({ message: "Erreur lors de l'export CSV des logs." });
    }
  }
);

export default router;
