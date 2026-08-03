/**
 * /api/hr/employees — Full CRUD for employees
 * Wizard creation: employees + profiles + contacts + emergency + contract + schedule (transaction)
 */
import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import { auditService } from "../../services/audit";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

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

// GET /hr/employees — list with filters
router.get("/", requirePermission("hr.employees.view"), async (req: AuthenticatedRequest, res, next) => {
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
router.get("/:id", requirePermission("hr.employees.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const [empRow, profileRow, contactRow, emergRow, contractRow, docsRow, leaveBal] = await Promise.all([
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
    ]);

    if (!empRow.rows[0]) return res.status(404).json({ error: "Employé non trouvé" });

    res.json({
      employee: empRow.rows[0],
      profile: profileRow.rows[0] ?? null,
      contacts: contactRow.rows[0] ?? null,
      emergency_contacts: emergRow.rows,
      contracts: contractRow.rows,
      documents: docsRow.rows,
      leave_balances: leaveBal.rows,
    });
  } catch (err) { next(err); }
});

// POST /hr/employees — create (wizard, full transaction)
router.post("/", requirePermission("hr.employees.create"), async (req: AuthenticatedRequest, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { identity, identifiers, contacts, assignment, contract, schedule, emergency, documents } = req.body;
    const act = actor(req);

    // Step 1 — Check for duplicate matricule (auto-generate if not provided)
    const matricule = identifiers?.matricule || await nextMatricule(client);
    const existing = await client.query("SELECT id FROM employees WHERE matricule=$1 AND deleted_at IS NULL", [matricule]);
    if (existing.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Matricule déjà utilisé", field: "matricule" });
    }

    // Step 2 — Insert employee
    const empRes = await client.query(`
      INSERT INTO employees (
        matricule, first_name, last_name, gender, date_of_birth, place_of_birth,
        nationality, marital_status, photo_url,
        id_document_number, social_security_number, professional_order_number, linked_user_id,
        status, category, hire_date, created_by, updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
        COALESCE($14,'actif')::employee_status,
        $15::personnel_category,
        $16, $17::uuid, $17::uuid)
      RETURNING *`,
      [
        matricule,
        identity?.firstName ?? identifiers?.firstName ?? "",
        identity?.lastName  ?? identifiers?.lastName  ?? "",
        identity?.gender    ?? null,
        identity?.dateOfBirth ?? null,
        identity?.placeOfBirth ?? null,
        identity?.nationality ?? "Algérienne",
        identity?.maritalStatus ?? null,
        identity?.photoUrl ?? null,
        identifiers?.idDocumentNumber ?? null,
        identifiers?.socialSecurityNumber ?? null,
        identifiers?.professionalOrderNumber ?? null,
        identifiers?.linkedUserId ?? null,
        assignment?.status ?? "actif",
        assignment?.category ?? null,
        contract?.startDate ?? null,
        act.userId,
      ]
    );
    const emp = empRes.rows[0];

    // Step 3 — Profile
    if (assignment) {
      await client.query(`
        INSERT INTO employee_profiles
          (employee_id, position_id, department_id, site_id, building, floor,
           service, team, manager_id, salary_base, created_by, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::uuid,$11::uuid)`,
        [emp.id, assignment.positionId ?? null, assignment.departmentId ?? null,
         assignment.siteId ?? null, assignment.building ?? null, assignment.floor ?? null,
         assignment.service ?? null, assignment.team ?? null, assignment.managerId ?? null,
         contract?.salaryBase ?? null, act.userId]
      );
    }

    // Step 4 — Contacts
    if (contacts) {
      await client.query(`
        INSERT INTO employee_contacts
          (employee_id, phone_primary, phone_secondary, email_professional, email_personal,
           address, commune, wilaya, country, created_by, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::uuid,$10::uuid)`,
        [emp.id, contacts.phonePrimary ?? null, contacts.phoneSecondary ?? null,
         contacts.emailProfessional ?? null, contacts.emailPersonal ?? null,
         contacts.address ?? null, contacts.commune ?? null, contacts.wilaya ?? null,
         contacts.country ?? "Algérie", act.userId]
      );
    }

    // Step 5 — Emergency contacts
    if (emergency?.name) {
      await client.query(`
        INSERT INTO employee_emergency_contacts
          (employee_id, name, relation, phone, address, is_primary, created_by, updated_by)
        VALUES ($1,$2,$3,$4,$5,TRUE,$6::uuid,$6::uuid)`,
        [emp.id, emergency.name, emergency.relation ?? null,
         emergency.phone ?? null, emergency.address ?? null, act.userId]
      );
    }

    // Step 6 — Contract
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
         contract.status ?? "actif", contract.startDate, contract.endDate ?? null,
         contract.trialEndDate ?? null, contract.isFullTime ?? true,
         contract.weeklyHours ?? 40, contract.salaryBase ?? null,
         contract.notes ?? null, act.userId]
      );
      contractRecord = cRes.rows[0];
    }

    // Step 7 — Schedule
    if (schedule?.workDays) {
      await client.query(`
        INSERT INTO employee_schedules
          (employee_id, work_days, start_time, end_time, break_minutes,
           rotation, night_work, on_call, created_by, updated_by)
        VALUES ($1,$2::jsonb,$3,$4,$5,$6,$7,$8,$9::uuid,$9::uuid)`,
        [emp.id, JSON.stringify(schedule.workDays), schedule.startTime ?? null,
         schedule.endTime ?? null, schedule.breakMinutes ?? 0,
         schedule.rotation ?? false, schedule.nightWork ?? false,
         schedule.onCall ?? false, act.userId]
      );
    }

    // Step 8 — Initialize leave balances for current year
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
    await client.query(`
      INSERT INTO hr_audit_events (employee_id, actor_id, actor_name, action, entity_type, entity_id, new_values)
      VALUES ($1::uuid, $2::uuid, $3, 'create_employee', 'employee', $1::uuid, $4::jsonb)`,
      [emp.id, act.userId, act.userName, JSON.stringify({ matricule, firstName: emp.first_name, lastName: emp.last_name })]
    );

    await client.query("COMMIT");
    res.status(201).json({ employee: emp, contract: contractRecord });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally { client.release(); }
});

