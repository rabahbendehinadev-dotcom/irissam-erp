/**
 * /admissions routes — CRUD backed by AdmissionService (DAL).
 *
 * Intégrité référentielle (UAT Phase 2) :
 *  - POST exige un patientId réel (patients), un bedId réel (occupé
 *    atomiquement par admit() dans la même transaction), et un motif non vide.
 *    doctorId/serviceId optionnels mais vérifiés en base quand fournis —
 *    les noms sont résolus côté serveur (jamais fournis par le client seul).
 *  - type/priority validés contre les enums PostgreSQL (drizzle enumValues).
 *  - admissionDate/admissionTime éventuels du client sont IGNORÉS — le service
 *    fixe la date/heure réelles côté serveur.
 *  - PATCH limité à diagnosis/notes/expectedDischargeDate — les transitions de
 *    statut et changements de lit passent par /cancel, /discharge, /transfer
 *    (chemins atomiques qui gèrent lit + encounter + audit).
 *  - RBAC : GET → admissions.view, POST → admissions.create,
 *    PATCH → admissions.edit, transfer/cancel/discharge → permissions dédiées.
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { db, pool } from "@workspace/db";
import { admissionsTable, auditLogsTable, admissionConsumablesTable } from "@workspace/db/schema";
import { requirePermission } from "../middleware/requirePermission";
import {
  eq,
  isNull,
  and,
  desc,
  asc,
  ilike,
  or,
  inArray,
} from "drizzle-orm";
import { admissionService } from "../services";
import type { ActorCtx } from "../repositories/types";

interface AuthenticatedRequest extends Request {
  auth?: { userId: string; role: string };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Valeurs autorisées — lues depuis le schéma drizzle (alignées sur PostgreSQL). */
const ADMISSION_TYPES: readonly string[] = admissionsTable.type.enumValues;
const ADMISSION_PRIORITIES: readonly string[] = admissionsTable.priority.enumValues;

function actor(req: AuthenticatedRequest): ActorCtx {
  return {
    userId:   req.auth?.userId ?? "system",
    userName: req.auth?.userId ?? "system",
    userRole: req.auth?.role   ?? "guest",
  };
}

const router = Router();

/** Map DB row → JSON response shape expected by the frontend */
function mapAdmission(a: typeof admissionsTable.$inferSelect) {
  return {
    id:                 a.id,
    admissionNumber:    a.admissionNumber,
    encounterId:        a.encounterId,
    patientId:          a.patientId,
    patientName:        a.patientName,
    patientMpiId:       a.patientMpiId,
    patientDob:         a.patientDob,
    patientPhone:       a.patientPhone,
    type:               a.type,
    status:             a.status,
    priority:           a.priority,
    serviceId:          a.serviceId,
    serviceName:        a.serviceName,
    doctorId:           a.doctorId,
    doctorName:         a.doctorName,
    motif:              a.motif,
    diagnosis:          a.diagnosis,
    bedId:              a.bedId,
    bedNumber:          a.bedNumber,
    roomNumber:         a.roomNumber,
    floorLabel:         a.floorLabel,
    buildingName:       a.buildingName,
    admissionDate:      a.admissionDate,
    admissionTime:      a.admissionTime,
    expectedDischargeDate: a.expectedDischargeDate,
    actualDischargeDate:   a.actualDischargeDate,
    actualDischargeTime:   a.actualDischargeTime,
    dischargeType:      a.dischargeType,
    dischargeNotes:     a.dischargeNotes,
    preadmissionDate:        a.preadmissionDate,
    preadmissionConvertedAt: a.preadmissionConvertedAt,
    notes:              a.notes,
    siteId:             a.siteId,
    createdAt:          a.createdAt,
    updatedAt:          a.updatedAt,
  };
}

