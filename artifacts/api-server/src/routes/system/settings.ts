import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { requireStepUp, requireStepUpFor } from "../../middleware/requireStepUp.js";

const router = Router();

async function auditLog(userId: string, module: string, description: string, ip?: string) {
  try {
    await pool.query(
      "INSERT INTO user_activity_logs (user_id, user_name, user_role, action, module, description, ip) SELECT $1, u.first_name||' '||u.last_name, u.role, 'view'::user_activity_action, $2, $3, $4 FROM users u WHERE u.id=$1",
      [userId, module, description, ip ?? null]
    );
  } catch { /* non-blocking */ }
}

const DEFAULT_SETTINGS = {
  hospital_name: "IRISSAM Hospital",
  hospital_name_ar: "مستشفى إيريسام",
  logo_url: null,
  address: null,
  phone: null,
  email: null,
  currency: "MAD",
  timezone: "Africa/Casablanca",
  date_format: "DD/MM/YYYY",
  default_language: "fr",
  mrn_format: "MRN-{YYYY}-{SEQ6}",
  encounter_number_format: "ENC-{YYYY}-{SEQ6}",
  invoice_number_format: "INV-{YYYY}-{SEQ6}",
  admission_number_format: "ADM-{YYYY}-{SEQ6}",
  backup_retention_days: 30,
  session_duration_hours: 8,
  password_policy: {
    minLength: 8,
    requireUppercase: true,
    requireNumber: true,
    requireSymbol: false,
    maxAgeDays: 90,
  },
  notification_settings: {},
  pwa_settings: {},
  blocked_ips: [],
  allowlisted_ips: [],
};

// GET /
router.get(
  "/",
  requireAuth,
  requirePermission("system.settings.view"),
  async (_req, res) => {
    try {
      const { rows } = await pool.query("SELECT * FROM system_settings LIMIT 1");
      res.json({ settings: rows[0] ?? DEFAULT_SETTINGS });
    } catch {
      res.status(500).json({ message: "Erreur lors de la récupération des paramètres." });
    }
  }
);

// PATCH /
router.patch(
  "/",
  requireAuth,
  requirePermission("system.settings.manage"),
  async (req: AuthenticatedRequest, res) => {
    const allowed = [
      "hospital_name", "hospital_name_ar", "logo_url", "address", "phone", "email",
      "currency", "timezone", "date_format", "default_language",
      "mrn_format", "encounter_number_format", "invoice_number_format", "admission_number_format",
      "backup_retention_days", "session_duration_hours",
      "password_policy", "notification_settings", "pwa_settings",
      "blocked_ips", "allowlisted_ips",
    ];

    const updates: string[] = ["updated_by=$1", "updated_at=now()"];
    const params: any[] = [req.auth!.userId];

    for (const field of allowed) {
      if (field in req.body) {
        params.push(req.body[field]);
        const isJson = ["password_policy", "notification_settings", "pwa_settings"].includes(field);
        updates.push(`${field}=$${params.length}${isJson ? "::jsonb" : ""}`);
      }
    }

    if (updates.length === 2) {
      res.status(400).json({ message: "Aucun champ valide à mettre à jour." });
      return;
    }

    try {
      // Get or create settings row
      let { rows } = await pool.query("SELECT id FROM system_settings LIMIT 1");
      if (!rows[0]) {
        const insert = await pool.query(
          `INSERT INTO system_settings (hospital_name, currency, timezone, date_format, default_language, backup_retention_days, session_duration_hours, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [
            DEFAULT_SETTINGS.hospital_name,
            DEFAULT_SETTINGS.currency,
            DEFAULT_SETTINGS.timezone,
            DEFAULT_SETTINGS.date_format,
            DEFAULT_SETTINGS.default_language,
            DEFAULT_SETTINGS.backup_retention_days,
            DEFAULT_SETTINGS.session_duration_hours,
            req.auth!.userId,
          ]
        );
        rows = insert.rows;
      }

      params.push(rows[0].id);
      const { rows: updated } = await pool.query(
        `UPDATE system_settings SET ${updates.join(",")} WHERE id=$${params.length} RETURNING *`,
        params
      );

      await auditLog(req.auth!.userId, "settings", "Paramètres système modifiés", req.ip);
      res.json({ settings: updated[0] });
    } catch {
      res.status(500).json({ message: "Erreur lors de la mise à jour des paramètres." });
    }
  }
);

// POST /reset
router.post(
  "/reset",
  requireAuth,
  requirePermission("system.settings.manage"),
  requireStepUpFor("reset_settings"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { rows } = await pool.query("SELECT id FROM system_settings LIMIT 1");
      if (!rows[0]) {
        res.status(404).json({ message: "Aucun paramètre à réinitialiser." });
        return;
      }
      await pool.query(
        `UPDATE system_settings SET password_policy=$1::jsonb, updated_by=$2, updated_at=now() WHERE id=$3`,
        [
          JSON.stringify({
            minLength: 8,
            requireUppercase: true,
            requireNumber: true,
            requireSymbol: false,
            maxAgeDays: 90,
          }),
          req.auth!.userId,
          rows[0].id,
        ]
      );
      await auditLog(req.auth!.userId, "settings", "Politique de mot de passe réinitialisée", req.ip);
      res.json({ reset: true });
    } catch {
      res.status(500).json({ message: "Erreur lors de la réinitialisation." });
    }
  }
);

export default router;
