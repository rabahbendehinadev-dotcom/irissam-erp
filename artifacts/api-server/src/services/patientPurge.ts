/**
 * patientPurge — suppression DÉFINITIVE d'un patient et de TOUTES ses données
 * liées (directes et indirectes), dans UNE transaction PostgreSQL atomique.
 *
 * Périmètre construit depuis le graphe FK réel (mêmes règles que le script
 * validé scripts/reset-uat-data.sql, mais restreint à UN SEUL patient) :
 *   - DELETE ciblés enfants → parents (jamais de DROP TABLE / TRUNCATE) ;
 *   - libération des ressources par UPDATE (lits, lits réa, box urgences,
 *     salles de bloc, ambulances) — les DÉFINITIONS matérielles ne sont
 *     JAMAIS supprimées ;
 *   - fiches qualité NC/CAPA conservées (seul le lien incident est coupé) ;
 *   - en-têtes de bordereaux d'assurance (lots multi-patients) conservés —
 *     seules les lignes des réclamations du patient sont retirées ;
 *   - référentiels système intouchés : users, rôles, permissions,
 *     départements, employés, médicaments, catalogues, stock, paramètres.
 */
import { pool } from "@workspace/db";

export interface PatientPurgeResult {
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    mpiId: string | null;
    fileNumber: string | null;
  };
  deleted: Record<string, number>;
  resourcesFreed: Record<string, number>;
  unlinked: Record<string, number>;
  totalRowsDeleted: number;
}