// PATCH /hr/employees/:id — update
router.patch("/:id", requirePermission("hr.employees.update"), async (req: AuthenticatedRequest, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const act = actor(req);
    const { identity, identifiers, contacts, assignment, status, statusReason } = req.body;

    // Get old values for audit
    const oldRow = await client.query("SELECT * FROM employees WHERE id=$1::uuid AND deleted_at IS NULL", [id]);
    if (!oldRow.rows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Employé non trouvé" }); }

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
        updateVals.push(src[jsKey]);
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
        [id, assignment.positionId ?? null, assignment.departmentId ?? null,
         assignment.siteId ?? null, assignment.building ?? null, assignment.floor ?? null,
         assignment.service ?? null, assignment.team ?? null, assignment.managerId ?? null,
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
        [id, contacts.phonePrimary ?? null, contacts.phoneSecondary ?? null,
         contacts.emailProfessional ?? null, contacts.emailPersonal ?? null,
         contacts.address ?? null, contacts.commune ?? null, contacts.wilaya ?? null,
         contacts.country ?? "Algérie", act.userId]
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
    }

    await client.query("COMMIT");
    const updated = await pool.query("SELECT * FROM employees WHERE id=$1::uuid", [id]);
    res.json(updated.rows[0]);
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally { client.release(); }
});

// PATCH /hr/employees/:id/status — change status
router.patch("/:id/status", requirePermission("hr.employees.update"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const act = actor(req);
    if (!status) return res.status(400).json({ error: "status requis" });

    await pool.query(`
      UPDATE employees SET status=$1::employee_status, updated_at=NOW(),
        updated_by=$2::uuid, version=version+1
      WHERE id=$3::uuid AND deleted_at IS NULL`, [status, act.userId, id]);

    await pool.query(`
      INSERT INTO hr_audit_events (employee_id, actor_id, actor_name, action, entity_type, entity_id, new_values)
      VALUES ($1::uuid,$2::uuid,$3,'change_status','employee',$1::uuid,$4::jsonb)`,
      [id, act.userId, act.userName, JSON.stringify({ status, reason })]);

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE (archive) /hr/employees/:id
router.delete("/:id", requirePermission("hr.employees.archive"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const act = actor(req);
    await pool.query(`
      UPDATE employees SET status='archive'::employee_status, deleted_at=NOW(),
        deleted_by=$1::uuid, updated_at=NOW(), version=version+1
      WHERE id=$2::uuid AND deleted_at IS NULL`, [act.userId, id]);
    await pool.query(`
      INSERT INTO hr_audit_events (employee_id, actor_id, actor_name, action, entity_type, entity_id)
      VALUES ($1::uuid,$2::uuid,$3,'archive_employee','employee',$1::uuid)`,
      [id, act.userId, act.userName]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /hr/employees/:id/attendance — attendance list for employee
router.get("/:id/attendance", requirePermission("hr.attendance.view"), async (req: AuthenticatedRequest, res, next) => {
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
router.get("/:id/leaves", requirePermission("hr.leaves.view"), async (req: AuthenticatedRequest, res, next) => {
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
router.get("/:id/documents", requirePermission("hr.documents.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const rows = await pool.query(
      `SELECT * FROM employee_documents WHERE employee_id=$1::uuid AND deleted_at IS NULL ORDER BY created_at DESC`, [id]);
    res.json(rows.rows);
  } catch (err) { next(err); }
});

// POST /hr/employees/:id/documents
router.post("/:id/documents", requirePermission("hr.documents.upload"), async (req: AuthenticatedRequest, res, next) => {
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
router.get("/:id/contracts", requirePermission("hr.contracts.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const rows = await pool.query(
      `SELECT * FROM employee_contracts WHERE employee_id=$1::uuid AND deleted_at IS NULL ORDER BY start_date DESC`, [id]);
    res.json(rows.rows);
  } catch (err) { next(err); }
});

// GET /hr/employees/:id/notes
router.get("/:id/notes", requirePermission("hr.employees.view"), async (req: AuthenticatedRequest, res, next) => {
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
router.post("/:id/notes", requirePermission("hr.employees.view"), async (req: AuthenticatedRequest, res, next) => {
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
router.get("/:id/audit", requirePermission("hr.employees.view"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const rows = await pool.query(
      `SELECT * FROM hr_audit_events WHERE employee_id=$1::uuid ORDER BY created_at DESC LIMIT 100`, [id]);
    res.json(rows.rows);
  } catch (err) { next(err); }
});

export default router;
