/**
 * Directory routes — référentiel réel (médecins, départements) depuis PostgreSQL.
 * Utilisé par les formulaires RDV / Admissions pour ne proposer que des
 * entités réelles (aucune donnée mock).
 */
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";

const router = Router();

/** GET /directory/doctors — médecins actifs (users.role = 'doctor') */
router.get("/doctors", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, COALESCE(specialty, '') AS specialty
         FROM users
        WHERE role = 'doctor'
          AND deleted_at IS NULL
          AND account_status = 'active'
        ORDER BY last_name, first_name`,
    );
    res.json(rows.map((r: any) => ({
      id:        r.id,
      firstName: r.first_name,
      lastName:  r.last_name,
      fullName:  `${r.first_name} ${r.last_name}`,
      specialty: r.specialty,
    })));
  } catch (err) {
    next(err);
  }
});

/** GET /directory/departments — départements actifs */
router.get("/departments", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name
         FROM departments
        WHERE deleted_at IS NULL
          AND is_active = true
        ORDER BY name`,
    );
    res.json(rows.map((r: any) => ({ id: r.id, name: r.name })));
  } catch (err) {
    next(err);
  }
});

export default router;
