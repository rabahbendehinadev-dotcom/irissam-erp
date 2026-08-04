import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";

const router = Router();

async function auditLog(userId: string, module: string, description: string, ip?: string) {
  try {
    await pool.query(
      "INSERT INTO user_activity_logs (user_id, user_name, user_role, action, module, description, ip) SELECT $1, u.first_name||' '||u.last_name, u.role, 'view'::user_activity_action, $2, $3, $4 FROM users u WHERE u.id=$1",
      [userId, module, description, ip ?? null]
    );
  } catch { /* non-blocking */ }
}

function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

// GET / — list webhooks (never return hashed_secret)
router.get(
  "/",
  requireAuth,
  requirePermission("system.webhooks.view"),
  async (_req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT id, name, endpoint_url, events, active, retry_policy, last_delivery_at, last_status, failure_count, created_by, created_at, updated_at FROM system_webhooks ORDER BY created_at DESC"
      );
      res.json({ webhooks: rows });
    } catch {
      res.status(500).json({ message: "Erreur lors de la récupération des webhooks." });
    }
  }
);

// GET /:id/deliveries
router.get(
  "/:id/deliveries",
  requireAuth,
  requirePermission("system.webhooks.view"),
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT id, webhook_id, event, status_code, left(response_body,500) as response_body, error_message, attempt, delivered_at FROM system_webhook_deliveries WHERE webhook_id=$1 ORDER BY delivered_at DESC LIMIT 50",
        [req.params.id]
      );
      res.json({ deliveries: rows });
    } catch {
      res.status(500).json({ message: "Erreur lors de la récupération des livraisons." });
    }
  }
);

// POST / — create webhook
router.post(
  "/",
  requireAuth,
  requirePermission("system.webhooks.manage"),
  async (req: AuthenticatedRequest, res) => {
    const { name, endpoint_url, events = [], secret, active = true, retry_policy } = req.body ?? {};
    if (!name || !endpoint_url) {
      res.status(400).json({ message: "name et endpoint_url requis." });
      return;
    }
    if (!secret) {
      res.status(400).json({ message: "secret requis." });
      return;
    }
    try {
      const hashed = hashSecret(secret);
      const { rows } = await pool.query(
        `INSERT INTO system_webhooks (name, endpoint_url, events, hashed_secret, active, retry_policy, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, endpoint_url, events, active, retry_policy, created_by, created_at`,
        [name, endpoint_url, events, hashed, active,
         retry_policy != null ? JSON.stringify(retry_policy) : JSON.stringify({ maxAttempts: 3, backoffSeconds: 60 }),
         req.auth!.userId]
      );
      await auditLog(req.auth!.userId, "webhooks", `Webhook créé: ${name}`, req.ip);
      res.status(201).json({ webhook: rows[0] });
    } catch {
      res.status(500).json({ message: "Erreur lors de la création du webhook." });
    }
  }
);

// PATCH /:id — update webhook
router.patch(
  "/:id",
  requireAuth,
  requirePermission("system.webhooks.manage"),
  async (req: AuthenticatedRequest, res) => {
    const { name, endpoint_url, events, secret, active, retry_policy } = req.body ?? {};
    try {
      const { rows: existing } = await pool.query(
        "SELECT id FROM system_webhooks WHERE id=$1",
        [req.params.id]
      );
      if (!existing[0]) {
        res.status(404).json({ message: "Webhook introuvable." });
        return;
      }
      const updates: string[] = [];
      const params: any[] = [];

      if (name !== undefined) { params.push(name); updates.push(`name=$${params.length}`); }
      if (endpoint_url !== undefined) { params.push(endpoint_url); updates.push(`endpoint_url=$${params.length}`); }
      if (events !== undefined) { params.push(events); updates.push(`events=$${params.length}`); }
      if (active !== undefined) { params.push(active); updates.push(`active=$${params.length}`); }
      if (retry_policy !== undefined) { params.push(retry_policy); updates.push(`retry_policy=$${params.length}`); }
      if (secret) { params.push(hashSecret(secret)); updates.push(`hashed_secret=$${params.length}`); }

      if (!updates.length) {
        res.status(400).json({ message: "Aucun champ à mettre à jour." });
        return;
      }
      updates.push(`updated_at=now()`);
      params.push(req.params.id);

      const { rows } = await pool.query(
        `UPDATE system_webhooks SET ${updates.join(",")} WHERE id=$${params.length} RETURNING id, name, endpoint_url, events, active, retry_policy, created_at, updated_at`,
        params
      );
      await auditLog(req.auth!.userId, "webhooks", `Webhook modifié: ${req.params.id}`, req.ip);
      res.json({ webhook: rows[0] });
    } catch {
      res.status(500).json({ message: "Erreur lors de la mise à jour du webhook." });
    }
  }
);

