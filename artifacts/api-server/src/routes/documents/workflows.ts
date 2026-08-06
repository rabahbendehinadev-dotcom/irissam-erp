import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middleware/requirePermission";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";

const router = Router();

// GET /api/documents/workflows — list pending workflows for current user
router.get("/", requirePermission("documents.view"), async (req: AuthenticatedRequest, res) => {
  try {
    const siteId = req.auth?.siteId;
    const userId = req.auth?.userId;
    const role = req.auth?.role;

    const pqr = await pool.query(`
      SELECT w.*, dr.title AS document_title, dr.document_number, dr.category,
             u.first_name || ' ' || u.last_name AS initiated_by_name,
             (
               SELECT json_agg(json_build_object(
                 'id', s.id, 'step_number', s.step_number, 'step_name', s.step_name,
                 'status', s.status, 'assigned_role', s.assigned_role,
                 'assigned_user', s.assigned_user, 'due_date', s.due_date,
                 'comment', s.comment, 'decision_at', s.decision_at
               ) ORDER BY s.step_number)
               FROM document_workflow_steps s WHERE s.workflow_id = w.id
             ) AS steps
      FROM document_workflows w
      JOIN document_records dr ON dr.id = w.document_id
      LEFT JOIN users u ON u.id = w.initiated_by
      WHERE w.deleted_at IS NULL
        AND dr.deleted_at IS NULL
        ${siteId ? "AND (dr.site_id = $1 OR dr.site_id IS NULL)" : ""}
      ORDER BY w.created_at DESC
      LIMIT 100
    `, siteId ? [siteId] : []);

    res.json({ workflows: pqr.rows });
  } catch (err: any) {
    req.log?.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/documents/workflows — start workflow on a document
router.post("/", requirePermission("documents.manage_workflows"), async (req: AuthenticatedRequest, res) => {
  const { documentId, workflowType, approvalMode, steps, dueDate } = req.body;
  if (!documentId || !steps?.length) {
    return res.status(400).json({ error: "documentId et steps requis" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const wRes = await client.query(`
      INSERT INTO document_workflows
        (document_id, workflow_type, approval_mode, total_steps, status, initiated_by, due_date, site_id, created_by)
      VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $5)
      RETURNING *
    `, [documentId, workflowType || "approval", approvalMode || "sequential",
        steps.length, req.auth?.userId, dueDate || null, req.auth?.siteId]);

    const workflow = wRes.rows[0];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await client.query(`
        INSERT INTO document_workflow_steps
          (workflow_id, step_number, step_name, step_type, assigned_role, assigned_user, due_date, site_id, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [workflow.id, i + 1, step.stepName, step.stepType || "approval",
          step.assignedRole || null, step.assignedUser || null,
          step.dueDate || null, req.auth?.siteId, req.auth?.userId]);
    }

    // Set document status to under_review
    await client.query(
      "UPDATE document_records SET status = 'under_review', updated_at = now(), updated_by = $1 WHERE id = $2",
      [req.auth?.userId, documentId]
    );

    await client.query("COMMIT");

    // Notify first-step assignees
    const firstStep = steps[0];
    if (firstStep?.assignedUser) {
      await pool.query(`
        INSERT INTO document_notifications (document_id, recipient_id, notification_type, title, body, site_id, created_by)
        VALUES ($1, $2, 'pending_approval', 'Document en attente d''approbation',
                'Un document vous est soumis pour approbation', $3, $4)
      `, [documentId, firstStep.assignedUser, req.auth?.siteId, req.auth?.userId]);
    }

    res.status(201).json(workflow);
  } catch (err: any) {
    await client.query("ROLLBACK");
    req.log?.error(err);
    res.status(500).json({ error: "Erreur lors du démarrage du workflow" });
  } finally {
    client.release();
  }
});

// POST /api/documents/workflows/step/:stepId/decide — approve/reject a step
router.post("/step/:stepId/decide", requirePermission("documents.approve"), async (req: AuthenticatedRequest, res) => {
  const { action, comment } = req.body;
  if (!["approved", "rejected", "returned"].includes(action)) {
    return res.status(400).json({ error: "action doit être approved, rejected ou returned" });
  }
  if (action === "rejected" && !comment?.trim()) {
    return res.status(400).json({ error: "Un commentaire est requis pour un rejet" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const stepRes = await client.query(
      "SELECT * FROM document_workflow_steps WHERE id = $1",
      [req.params.stepId]
    );
    if (!stepRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Étape introuvable" });
    }

    const step = stepRes.rows[0];

    await client.query(`
      UPDATE document_workflow_steps
      SET status = $1, comment = $2, decision_at = now(), updated_at = now(), updated_by = $3
      WHERE id = $4
    `, [action, comment || null, req.auth?.userId, step.id]);

    // Record in approvals
    await client.query(`
      INSERT INTO document_approvals (document_id, step_id, approver_id, action, comment, decided_at, site_id, created_by)
      SELECT w.document_id, $1, $2, $3, $4, now(), w.site_id, $2
      FROM document_workflow_steps s
      JOIN document_workflows w ON w.id = s.workflow_id
      WHERE s.id = $1
    `, [step.id, req.auth?.userId, action, comment || null]);

    // Update workflow & document status
    const workflowRes = await client.query(
      "SELECT * FROM document_workflows WHERE id = $1",
      [step.workflow_id]
    );
    const workflow = workflowRes.rows[0];

    let newDocStatus = "under_review";
    if (action === "rejected") {
      newDocStatus = "rejected";
      await client.query(
        "UPDATE document_workflows SET status = 'rejected', updated_at = now(), updated_by = $1 WHERE id = $2",
        [req.auth?.userId, step.workflow_id]
      );
    } else if (action === "approved") {
      if (step.step_number >= workflow.total_steps) {
        // All steps done
        newDocStatus = "approved";
        await client.query(`
          UPDATE document_workflows
          SET status = 'approved', completed_at = now(), updated_at = now(), updated_by = $1
          WHERE id = $2
        `, [req.auth?.userId, step.workflow_id]);
      } else {
        // Advance to next step
        await client.query(`
          UPDATE document_workflows SET current_step = $1, updated_at = now(), updated_by = $2 WHERE id = $3
        `, [step.step_number + 1, req.auth?.userId, step.workflow_id]);
        await client.query(`
          UPDATE document_workflow_steps SET status = 'in_progress', updated_at = now()
          WHERE workflow_id = $1 AND step_number = $2
        `, [step.workflow_id, step.step_number + 1]);
      }
    }

    await client.query(
      "UPDATE document_records SET status = $1, updated_at = now(), updated_by = $2 WHERE id = $3",
      [newDocStatus, req.auth?.userId, workflow.document_id]
    );

    await client.query("COMMIT");
    res.json({ success: true, newStatus: newDocStatus });
  } catch (err: any) {
    await client.query("ROLLBACK");
    req.log?.error(err);
    res.status(500).json({ error: "Erreur lors de la décision" });
  } finally {
    client.release();
  }
});

export default router;
