/**
 * Patient Portal Admin — Publish/Unpublish routes (staff-only).
 *
 * POST /patient-portal-admin/lab-orders/:id/publish
 * POST /patient-portal-admin/lab-orders/:id/unpublish
 * POST /patient-portal-admin/imaging/:id/publish
 * POST /patient-portal-admin/imaging/:id/unpublish
 * POST /patient-portal-admin/prescriptions/:id/publish
 * POST /patient-portal-admin/prescriptions/:id/unpublish
 * POST /patient-portal-admin/documents/:id/publish
 * POST /patient-portal-admin/documents/:id/unpublish
 */
import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission.js";
import type { AuthenticatedRequest } from "../../middleware/requireAuth.js";

const router = Router();

// Helper: send a notification to the patient when a result is published
async function notifyPatient(patientId: string, type: string, title: string, body: string) {
  try {
    // Find the portal account for this patient
    const { rows } = await pool.query(
      `SELECT id FROM patient_portal_accounts WHERE patient_id=$1 AND deleted_at IS NULL`,
      [patientId],
    );
    if (!rows[0]) return;
    await pool.query(
      `INSERT INTO patient_portal_notifications
         (account_id, type, title, body, is_read)
       VALUES ($1,$2,$3,$4,FALSE)`,
      [rows[0].id, type, title, body],
    );
  } catch (e) {
    console.error("[portal/notify]", e);
  }
}

// Helper: write to user_activity_logs
async function auditAction(req: AuthenticatedRequest, action: string, entityType: string, entityId: string, meta?: Record<string, unknown>) {
  try {
    await pool.query(
      `INSERT INTO user_activity_logs (user_id, action, entity_type, entity_id, metadata, ip_address, timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,now())`,
      [
        req.auth?.userId ?? null,
        action,
        entityType,
        entityId,
        meta ? JSON.stringify(meta) : null,
        req.ip ?? null,
      ],
    );
  } catch {}
}

// ─── LAB ORDERS ────────────────────────────────────────────────────────────────