/** GET /admissions (requires admissions.view) */
router.get("/", requirePermission("admissions.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, search, date, patientId, type } = req.query as {
      status?: string;
      search?: string;
      date?: string;
      patientId?: string;
      type?: string;
    };

    // All filters are accumulated then applied in ONE where(and(...)).
    // With Drizzle's $dynamic(), each .where() call REPLACES the previous
    // clause — chaining patientId + type used to silently DROP the patientId
    // filter and leak other patients' hospitalisations onto the fiche.
    const conditions = [isNull(admissionsTable.deletedAt)];

    if (patientId) {
      conditions.push(eq(admissionsTable.patientId, patientId));
    }

    if (type) {
      conditions.push(
        eq(admissionsTable.type, type as (typeof admissionsTable.type.enumValues)[number]),
      );
    }

    if (status && status !== "all") {
      conditions.push(
        eq(admissionsTable.status, status as "active" | "discharged" | "transferred" | "cancelled"),
      );
    }

    if (date) {
      conditions.push(eq(admissionsTable.admissionDate, date));
    }

    if (search) {
      const searchCond = or(
        ilike(admissionsTable.patientName, `%${search}%`),
        ilike(admissionsTable.admissionNumber, `%${search}%`),
        ilike(admissionsTable.doctorName, `%${search}%`),
        ilike(admissionsTable.serviceName, `%${search}%`),
      );
      if (searchCond) conditions.push(searchCond);
    }

    const rows = await db
      .select()
      .from(admissionsTable)
      .where(and(...conditions))
      .orderBy(desc(admissionsTable.createdAt));
    res.json(rows.map(mapAdmission));
  } catch (err) {
    next(err);
  }
});

/** GET /admissions/:id (requires admissions.view) */
router.get("/:id", requirePermission("admissions.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const [row] = await db
      .select()
      .from(admissionsTable)
      .where(and(eq(admissionsTable.id, id), isNull(admissionsTable.deletedAt)))
      .limit(1);

    if (!row) { res.status(404).json({ message: "Admission not found" }); return; }
    res.json(mapAdmission(row));
  } catch (err) {
    next(err);
  }
});

// ─── Timeline (historique ADT) ────────────────────────────────────────────────

/** Libellés français des types de sortie (mêmes valeurs que l'enum discharge_type). */
const DISCHARGE_TYPE_LABEL: Record<string, string> = {
  domicile:          "retour à domicile",
  transfert_interne: "transfert interne",
  transfert_externe: "transfert externe",
  deces:             "décès",
  fugue:             "fugue",
  contre_avis:       "sortie contre avis médical",
};

/** "2026-08-13" → "13/08/2026" (chaîne vide si absent/inattendu). */
const frDate = (iso: unknown): string =>
  typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("/") : "";

/**
 * GET /admissions/:id/timeline (requires admissions.view)
 *
 * Historique réel de l'admission, reconstruit depuis audit_logs : les
 * mouvements ADT (admitted / bed_transferred / discharged / cancelled) y sont
 * journalisés par admissionService dans la même transaction que la mutation.
 * Aucune table dédiée ni duplication — on ne fait que projeter le journal
 * existant vers le contrat AdmissionTimelineEvent du frontend. Les actions
 * d'UI (view/print…) vivent dans user_activity_logs et sont exclues d'office.
 */
