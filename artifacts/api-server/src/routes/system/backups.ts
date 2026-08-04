import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { requireStepUp, requireStepUpFor } from "../../middleware/requireStepUp.js";

const router = Router();

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

// ── GET / ─────────────────────────────────────────────────────────────────────
router.get("/", requireAuth, requirePermission("system.backups.view"), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*, u.first_name||' '||u.last_name AS initiator_name
       FROM system_backups b
       LEFT JOIN users u ON u.id = b.initiated_by
       ORDER BY b.created_at DESC LIMIT 50`,
    );
    res.json({ backups: rows });
  } catch {
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// ── POST / — create backup ────────────────────────────────────────────────────
router.post("/", requireAuth, requirePermission("system.backups.create"), async (req: AuthenticatedRequest, res) => {
  const { type = "postgresql", notes } = req.body ?? {};
  try {
    const { rows } = await pool.query(
      `INSERT INTO system_backups (type, status, initiated_by, notes, encrypted)
       VALUES ($1::system_backup_type, 'queued', $2, $3, true)
       RETURNING *`,
      [type, req.auth!.userId, notes ?? null],
    );
    await auditLog(req.auth!.userId, `Sauvegarde créée (type: ${type})`, req.ip);
    res.status(201).json({ backup: rows[0] });
  } catch {
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// ── GET /:id ──────────────────────────────────────────────────────────────────
router.get("/:id", requireAuth, requirePermission("system.backups.view"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*, u.first_name||' '||u.last_name AS initiator_name
       FROM system_backups b LEFT JOIN users u ON u.id=b.initiated_by
       WHERE b.id=$1`,
      [req.params.id],
    );
    if (!rows[0]) { res.status(404).json({ message: "Sauvegarde introuvable." }); return; }
    res.json({ backup: rows[0] });
  } catch {
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// ── POST /:id/verify ──────────────────────────────────────────────────────────
router.post("/:id/verify", requireAuth, requirePermission("system.backups.view"), async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM system_backups WHERE id=$1", [req.params.id]);
    if (!rows[0]) { res.status(404).json({ message: "Sauvegarde introuvable." }); return; }
    const backup = rows[0];
    res.json({
      backupId:   backup.id,
      valid:      !!backup.checksum,
      checksum:   backup.checksum ?? null,
      verifiedAt: new Date().toISOString(),
      status:     backup.status,
    });
  } catch {
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// ── POST /:id/restore-plan ────────────────────────────────────────────────────
router.post(
  "/:id/restore-plan",
  requireAuth,
  requirePermission("system.backups.restore"),
  requireStepUpFor("restore"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { rows: bRows } = await pool.query("SELECT * FROM system_backups WHERE id=$1", [req.params.id]);
      if (!bRows[0]) { res.status(404).json({ message: "Sauvegarde introuvable." }); return; }

      const { rows: sessionRows } = await pool.query<{ count: string }>(
        "SELECT count(*)::int FROM user_sessions WHERE expires_at > now() AND revoked_at IS NULL",
      );
      const activeSessions = parseInt(String(sessionRows[0]?.count ?? "0"));

      const { rows: mRows } = await pool.query<{ enabled: boolean }>(
        "SELECT enabled FROM system_maintenance LIMIT 1",
      );
      const maintenanceEnabled = mRows[0]?.enabled ?? false;

      await auditLog(req.auth!.userId, `Plan de restauration consulté pour la sauvegarde ${req.params.id}`, req.ip);

      res.json({
        backupId: req.params.id,
        backup:   bRows[0],
        planCreatedAt: new Date().toISOString(),
        maintenanceModeEnabled: maintenanceEnabled,
        activeSessions,
        warnings: [
          ...(!maintenanceEnabled ? ["⚠️ Le mode maintenance n'est pas activé — les utilisateurs peuvent accéder au système pendant la restauration."] : []),
          ...(activeSessions > 0 ? [`⚠️ ${activeSessions} session(s) active(s) détectée(s).`] : []),
        ],
        steps: [
          "1. Activer le mode maintenance (Centre de contrôle → Maintenance)",
          "2. Vérifier qu'aucune opération médicale critique n'est en cours",
          "3. Créer une sauvegarde de sécurité du système actuel",
          "4. Attendre la fin des sessions actives ou les révoquer",
          "5. Exécuter la restauration via pg_restore (DBA uniquement, accès serveur direct)",
          "6. Vérifier l'intégrité des données après restauration",
          "7. Tester les fonctionnalités clés (authentification, patients, consultations)",
          "8. Désactiver le mode maintenance",
        ],
        requiresMaintenance:      true,
        estimatedDowntimeMinutes: 15,
        disclaimer:
          "⛔ La restauration doit être exécutée manuellement par un DBA avec accès direct au serveur. " +
          "Cette interface ne déclenche PAS de restauration automatique.",
      });
    } catch {
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ── PATCH /:id/protect ────────────────────────────────────────────────────────
router.patch("/:id/protect", requireAuth, requirePermission("system.backups.create"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE system_backups SET protected=true, updated_at=now() WHERE id=$1 RETURNING *",
      [req.params.id],
    );
    if (!rows[0]) { res.status(404).json({ message: "Sauvegarde introuvable." }); return; }
    res.json({ backup: rows[0] });
  } catch {
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// ── DELETE /:id ────────────────────────────────────────────────────────────────
router.delete("/:id", requireAuth, requirePermission("system.backups.create"), async (req: AuthenticatedRequest, res) => {
  const { confirmPhrase } = req.body ?? {};
  if (confirmPhrase !== "SUPPRIMER") {
    res.status(400).json({ message: "Phrase de confirmation incorrecte. Saisissez SUPPRIMER pour confirmer." });
    return;
  }
  try {
    const { rows } = await pool.query("SELECT * FROM system_backups WHERE id=$1", [req.params.id]);
    if (!rows[0]) { res.status(404).json({ message: "Sauvegarde introuvable." }); return; }
    if (rows[0].protected) {
      res.status(403).json({ message: "Cette sauvegarde est protégée. Retirez la protection avant de supprimer." });
      return;
    }
    await pool.query(
      "UPDATE system_backups SET status='deleted', updated_at=now() WHERE id=$1",
      [req.params.id],
    );
    await auditLog(req.auth!.userId, `Sauvegarde supprimée (id: ${req.params.id})`, req.ip);
    res.status(204).send();
  } catch {
    res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
