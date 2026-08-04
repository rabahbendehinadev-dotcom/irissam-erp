import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { requireStepUpFor } from "../../middleware/requireStepUp.js";

const router = Router();

async function auditLog(userId: string, module: string, description: string, ip?: string) {
  try {
    await pool.query(
      "INSERT INTO user_activity_logs (user_id, user_name, user_role, action, module, description, ip) SELECT $1, u.first_name||' '||u.last_name, u.role, 'view'::user_activity_action, $2, $3, $4 FROM users u WHERE u.id=$1",
      [userId, module, description, ip ?? null]
    );
  } catch { /* non-blocking */ }
}

const SEED_INTEGRATIONS = [
  { type: "smtp", label: "Email (SMTP)", environment: "production" },
  { type: "sms", label: "SMS Gateway", environment: "production" },
  { type: "whatsapp", label: "WhatsApp Business API", environment: "production" },
  { type: "object_storage", label: "Stockage Objet (S3)", environment: "production" },
  { type: "pacs", label: "PACS (Imagerie médicale)", environment: "production" },
  { type: "hl7", label: "HL7 Interface", environment: "production" },
  { type: "fhir", label: "FHIR API", environment: "production" },
  { type: "payment_gateway", label: "Passerelle de Paiement", environment: "production" },
];

// GET / — list integrations (never return config_encrypted)
router.get(
  "/",
  requireAuth,
  requirePermission("system.integrations.view"),
  async (_req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT id, type, label, configured, enabled, config_masked, last_test_at, last_success_at, last_error, environment, created_at FROM system_integrations ORDER BY type"
      );
      res.json({ integrations: rows });
    } catch {
      res.status(500).json({ message: "Erreur lors de la récupération des intégrations." });
    }
  }
);

// POST /seed — upsert default integrations
router.post(
  "/seed",
  requireAuth,
  requirePermission("system.integrations.manage"),
  async (_req, res) => {
    let seeded = 0;
    try {
      for (const integ of SEED_INTEGRATIONS) {
        const result = await pool.query(
          `INSERT INTO system_integrations (type, label, configured, enabled, environment)
           VALUES ($1, $2, false, false, $3)
           ON CONFLICT (type, environment) DO NOTHING`,
          [integ.type, integ.label, integ.environment]
        );
        seeded += result.rowCount ?? 0;
      }
      res.json({ seeded });
    } catch {
      res.status(500).json({ message: "Erreur lors de la création des intégrations par défaut." });
    }
  }
);

// POST /:id/test
router.post(
  "/:id/test",
  requireAuth,
  requirePermission("system.integrations.manage"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT id FROM system_integrations WHERE id=$1",
        [req.params.id]
      );
      if (!rows[0]) {
        res.status(404).json({ message: "Intégration introuvable." });
        return;
      }
      await pool.query(
        "UPDATE system_integrations SET last_test_at=now(), updated_at=now() WHERE id=$1",
        [req.params.id]
      );
      res.json({
        tested: true,
        reachable: false,
        note: "Test de connexion réel non disponible — configurez les identifiants via l'interface.",
      });
    } catch {
      res.status(500).json({ message: "Erreur lors du test de l'intégration." });
    }
  }
);

// PATCH /:id
// Secret fields (password, apiKey, secret, token) require step-up authentication.
// Non-secret fields (label, enabled) do not.
router.patch(
  "/:id",
  requireAuth,
  requirePermission("system.integrations.manage"),
  async (req: AuthenticatedRequest, res) => {
    const { label, enabled, config } = req.body ?? {};

    // Enforce step-up when secrets are being updated
    if (config && typeof config === "object") {
      const secretFields = ["password", "apiKey", "secret", "token"];
      const hasSecrets = secretFields.some((f) =>
        Object.keys(config as object).some((k) => k.toLowerCase().includes(f.toLowerCase()))
      );
      if (hasSecrets) {
        const rawToken = req.headers["x-step-up-token"] as string | undefined;
        if (!rawToken) {
          res.status(403).json({
            code: "STEP_UP_REQUIRED",
            message: "Authentification renforcée requise pour modifier des secrets d'intégration.",
            requiredOperation: "update_integration_secret",
          });
          return;
        }
        const crypto = (await import("node:crypto")).default;
        const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
        const { rows: su } = await pool.query(
          `SELECT id FROM system_step_up_tokens
           WHERE token_hash=$1 AND user_id=$2 AND expires_at>now() AND used_at IS NULL
             AND (operation='general' OR operation='update_integration_secret')`,
          [hash, req.auth!.userId],
        );
        if (!su[0]) {
          res.status(403).json({ code: "STEP_UP_EXPIRED", message: "Token step-up invalide ou expiré." });
          return;
        }
        await pool.query("UPDATE system_step_up_tokens SET used_at=now() WHERE id=$1", [su[0].id]).catch(() => {});
      }
    }
    try {
      const { rows: existing } = await pool.query(
        "SELECT id FROM system_integrations WHERE id=$1",
        [req.params.id]
      );
      if (!existing[0]) {
        res.status(404).json({ message: "Intégration introuvable." });
        return;
      }

      const updates: string[] = ["updated_at=now()"];
      const params: any[] = [];

      if (label !== undefined) {
        params.push(label);
        updates.push(`label=$${params.length}`);
      }
      if (enabled !== undefined) {
        params.push(enabled);
        updates.push(`enabled=$${params.length}`);
      }

      if (config && typeof config === "object") {
        const secretFields = ["password", "apiKey", "secret", "token"];
        const hasSecrets = secretFields.some((f) => f in config);

        if (hasSecrets) {
          // Build masked config: keep host/port/from/username/url, mask secret fields
          const masked: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(config)) {
            if (secretFields.some((sf) => k.toLowerCase().includes(sf.toLowerCase()))) {
              masked[k] = "****";
            } else {
              masked[k] = v;
            }
          }
          const encrypted = Buffer.from(JSON.stringify(config)).toString("base64");

          params.push(JSON.stringify(masked));
          updates.push(`config_masked=$${params.length}::jsonb`);
          params.push(encrypted);
          updates.push(`config_encrypted=$${params.length}`);
          params.push(true);
          updates.push(`configured=$${params.length}`);
        }
      }

      params.push(req.params.id);
      const { rows } = await pool.query(
        `UPDATE system_integrations SET ${updates.join(",")} WHERE id=$${params.length}
         RETURNING id, type, label, configured, enabled, config_masked, last_test_at, last_success_at, last_error, environment, created_at, updated_at`,
        params
      );

      await auditLog(req.auth!.userId, "integrations", `Intégration mise à jour: ${req.params.id}`, req.ip);
      res.json({ integration: rows[0] });
    } catch {
      res.status(500).json({ message: "Erreur lors de la mise à jour de l'intégration." });
    }
  }
);

export default router;