router.get("/:id/timeline", requirePermission("admissions.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);

    const [adm] = await db
      .select({ id: admissionsTable.id })
      .from(admissionsTable)
      .where(and(eq(admissionsTable.id, id), isNull(admissionsTable.deletedAt)))
      .limit(1);
    if (!adm) { res.status(404).json({ message: "Admission not found" }); return; }

    const rows = await db
      .select()
      .from(auditLogsTable)
      .where(and(
        eq(auditLogsTable.resourceType, "admission"),
        eq(auditLogsTable.resourceId, id),
        inArray(auditLogsTable.action, [
          "admitted", "preadmitted", "preadmission_converted",
          "bed_transferred", "discharged", "cancelled",
        ]),
      ))
      .orderBy(asc(auditLogsTable.timestamp));

    const events = rows.map((r) => {
      const oldV = (r.oldValue ?? {}) as Record<string, unknown>;
      const newV = (r.newValue ?? {}) as Record<string, unknown>;

      let type = "status_change";
      let description: string = r.action;

      switch (r.action) {
        case "admitted": {
          type = "admission";
          const num = typeof newV.admissionNumber === "string" ? newV.admissionNumber : "";
          const bed = typeof newV.bedNumber === "string" ? newV.bedNumber : "";
          description = `Admission${num ? ` ${num}` : ""} créée${bed ? ` — lit ${bed}` : ""}`;
          break;
        }
        case "preadmitted": {
          type = "admission";
          const num  = typeof newV.admissionNumber === "string" ? newV.admissionNumber : "";
          const bed  = typeof newV.bedNumber === "string" ? newV.bedNumber : "";
          const prev = frDate(newV.preadmissionDate);
          description = `Préadmission${num ? ` ${num}` : ""} créée${bed ? ` — lit ${bed} réservé` : ""}${prev ? ` (entrée prévue le ${prev})` : ""}`;
          break;
        }
        case "preadmission_converted": {
          type = "preadmission_converted";
          const bed = typeof newV.bedNumber === "string" ? newV.bedNumber : "";
          description = `Admission confirmée — hospitalisation effective${bed ? ` (lit ${bed} occupé)` : ""}`;
          break;
        }
        case "bed_transferred": {
          type = "bed_change";
          const from    = typeof oldV.bedNumber === "string" && oldV.bedNumber ? oldV.bedNumber : "?";
          const to      = typeof newV.bedNumber === "string" && newV.bedNumber ? newV.bedNumber : "?";
          const svcFrom = typeof oldV.serviceName === "string" ? oldV.serviceName : "";
          const svcTo   = typeof newV.serviceName === "string" ? newV.serviceName : "";
          const svc     = svcTo && svcTo !== svcFrom ? ` (${svcFrom} → ${svcTo})` : "";
          const motif   = typeof newV.motif === "string" && newV.motif ? ` — motif : ${newV.motif}` : "";
          description = `Transfert de lit ${from} → ${to}${svc}${motif}`;
          break;
        }
        case "discharged": {
          type = "discharge";
          const dt    = typeof newV.dischargeType === "string" ? newV.dischargeType : "";
          const label = DISCHARGE_TYPE_LABEL[dt] ?? dt;
          const d     = frDate(newV.dischargeDate);
          const time  = typeof newV.dischargeTime === "string" ? newV.dischargeTime : "";
          description = `Sortie${label ? ` : ${label}` : ""}${d ? ` — le ${d}${time ? ` à ${time}` : ""}` : ""}`;
          break;
        }
        case "cancelled": {
          type = "status_change";
          description = "Admission annulée";
          break;
        }
      }

      return {
        id:          r.id,
        admissionId: id,
        type,
        description,
        date:        r.timestamp?.toISOString() ?? new Date().toISOString(),
        userId:      r.userId ?? "",
        userName:    r.userName,
      };
    });

    res.json(events);
  } catch (err) {
    next(err);
  }
});

