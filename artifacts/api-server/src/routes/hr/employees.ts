/**
 * /api/hr/employees — Full CRUD for employees
 * Wizard creation: employees + profiles + contacts + emergency + contract + schedule (transaction)
 */
import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import { auditService } from "../../services/audit";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { legacyEnumForRole } from "../system/users";

const router = Router();

function actor(req: AuthenticatedRequest) {
  return { userId: req.auth?.userId ?? "system", userName: req.auth?.userId ?? "system", userRole: req.auth?.role ?? "guest" };
}

/** Generate next matricule */
async function nextMatricule(client: any): Promise<string> {
  const { rows } = await client.query("SELECT nextval('matricule_seq') AS n");
  return `EMP-${String(rows[0].n).padStart(5, "0")}`;
}
/** Generate next contract number */
async function nextContractNumber(client: any): Promise<string> {
  const { rows } = await client.query("SELECT nextval('contract_number_seq') AS n");
  return `CTR-${new Date().getFullYear()}-${String(rows[0].n).padStart(4, "0")}`;
}

/** "" → NULL : les formulaires envoient des chaînes vides pour les champs non remplis
 *  (PostgreSQL rejette "" pour les colonnes date / uuid / numeric / enum) */
const nn = (v: unknown) => (v === "" || v === undefined || v === null ? null : v);

/** Traduit les erreurs PostgreSQL de format/doublon en réponses françaises claires. Retourne true si gérée. */
function pgErrorResponse(err: any, res: any, step = ""): boolean {
  const stepHint = step ? ` (étape: ${step})` : "";
  if (err?.code === "22007" || err?.code === "22008") {
    res.status(400).json({ error: `Format de date invalide — vérifiez les champs date saisis${stepHint}.` });
    return true;
  }
  if (err?.code === "22P02") {
    res.status(400).json({ error: `Format de données invalide${stepHint} — vérifiez les champs saisis (genre, catégorie, type de contrat, rôle ERP).` });
    return true;
  }
  if (err?.code === "23505") {
    res.status(409).json({ error: "Doublon : un enregistrement identique existe déjà (matricule ou identifiant unique)." });
    return true;
  }
  return false;
}

/* ─── Compte ERP lié (création réservée à l'administration) ────────────────────
 * La fiche employé RH est la source maîtresse ; le compte utilisateur (users)
 * est optionnel et rattaché via employees.linked_user_id (index unique partiel,
 * migration 045). Mot de passe provisoire (bcrypt 12) + force_password_change :
 * changement obligatoire au premier login. Les permissions réelles viennent de
 * user_roles → role_permissions ; users.role n'est que la valeur héritée. */

type ErpAccountInput = { email?: string; roleId?: string; tempPassword?: string; phone?: string | null };
type ErpAccountResult =
  | { ok: true; userId: string; email: string; roleName: string; roleDisplay: string }
  | { ok: false; status: number; error: string };

function canManageAccounts(req: AuthenticatedRequest): boolean {
  return req.auth?.role === "super_admin" || (req.auth?.permissions ?? []).includes("admin.users");
}

async function createErpAccount(
  client: any,
  emp: { id: string; matricule: string; first_name: string; last_name: string },
  account: ErpAccountInput,
  act: { userId: string; userName: string },
): Promise<ErpAccountResult> {
  const email = String(account.email ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, status: 400, error: "Adresse email invalide pour le compte ERP." };
  const tempPassword = String(account.tempPassword ?? "");
  if (tempPassword.length < 8) return { ok: false, status: 400, error: "Le mot de passe provisoire doit contenir au moins 8 caractères." };
  if (!account.roleId) return { ok: false, status: 400, error: "Rôle du compte ERP obligatoire." };
  const roleQ = await client.query(`SELECT id, name, display_name FROM roles WHERE id=$1::uuid`, [account.roleId]);
  if (!roleQ.rows[0]) return { ok: false, status: 400, error: "Rôle sélectionné invalide." };
  const role = roleQ.rows[0];

  const dup = await client.query(`SELECT id FROM users WHERE lower(email)=$1 AND deleted_at IS NULL`, [email]);
  if (dup.rows[0]) return { ok: false, status: 409, error: `Un compte ERP existe déjà avec l'email ${email}.` };

  // users.employee_number est unique : ne le renseigner que s'il est libre
  const numTaken = await client.query(`SELECT id FROM users WHERE employee_number=$1 AND deleted_at IS NULL`, [emp.matricule]);
  const employeeNumber = numTaken.rows[0] ? null : emp.matricule;

  const hash = await bcrypt.hash(tempPassword, 12);
  const uRes = await client.query(`
    INSERT INTO users (first_name, last_name, email, role, hashed_password,
      employee_number, phone, language, account_status, force_password_change,
      created_by, updated_by)
    VALUES ($1,$2,$3,$4::user_role,$5,$6,$7,'fr','active',TRUE,$8::uuid,$8::uuid)
    RETURNING id, email`,
    [emp.first_name, emp.last_name, email, legacyEnumForRole(role.name), hash,
     employeeNumber, nn(account.phone), act.userId]);
  const user = uRes.rows[0];

  await client.query(
    `INSERT INTO user_roles (user_id, role_id, granted_by) VALUES ($1::uuid,$2::uuid,$3::uuid)`,
    [user.id, role.id, act.userId]);
  await client.query(
    `UPDATE employees SET linked_user_id=$1::uuid, updated_at=NOW(), version=version+1 WHERE id=$2::uuid`,
    [user.id, emp.id]);
  await client.query(`
    INSERT INTO hr_audit_events (employee_id, actor_id, actor_name, action, entity_type, entity_id, new_values)
    VALUES ($1::uuid,$2::uuid,$3,'create_erp_account','user',$4::uuid,$5::jsonb)`,
    [emp.id, act.userId, act.userName, user.id, JSON.stringify({ email, role: role.name })]);

  return { ok: true, userId: user.id, email: user.email, roleName: role.name, roleDisplay: role.display_name };
}