router.post(
  "/lab-orders/:id/publish",
  requirePermission("patient_portal.results.publish"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id: rawId } = req.params;
    const id = String(rawId);
    const { note } = req.body as { note?: string };
    const userId = req.auth!.userId;

    try {
      const { rows } = await pool.query(
        `SELECT lo.id, lo.patient_id, lo.status, lo.test, lo.published_to_patient
         FROM lab_orders lo
         JOIN patients pt ON pt.id = lo.patient_id AND pt.deleted_at IS NULL
         WHERE lo.id=$1 AND lo.deleted_at IS NULL`,
        [id],
      );
      const order = rows[0];
      if (!order) { res.status(404).json({ message: "Ordre lab introuvable." }); return; }

      // Rule: must be validated (validee or critique)
      if (!["validee", "critique"].includes(order.status)) {
        res.status(422).json({
          message: `Impossible de publier un résultat non validé (statut actuel: ${order.status}).`,
        });
        return;
      }

      await pool.query(
        `UPDATE lab_orders
         SET published_to_patient=TRUE, published_at=now(), published_by=$1,
             patient_visible_note=$2, unpublished_at=NULL, unpublished_by=NULL
         WHERE id=$3`,
        [userId, note ?? null, id],
      );

      await auditAction(req, "publish_to_patient", "lab_order", id, { test: order.test, note });
      await notifyPatient(
        order.patient_id,
        "lab_result",
        "Résultat disponible",
        `Votre résultat d'analyse "${order.test}" est maintenant disponible sur votre portail patient.`,
      );

      res.json({ message: "Résultat publié sur le portail patient.", id });
    } catch (err) {
      console.error("[portal-admin/lab/publish]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

router.post(
  "/lab-orders/:id/unpublish",
  requirePermission("patient_portal.results.unpublish"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id: rawId } = req.params;
    const id = String(rawId);
    const { note } = req.body as { note?: string };
    const userId = req.auth!.userId;

    try {
      const { rows } = await pool.query(
        `SELECT id, published_to_patient FROM lab_orders WHERE id=$1 AND deleted_at IS NULL`,
        [id],
      );
      if (!rows[0]) { res.status(404).json({ message: "Ordre lab introuvable." }); return; }

      await pool.query(
        `UPDATE lab_orders
         SET published_to_patient=FALSE, unpublished_at=now(), unpublished_by=$1,
             publication_note=COALESCE($2, publication_note)
         WHERE id=$3`,
        [userId, note ?? null, id],
      );

      await auditAction(req, "unpublish_from_patient", "lab_order", id, { note });
      res.json({ message: "Résultat retiré du portail patient.", id });
    } catch (err) {
      console.error("[portal-admin/lab/unpublish]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ─── IMAGING ORDERS ────────────────────────────────────────────────────────────

router.post(
  "/imaging/:id/publish",
  requirePermission("patient_portal.results.publish"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id: rawId } = req.params;
    const id = String(rawId);
    const { note } = req.body as { note?: string };
    const userId = req.auth!.userId;

    try {
      const { rows } = await pool.query(
        `SELECT id, patient_id, status, study_type FROM imaging_orders WHERE id=$1 AND deleted_at IS NULL`,
        [id],
      );
      const order = rows[0];
      if (!order) { res.status(404).json({ message: "Imagerie introuvable." }); return; }

      if (order.status !== "interpretee") {
        res.status(422).json({
          message: `Impossible de publier une imagerie non interprétée (statut actuel: ${order.status}).`,
        });
        return;
      }

      await pool.query(
        `UPDATE imaging_orders
         SET published_to_patient=TRUE, published_at=now(), published_by=$1,
             patient_visible_note=$2, unpublished_at=NULL, unpublished_by=NULL
         WHERE id=$3`,
        [userId, note ?? null, id],
      );

      await auditAction(req, "publish_to_patient", "imaging_order", id, { studyType: order.study_type, note });
      await notifyPatient(
        order.patient_id,
        "imaging_result",
        "Compte-rendu d'imagerie disponible",
        `Votre compte-rendu d'imagerie est maintenant disponible sur votre portail patient.`,
      );

      res.json({ message: "Imagerie publiée sur le portail patient.", id });
    } catch (err) {
      console.error("[portal-admin/imaging/publish]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

router.post(
  "/imaging/:id/unpublish",
  requirePermission("patient_portal.results.unpublish"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id: rawId } = req.params;
    const id = String(rawId);
    const { note } = req.body as { note?: string };
    const userId = req.auth!.userId;

    try {
      const { rows } = await pool.query(
        `SELECT id FROM imaging_orders WHERE id=$1 AND deleted_at IS NULL`,
        [id],
      );
      if (!rows[0]) { res.status(404).json({ message: "Imagerie introuvable." }); return; }

      await pool.query(
        `UPDATE imaging_orders
         SET published_to_patient=FALSE, unpublished_at=now(), unpublished_by=$1,
             publication_note=COALESCE($2, publication_note)
         WHERE id=$3`,
        [userId, note ?? null, id],
      );

      await auditAction(req, "unpublish_from_patient", "imaging_order", id, { note });
      res.json({ message: "Imagerie retirée du portail patient.", id });
    } catch (err) {
      console.error("[portal-admin/imaging/unpublish]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ─── PRESCRIPTIONS ─────────────────────────────────────────────────────────────

router.post(
  "/prescriptions/:id/publish",
  requirePermission("patient_portal.prescriptions.publish"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id: rawId } = req.params;
    const id = String(rawId);
    const { note } = req.body as { note?: string };
    const userId = req.auth!.userId;

    try {
      const { rows } = await pool.query(
        `SELECT id, patient_id, status, drug FROM prescriptions WHERE id=$1 AND deleted_at IS NULL`,
        [id],
      );
      const rx = rows[0];
      if (!rx) { res.status(404).json({ message: "Ordonnance introuvable." }); return; }

      if (rx.status === "annule") {
        res.status(422).json({ message: "Impossible de publier une ordonnance annulée." });
        return;
      }

      await pool.query(
        `UPDATE prescriptions
         SET published_to_patient=TRUE, published_at=now(), published_by=$1,
             patient_visible_note=$2, unpublished_at=NULL, unpublished_by=NULL
         WHERE id=$3`,
        [userId, note ?? null, id],
      );

      await auditAction(req, "publish_to_patient", "prescription", id, { drug: rx.drug, note });
      await notifyPatient(
        rx.patient_id,
        "prescription",
        "Ordonnance disponible",
        `Votre ordonnance pour "${rx.drug}" est disponible sur votre portail patient.`,
      );

      res.json({ message: "Ordonnance publiée sur le portail patient.", id });
    } catch (err) {
      console.error("[portal-admin/prescriptions/publish]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

router.post(
  "/prescriptions/:id/unpublish",
  requirePermission("patient_portal.prescriptions.publish"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id: rawId } = req.params;
    const id = String(rawId);
    const { note } = req.body as { note?: string };
    const userId = req.auth!.userId;

    try {
      const { rows } = await pool.query(
        `SELECT id FROM prescriptions WHERE id=$1 AND deleted_at IS NULL`,
        [id],
      );
      if (!rows[0]) { res.status(404).json({ message: "Ordonnance introuvable." }); return; }

      await pool.query(
        `UPDATE prescriptions
         SET published_to_patient=FALSE, unpublished_at=now(), unpublished_by=$1,
             publication_note=COALESCE($2, publication_note)
         WHERE id=$3`,
        [userId, note ?? null, id],
      );

      await auditAction(req, "unpublish_from_patient", "prescription", id, { note });
      res.json({ message: "Ordonnance retirée du portail patient.", id });
    } catch (err) {
      console.error("[portal-admin/prescriptions/unpublish]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

// ─── DOCUMENTS ─────────────────────────────────────────────────────────────────

const BLOCKED_CONFIDENTIALITY = ["hr_confidential", "finance_confidential", "direction_only", "medical_confidential"];

router.post(
  "/documents/:id/publish",
  requirePermission("patient_portal.documents.publish"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id: rawId } = req.params;
    const id = String(rawId);
    const { note } = req.body as { note?: string };
    const userId = req.auth!.userId;

    try {
      const { rows } = await pool.query(
        `SELECT dr.id, dr.patient_id, dr.title, dr.confidentiality, dr.internal_only
         FROM document_records dr
         JOIN patients pt ON pt.id = dr.patient_id AND pt.deleted_at IS NULL
         WHERE dr.id=$1 AND dr.deleted_at IS NULL`,
        [id],
      );
      const doc = rows[0];
      if (!doc) { res.status(404).json({ message: "Document introuvable." }); return; }

      // Block confidential and internal documents
      if (BLOCKED_CONFIDENTIALITY.includes(doc.confidentiality) || doc.internal_only) {
        res.status(422).json({
          message: doc.internal_only
            ? "Ce document est marqué usage interne uniquement et ne peut pas être publié sur le portail patient."
            : `Ce document est classifié "${doc.confidentiality}" et ne peut pas être publié sur le portail patient.`,
        });
        return;
      }

      if (!doc.patient_id) {
        res.status(422).json({ message: "Ce document n'est pas associé à un patient." });
        return;
      }

      await pool.query(
        `UPDATE document_records
         SET published_to_patient=TRUE, published_at=now(), published_by=$1,
             publication_note=$2, unpublished_at=NULL, unpublished_by=NULL
         WHERE id=$3`,
        [userId, note ?? null, id],
      );

      await auditAction(req, "publish_to_patient", "document", id, { title: doc.title, note });
      await notifyPatient(
        doc.patient_id,
        "document",
        "Document disponible",
        `Le document "${doc.title}" est maintenant disponible sur votre portail patient.`,
      );

      res.json({ message: "Document publié sur le portail patient.", id });
    } catch (err) {
      console.error("[portal-admin/documents/publish]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

router.post(
  "/documents/:id/unpublish",
  requirePermission("patient_portal.documents.unpublish"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id: rawId } = req.params;
    const id = String(rawId);
    const { note } = req.body as { note?: string };
    const userId = req.auth!.userId;

    try {
      const { rows } = await pool.query(
        `SELECT id FROM document_records WHERE id=$1 AND deleted_at IS NULL`,
        [id],
      );
      if (!rows[0]) { res.status(404).json({ message: "Document introuvable." }); return; }

      await pool.query(
        `UPDATE document_records
         SET published_to_patient=FALSE, unpublished_at=now(), unpublished_by=$1,
             publication_note=COALESCE($2, publication_note)
         WHERE id=$3`,
        [userId, note ?? null, id],
      );

      await auditAction(req, "unpublish_from_patient", "document", id, { note });
      res.json({ message: "Document retiré du portail patient.", id });
    } catch (err) {
      console.error("[portal-admin/documents/unpublish]", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  },
);

export default router;