/** POST /admissions (requires admissions.create) — referential integrity enforced */
router.post("/", requirePermission("admissions.create"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as {
      encounterId?: string;
      patientId?: string;
      type?: string;
      priority?: string;
      serviceId?: string;
      serviceName?: string;
      doctorId?: string;
      doctorName?: string;
      motif?: string;
      diagnosis?: string;
      bedId?: string;
      bedNumber?: string;
      roomNumber?: string;
      floorLabel?: string;
      buildingName?: string;
      expectedDischargeDate?: string;
      preadmissionDate?: string;
      notes?: string;
    };

    // Alias hérité du module urgences : « critique » ≙ « vital » (absent de l'enum admission_priority)
    if (body.priority === "critique") body.priority = "vital";

    // ── patientId : obligatoire, UUID, patient réel ─────────────────────────
    if (!body.patientId || !UUID_RE.test(body.patientId)) {
      res.status(400).json({ error: "patientId (UUID) est requis — sélectionnez un patient réel" });
      return;
    }
    const patientQ = await pool.query(
      `SELECT id, first_name, last_name, mpi_id, date_of_birth, phone
         FROM patients WHERE id = $1 AND deleted_at IS NULL`,
      [body.patientId],
    );
    if (patientQ.rows.length === 0) {
      res.status(400).json({ error: "Patient introuvable" });
      return;
    }
    const p = patientQ.rows[0];
    const patientName = `${p.last_name} ${p.first_name}`;
    const patientDob: string | undefined =
      p.date_of_birth instanceof Date
        ? p.date_of_birth.toISOString().slice(0, 10)
        : (p.date_of_birth ?? undefined);

    // ── motif : obligatoire ─────────────────────────────────────────────────
    const motif = (body.motif ?? "").trim();
    if (!motif) {
      res.status(400).json({ error: "motif est requis" });
      return;
    }

    // ── type / priority : enums PostgreSQL ──────────────────────────────────
    if (body.type !== undefined && !ADMISSION_TYPES.includes(body.type)) {
      res.status(400).json({ error: `type invalide — valeurs autorisées : ${ADMISSION_TYPES.join(", ")}` });
      return;
    }
    if (body.priority !== undefined && !ADMISSION_PRIORITIES.includes(body.priority)) {
      res.status(400).json({ error: `priority invalide — valeurs autorisées : ${ADMISSION_PRIORITIES.join(", ")}` });
      return;
    }

    // ── preadmissionDate : optionnelle, AAAA-MM-JJ (type "preadmission" uniquement) ──
    const preadmissionDate =
      typeof body.preadmissionDate === "string" && body.preadmissionDate.trim() ? body.preadmissionDate.trim() : undefined;
    if (preadmissionDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(preadmissionDate)) {
      res.status(400).json({ error: "preadmissionDate invalide (format AAAA-MM-JJ)" });
      return;
    }

    // ── bedId : obligatoire (l'admission occupe un lit réel) ────────────────
    if (!body.bedId || !UUID_RE.test(body.bedId)) {
      res.status(400).json({ error: "bedId (UUID) est requis — sélectionnez un lit réel" });
      return;
    }

    // ── doctorId : optionnel mais vérifié; nom résolu côté serveur ─────────
    let doctorId: string | undefined;
    let doctorName = (body.doctorName ?? "").trim();
    if (body.doctorId) {
      if (!UUID_RE.test(body.doctorId)) {
        res.status(400).json({ error: "doctorId invalide (UUID attendu)" });
        return;
      }
      const doctorQ = await pool.query(
        `SELECT id, first_name, last_name FROM users
          WHERE id = $1 AND role = 'doctor' AND deleted_at IS NULL`,
        [body.doctorId],
      );
      if (doctorQ.rows.length === 0) {
        res.status(400).json({ error: "Médecin introuvable" });
        return;
      }
      doctorId   = doctorQ.rows[0].id;
      doctorName = `Dr ${doctorQ.rows[0].first_name} ${doctorQ.rows[0].last_name}`;
    } else {
      // Revue UAT Phase 2 : plus de médecin en texte libre — l'UUID d'un
      // utilisateur réel est exigé, le nom est toujours résolu côté serveur.
      res.status(400).json({ error: "doctorId est requis (UUID d'un utilisateur réel)" });
      return;
    }

    // ── serviceId : optionnel mais vérifié (departments); nom résolu ───────
    let serviceId: string | undefined;
    let serviceName = (body.serviceName ?? "").trim();
    if (body.serviceId) {
      if (!UUID_RE.test(body.serviceId)) {
        res.status(400).json({ error: "serviceId invalide (UUID attendu)" });
        return;
      }
      const deptQ = await pool.query(
        `SELECT id, name FROM departments
          WHERE id = $1 AND deleted_at IS NULL AND is_active = true`,
        [body.serviceId],
      );
      if (deptQ.rows.length === 0) {
        res.status(400).json({ error: "Service/département introuvable" });
        return;
      }
      serviceId   = deptQ.rows[0].id;
      serviceName = deptQ.rows[0].name;
    } else if (serviceName) {
      // Résolution stricte : le nom doit correspondre à un département réel —
      // aucun service fictif ne doit être persisté (revue UAT Phase 2).
      const deptByName = await pool.query(
        `SELECT id, name FROM departments
          WHERE lower(name) = lower($1) AND deleted_at IS NULL AND is_active = true`,
        [serviceName],
      );
      if (deptByName.rows.length === 0) {
        res.status(400).json({ error: `Service inconnu : "${serviceName}" ne correspond à aucun département réel` });
        return;
      }
      serviceId   = deptByName.rows[0].id;
      serviceName = deptByName.rows[0].name;
    } else {
      res.status(400).json({ error: "serviceId ou serviceName est requis" });
      return;
    }

    // ── encounterId : format + appartenance au même patient ─────────────────
    if (body.encounterId) {
      if (!UUID_RE.test(body.encounterId)) {
        res.status(400).json({ error: "encounterId invalide (UUID attendu)" });
        return;
      }
      const encQ = await pool.query(
        `SELECT patient_id FROM encounters WHERE id = $1`,
        [body.encounterId],
      );
      if (encQ.rows.length === 0) {
        res.status(400).json({ error: "Encounter introuvable" });
        return;
      }
      if (encQ.rows[0].patient_id !== body.patientId) {
        res.status(400).json({ error: "encounterId appartient à un autre patient — rattachement refusé" });
        return;
      }
    }

    // ── expectedDischargeDate : format + cohérence clinique ─────────────────
    // (bug UAT : une valeur transitoire "0006-02-02" d'un <input type=date>
    // passait le simple contrôle de format et polluait la base)
    if (body.expectedDischargeDate) {
      if (!DATE_RE.test(body.expectedDischargeDate)) {
        res.status(400).json({ error: "expectedDischargeDate invalide (YYYY-MM-DD attendu)" });
        return;
      }
      const admissionDay = new Date().toISOString().slice(0, 10); // le service fixe admissionDate = aujourd'hui
      if (body.expectedDischargeDate < admissionDay) {
        res.status(400).json({ error: "expectedDischargeDate ne peut pas être antérieure à la date d'admission" });
        return;
      }
    }

    try {
      const { admission } = await admissionService.admit(
        {
          patientId:     p.id,
          patientName,
          patientMpiId:  p.mpi_id ?? undefined,
          patientDob,
          patientPhone:  p.phone ?? undefined,
          type:          body.type,
          priority:      body.priority,
          serviceId,
          serviceName,
          doctorId,
          doctorName,
          motif,
          diagnosis:     body.diagnosis?.trim() || undefined,
          notes:         body.notes?.trim() || undefined,
          bedId:         body.bedId,
          bedNumber:     body.bedNumber,
          roomNumber:    body.roomNumber,
          floorLabel:    body.floorLabel,
          buildingName:  body.buildingName,
          expectedDischargeDate: body.expectedDischargeDate,
          preadmissionDate: body.type === "preadmission" ? preadmissionDate : undefined,
          encounterId:   body.encounterId, // reuse from Urgences/Consultation
          siteId:        undefined,
        },
        actor(req),
      );

      res.status(201).json(mapAdmission(admission));
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      if (msg.includes("non disponible")) { res.status(409).json({ error: msg }); return; }
      if (msg.includes("introuvable"))    { res.status(400).json({ error: msg }); return; }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

/** PATCH /admissions/:id (requires admissions.edit) — champs administratifs uniquement */
router.patch("/:id", requirePermission("admissions.edit"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const body = req.body as {
      status?: unknown;
      bedId?: unknown;
      bedNumber?: unknown;
      diagnosis?: string;
      notes?: string;
      expectedDischargeDate?: string;
    };

    // Les transitions d'état et changements de lit passent par les endpoints
    // atomiques dédiés (libération/occupation du lit + encounter + audit).
    if (body.status !== undefined) {
      res.status(400).json({ error: "status non modifiable ici — utilisez /cancel, /discharge ou /transfer" });
      return;
    }
    if (body.bedId !== undefined || body.bedNumber !== undefined) {
      res.status(400).json({ error: "changement de lit non modifiable ici — utilisez /transfer" });
      return;
    }
    if (body.expectedDischargeDate) {
      if (!DATE_RE.test(body.expectedDischargeDate)) {
        res.status(400).json({ error: "expectedDischargeDate invalide (YYYY-MM-DD attendu)" });
        return;
      }
      const [current] = await db
        .select({ admissionDate: admissionsTable.admissionDate })
        .from(admissionsTable)
        .where(and(eq(admissionsTable.id, id), isNull(admissionsTable.deletedAt)))
        .limit(1);
      if (!current) { res.status(404).json({ message: "Admission not found" }); return; }
      if (current.admissionDate && body.expectedDischargeDate < current.admissionDate) {
        res.status(400).json({ error: "expectedDischargeDate ne peut pas être antérieure à la date d'admission" });
        return;
      }
    }

    const [updated] = await db
      .update(admissionsTable)
      .set({
        ...(typeof body.diagnosis === "string" && { diagnosis: body.diagnosis.trim() || null }),
        ...(typeof body.notes === "string" && { notes: body.notes.trim() || null }),
        ...(body.expectedDischargeDate !== undefined && { expectedDischargeDate: body.expectedDischargeDate || null }),
        updatedAt: new Date(),
        updatedBy: req.auth?.userId ?? undefined,
      })
      .where(and(eq(admissionsTable.id, id), isNull(admissionsTable.deletedAt)))
      .returning();

    if (!updated) { res.status(404).json({ message: "Admission not found" }); return; }
    res.json(mapAdmission(updated));
  } catch (err) {
    next(err);
  }
});

/** POST /admissions/:id/transfer (requires admissions.transfer)
 *  Body: { newBedId, motif (obligatoire), notes? } — mouvement ADT atomique. */
router.post("/:id/transfer", requirePermission("admissions.transfer"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id   = String(req.params.id);
    const body = req.body as { newBedId?: string; motif?: string; notes?: string };
    if (!body.newBedId) { res.status(400).json({ error: "newBedId requis" }); return; }
    const motif = typeof body.motif === "string" ? body.motif.trim() : "";
    if (!motif) { res.status(400).json({ error: "Le motif du transfert est obligatoire" }); return; }
    const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : undefined;

    const updated = await admissionService.transferBed(id, { newBedId: body.newBedId, motif, notes }, actor(req));
    res.json(mapAdmission(updated));
  } catch (err: any) {
    const msg: string = err?.message ?? "";
    if (msg.includes("introuvable"))     { res.status(404).json({ error: msg }); return; }
    if (msg.includes("déjà ce lit"))     { res.status(400).json({ error: msg }); return; }
    if (msg.includes("n'est pas active") || msg.includes("non disponible") || msg.includes("non affecté")) {
      res.status(409).json({ error: msg }); return;
    }
    next(err);
  }
});

/** POST /admissions/:id/cancel (requires admissions.cancel) */
router.post("/:id/cancel", requirePermission("admissions.cancel"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    // Transaction complète : statut + libération du lit + clôture encounter + audit
    const cancelled = await admissionService.cancel(id, actor(req));
    res.json(mapAdmission(cancelled));
  } catch (err: any) {
    const msg: string = err?.message ?? "";
    if (msg.includes("introuvable")) { res.status(404).json({ error: msg }); return; }
    if (msg.includes("déjà"))        { res.status(409).json({ error: msg }); return; }
    next(err);
  }
});