/** Suspend le compte ERP lié (désactivation / archivage de l'employé).
 *  La réactivation du compte reste une décision MANUELLE de l'administration. */
async function suspendLinkedAccount(
  q: { query: (...a: any[]) => Promise<any> },
  employeeId: string,
  act: { userId: string; userName: string },
  reason: string,
): Promise<string | null> {
  const r = await q.query(`
    UPDATE users u SET account_status='suspended', updated_at=NOW(), version=u.version+1
    FROM employees e
    WHERE e.id=$1::uuid AND e.linked_user_id=u.id AND u.deleted_at IS NULL AND u.account_status='active'
    RETURNING u.id, u.email`, [employeeId]);
  const acc = r.rows[0];
  if (!acc) return null;
  await q.query(`UPDATE user_sessions SET revoked_at=now() WHERE user_id=$1::uuid AND revoked_at IS NULL`, [acc.id]);
  await q.query(`
    INSERT INTO hr_audit_events (employee_id, actor_id, actor_name, action, entity_type, entity_id, new_values)
    VALUES ($1::uuid,$2::uuid,$3,'suspend_erp_account','user',$4::uuid,$5::jsonb)`,
    [employeeId, act.userId, act.userName, acc.id, JSON.stringify({ email: acc.email, reason })]);
  return acc.email;
}

