/**
 * Patient Portal — Profile
 * GET  /patient-portal/profile
 * PATCH /patient-portal/profile   (phone, email, address, emergency_contact_phone only)
 */
import { Router } from "express";
import type { Response } from "express";
import { pool } from "@workspace/db";
import { requirePatientAuth, type PatientRequest } from "../../middleware/requirePatientAuth.js";

const router = Router();

async function auditLog(accountId: string, patientId: string, action: string, ip: string | undefined) {
  try {
    await pool.query(
      `INSERT INTO patient_portal_access_logs (account_id,patient_id,action,ip)
       VALUES ($1,$2,$3,$4)`,
      [accountId, patientId, action, ip ?? null],
    );
  } catch { /* non-blocking */ }
}

// GET /profile
router.get("/", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId, accountId } = req.patient!;
  try {
    const { rows } = await pool.query(
      `SELECT
         p.id, p.first_name, p.last_name, p.maiden_name, p.mpi_id,
         p.date_of_birth, p.gender, p.phone, p.phone_secondary,
         p.email, p.address, p.place_of_birth,
         p.emergency_contact_phone,
         pi.insurer_name, pi.member_number, pi.expiry_date AS insurance_expiry,
         a.preferred_language, a.email AS portal_email, a.email_verified
       FROM patients p
       JOIN patient_portal_accounts a ON a.patient_id = p.id
       LEFT JOIN patient_insurances pi ON pi.patient_id=p.id AND pi.status='active'
       WHERE p.id=$1 AND a.id=$2 AND a.deleted_at IS NULL`,
      [patientId, accountId],
    );
    if (!rows[0]) {
      res.status(404).json({ message: "Profil introuvable." });
      return;
    }
    await auditLog(accountId, patientId, "view_profile", req.ip);
    res.json({ profile: rows[0] });
  } catch (err) {
    console.error("[portal/profile]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// PATCH /profile — only allow safe contact fields
router.patch("/", requirePatientAuth, async (req: PatientRequest, res: Response) => {
  const { patientId, accountId } = req.patient!;
  const { phone, email, address, emergencyContactPhone, preferredLanguage } = req.body ?? {};

  try {
    // Update patients table (only contact fields)
    if (phone || address || emergencyContactPhone) {
      const setParts: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (phone)                { setParts.push(`phone=$${i++}`); vals.push(phone); }
      if (address)              { setParts.push(`address=$${i++}`); vals.push(address); }
      if (emergencyContactPhone){ setParts.push(`emergency_contact_phone=$${i++}`); vals.push(emergencyContactPhone); }
      vals.push(patientId);
      await pool.query(
        `UPDATE patients SET ${setParts.join(",")} WHERE id=$${i}`,
        vals,
      );
    }

    // Update portal account email + language
    if (email || preferredLanguage) {
      const setParts: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (email)            { setParts.push(`email=$${i++}`); vals.push(email); }
      if (preferredLanguage){ setParts.push(`preferred_language=$${i++}`); vals.push(preferredLanguage); }
      vals.push(accountId);
      await pool.query(
        `UPDATE patient_portal_accounts SET ${setParts.join(",")}, updated_at=now() WHERE id=$${i}`,
        vals,
      );
    }

    await auditLog(accountId, patientId, "update_profile", req.ip);
    res.json({ message: "Profil mis à jour." });
  } catch (err) {
    console.error("[portal/profile PATCH]", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