/* ─── Fiche consommable du séjour ─────────────────────────────────────────────
 * Étape 1 : saisie libre (désignation texte), SANS liaison Stock Médical /
 * Pharmacie (étape 2 prévue). La ligne elle-même porte l'utilisateur
 * responsable et l'horodatage — c'est le registre demandé. */

function mapConsumable(c: typeof admissionConsumablesTable.$inferSelect) {
  return {
    id:             c.id,
    admissionId:    c.admissionId,
    itemType:       c.itemType,
    designation:    c.designation,
    quantity:       c.quantity,
    usedAt:         c.usedAt,
    note:           c.note,
    recordedBy:     c.recordedBy,
    recordedByName: c.recordedByName,
    createdAt:      c.createdAt,
  };
}

/** GET /admissions/:id/consumables (requires admissions.view) */
router.get("/:id/consumables", requirePermission("admissions.view"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    if (!UUID_RE.test(id)) { res.status(400).json({ error: "Identifiant d'admission invalide" }); return; }
    const [adm] = await db.select({ id: admissionsTable.id }).from(admissionsTable).where(eq(admissionsTable.id, id)).limit(1);
    if (!adm) { res.status(404).json({ error: "Admission introuvable" }); return; }
    const rows = await db.select().from(admissionConsumablesTable)
      .where(eq(admissionConsumablesTable.admissionId, id))
      .orderBy(desc(admissionConsumablesTable.usedAt), desc(admissionConsumablesTable.createdAt));
    res.json(rows.map(mapConsumable));
  } catch (err) { next(err); }
});