// GET /hr/employees — list with filters
router.get("/", requirePermission("hr.employees.view"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { q, status, category, department_id, site_id, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const conditions: string[] = ["e.deleted_at IS NULL"];
    const params: any[] = [];
    let i = 1;

    if (q) {
      conditions.push(`(e.first_name ILIKE $${i} OR e.last_name ILIKE $${i} OR e.matricule ILIKE $${i})`);
      params.push(`%${q}%`); i++;
    }
    if (status) { conditions.push(`e.status = $${i}::employee_status`); params.push(status); i++; }
    if (category) { conditions.push(`e.category = $${i}::personnel_category`); params.push(category); i++; }
    if (department_id) { conditions.push(`p.department_id = $${i}::uuid`); params.push(department_id); i++; }
    if (site_id) { conditions.push(`p.site_id = $${i}`); params.push(site_id); i++; }

    const where = conditions.join(" AND ");

    const [rows, countRow] = await Promise.all([
      pool.query(`
        SELECT e.id, e.matricule, e.first_name, e.last_name, e.gender, e.status,
               e.category, e.hire_date, e.photo_url,
               ep.position_id, ep.department_id, ep.site_id, ep.manager_id,
               ep.service, ep.team,
               pos.name  AS position_name,
               dep.name  AS department_name,
               ec.phone_primary, ec.email_professional,
               ectr.type AS contract_type, ectr.end_date AS contract_end_date,
               -- Today's attendance
               att.status AS today_status,
               -- Next shift
               (SELECT shift_date || ' ' || start_time
                FROM employee_shifts es2
                WHERE es2.employee_id = e.id
                  AND es2.shift_date >= CURRENT_DATE
                  AND es2.deleted_at IS NULL
                ORDER BY es2.shift_date, es2.start_time LIMIT 1) AS next_shift
        FROM employees e
        LEFT JOIN employee_profiles ep ON ep.employee_id = e.id AND ep.deleted_at IS NULL
        LEFT JOIN employee_positions pos ON pos.id = ep.position_id AND pos.deleted_at IS NULL
        LEFT JOIN hr_departments dep ON dep.id = ep.department_id AND dep.deleted_at IS NULL
        LEFT JOIN employee_contacts ec ON ec.employee_id = e.id AND ec.deleted_at IS NULL
        LEFT JOIN LATERAL (
          SELECT type, end_date FROM employee_contracts
          WHERE employee_id = e.id AND status = 'actif' AND deleted_at IS NULL
          ORDER BY start_date DESC LIMIT 1
        ) ectr ON TRUE
        LEFT JOIN LATERAL (
          SELECT status FROM attendance_records
          WHERE employee_id = e.id AND record_date = CURRENT_DATE AND deleted_at IS NULL
          LIMIT 1
        ) att ON TRUE
        WHERE ${where}
        ORDER BY e.last_name, e.first_name
        LIMIT $${i} OFFSET $${i+1}`,
        [...params, parseInt(limit), parseInt(offset)]
      ),
      pool.query(
        `SELECT COUNT(*) AS total
         FROM employees e
         LEFT JOIN employee_profiles ep ON ep.employee_id = e.id AND ep.deleted_at IS NULL
         WHERE ${where}`,
        params
      )
    ]);

    // Stats for header cards
    const statsRow = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE e.deleted_at IS NULL) AS total,
        COUNT(*) FILTER (WHERE e.deleted_at IS NULL AND att.status = 'present') AS present,
        COUNT(*) FILTER (WHERE e.deleted_at IS NULL AND e.status = 'absent') AS absent,
        COUNT(*) FILTER (WHERE e.deleted_at IS NULL AND att.status = 'retard') AS late,
        COUNT(*) FILTER (WHERE e.deleted_at IS NULL AND e.status = 'en_conge') AS on_leave,
        COUNT(*) FILTER (WHERE e.deleted_at IS NULL AND att.status = 'en_garde') AS on_shift,
        COUNT(*) FILTER (
          WHERE e.deleted_at IS NULL
            AND ectr.end_date IS NOT NULL
            AND ectr.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        ) AS expiring_contracts
      FROM employees e
      LEFT JOIN LATERAL (
        SELECT status FROM attendance_records
        WHERE employee_id = e.id AND record_date = CURRENT_DATE AND deleted_at IS NULL LIMIT 1
      ) att ON TRUE
      LEFT JOIN LATERAL (
        SELECT end_date FROM employee_contracts
        WHERE employee_id = e.id AND status = 'actif' AND deleted_at IS NULL
        ORDER BY start_date DESC LIMIT 1
      ) ectr ON TRUE
    `);

    res.json({
      data: rows.rows,
      total: parseInt(countRow.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset),
      stats: statsRow.rows[0]
    });
  } catch (err) { next(err); }
});

// GET /hr/employees/:id — single employee detail
router.get("/:id", requirePermission("hr.employees.view"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const [empRow, profileRow, contactRow, emergRow, contractRow, docsRow, leaveBal, accountRow] = await Promise.all([
      pool.query(`SELECT * FROM employees WHERE id=$1::uuid AND deleted_at IS NULL`, [id]),
      pool.query(`SELECT ep.*, pos.name AS position_name, dep.name AS department_name,
                    mgr.first_name || ' ' || mgr.last_name AS manager_name
                  FROM employee_profiles ep
                  LEFT JOIN employee_positions pos ON pos.id = ep.position_id
                  LEFT JOIN hr_departments dep ON dep.id = ep.department_id
                  LEFT JOIN employees mgr ON mgr.id = ep.manager_id
                  WHERE ep.employee_id=$1::uuid AND ep.deleted_at IS NULL LIMIT 1`, [id]),
      pool.query(`SELECT * FROM employee_contacts WHERE employee_id=$1::uuid AND deleted_at IS NULL LIMIT 1`, [id]),
      pool.query(`SELECT * FROM employee_emergency_contacts WHERE employee_id=$1::uuid AND deleted_at IS NULL`, [id]),
      pool.query(`SELECT * FROM employee_contracts WHERE employee_id=$1::uuid AND deleted_at IS NULL ORDER BY start_date DESC`, [id]),
      pool.query(`SELECT * FROM employee_documents WHERE employee_id=$1::uuid AND deleted_at IS NULL ORDER BY created_at DESC`, [id]),
      pool.query(`SELECT * FROM leave_balances WHERE employee_id=$1::uuid ORDER BY year DESC`, [id]),
      pool.query(`SELECT u.id, u.email, u.account_status, u.last_login_at, u.force_password_change,
                    r.role_name, r.role_display
                  FROM employees e
                  JOIN users u ON u.id = e.linked_user_id AND u.deleted_at IS NULL
                  LEFT JOIN LATERAL (
                    SELECT ro.name AS role_name, ro.display_name AS role_display
                    FROM user_roles ur JOIN roles ro ON ro.id = ur.role_id
                    WHERE ur.user_id = u.id ORDER BY ur.granted_at DESC LIMIT 1
                  ) r ON TRUE
                  WHERE e.id=$1::uuid LIMIT 1`, [id]),
    ]);

    if (!empRow.rows[0]) return void res.status(404).json({ error: "Employé non trouvé" });

    res.json({
      employee: empRow.rows[0],
      profile: profileRow.rows[0] ?? null,
      contacts: contactRow.rows[0] ?? null,
      emergency_contacts: emergRow.rows,
      contracts: contractRow.rows,
      documents: docsRow.rows,
      leave_balances: leaveBal.rows,
      account: accountRow.rows[0] ?? null,
    });
  } catch (err) { next(err); }
});

// POST /hr/employees — create (wizard, full transaction)
router.post("/", requirePermission("hr.employees.create"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  const client = await pool.connect();
  let _step = "init";   // étape courante pour diagnostic 22P02
  try {
    await client.query("BEGIN");
    const { identity, identifiers, contacts, assignment, contract, schedule, emergency, documents } = req.body;
    const act = actor(req);

    // Step 1 — Check for duplicate matricule (auto-generate if not provided)
    _step = "matricule";
    const matricule = identifiers?.matricule || await nextMatricule(client);
    const existing = await client.query("SELECT id FROM employees WHERE matricule=$1 AND deleted_at IS NULL", [matricule]);
    if (existing.rows.length) {
      await client.query("ROLLBACK");
      return void res.status(409).json({ error: "Matricule déjà utilisé", field: "matricule" });
    }

    // Step 2 — Insert employee
    // gender et marital_status : cast explicite pour éviter 22P02 sur enum implicite
    _step = "employees";
    const genderVal   = nn(identity?.gender);
    const categoryVal = nn(assignment?.category);
    const empRes = await client.query(`
      INSERT INTO employees (
        matricule, first_name, last_name, gender, date_of_birth, place_of_birth,
        nationality, marital_status, photo_url,
        id_document_number, social_security_number, professional_order_number, linked_user_id,
        status, category, hire_date, created_by, updated_by
      ) VALUES ($1,$2,$3,
        CASE WHEN $4::text IS NULL THEN NULL ELSE $4::gender_type END,
        $5,$6,$7,$8,$9,$10,$11,$12,$13,
        COALESCE($14,'actif')::employee_status,
        CASE WHEN $15::text IS NULL THEN NULL ELSE $15::personnel_category END,
        $16, $17::uuid, $17::uuid)
      RETURNING *`,
      [
        matricule,
        identity?.firstName ?? identifiers?.firstName ?? "",
        identity?.lastName  ?? identifiers?.lastName  ?? "",
        genderVal,
        nn(identity?.dateOfBirth),
        nn(identity?.placeOfBirth),
        nn(identity?.nationality) ?? "Algérienne",
        nn(identity?.maritalStatus),
        nn(identity?.photoUrl),
        nn(identifiers?.idDocumentNumber),
        nn(identifiers?.socialSecurityNumber),
        nn(identifiers?.professionalOrderNumber),
        nn(identifiers?.linkedUserId),
        nn(assignment?.status) ?? "actif",
        categoryVal,
        nn(contract?.startDate),
        act.userId,
      ]
    );
    const emp = empRes.rows[0];

    // Step 3 — Profile
    _step = "profile";
    if (assignment) {
      await client.query(`
        INSERT INTO employee_profiles
          (employee_id, position_id, department_id, site_id, building, floor,
           service, team, manager_id, salary_base, created_by, updated_by)
        VALUES ($1,
          CASE WHEN $2::text IS NULL THEN NULL ELSE $2::uuid END,
          CASE WHEN $3::text IS NULL THEN NULL ELSE $3::uuid END,
          $4,$5,$6,$7,$8,
          CASE WHEN $9::text IS NULL THEN NULL ELSE $9::uuid END,
          $10,$11::uuid,$11::uuid)`,
        [emp.id, nn(assignment.positionId), nn(assignment.departmentId),
         nn(assignment.siteId), nn(assignment.building), nn(assignment.floor),
         nn(assignment.service), nn(assignment.team), nn(assignment.managerId),
         nn(contract?.salaryBase), act.userId]
      );
    }

    // Step 4 — Contacts
    _step = "contacts";
    if (contacts) {
      await client.query(`
        INSERT INTO employee_contacts
          (employee_id, phone_primary, phone_secondary, email_professional, email_personal,
           address, commune, wilaya, country, created_by, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::uuid,$10::uuid)`,
        [emp.id, nn(contacts.phonePrimary), nn(contacts.phoneSecondary),
         nn(contacts.emailProfessional), nn(contacts.emailPersonal),
         nn(contacts.address), nn(contacts.commune), nn(contacts.wilaya),
         nn(contacts.country) ?? "Algérie", act.userId]
      );
    }

    // Step 5 — Emergency contacts
    _step = "emergency";
    if (emergency?.name) {
      await client.query(`
        INSERT INTO employee_emergency_contacts
          (employee_id, name, relation, phone, address, is_primary, created_by, updated_by)
        VALUES ($1,$2,$3,$4,$5,TRUE,$6::uuid,$6::uuid)`,
        [emp.id, emergency.name, nn(emergency.relation),
         nn(emergency.phone), nn(emergency.address), act.userId]
      );
    }

    // Step 6 — Contract
    _step = "contract";
    let contractRecord = null;
    if (contract?.type) {
      const contractNumber = await nextContractNumber(client);
      const cRes = await client.query(`
        INSERT INTO employee_contracts
          (contract_number, employee_id, type, status, start_date, end_date,
           trial_end_date, is_full_time, weekly_hours, salary_base, notes,
           created_by, updated_by)
        VALUES ($1,$2,$3::contract_type,
          COALESCE($4,'actif')::contract_status,
          $5,$6,$7,COALESCE($8,TRUE),$9,$10,$11,$12::uuid,$12::uuid)
        RETURNING *`,
        [contractNumber, emp.id, contract.type,
         nn(contract.status) ?? "actif", nn(contract.startDate), nn(contract.endDate),
         nn(contract.trialEndDate), contract.isFullTime ?? true,
         nn(contract.weeklyHours) ?? 40, nn(contract.salaryBase),
         nn(contract.notes), act.userId]
      );
      contractRecord = cRes.rows[0];
    }

    // Step 7 — Schedule
    _step = "schedule";
    if (schedule?.workDays) {
      await client.query(`
        INSERT INTO employee_schedules
          (employee_id, work_days, start_time, end_time, break_minutes,
           rotation, night_work, on_call, created_by, updated_by)
        VALUES ($1,$2::jsonb,$3,$4,$5,$6,$7,$8,$9::uuid,$9::uuid)`,
        [emp.id, JSON.stringify(schedule.workDays), nn(schedule.startTime),
         nn(schedule.endTime), typeof schedule.breakMinutes === "number" ? schedule.breakMinutes : 0,
         schedule.rotation === true, schedule.nightWork === true,
         schedule.onCall === true, act.userId]
      );
    }

    // Step 8 — Initialize leave balances for current year
    _step = "leave_balances";
    const currentYear = new Date().getFullYear();
    const leaveTypes = ["annuel", "maladie", "recuperation"];
    for (const lt of leaveTypes) {
      await client.query(`
        INSERT INTO leave_balances (employee_id, leave_type, year, total_days)
        VALUES ($1, $2::leave_type, $3, $4)
        ON CONFLICT (employee_id, leave_type, year) DO NOTHING`,
        [emp.id, lt, currentYear, lt === "annuel" ? 30 : lt === "maladie" ? 15 : 0]
      );
    }

    // Audit
    _step = "audit_employee";
    await client.query(`
      INSERT INTO hr_audit_events (employee_id, actor_id, actor_name, action, entity_type, entity_id, new_values)
      VALUES ($1::uuid, $2::uuid, $3, 'create_employee', 'employee', $1::uuid, $4::jsonb)`,
      [emp.id, act.userId, act.userName, JSON.stringify({ matricule, firstName: emp.first_name, lastName: emp.last_name })]
    );

    // Step 9 (optionnel) — Compte ERP lié, dans la même transaction
    _step = "erp_account";
    let accountResult: ErpAccountResult | null = null;
    const account = req.body?.account;
    if (account?.create) {
      if (!canManageAccounts(req)) {
        await client.query("ROLLBACK");
        return void res.status(403).json({ error: "La création d'un compte ERP nécessite la permission d'administration des utilisateurs (admin.users)." });
      }
      accountResult = await createErpAccount(client, emp,
        { ...account, phone: contacts?.phonePrimary ?? null }, act);
      if (!accountResult.ok) {
        await client.query("ROLLBACK");
        return void res.status(accountResult.status).json({ error: accountResult.error });
      }
    }

    await client.query("COMMIT");
    res.status(201).json({
      employee: emp,
      contract: contractRecord,
      account: accountResult && accountResult.ok
        ? { userId: accountResult.userId, email: accountResult.email, role: accountResult.roleDisplay }
        : null,
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    // Enrichir l'erreur avec l'étape pour diagnostic en prod
    if (err?.code === "22P02" || err?.code === "22007" || err?.code === "22008") {
      (err as any)._step = _step;
    }
    if (pgErrorResponse(err, res, _step)) return;
    next(err);
  } finally { client.release(); }
});

// PATCH /hr/employees/:id — update
router.patch("/:id", requirePermission("hr.employees.update"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const act = actor(req);
    const { identity, identifiers, contacts, assignment, status, statusReason } = req.body;

    // Get old values for audit
    const oldRow = await client.query("SELECT * FROM employees WHERE id=$1::uuid AND deleted_at IS NULL", [id]);
    if (!oldRow.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Employé non trouvé" }); }

    // Update employees
    const updateFields: string[] = [];
    const updateVals: any[] = [];
    let pi = 1;

    const fieldMap: Record<string, string> = {
      firstName: "first_name", lastName: "last_name", gender: "gender",
      dateOfBirth: "date_of_birth", placeOfBirth: "place_of_birth",
      nationality: "nationality", maritalStatus: "marital_status",
      photoUrl: "photo_url",
    };
    const src = { ...identity, ...identifiers };
    for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
      if (src[jsKey] !== undefined) {
        updateFields.push(`${dbCol} = $${pi++}`);
        // Ne jamais vider le nom/prénom ; les autres champs vides deviennent NULL (date/uuid/enum)
        updateVals.push(jsKey === "firstName" || jsKey === "lastName" ? src[jsKey] : nn(src[jsKey]));
      }
    }
    if (status) {
      updateFields.push(`status = $${pi++}::employee_status`);
      updateVals.push(status);
    }
    if (updateFields.length) {
      updateFields.push(`updated_at = NOW()`, `updated_by = $${pi++}::uuid`, `version = version + 1`);
      updateVals.push(act.userId, id);
      await client.query(
        `UPDATE employees SET ${updateFields.join(", ")} WHERE id = $${pi}::uuid AND deleted_at IS NULL`,
        updateVals
      );
    }

    // Update profile
    if (assignment) {
      await client.query(`
        INSERT INTO employee_profiles (employee_id, position_id, department_id, site_id,
          building, floor, service, team, manager_id, created_by, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::uuid,$10::uuid)
        ON CONFLICT (employee_id) DO UPDATE SET
          position_id=$2, department_id=$3, site_id=$4,
          building=$5, floor=$6, service=$7, team=$8, manager_id=$9,
          updated_at=NOW(), updated_by=$10::uuid, version=employee_profiles.version+1
        WHERE employee_profiles.deleted_at IS NULL`,
        [id, nn(assignment.positionId), nn(assignment.departmentId),
         nn(assignment.siteId), nn(assignment.building), nn(assignment.floor),
         nn(assignment.service), nn(assignment.team), nn(assignment.managerId),
         act.userId]
      );
    }

    // Update contacts
    if (contacts) {
      await client.query(`
        INSERT INTO employee_contacts (employee_id, phone_primary, phone_secondary,
          email_professional, email_personal, address, commune, wilaya, country, created_by, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::uuid,$10::uuid)
        ON CONFLICT (employee_id) DO UPDATE SET
          phone_primary=$2, phone_secondary=$3, email_professional=$4,
          email_personal=$5, address=$6, commune=$7, wilaya=$8, country=$9,
          updated_at=NOW(), updated_by=$10::uuid
        WHERE employee_contacts.deleted_at IS NULL`,
        [id, nn(contacts.phonePrimary), nn(contacts.phoneSecondary),
         nn(contacts.emailProfessional), nn(contacts.emailPersonal),
         nn(contacts.address), nn(contacts.commune), nn(contacts.wilaya),
         nn(contacts.country) ?? "Algérie", act.userId]
      );
    }

    // Status change audit
    if (status && status !== oldRow.rows[0].status) {
      await client.query(`
        INSERT INTO hr_audit_events (employee_id, actor_id, actor_name, action, entity_type, entity_id, old_values, new_values)
        VALUES ($1::uuid,$2::uuid,$3,'change_status','employee',$1::uuid,$4::jsonb,$5::jsonb)`,
        [id, act.userId, act.userName,
         JSON.stringify({ status: oldRow.rows[0].status }),
         JSON.stringify({ status, reason: statusReason })]
      );
      // Employé suspendu / archivé → suspension automatique du compte ERP lié
      if (status === "suspendu" || status === "archive") {
        await suspendLinkedAccount(client, String(id), act, `Statut employé → ${status}`);
      }
    }

    await client.query("COMMIT");
    const updated = await pool.query("SELECT * FROM employees WHERE id=$1::uuid", [id]);
    res.json(updated.rows[0]);
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    if (pgErrorResponse(err, res)) return;
    next(err);
  } finally { client.release(); }
});

// PATCH /hr/employees/:id/status — change status
router.patch("/:id/status", requirePermission("hr.employees.update"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const act = actor(req);
    if (!status) return void res.status(400).json({ error: "status requis" });

    await pool.query(`
      UPDATE employees SET status=$1::employee_status, updated_at=NOW(),
        updated_by=$2::uuid, version=version+1
      WHERE id=$3::uuid AND deleted_at IS NULL`, [status, act.userId, id]);

    await pool.query(`
      INSERT INTO hr_audit_events (employee_id, actor_id, actor_name, action, entity_type, entity_id, new_values)
      VALUES ($1::uuid,$2::uuid,$3,'change_status','employee',$1::uuid,$4::jsonb)`,
      [id, act.userId, act.userName, JSON.stringify({ status, reason })]);

    // Employé suspendu / archivé → suspension automatique du compte ERP lié
    let accountSuspended: string | null = null;
    if (status === "suspendu" || status === "archive") {
      accountSuspended = await suspendLinkedAccount(pool, String(id), act, `Statut employé → ${status}`);
    }

    res.json({ ok: true, accountSuspended: !!accountSuspended });
  } catch (err) { next(err); }
});

// POST /hr/employees/:id/account — créer un compte ERP pour un employé existant
router.post("/:id/account", requirePermission("hr.employees.view"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  const client = await pool.connect();
  try {
    const id = String(req.params.id ?? "");
    const act = actor(req);
    if (!canManageAccounts(req)) {
      client.release();
      return void res.status(403).json({ error: "La création d'un compte ERP nécessite la permission d'administration des utilisateurs (admin.users)." });
    }

    await client.query("BEGIN");
    const empQ = await client.query(
      `SELECT id, matricule, first_name, last_name, status, linked_user_id
       FROM employees WHERE id=$1::uuid AND deleted_at IS NULL FOR UPDATE`, [id]);
    if (!empQ.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Employé non trouvé" }); }
    const emp = empQ.rows[0];
    if (emp.linked_user_id) {
      await client.query("ROLLBACK");
      return void res.status(409).json({ error: "Cet employé a déjà un compte ERP lié." });
    }

    const contactQ = await client.query(
      `SELECT phone_primary FROM employee_contacts WHERE employee_id=$1::uuid AND deleted_at IS NULL LIMIT 1`, [id]);

    const result = await createErpAccount(client, emp,
      { ...req.body, phone: contactQ.rows[0]?.phone_primary ?? null }, act);
    if (!result.ok) {
      await client.query("ROLLBACK");
      return void res.status(result.status).json({ error: result.error });
    }

    await client.query("COMMIT");
    res.status(201).json({ userId: result.userId, email: result.email, role: result.roleDisplay });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    if (pgErrorResponse(err, res)) return;
    next(err);
  } finally { client.release(); }
});

// DELETE (archive) /hr/employees/:id
router.delete("/:id", requirePermission("hr.employees.archive"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const act = actor(req);
    // Suspension du compte ERP AVANT le soft-delete (le helper joint employees sans deleted_at)
    const accountSuspended = await suspendLinkedAccount(pool, String(id), act, "Archivage de l'employé");
    await pool.query(`
      UPDATE employees SET status='archive'::employee_status, deleted_at=NOW(),
        deleted_by=$1::uuid, updated_at=NOW(), version=version+1
      WHERE id=$2::uuid AND deleted_at IS NULL`, [act.userId, id]);
    await pool.query(`
      INSERT INTO hr_audit_events (employee_id, actor_id, actor_name, action, entity_type, entity_id)
      VALUES ($1::uuid,$2::uuid,$3,'archive_employee','employee',$1::uuid)`,
      [id, act.userId, act.userName]);
    res.json({ ok: true, accountSuspended: !!accountSuspended });
  } catch (err) { next(err); }
});

// DELETE /hr/employees/:id/permanent — suppression définitive (fiches de test / erreurs de saisie)
// Refusée (409 + suggestion Désactiver/Archiver) si l'employé possède un historique
// opérationnel ou financier : pointage, absences, congés, planning, badge, paie.
// Sinon : purge transactionnelle des lignes satellites de création (profil, contacts,
// contrat, soldes…) puis de la fiche employé. Fonctionne aussi sur une fiche déjà archivée.
router.delete("/:id/permanent", requirePermission("hr.employees.archive"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  const client = await pool.connect();
  try {
    const id = String(req.params.id ?? "");
    const act = actor(req);
    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
      res.status(400).json({ error: "Identifiant employé invalide" });
      return;
    }

    await client.query("BEGIN");
    const empQ = await client.query(
      `SELECT id, matricule, first_name, last_name FROM employees WHERE id=$1::uuid FOR UPDATE`, [id]);
    if (!empQ.rows[0]) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Employé non trouvé" });
      return;
    }
    const emp = empQ.rows[0];

    // Historique opérationnel / financier → suppression définitive interdite
    const chk = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM attendance_records          WHERE employee_id=$1::uuid) AS pointages,
        (SELECT COUNT(*) FROM attendance_events           WHERE employee_id=$1::uuid) AS evenements_pointage,
        (SELECT COUNT(*) FROM late_records                WHERE employee_id=$1::uuid) AS retards,
        (SELECT COUNT(*) FROM absence_records             WHERE employee_id=$1::uuid) AS absences,
        (SELECT COUNT(*) FROM overtime_records            WHERE employee_id=$1::uuid) AS heures_sup,
        (SELECT COUNT(*) FROM leave_requests              WHERE employee_id=$1::uuid) AS demandes_conge,
        (SELECT COUNT(*) FROM employee_shifts             WHERE employee_id=$1::uuid) AS gardes_planning,
        (SELECT COUNT(*) FROM badge_events                WHERE employee_id=$1::uuid) AS evenements_badge,
        (SELECT COUNT(*) FROM payroll_employee_runs       WHERE employee_id=$1::uuid) AS calculs_paie,
        (SELECT COUNT(*) FROM payroll_payslips            WHERE employee_id=$1::uuid) AS bulletins_paie,
        (SELECT COUNT(*) FROM payroll_payment_order_items WHERE employee_id=$1::uuid) AS ordres_paiement,
        (SELECT COUNT(*) FROM payroll_advances            WHERE employee_id=$1::uuid) AS acomptes,
        (SELECT COUNT(*) FROM payroll_loans               WHERE employee_id=$1::uuid) AS prets,
        (SELECT COUNT(*) FROM payroll_bonuses             WHERE employee_id=$1::uuid) AS primes,
        (SELECT COUNT(*) FROM payroll_adjustments         WHERE employee_id=$1::uuid) AS ajustements_paie,
        (SELECT COUNT(*) FROM payroll_anomalies           WHERE employee_id=$1::uuid) AS anomalies_paie
    `, [id]);
    const LABELS: Record<string, string> = {
      pointages: "Pointages", evenements_pointage: "Événements de pointage", retards: "Retards",
      absences: "Absences", heures_sup: "Heures supplémentaires", demandes_conge: "Demandes de congé",
      gardes_planning: "Gardes / planning", evenements_badge: "Événements badge",
      calculs_paie: "Calculs de paie", bulletins_paie: "Bulletins de paie",
      ordres_paiement: "Ordres de paiement", acomptes: "Acomptes", prets: "Prêts",
      primes: "Primes", ajustements_paie: "Ajustements de paie", anomalies_paie: "Anomalies de paie",
    };
    const blockers = Object.entries(chk.rows[0])
      .filter(([, v]) => Number(v) > 0)
      .map(([k, v]) => ({ type: LABELS[k] ?? k, count: Number(v) }));

    if (blockers.length > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({
        error: "Suppression définitive impossible : cet employé possède des données RH / Paie / Pointage liées. Désactivez-le ou archivez-le à la place.",
        blockers,
      });
      return;
    }

    // Compte ERP lié : le capturer avant la purge pour le suspendre ensuite
    const linkedQ = await client.query(`SELECT linked_user_id FROM employees WHERE id=$1::uuid`, [id]);
    const linkedUserId: string | null = linkedQ.rows[0]?.linked_user_id ?? null;

    // Fiche propre (test / erreur de saisie) → détacher les références manager,
    // purger les lignes satellites de création, puis la fiche employé.
    await client.query(`UPDATE employee_profiles SET manager_id=NULL WHERE manager_id=$1::uuid`, [id]);
    await client.query(`UPDATE hr_departments   SET manager_id=NULL WHERE manager_id=$1::uuid`, [id]);
    await client.query(`UPDATE leave_requests   SET manager_id=NULL WHERE manager_id=$1::uuid`, [id]);
    await client.query(`UPDATE leave_requests   SET replacement_employee_id=NULL WHERE replacement_employee_id=$1::uuid`, [id]);
    for (const table of [
      "hr_audit_events", "hr_notes", "hr_alerts", "badge_assignments", "leave_balances",
      "employee_schedules", "employee_contracts", "employee_documents",
      "employee_emergency_contacts", "employee_contacts", "employee_profiles",
    ]) {
      await client.query(`DELETE FROM ${table} WHERE employee_id=$1::uuid`, [id]);
    }
    await client.query(`DELETE FROM employees WHERE id=$1::uuid`, [id]);

    // Suspension du compte ERP orphelin (le lien est parti avec la fiche)
    let suspendedEmail: string | null = null;
    if (linkedUserId) {
      const sQ = await client.query(`
        UPDATE users SET account_status='suspended', updated_at=NOW(), version=version+1
        WHERE id=$1::uuid AND deleted_at IS NULL AND account_status='active'
        RETURNING email`, [linkedUserId]);
      suspendedEmail = sQ.rows[0]?.email ?? null;
      await client.query(`UPDATE user_sessions SET revoked_at=now() WHERE user_id=$1::uuid AND revoked_at IS NULL`, [linkedUserId]);
    }

    await client.query(`
      INSERT INTO hr_audit_events (employee_id, actor_id, actor_name, action, entity_type, entity_id, new_values)
      VALUES (NULL, $1::uuid, $2, 'delete_employee_permanent', 'employee', $3::uuid, $4::jsonb)`,
      [act.userId, act.userName, id,
       JSON.stringify({ matricule: emp.matricule, nom: `${emp.first_name} ${emp.last_name}`,
                        compteSuspendu: suspendedEmail })]);

    await client.query("COMMIT");
    res.json({ ok: true, deleted: { id, matricule: emp.matricule } });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    if (err?.code === "23503") {
      res.status(409).json({
        error: "Suppression définitive impossible : des données liées ont été détectées dans un autre module. Désactivez ou archivez l'employé à la place.",
        blockers: [],
      });
      return;
    }
    next(err);
  } finally { client.release(); }
});

