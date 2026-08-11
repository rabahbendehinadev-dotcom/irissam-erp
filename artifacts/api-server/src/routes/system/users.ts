/**
 * /api/system/users — Console d'administration des comptes ERP.
 *
 * La RH (« Personnel & RH ») reste la source maîtresse des employés : les
 * comptes sont créés depuis le module RH (assistant employé ou fiche employé)
 * et cette console permet à l'administration de les gouverner :
 *   liste + employé lié + dernier login, changement de rôle,
 *   activation / suspension, réinitialisation du mot de passe (provisoire,
 *   changement obligatoire au premier login), liaison / déliaison d'une fiche
 *   employé, journal d'activité par compte.
 *
 * Sécurité : toutes les routes exigent la permission `admin.users`
 * (super_admin bypass via requirePermission). Garde-fous : impossible de
 * suspendre son propre compte ou de neutraliser le dernier super admin actif.
 *
 * NOTE : les permissions du JWT sont recalculées au prochain refresh du token
 * (≤ 15 min) ou au prochain login — un changement de rôle n'est donc pas
 * instantané pour une session déjà ouverte.
 */
import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission.js";
import type { AuthenticatedRequest } from "../../middleware/requireAuth.js";

const router = Router();
router.use(requirePermission("admin.users"));

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * users.role (enum user_role) est une colonne héritée conservée pour
 * compatibilité : les permissions réelles proviennent de user_roles →
 * role_permissions (calculées au login). On y range la valeur la plus proche.
 */
const LEGACY_ROLE_ENUM: Record<string, string> = {
  super_admin: "super_admin",
  system_administrator: "admin",
  administrator: "administrateur",
  director: "directeur",
  directeur_general: "directeur",
  directeur_medical: "directeur",
  directeur_rh: "directeur",
  directeur_financier: "directeur",
  directeur_soins: "directeur",
  manager: "directeur",
  doctor: "doctor",
  nurse: "nurse",
  pharmacist: "pharmacist",
  laboratory: "laboratoire",
  radiology: "radiologie",
  reception: "reception",
  finance: "finance",
  payroll_manager: "finance",
  payroll_officer: "finance",
  insurance_agent: "finance",
  hr: "rh",
  hr_manager: "rh",
  hr_officer: "rh",
};
export function legacyEnumForRole(roleName: string): string {
  return LEGACY_ROLE_ENUM[roleName] ?? "reception";
}

/** Journal système (module security) — best-effort, ne bloque jamais. */
async function logSecurity(actorId: string, message: string, context: Record<string, unknown>) {
  await pool
    .query(
      `INSERT INTO system_logs (level, module, message, context) VALUES ('info', 'security', $1, $2)`,
      [message, JSON.stringify({ ...context, actorId })],
    )
    .catch(() => {});
}

/** Trace RH sur la fiche employé liée au compte (si elle existe) — best-effort. */
async function hrAuditForUser(
  targetUserId: string,
  actorId: string,
  action: string,
  newValues: Record<string, unknown>,
) {
  await pool
    .query(
      `INSERT INTO hr_audit_events (employee_id, actor_id, actor_name, action, entity_type, entity_id, new_values)
       SELECT e.id, $2::uuid, $3, $4, 'user', $1::uuid, $5::jsonb
       FROM employees e
       WHERE e.linked_user_id = $1::uuid AND e.deleted_at IS NULL`,
      [targetUserId, actorId, actorId, action, JSON.stringify(newValues)],
    )
    .catch(() => {});
}