/** POST /admissions/:id/consumables (requires admissions.edit)
 *  Enregistre un médicament / consommable utilisé pour ce séjour. */
router.post("/:id/consumables", requirePermission("admissions.edit"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    if (!UUID_RE.test(id)) { res.status(400).json({ error: "Identifiant d'admission invalide" }); return; }

    const body = (req.body ?? {}) as {
      designation?: unknown; itemType?: unknown; quantity?: unknown; usedAt?: unknown; note?: unknown;
    };

    const designation = typeof body.designation === "string" ? body.designation.trim() : "";
    if (!designation) { res.status(400).json({ error: "designation requise" }); return; }
    if (designation.length > 200) { res.status(400).json({ error: "designation trop longue (200 caractères max)" }); return; }

    const itemType = body.itemType === undefined ? "consommable" : body.itemType;
    if (itemType !== "medicament" && itemType !== "consommable") {
      res.status(400).json({ error: "itemType invalide — valeurs autorisées : medicament, consommable" });
      return;
    }

    const quantity = body.quantity;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
      res.status(400).json({ error: "quantity invalide (entier entre 1 et 9999)" });
      return;
    }

    let usedAt = new Date();
    if (body.usedAt !== undefined) {
      if (typeof body.usedAt !== "string" || Number.isNaN(new Date(body.usedAt).getTime())) {
        res.status(400).json({ error: "usedAt invalide (date/heure ISO attendue)" });
        return;
      }
      usedAt = new Date(body.usedAt);
      if (usedAt.getTime() > Date.now() + 5 * 60 * 1000) {
        res.status(400).json({ error: "usedAt est dans le futur" });
        return;
      }
    }

    const rawNote = typeof body.note === "string" ? body.note.trim() : "";
    if (rawNote.length > 1000) { res.status(400).json({ error: "note trop longue (1000 caractères max)" }); return; }
    const note = rawNote || null;

    const [adm] = await db.select().from(admissionsTable).where(eq(admissionsTable.id, id)).limit(1);
    if (!adm) { res.status(404).json({ error: "Admission introuvable" }); return; }
    if (adm.status === "cancelled") {
      res.status(409).json({ error: "Admission annulée — enregistrement impossible" });
      return;
    }
    if (adm.status === "preadmission") {
      res.status(409).json({ error: "Patient non encore admis (préadmission) — confirmez l'admission d'abord" });
      return;
    }

    const act = actor(req);
    const [row] = await db.insert(admissionConsumablesTable).values({
      admissionId:    adm.id,
      patientId:      adm.patientId,
      encounterId:    adm.encounterId ?? null,
      itemType,
      designation,
      quantity,
      usedAt,
      note,
      recordedBy:     UUID_RE.test(act.userId) ? act.userId : null,
      recordedByName: act.userName,
    }).returning();

    res.status(201).json(mapConsumable(row));
  } catch (err) { next(err); }
});