export async function deletePatientPermanently(
  patientId: string,
  actorUserId: string,
  ip?: string | null,
): Promise<PatientPurgeResult | null> {
  const client = await pool.connect();
  const deleted: Record<string, number> = {};
  const resourcesFreed: Record<string, number> = {};
  const unlinked: Record<string, number> = {};

  try {
    await client.query("BEGIN");

    const pRes = await client.query(
      `SELECT id, first_name, last_name, mpi_id, file_number
         FROM patients WHERE id = $1 FOR UPDATE`,
      [patientId],
    );
    if (!pRes.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    const p = pRes.rows[0] as {
      id: string; first_name: string; last_name: string;
      mpi_id: string | null; file_number: string | null;
    };

    const collect = async (sql: string, params: unknown[]): Promise<string[]> =>
      (await client.query(sql, params)).rows.map((r: { id: string }) => r.id);

    // ── 1. Périmètre : identifiants de TOUS les enregistrements du patient ───
    const encIds = await collect(
      `SELECT id FROM encounters WHERE patient_id = $1`, [patientId]);
    const admIds = await collect(
      `SELECT id FROM admissions
        WHERE patient_id = $1 OR encounter_id = ANY($2::uuid[])`,
      [patientId, encIds]);
    const visitIds = await collect(
      `SELECT id FROM emergency_visits
        WHERE patient_id = $1 OR encounter_id = ANY($2::uuid[])`,
      [patientId, encIds]);
    const apptIds = await collect(
      `SELECT id FROM appointments WHERE patient_id = $1`, [patientId]);
    const consultIds = await collect(
      `SELECT id FROM consultations
        WHERE patient_id = $1 OR encounter_id = ANY($2::uuid[])`,
      [patientId, encIds]);
    const invIds = await collect(
      `SELECT id FROM invoices
        WHERE patient_id = $1 OR encounter_id = ANY($2::uuid[])
           OR admission_id = ANY($3::uuid[]) OR consultation_id = ANY($4::uuid[])`,
      [patientId, encIds, admIds, consultIds]);
    const polIds = await collect(
      `SELECT id FROM insurance_policies WHERE patient_id = $1`, [patientId]);
    const covIds = await collect(
      `SELECT id FROM coverage_requests
        WHERE patient_id = $1 OR encounter_id = ANY($2::uuid[])
           OR admission_id = ANY($3::uuid[]) OR policy_id = ANY($4::uuid[])`,
      [patientId, encIds, admIds, polIds]);
    const claimIds = await collect(
      `SELECT id FROM insurance_claims
        WHERE patient_id = $1 OR encounter_id = ANY($2::uuid[])
           OR invoice_id = ANY($3::uuid[]) OR policy_id = ANY($4::uuid[])
           OR coverage_request_id = ANY($5::uuid[])`,
      [patientId, encIds, invIds, polIds, covIds]);
    const acctIds = await collect(
      `SELECT id FROM patient_portal_accounts WHERE patient_id = $1`, [patientId]);
    const srIds = await collect(
      `SELECT id FROM surgical_requests
        WHERE patient_id = $1 OR encounter_id = ANY($2::uuid[])`,
      [patientId, encIds]);
    const icuIds = await collect(
      `SELECT id FROM icu_admissions
        WHERE patient_id = $1 OR encounter_id = ANY($2::uuid[])`,
      [patientId, encIds]);
    const medConsIds = await collect(
      `SELECT id FROM medical_consumptions
        WHERE patient_id = $1 OR encounter_id = ANY($2::uuid[])`,
      [patientId, encIds]);
    const docIds = await collect(
      `SELECT id FROM document_records WHERE patient_id = $1`, [patientId]);
    const wfIds = await collect(
      `SELECT id FROM document_workflows WHERE document_id = ANY($1::uuid[])`, [docIds]);
    const qiIds = await collect(
      `SELECT id FROM quality_incidents
        WHERE patient_id = $1 OR admission_id = ANY($2::uuid[])`,
      [patientId, admIds]);

    // entity_id (text) des notifications/alertes liées au patient
    const entityTextIds: string[] = [
      patientId, ...encIds, ...admIds, ...visitIds, ...apptIds,
      ...invIds, ...srIds, ...icuIds, ...consultIds, ...claimIds,
    ];

    // ── 2. Libération des ressources (UPDATE, jamais DELETE) ─────────────────
    const free = async (label: string, sql: string, params: unknown[]) => {
      const r = await client.query(sql, params);
      if (r.rowCount) resourcesFreed[label] = r.rowCount;
    };

    await free("occupancy_beds",
      `UPDATE occupancy_beds SET
         patient_id = NULL, patient_name = NULL, encounter_id = NULL, admission_id = NULL,
         occupied_at = NULL, expected_release_at = NULL,
         cleaning_started_at = NULL, cleaning_completed_at = NULL,
         status = 'disponible', updated_at = now()
       WHERE patient_id = $1 OR admission_id = ANY($2::uuid[]) OR encounter_id = ANY($3::uuid[])`,
      [patientId, admIds, encIds]);

    await free("icu_beds",
      `UPDATE icu_beds SET
         patient_id = NULL, patient_name = NULL, encounter_id = NULL, icu_admission_id = NULL,
         priority = NULL, occupied_at = NULL, expected_release_at = NULL, cleaning_started_at = NULL,
         status = 'disponible', updated_at = now()
       WHERE patient_id = $1 OR encounter_id = ANY($2::uuid[]) OR icu_admission_id = ANY($3::uuid[])`,
      [patientId, encIds, icuIds]);

    // Box urgences : décrément de l'occupation pour les passages encore actifs
    // du patient (statuts physiquement en box), puis recalcul du statut.
    await free("emergency_rooms",
      `WITH d AS (
         SELECT assigned_room_id AS room_id, count(*)::int AS n
           FROM emergency_visits
          WHERE (patient_id = $1 OR encounter_id = ANY($2::uuid[]))
            AND assigned_room_id IS NOT NULL
            AND status IN ('attente_triage','en_triage','attente_soins','en_soins','observation')
          GROUP BY 1
       )
       UPDATE emergency_rooms er SET
         occupied = GREATEST(er.occupied - d.n, 0),
         status = (CASE
                    WHEN GREATEST(er.occupied - d.n, 0) = 0 THEN 'libre'
                    WHEN GREATEST(er.occupied - d.n, 0) >= er.capacity THEN 'occupee'
                    ELSE 'partielle'
                  END)::er_room_status,
         updated_at = now()
       FROM d WHERE er.id = d.room_id`,
      [patientId, encIds]);

    await free("operating_rooms",
      `UPDATE operating_rooms SET
         current_surgical_request_id = NULL, status = 'libre', updated_at = now()
       WHERE current_surgical_request_id = ANY($1::uuid[])`,
      [srIds]);

    await free("ambulances",
      `UPDATE ambulances SET
         current_patient_id = NULL, current_patient_name = NULL, current_patient_priority = NULL,
         chief_complaint = NULL, location = NULL, dispatched_at = NULL, eta_minutes = NULL,
         status = 'disponible', updated_at = now()
       WHERE current_patient_id = $1`,
      [patientId]);

    // ── 3. Qualité : conserver NC/CAPA, couper le lien vers les incidents ────
    const unlink = async (label: string, sql: string, params: unknown[]) => {
      const r = await client.query(sql, params);
      if (r.rowCount) unlinked[label] = r.rowCount;
    };
    await unlink("quality_non_conformities",
      `UPDATE quality_non_conformities SET incident_id = NULL WHERE incident_id = ANY($1::uuid[])`,
      [qiIds]);
    await unlink("quality_corrective_actions",
      `UPDATE quality_corrective_actions SET incident_id = NULL WHERE incident_id = ANY($1::uuid[])`,
      [qiIds]);

    // ── 4. DELETE ciblés, ordre enfants → parents (graphe FK réel) ───────────
    const del = async (table: string, where: string, params: unknown[]) => {
      const r = await client.query(`DELETE FROM ${table} WHERE ${where}`, params);
      if (r.rowCount) deleted[table] = (deleted[table] ?? 0) + r.rowCount;
    };

    await del("admission_timeline_events", `admission_id = ANY($1::uuid[])`, [admIds]);
    await del("emergency_vitals",
      `visit_id = ANY($1::uuid[]) OR encounter_id = ANY($2::uuid[])`, [visitIds, encIds]);

    // Assurance — enfants des réclamations d'abord
    await del("insurance_approvals", `claim_id = ANY($1::uuid[])`, [claimIds]);
    await del("insurance_bordereau_items", `claim_id = ANY($1::uuid[])`, [claimIds]);
    await del("insurance_rejections", `claim_id = ANY($1::uuid[])`, [claimIds]);
    await del("insurance_org_payments", `claim_id = ANY($1::uuid[])`, [claimIds]);
    await del("insurance_claim_items",
      `claim_id = ANY($1::uuid[])
         OR invoice_item_id IN (SELECT id FROM invoice_items WHERE invoice_id = ANY($2::uuid[]))`,
      [claimIds, invIds]);
    await del("insurance_claims", `id = ANY($1::uuid[])`, [claimIds]);
    await del("coverage_requests", `id = ANY($1::uuid[])`, [covIds]);
    await del("insurance_policies", `id = ANY($1::uuid[])`, [polIds]);

    // Facturation
    await del("billable_events",
      `patient_id = $1 OR encounter_id = ANY($2::uuid[]) OR invoice_id = ANY($3::uuid[])`,
      [patientId, encIds, invIds]);
    await del("credit_notes",
      `patient_id = $1 OR invoice_id = ANY($2::uuid[])`, [patientId, invIds]);
    await del("payments",
      `patient_id = $1 OR invoice_id = ANY($2::uuid[])`, [patientId, invIds]);
    await del("invoice_items", `invoice_id = ANY($1::uuid[])`, [invIds]);

    // Qualité : incidents liés au patient (NC/CAPA déjà déliées)
    await del("quality_incidents", `id = ANY($1::uuid[])`, [qiIds]);

    // Urgences puis facturation parent
    await del("emergency_visits", `id = ANY($1::uuid[])`, [visitIds]);
    await del("invoices", `id = ANY($1::uuid[])`, [invIds]);

    // Rendez-vous (+ demandes du portail)
    await del("patient_portal_appointment_requests",
      `patient_id = $1 OR account_id = ANY($2::uuid[]) OR appointment_id = ANY($3::uuid[])`,
      [patientId, acctIds, apptIds]);
    await del("appointments", `id = ANY($1::uuid[])`, [apptIds]);

    // Historiques / clinique
    await del("audit_logs",
      `patient_id = $1 OR encounter_id = ANY($2::uuid[])`, [patientId, encIds]);
    await del("clinical_notes",
      `patient_id = $1 OR encounter_id = ANY($2::uuid[])`, [patientId, encIds]);
    await del("clinical_tasks",
      `patient_id = $1 OR encounter_id = ANY($2::uuid[])`, [patientId, encIds]);
    await del("doctor_messages",
      `patient_id = $1 OR encounter_id = ANY($2::uuid[])`, [patientId, encIds]);

    // GED — documents du patient et toutes leurs tables filles
    await del("document_access_rules", `document_id = ANY($1::uuid[])`, [docIds]);
    await del("document_approvals", `document_id = ANY($1::uuid[])`, [docIds]);
    await del("document_archive_jobs", `document_id = ANY($1::uuid[])`, [docIds]);
    await del("document_comments", `document_id = ANY($1::uuid[])`, [docIds]);
    await del("document_download_logs", `document_id = ANY($1::uuid[])`, [docIds]);
    await del("document_notifications", `document_id = ANY($1::uuid[])`, [docIds]);
    await del("document_shares", `document_id = ANY($1::uuid[])`, [docIds]);
    await del("document_signatures", `document_id = ANY($1::uuid[])`, [docIds]);
    await del("document_versions", `document_id = ANY($1::uuid[])`, [docIds]);
    await del("document_watermarks", `document_id = ANY($1::uuid[])`, [docIds]);
    await del("document_links",
      `source_id = ANY($1::uuid[]) OR target_id = ANY($1::uuid[])`, [docIds]);
    await del("document_workflow_steps", `workflow_id = ANY($1::uuid[])`, [wfIds]);
    await del("document_workflows", `id = ANY($1::uuid[])`, [wfIds]);
    await del("document_records", `id = ANY($1::uuid[])`, [docIds]);

    // Bloc opératoire
    await del("or_slots",
      `patient_id = $1 OR surgical_request_id = ANY($2::uuid[])`, [patientId, srIds]);

    // Stock médical : consommations liées au patient (les mouvements de stock
    // globaux et les lots sont conservés)
    await del("medical_consumption_items", `consumption_id = ANY($1::uuid[])`, [medConsIds]);
    await del("medical_consumptions", `id = ANY($1::uuid[])`, [medConsIds]);

    // Prescriptions / laboratoire / imagerie
    await del("prescriptions",
      `patient_id = $1 OR encounter_id = ANY($2::uuid[])`, [patientId, encIds]);
    await del("lab_orders",
      `patient_id = $1 OR encounter_id = ANY($2::uuid[])`, [patientId, encIds]);
    await del("imaging_orders",
      `patient_id = $1 OR encounter_id = ANY($2::uuid[])`, [patientId, encIds]);

    // Réanimation / bloc / hospitalisations / consultations
    await del("icu_admissions", `id = ANY($1::uuid[])`, [icuIds]);
    await del("surgical_requests", `id = ANY($1::uuid[])`, [srIds]);
    await del("admissions", `id = ANY($1::uuid[])`, [admIds]);
    await del("consultations", `id = ANY($1::uuid[])`, [consultIds]);

    // Portail patient
    await del("patient_portal_access_logs",
      `patient_id = $1 OR account_id = ANY($2::uuid[])`, [patientId, acctIds]);
    await del("patient_portal_consents",
      `patient_id = $1 OR account_id = ANY($2::uuid[])`, [patientId, acctIds]);
    await del("patient_portal_devices", `account_id = ANY($1::uuid[])`, [acctIds]);
    await del("patient_portal_messages",
      `patient_id = $1 OR account_id = ANY($2::uuid[])`, [patientId, acctIds]);
    await del("patient_portal_notifications",
      `patient_id = $1 OR account_id = ANY($2::uuid[])`, [patientId, acctIds]);
    await del("patient_portal_sessions",
      `patient_id = $1 OR account_id = ANY($2::uuid[])`, [patientId, acctIds]);
    await del("portal_preview_tokens",
      `patient_id = $1 OR account_id = ANY($2::uuid[])`, [patientId, acctIds]);
    await del("patient_portal_accounts", `id = ANY($1::uuid[])`, [acctIds]);

    // Divers patient
    await del("patient_timeline_events", `patient_id = $1`, [patientId]);
    await del("patient_vaccinations", `patient_id = $1`, [patientId]);

    // Épisodes (tous les enfants sont supprimés / déliés ci-dessus)
    await del("encounters", `id = ANY($1::uuid[])`, [encIds]);

    // Notifications / alertes référencées par entity_id (texte)
    await del("notifications", `entity_id = ANY($1::text[])`, [entityTextIds]);
    await del("alerts", `entity_id = ANY($1::text[])`, [entityTextIds]);

    // Enfin, la fiche patient elle-même
    await del("patients", `id = $1`, [patientId]);

    const totalRowsDeleted = Object.values(deleted).reduce((a, b) => a + b, 0);

    // ── 5. Journal d'activité (dans la même transaction) ─────────────────────
    await client.query(
      `INSERT INTO user_activity_logs
         (user_id, user_name, user_role, action, module, description, ip)
       SELECT $1, u.first_name || ' ' || u.last_name, u.role,
              'view'::user_activity_action, 'system', $2, $3
         FROM users u WHERE u.id = $1`,
      [
        actorUserId,
        `SUPPRESSION DÉFINITIVE patient ${p.last_name} ${p.first_name} ` +
        `(MPI ${p.mpi_id ?? "—"}, dossier ${p.file_number ?? "—"}) — ` +
        `${totalRowsDeleted} lignes supprimées dans ${Object.keys(deleted).length} tables`,
        ip ?? null,
      ],
    );

    await client.query("COMMIT");

    return {
      patient: {
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        mpiId: p.mpi_id,
        fileNumber: p.file_number,
      },
      deleted,
      resourcesFreed,
      unlinked,
      totalRowsDeleted,
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
