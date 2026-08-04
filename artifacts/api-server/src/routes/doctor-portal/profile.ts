/**
 * Doctor Portal — Doctor Profile & Preferences
 * GET   /profile      — doctor info + preferences
 * PATCH /profile      — update preferences (language, signature, notifications)
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import type { AuthenticatedRequest } from "../../middleware/requireAuth.js";

const router = Router();

router.get("/", async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth!;
  try {
    const [userRow, prefRow, sessions] = await Promise.all([
      pool.query(
        `SELECT id, first_name, last_name, email, role, language,
                department_id, site_id, avatar_url, is_active, last_login_at
         FROM users WHERE id=$1`,
        [auth.userId]
      ),
      pool.query(
        `SELECT * FROM doctor_portal_preferences WHERE user_id=$1`,
        [auth.userId]
      ),
      pool.query(
        `SELECT id, created_at, ip_address, user_agent, is_active
         FROM user_sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10`,
        [auth.userId]
      ).catch(() => ({ rows: [] })),
    ]);
    if (!userRow.rowCount) { res.status(404).json({ message: "Profil introuvable" }); return; }
    res.json({
      user:        userRow.rows[0],
      preferences: prefRow.rows[0] ?? { user_id: auth.userId, language: "fr", notification_prefs: {} },
      sessions:    sessions.rows,
    });
  } catch (err) {
    console.error("[dp/profile GET]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.patch("/", async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth!;
  const { language, signatureText, notificationPrefs } = req.body as Record<string, unknown>;
  try {
    await pool.query(
      `INSERT INTO doctor_portal_preferences (user_id, language, signature_text, notification_prefs, updated_at)
       VALUES ($1, COALESCE($2,'fr'), $3, COALESCE($4,'{}')::jsonb, now())
       ON CONFLICT (user_id) DO UPDATE SET
         language           = COALESCE($2, doctor_portal_preferences.language),
         signature_text     = COALESCE($3, doctor_portal_preferences.signature_text),
         notification_prefs = COALESCE($4,'{}')::jsonb || doctor_portal_preferences.notification_prefs,
         updated_at         = now()`,
      [auth.userId, language ?? null, signatureText ?? null,
       notificationPrefs ? JSON.stringify(notificationPrefs) : null]
    );
    res.json({ updated: true });
  } catch (err) {
    console.error("[dp/profile PATCH]", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;