/** POST /admissions/:id/confirm (requires admissions.create)
 *  Confirmation d'une préadmission (entrée réelle du patient) — transaction
 *  atomique côté service : lit réservé → occupé, encounter clinique ouvert,
 *  statut → active, conversion journalisée. */
router.post("/:id/confirm", requirePermission("admissions.create"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const confirmed = await admissionService.confirmPreadmission(id, actor(req));
    res.json(mapAdmission(confirmed));
  } catch (err: any) {
    const msg: string = err?.message ?? "";
    if (msg.includes("introuvable")) { res.status(404).json({ error: msg }); return; }
    if (msg.includes("n'est pas une préadmission") || msg.includes("annulée") ||
        msg.includes("plus disponible") || msg.includes("Aucun lit")) {
      res.status(409).json({ error: msg }); return;
    }
    next(err);
  }
});

/** POST /admissions/:id/discharge (requires admissions.discharge)
 *  Body: { dischargeType (obligatoire), dischargeNotes?, dischargeDate? (AAAA-MM-JJ), dischargeTime? (HH:MM) }
 *  Sortie ADT atomique : admission clôturée + lit → nettoyage + encounter fermé + journalisation. */
const DISCHARGE_TYPES = ["domicile", "transfert_interne", "transfert_externe", "deces", "fugue", "contre_avis"];