/** Nombre de super admins actifs autres que `excludeUserId` (colonne héritée OU rôle RBAC). */
async function countOtherActiveSuperAdmins(excludeUserId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT u.id)::int AS n
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE u.deleted_at IS NULL
       AND u.account_status = 'active'
       AND u.id <> $1::uuid
       AND (u.role = 'super_admin' OR r.name = 'super_admin')`,
    [excludeUserId],
  );
  return rows[0]?.n ?? 0;
}

// ─── GET /system/users — liste des comptes ───────────────────────────────────
router.get("/", async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim();
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
    const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;

    const conds: string[] = ["u.deleted_at IS NULL"];
    const params: unknown[] = [];
    let pi = 1;
    if (q) {
      conds.push(`(u.first_name ILIKE $${pi} OR u.last_name ILIKE $${pi} OR u.email ILIKE $${pi} OR u.employee_number ILIKE $${pi})`);
      params.push(`%${q}%`);
      pi++;
    }
    if (status === "active" || status === "suspended") {
      conds.push(`u.account_status = $${pi++}`);
      params.push(status);
    }
    const where = conds.join(" AND ");

    const [rows, count, stats] = await Promise.all([
      pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.role AS legacy_role,
                u.account_status, u.last_login_at, u.force_password_change,
                u.locked_until, u.employee_number, u.created_at,
                r.role_name, r.role_display,
                e.id  AS employee_id, e.matricule AS employee_matricule,
                e.first_name AS employee_first_name, e.last_name AS employee_last_name,
                e.status AS employee_status
         FROM users u
         LEFT JOIN LATERAL (
           SELECT ro.name AS role_name, ro.display_name AS role_display
           FROM user_roles ur JOIN roles ro ON ro.id = ur.role_id
           WHERE ur.user_id = u.id
           ORDER BY ur.granted_at DESC LIMIT 1
         ) r ON TRUE
         LEFT JOIN employees e ON e.linked_user_id = u.id AND e.deleted_at IS NULL
         WHERE ${where}
         ORDER BY u.created_at DESC
         LIMIT $${pi} OFFSET $${pi + 1}`,
        [...params, limit, offset],
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM users u WHERE ${where}`, params),
      pool.query(
        `SELECT COUNT(*)::int                                            AS total,
                COUNT(*) FILTER (WHERE account_status = 'active')::int    AS active,
                COUNT(*) FILTER (WHERE account_status <> 'active')::int   AS suspended,
                COUNT(*) FILTER (WHERE last_login_at IS NULL)::int        AS never_logged,
                COUNT(*) FILTER (WHERE force_password_change)::int        AS must_change_password
         FROM users WHERE deleted_at IS NULL`,
      ),
    ]);

    res.json({ data: rows.rows, total: count.rows[0].total, limit, offset, stats: stats.rows[0] });
  } catch (err) { next(err); }
});

// ─── GET /system/users/roles — référentiel des rôles ─────────────────────────
router.get("/roles", async (_req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const rows = await pool.query(
      `SELECT r.id, r.name, r.display_name, r.description,
              (SELECT COUNT(*)::int FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count
       FROM roles r ORDER BY r.display_name`,
    );
    res.json(rows.rows);
  } catch (err) { next(err); }
});

// ─── GET /system/users/link-candidates — employés sans compte ────────────────
router.get("/link-candidates", async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const q = String(req.query.q ?? "").trim();
    const params: unknown[] = [];
    let filter = "";
    if (q) {
      filter = `AND (e.first_name ILIKE $1 OR e.last_name ILIKE $1 OR e.matricule ILIKE $1)`;
      params.push(`%${q}%`);
    }
    const rows = await pool.query(
      `SELECT e.id, e.matricule, e.first_name, e.last_name, e.status,
              pos.name AS position_name
       FROM employees e
       LEFT JOIN employee_profiles ep ON ep.employee_id = e.id AND ep.deleted_at IS NULL
       LEFT JOIN employee_positions pos ON pos.id = ep.position_id
       WHERE e.deleted_at IS NULL AND e.linked_user_id IS NULL AND e.status <> 'archive'
       ${filter}
       ORDER BY e.last_name, e.first_name
       LIMIT 20`,
      params,
    );
    res.json(rows.rows);
  } catch (err) { next(err); }
});

// ─── GET /system/users/:id/activity — journal d'activité du compte ───────────
router.get("/:id/activity", async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const id = String(req.params.id ?? "");
    if (!UUID_RE.test(id)) return void res.status(400).json({ error: "Identifiant de compte invalide" });
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
    const rows = await pool.query(
      `SELECT id, "timestamp", action, module, resource_type, resource_label, description, ip
       FROM user_activity_logs
       WHERE user_id = $1::uuid
       ORDER BY "timestamp" DESC
       LIMIT $2`,
      [id, limit],
    );
    res.json(rows.rows);
  } catch (err) { next(err); }
});

// ─── PATCH /system/users/:id — rôle / liaison employé ────────────────────────
router.patch("/:id", async (req: AuthenticatedRequest, res, next): Promise<void> => {
  const client = await pool.connect();
  try {
    const id = String(req.params.id ?? "");
    if (!UUID_RE.test(id)) { client.release(); return void res.status(400).json({ error: "Identifiant de compte invalide" }); }
    const { roleId } = req.body ?? {};
    const hasLink = Object.prototype.hasOwnProperty.call(req.body ?? {}, "linkedEmployeeId");
    const linkedEmployeeId = req.body?.linkedEmployeeId;
    const actorId = req.auth!.userId;

    await client.query("BEGIN");
    const uQ = await client.query(
      `SELECT id, first_name, last_name, email, role, account_status FROM users
       WHERE id = $1::uuid AND deleted_at IS NULL FOR UPDATE`,
      [id],
    );
    if (!uQ.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Compte non trouvé" }); }
    const user = uQ.rows[0];

    // — Changement de rôle —
    if (roleId) {
      if (!UUID_RE.test(String(roleId))) { await client.query("ROLLBACK"); return void res.status(400).json({ error: "Rôle sélectionné invalide" }); }
      const rQ = await client.query(`SELECT id, name, display_name FROM roles WHERE id = $1::uuid`, [roleId]);
      if (!rQ.rows[0]) { await client.query("ROLLBACK"); return void res.status(400).json({ error: "Rôle sélectionné invalide" }); }
      const role = rQ.rows[0];

      // Garde-fou : ne pas rétrograder le dernier super admin actif
      const wasSuper = user.role === "super_admin";
      if (wasSuper && role.name !== "super_admin" && (await countOtherActiveSuperAdmins(id)) === 0) {
        await client.query("ROLLBACK");
        return void res.status(409).json({ error: "Impossible de retirer le rôle Super Administrateur du dernier super admin actif." });
      }

      await client.query(`DELETE FROM user_roles WHERE user_id = $1::uuid`, [id]);
      await client.query(
        `INSERT INTO user_roles (user_id, role_id, granted_by) VALUES ($1::uuid, $2::uuid, $3::uuid)`,
        [id, role.id, actorId],
      );
      await client.query(
        `UPDATE users SET role = $1::user_role, updated_at = NOW(), updated_by = $2::uuid, version = version + 1
         WHERE id = $3::uuid`,
        [legacyEnumForRole(role.name), actorId, id],
      );
    }

    // — Liaison / déliaison d'une fiche employé —
    if (hasLink) {
      if (linkedEmployeeId === null || linkedEmployeeId === "") {
        const unQ = await client.query(
          `UPDATE employees SET linked_user_id = NULL, updated_at = NOW(), version = version + 1
           WHERE linked_user_id = $1::uuid AND deleted_at IS NULL
           RETURNING id, matricule`,
          [id],
        );
        if (unQ.rows[0]) {
          await client.query(
            `INSERT INTO hr_audit_events (employee_id, actor_id, actor_name, action, entity_type, entity_id, new_values)
             VALUES ($1::uuid, $2::uuid, $2, 'unlink_erp_account', 'user', $3::uuid, $4::jsonb)`,
            [unQ.rows[0].id, actorId, id, JSON.stringify({ email: user.email })],
          );
        }
      } else {
        const empId = String(linkedEmployeeId);
        if (!UUID_RE.test(empId)) { await client.query("ROLLBACK"); return void res.status(400).json({ error: "Identifiant employé invalide" }); }
        const eQ = await client.query(
          `SELECT id, matricule, first_name, last_name, linked_user_id FROM employees
           WHERE id = $1::uuid AND deleted_at IS NULL FOR UPDATE`,
          [empId],
        );
        if (!eQ.rows[0]) { await client.query("ROLLBACK"); return void res.status(400).json({ error: "Employé introuvable" }); }
        const emp = eQ.rows[0];
        if (emp.linked_user_id && emp.linked_user_id !== id) {
          await client.query("ROLLBACK");
          return void res.status(409).json({ error: `L'employé ${emp.matricule} est déjà lié à un autre compte ERP.` });
        }
        const otherQ = await client.query(
          `SELECT matricule FROM employees WHERE linked_user_id = $1::uuid AND id <> $2::uuid AND deleted_at IS NULL`,
          [id, empId],
        );
        if (otherQ.rows[0]) {
          await client.query("ROLLBACK");
          return void res.status(409).json({ error: `Ce compte est déjà lié à l'employé ${otherQ.rows[0].matricule}. Détachez-le d'abord.` });
        }
        await client.query(
          `UPDATE employees SET linked_user_id = $1::uuid, updated_at = NOW(), version = version + 1 WHERE id = $2::uuid`,
          [id, empId],
        );
        await client.query(
          `INSERT INTO hr_audit_events (employee_id, actor_id, actor_name, action, entity_type, entity_id, new_values)
           VALUES ($1::uuid, $2::uuid, $2, 'link_erp_account', 'user', $3::uuid, $4::jsonb)`,
          [empId, actorId, id, JSON.stringify({ email: user.email, matricule: emp.matricule })],
        );
      }
    }

    await client.query("COMMIT");
    await logSecurity(actorId, `Compte ERP modifié: ${user.email}`, { targetUserId: id, roleId: roleId ?? null, linkedEmployeeId: hasLink ? linkedEmployeeId : undefined });

    const out = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.role AS legacy_role, u.account_status,
              u.last_login_at, u.force_password_change,
              r.role_name, r.role_display,
              e.id AS employee_id, e.matricule AS employee_matricule
       FROM users u
       LEFT JOIN LATERAL (
         SELECT ro.name AS role_name, ro.display_name AS role_display
         FROM user_roles ur JOIN roles ro ON ro.id = ur.role_id
         WHERE ur.user_id = u.id ORDER BY ur.granted_at DESC LIMIT 1
       ) r ON TRUE
       LEFT JOIN employees e ON e.linked_user_id = u.id AND e.deleted_at IS NULL
       WHERE u.id = $1::uuid`,
      [id],
    );
    res.json(out.rows[0]);
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally { client.release(); }
});

// ─── POST /system/users/:id/status — activer / suspendre ─────────────────────
router.post("/:id/status", async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const id = String(req.params.id ?? "");
    if (!UUID_RE.test(id)) return void res.status(400).json({ error: "Identifiant de compte invalide" });
    const { action, reason } = req.body ?? {};
    if (action !== "activate" && action !== "suspend") {
      return void res.status(400).json({ error: "action doit être 'activate' ou 'suspend'" });
    }
    const actorId = req.auth!.userId;

    const uQ = await pool.query(
      `SELECT id, email, role, account_status FROM users WHERE id = $1::uuid AND deleted_at IS NULL`,
      [id],
    );
    if (!uQ.rows[0]) return void res.status(404).json({ error: "Compte non trouvé" });
    const user = uQ.rows[0];

    if (action === "suspend") {
      if (id === actorId) {
        return void res.status(400).json({ error: "Vous ne pouvez pas suspendre votre propre compte." });
      }
      if (user.role === "super_admin" && (await countOtherActiveSuperAdmins(id)) === 0) {
        return void res.status(409).json({ error: "Impossible de suspendre le dernier super admin actif." });
      }
      await pool.query(
        `UPDATE users SET account_status = 'suspended', updated_at = NOW(), updated_by = $1::uuid, version = version + 1
         WHERE id = $2::uuid`,
        [actorId, id],
      );
      // Révoquer les sessions ouvertes du compte suspendu
      await pool.query(
        `UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1::uuid AND revoked_at IS NULL`,
        [id],
      ).catch(() => {});
    } else {
      await pool.query(
        `UPDATE users SET account_status = 'active', failed_login_attempts = 0, locked_until = NULL,
                updated_at = NOW(), updated_by = $1::uuid, version = version + 1
         WHERE id = $2::uuid`,
        [actorId, id],
      );
    }

    await logSecurity(actorId, `Compte ERP ${action === "suspend" ? "suspendu" : "réactivé"}: ${user.email}`, { targetUserId: id, reason: reason ?? null });
    await hrAuditForUser(id, actorId, action === "suspend" ? "suspend_erp_account" : "reactivate_erp_account", { email: user.email, reason: reason ?? null });

    res.json({ ok: true, accountStatus: action === "suspend" ? "suspended" : "active" });
  } catch (err) { next(err); }
});

// ─── POST /system/users/:id/reset-password — mot de passe provisoire ─────────
router.post("/:id/reset-password", async (req: AuthenticatedRequest, res, next): Promise<void> => {
  const client = await pool.connect();
  try {
    const id = String(req.params.id ?? "");
    if (!UUID_RE.test(id)) { client.release(); return void res.status(400).json({ error: "Identifiant de compte invalide" }); }
    const tempPassword = String(req.body?.tempPassword ?? "");
    if (tempPassword.length < 8) {
      client.release();
      return void res.status(400).json({ error: "Le mot de passe provisoire doit contenir au moins 8 caractères." });
    }
    const actorId = req.auth!.userId;

    await client.query("BEGIN");
    const uQ = await client.query(
      `SELECT id, email FROM users WHERE id = $1::uuid AND deleted_at IS NULL FOR UPDATE`,
      [id],
    );
    if (!uQ.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Compte non trouvé" }); }

    const hash = await bcrypt.hash(tempPassword, 12);
    await client.query(
      `UPDATE users SET hashed_password = $1, force_password_change = TRUE,
              failed_login_attempts = 0, locked_until = NULL,
              updated_at = NOW(), updated_by = $2::uuid, version = version + 1
       WHERE id = $3::uuid`,
      [hash, actorId, id],
    );
    // Révoquer toutes les sessions existantes : reconnexion obligatoire
    await client.query(
      `UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1::uuid AND revoked_at IS NULL`,
      [id],
    );
    await client.query("COMMIT");

    await logSecurity(actorId, `Mot de passe réinitialisé (provisoire): ${uQ.rows[0].email}`, { targetUserId: id });
    await hrAuditForUser(id, actorId, "reset_erp_password", { email: uQ.rows[0].email });

    res.json({ ok: true, forcePasswordChange: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally { client.release(); }
});

export default router;