// GET /hr/employees/:id/attendance — attendance list for employee
router.get("/:id/attendance", requirePermission("hr.attendance.view"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const { month, year, limit = "30", offset = "0" } = req.query as Record<string, string>;
    const conditions = ["employee_id=$1::uuid", "deleted_at IS NULL"];
    const params: any[] = [id];
    let pi = 2;
    if (year && month) {
      conditions.push(`EXTRACT(YEAR FROM record_date)=$${pi++} AND EXTRACT(MONTH FROM record_date)=$${pi++}`);
      params.push(parseInt(year), parseInt(month));
    }
    const rows = await pool.query(
      `SELECT * FROM attendance_records WHERE ${conditions.join(" AND ")}
       ORDER BY record_date DESC LIMIT $${pi} OFFSET $${pi+1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    res.json(rows.rows);
  } catch (err) { next(err); }
});

// GET /hr/employees/:id/leaves
router.get("/:id/leaves", requirePermission("hr.leaves.view"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const rows = await pool.query(
      `SELECT lr.*, e.first_name || ' ' || e.last_name AS replacement_name
       FROM leave_requests lr
       LEFT JOIN employees e ON e.id = lr.replacement_employee_id
       WHERE lr.employee_id=$1::uuid AND lr.deleted_at IS NULL
       ORDER BY lr.created_at DESC`, [id]);
    const balances = await pool.query(
      `SELECT * FROM leave_balances WHERE employee_id=$1::uuid ORDER BY year DESC`, [id]);
    res.json({ requests: rows.rows, balances: balances.rows });
  } catch (err) { next(err); }
});

// GET /hr/employees/:id/documents
router.get("/:id/documents", requirePermission("hr.documents.view"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const rows = await pool.query(
      `SELECT * FROM employee_documents WHERE employee_id=$1::uuid AND deleted_at IS NULL ORDER BY created_at DESC`, [id]);
    res.json(rows.rows);
  } catch (err) { next(err); }
});

// POST /hr/employees/:id/documents
router.post("/:id/documents", requirePermission("hr.documents.upload"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const act = actor(req);
    const { docType, title, fileUrl, fileSize, mimeType, expiryDate, reminderDays, notes } = req.body;
    const row = await pool.query(`
      INSERT INTO employee_documents (employee_id, doc_type, title, file_url, file_size, mime_type,
        expiry_date, reminder_days, notes, created_by, updated_by)
      VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10::uuid,$10::uuid)
      RETURNING *`,
      [id, docType, title, fileUrl ?? null, fileSize ?? null, mimeType ?? null,
       expiryDate ?? null, reminderDays ?? 30, notes ?? null, act.userId]);
    res.status(201).json(row.rows[0]);
  } catch (err) { next(err); }
});

// GET /hr/employees/:id/contracts
router.get("/:id/contracts", requirePermission("hr.contracts.view"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const rows = await pool.query(
      `SELECT * FROM employee_contracts WHERE employee_id=$1::uuid AND deleted_at IS NULL ORDER BY start_date DESC`, [id]);
    res.json(rows.rows);
  } catch (err) { next(err); }
});

// GET /hr/employees/:id/notes
router.get("/:id/notes", requirePermission("hr.employees.view"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const rows = await pool.query(
      `SELECT n.*, u.username AS author_name
       FROM hr_notes n
       LEFT JOIN users u ON u.id = n.author_id
       WHERE n.employee_id=$1::uuid AND n.deleted_at IS NULL
       ORDER BY n.created_at DESC`, [id]);
    res.json(rows.rows);
  } catch (err) { next(err); }
});

// POST /hr/employees/:id/notes
router.post("/:id/notes", requirePermission("hr.employees.view"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const act = actor(req);
    const { content, isPrivate } = req.body;
    const row = await pool.query(`
      INSERT INTO hr_notes (employee_id, author_id, content, is_private, created_by, updated_by)
      VALUES ($1::uuid,$2::uuid,$3,$4,$2::uuid,$2::uuid) RETURNING *`,
      [id, act.userId, content, isPrivate ?? false]);
    res.status(201).json(row.rows[0]);
  } catch (err) { next(err); }
});

// GET /hr/employees/:id/audit
router.get("/:id/audit", requirePermission("hr.employees.view"), async (req: AuthenticatedRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const rows = await pool.query(
      `SELECT * FROM hr_audit_events WHERE employee_id=$1::uuid ORDER BY created_at DESC LIMIT 100`, [id]);
    res.json(rows.rows);
  } catch (err) { next(err); }
});

export default router;