router.post("/:id/discharge", requirePermission("admissions.discharge"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const body = req.body as {
      dischargeType?:  string;
      dischargeNotes?: string;
      dischargeDate?:  string;
      dischargeTime?:  string;
    };

    if (!body.dischargeType || !DISCHARGE_TYPES.includes(body.dischargeType)) {
      res.status(400).json({ error: `Type de sortie invalide — attendu : ${DISCHARGE_TYPES.join(", ")}` });
      return;
    }
    const dischargeDate = typeof body.dischargeDate === "string" && body.dischargeDate.trim() ? body.dischargeDate.trim() : undefined;
    const dischargeTime = typeof body.dischargeTime === "string" && body.dischargeTime.trim() ? body.dischargeTime.trim() : undefined;
    if (dischargeDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(dischargeDate)) {
      res.status(400).json({ error: "Date de sortie invalide (format AAAA-MM-JJ)" });
      return;
    }
    if (dischargeTime !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(dischargeTime)) {
      res.status(400).json({ error: "Heure de sortie invalide (format HH:MM)" });
      return;
    }

    const admission = await admissionService.discharge(id, {
      dischargeType:  body.dischargeType,
      dischargeNotes: typeof body.dischargeNotes === "string" && body.dischargeNotes.trim() ? body.dischargeNotes.trim() : undefined,
      dischargeDate,
      dischargeTime,
    }, actor(req));

    res.json(mapAdmission(admission));
  } catch (err: any) {
    const msg: string = err?.message ?? "";
    if (msg.includes("introuvable")) { res.status(404).json({ error: msg }); return; }
    if (msg.includes("invalide"))    { res.status(400).json({ error: msg }); return; }
    if (msg.includes("déjà sorti") || msg.includes("annulée") || msg.includes("pas active")) {
      res.status(409).json({ error: msg }); return;
    }
    next(err);
  }
});

export default router;