// DELETE /:id
router.delete(
  "/:id",
  requireAuth,
  requirePermission("system.webhooks.manage"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { rows } = await pool.query(
        "DELETE FROM system_webhooks WHERE id=$1 RETURNING id",
        [req.params.id]
      );
      if (!rows[0]) {
        res.status(404).json({ message: "Webhook introuvable." });
        return;
      }
      await auditLog(req.auth!.userId, "webhooks", `Webhook supprimé: ${req.params.id}`, req.ip);
      res.status(204).send();
    } catch {
      res.status(500).json({ message: "Erreur lors de la suppression du webhook." });
    }
  }
);

// POST /:id/test
router.post(
  "/:id/test",
  requireAuth,
  requirePermission("system.webhooks.manage"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT id, endpoint_url, hashed_secret, failure_count FROM system_webhooks WHERE id=$1",
        [req.params.id]
      );
      if (!rows[0]) {
        res.status(404).json({ message: "Webhook introuvable." });
        return;
      }
      const webhook = rows[0];
      const payload = {
        event: "test.ping",
        timestamp: new Date().toISOString(),
        webhookId: req.params.id,
      };
      const sig = crypto
        .createHmac("sha256", webhook.hashed_secret)
        .update(JSON.stringify(payload))
        .digest("hex");

      let statusCode = 0;
      let success = false;
      let responseBody = "";
      let errorMessage: string | null = null;

      try {
        const response = await fetch(webhook.endpoint_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": sig,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });
        statusCode = response.status;
        success = response.ok;
        responseBody = (await response.text()).substring(0, 500);
      } catch (fetchErr: any) {
        errorMessage = fetchErr?.message ?? "Fetch error";
        statusCode = 0;
        success = false;
      }

      await pool.query(
        `INSERT INTO system_webhook_deliveries (webhook_id, event, status_code, response_body, error_message, attempt)
         VALUES ($1, 'test.ping', $2, $3, $4, 1)`,
        [req.params.id, statusCode, responseBody || null, errorMessage]
      ).catch(() => {});

      await pool.query(
        `UPDATE system_webhooks SET last_delivery_at=now(), last_status=$1, failure_count=$2, updated_at=now() WHERE id=$3`,
        [statusCode, success ? 0 : (webhook.failure_count ?? 0) + 1, req.params.id]
      ).catch(() => {});

      res.json({ statusCode, success });
    } catch {
      res.status(500).json({ message: "Erreur lors du test du webhook." });
    }
  }
);

// POST /:id/retry/:deliveryId
router.post(
  "/:id/retry/:deliveryId",
  requireAuth,
  requirePermission("system.webhooks.manage"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { rows: webhookRows } = await pool.query(
        "SELECT id, endpoint_url, hashed_secret, failure_count FROM system_webhooks WHERE id=$1",
        [req.params.id]
      );
      if (!webhookRows[0]) {
        res.status(404).json({ message: "Webhook introuvable." });
        return;
      }
      const { rows: deliveryRows } = await pool.query(
        "SELECT id, event, attempt FROM system_webhook_deliveries WHERE id=$1 AND webhook_id=$2",
        [req.params.deliveryId, req.params.id]
      );
      if (!deliveryRows[0]) {
        res.status(404).json({ message: "Livraison introuvable." });
        return;
      }

      const webhook = webhookRows[0];
      const delivery = deliveryRows[0];
      const payload = {
        event: delivery.event,
        timestamp: new Date().toISOString(),
        webhookId: req.params.id,
        retryOf: req.params.deliveryId,
      };
      const sig = crypto
        .createHmac("sha256", webhook.hashed_secret)
        .update(JSON.stringify(payload))
        .digest("hex");

      let statusCode = 0;
      let success = false;
      let responseBody = "";
      let errorMessage: string | null = null;

      try {
        const response = await fetch(webhook.endpoint_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": sig,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });
        statusCode = response.status;
        success = response.ok;
        responseBody = (await response.text()).substring(0, 500);
      } catch (fetchErr: any) {
        errorMessage = fetchErr?.message ?? "Fetch error";
        statusCode = 0;
        success = false;
      }

      await pool.query(
        `INSERT INTO system_webhook_deliveries (webhook_id, event, status_code, response_body, error_message, attempt)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.params.id, delivery.event, statusCode, responseBody || null, errorMessage, (delivery.attempt ?? 1) + 1]
      ).catch(() => {});

      await pool.query(
        `UPDATE system_webhooks SET last_delivery_at=now(), last_status=$1, failure_count=$2, updated_at=now() WHERE id=$3`,
        [statusCode, success ? 0 : (webhook.failure_count ?? 0) + 1, req.params.id]
      ).catch(() => {});

      res.json({ statusCode, success });
    } catch {
      res.status(500).json({ message: "Erreur lors de la nouvelle tentative de livraison." });
    }
  }
);

export default router;
