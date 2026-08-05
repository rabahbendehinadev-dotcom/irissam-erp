import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { requireStepUp, requireStepUpFor } from "../../middleware/requireStepUp.js";
import { runMigrations } from "../../lib/migrations.js";

const router = Router();

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, "../../../../lib/db/migrations");

const MIGRATIONS_LIST = [
  "001_clinical_schema.sql",
  "002_seed_indexes.sql",
  "003_schema_additions.sql",
  "004_auth_rbac.sql",
  "005_rbac_seed.sql",
  "006_fix_legacy_constraints.sql",
  "007_safe_uuid_migration.sql",
  "008_billing_extension.sql",
  "009_billing_hardening.sql",
  "010_insurance_module.sql",
  "011_insurance_permissions.sql",
  "012_overpayment_constraints.sql",
  "013_hr_module.sql",
  "014_hr_permissions.sql",
  "015_medical_stock.sql",
  "016_medical_stock_permissions.sql",
  "017_biomedical.sql",
  "018_biomedical_permissions.sql",
  "019_quality_module.sql",
  "020_quality_permissions.sql",
  "021_executive_dashboard.sql",
  "022_ged_module.sql",
  "023_ged_permissions.sql",
  "024_payroll_module.sql",
  "025_payroll_permissions.sql",
  "026_super_admin_tables.sql",
  "027_super_admin_permissions.sql",
  "028_patient_portal_tables.sql",
  "029_patient_portal_permissions.sql",
  "030_patient_portal_admin.sql",
  "031_portal_otp_security.sql",
  "032_unlock_admin_raise_lockout.sql",
  "033_doctor_portal_tables.sql",
  "034_doctor_portal_permissions.sql",
  "035_reset_admin_password.sql",
];

async function auditLog(userId: string, desc: string, ip?: string) {
  try {
    await pool.query(
      `INSERT INTO user_activity_logs (user_id, user_name, user_role, action, module, description, ip)
       SELECT $1, u.first_name||' '||u.last_name, u.role, 'view'::user_activity_action, 'system', $2, $3
       FROM users u WHERE u.id=$1`,
      [userId, desc, ip ?? null],
    );
  } catch { /* non-blocking */ }
}

// ── GET / — list all migrations with status ──────────────────────────────────
router.get(
  "/",
  requireAuth,
  requirePermission("system.migrations.view"),
  async (_req, res) => {
    try {
      const { rows } = await pool.query<{ name: string; applied_at: Date; duration_ms: number }>(
        "SELECT name, applied_at, duration_ms FROM __migrations ORDER BY id",
      );
      const appliedMap = new Map(rows.map(r => [r.name, r]));

      const result = MIGRATIONS_LIST.map((name, i) => {
        const applied = appliedMap.get(name);
        return {
          number:    i + 1,
          name,
          status:    applied ? "applied" : "pending",
          appliedAt: applied?.applied_at ?? null,
          durationMs: applied?.duration_ms ?? null,
        };
      });

      res.json({ migrations: result, total: MIGRATIONS_LIST.length, applied: appliedMap.size });
    } catch {
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── GET /:name/sql-preview — read-only SQL preview (applied only) ────────────
router.get(
  "/:name/sql-preview",
  requireAuth,
  requirePermission("system.migrations.view"),
  async (req, res) => {
    const name = String(req.params.name);
    if (!MIGRATIONS_LIST.includes(name)) {
      res.status(404).json({ message: "Migration introuvable." });
      return;
    }
    try {
      const { rows } = await pool.query<{ name: string }>(
        "SELECT name FROM __migrations WHERE name = $1 LIMIT 1",
        [name],
      );
      if (!rows.length) {
        res.status(403).json({
          message: "Aperçu SQL non disponible pour les migrations en attente.",
          code:    "PENDING_MIGRATION",
        });
        return;
      }

      const filePath = path.join(MIGRATIONS_DIR, name);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ message: "Fichier SQL introuvable." });
        return;
      }

      const content = fs.readFileSync(filePath, "utf8");
      res.json({
        name,
        preview: content.slice(0, 2000),
        truncated: content.length > 2000,
        totalLength: content.length,
      });
    } catch {
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── POST /verify — compare applied vs expected ────────────────────────────────
router.post(
  "/verify",
  requireAuth,
  requirePermission("system.migrations.view"),
  async (_req, res) => {
    try {
      const { rows } = await pool.query<{ count: string }>("SELECT count(*)::int as count FROM __migrations");
      const applied = parseInt(String(rows[0]?.count ?? "0"));
      const total   = MIGRATIONS_LIST.length;
      const pending = total - applied;
      res.json({ total, applied, pending, ok: applied >= total });
    } catch {
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── POST /apply — apply pending migrations ────────────────────────────────────
router.post(
  "/apply",
  requireAuth,
  requirePermission("system.migrations.apply"),
  requireStepUpFor("apply_migration"),
  async (req: AuthenticatedRequest, res) => {
    try {
      await runMigrations();
      await auditLog(req.auth!.userId, "Migrations en attente appliquées via le centre de contrôle", req.ip);
      res.json({ message: "Migrations appliquées avec succès.", appliedAt: new Date().toISOString() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      res.status(500).json({ message: "Erreur lors de l'application des migrations.", error: msg });
    }
  },
);

export default router;
