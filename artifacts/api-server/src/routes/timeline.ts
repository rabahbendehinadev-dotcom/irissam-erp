/**
 * /encounters/:encounterId/timeline
 *
 * Aggregates all clinical events for an encounter:
 *   - The encounter itself (opened/closed events)
 *   - Lab orders + results
 *   - Imaging orders + reports
 *   - Prescriptions + dispenses
 *   - Audit log entries for the encounter
 *
 * Returns events sorted chronologically (oldest first).
 */
import { Router } from "express";
import { repos } from "../repositories";
import { encounterService } from "../services/encounter";

const router = Router({ mergeParams: true });

interface TimelineEvent {
  id:          string;
  type:        string;   // encounter_opened | lab_order | lab_result | imaging_order | imaging_report | prescription | dispense | encounter_closed
  timestamp:   string;
  summary:     string;
  detail?:     string;
  actor?:      string;
  isCritical?: boolean;
  status?:     string;
  sourceId:    string;   // ID of the source record
}

/** GET /encounters/:encounterId/timeline */
router.get("/", async (req, res, next) => {
  try {
    const { encounterId } = req.params as { encounterId: string };

    const encounter = await encounterService.findById(encounterId);
    if (!encounter) {
      res.status(404).json({ error: "Encounter introuvable" });
      return;
    }

    const [labResult, imagingResult, rxResult, auditResult] = await Promise.all([
      repos.labOrder.list({ encounterId, limit: 500 }),
      repos.imagingOrder.list({ encounterId, limit: 500 }),
      repos.prescription.list({ encounterId, limit: 500 }),
      repos.auditLog.list({ encounterId, limit: 500 }),
    ]);

    const events: TimelineEvent[] = [];

    // 1. Encounter opened
    events.push({
      id:        `enc-open-${encounter.id}`,
      type:      "encounter_opened",
      timestamp: encounter.openedAt?.toISOString() ?? encounter.updatedAt.toISOString(),
      summary:   `Dossier ouvert — ${encounter.chiefComplaint ?? "Motif non précisé"}`,
      actor:     encounter.primaryDoctorName ?? undefined,
      sourceId:  encounter.id,
    });

    // 2. Lab orders
    for (const lo of labResult.data) {
      events.push({
        id:        `lab-order-${lo.id}`,
        type:      "lab_order",
        timestamp: lo.requestedAt?.toISOString() ?? lo.updatedAt.toISOString(),
        summary:   `Analyse demandée — ${lo.test}`,
        actor:     lo.requestedByName,
        status:    lo.status,
        sourceId:  lo.id,
      });
      if (lo.result) {
        events.push({
          id:         `lab-result-${lo.id}`,
          type:       "lab_result",
          timestamp:  lo.resultAt?.toISOString() ?? lo.updatedAt.toISOString(),
          summary:    `Résultat ${lo.test}${lo.isCritical ? " ⚠ CRITIQUE" : ""}`,
          detail:     lo.result,
          isCritical: lo.isCritical ?? false,
          actor:      lo.validatedByName ?? undefined,
          status:     lo.status,
          sourceId:   lo.id,
        });
      }
    }

    // 3. Imaging orders
    for (const io of imagingResult.data) {
      events.push({
        id:        `img-order-${io.id}`,
        type:      "imaging_order",
        timestamp: io.requestedAt?.toISOString() ?? io.updatedAt.toISOString(),
        summary:   `Imagerie demandée — ${io.exam} (${io.region})`,
        actor:     io.requestedByName,
        status:    io.status,
        sourceId:  io.id,
      });
      if (io.report) {
        events.push({
          id:        `img-report-${io.id}`,
          type:      "imaging_report",
          timestamp: io.interpretedAt?.toISOString() ?? io.updatedAt.toISOString(),
          summary:   `Compte-rendu — ${io.exam}`,
          detail:    io.report,
          actor:     io.interpretedByName ?? undefined,
          status:    io.status,
          sourceId:  io.id,
        });
      }
    }

    // 4. Prescriptions
    for (const rx of rxResult.data) {
      events.push({
        id:        `rx-${rx.id}`,
        type:      "prescription",
        timestamp: rx.prescribedAt?.toISOString() ?? rx.updatedAt.toISOString(),
        summary:   `Prescription — ${rx.drug} ${rx.dosage} ${rx.route}`,
        actor:     rx.prescribedByName,
        status:    rx.status,
        sourceId:  rx.id,
      });
      if (rx.dispensedAt) {
        events.push({
          id:        `dispense-${rx.id}`,
          type:      "dispense",
          timestamp: rx.dispensedAt.toISOString(),
          summary:   `Délivré — ${rx.drug}`,
          actor:     rx.dispensedByName ?? undefined,
          status:    "delivre",
          sourceId:  rx.id,
        });
      }
    }

    // 5. Audit events (clinical category only)
    for (const ae of auditResult.data) {
      if (["created","status_changed","result_validated","critical_result","report_validated","dispensed"].includes(ae.action)) {
        continue; // already represented by the above
      }
      events.push({
        id:        `audit-${ae.id}`,
        type:      "audit",
        timestamp: ae.timestamp?.toISOString() ?? new Date().toISOString(),
        summary:   `${ae.action} — ${ae.resourceType ?? ae.module}`,
        actor:     ae.userName,
        sourceId:  ae.id,
      });
    }

    // 6. Encounter closed (if applicable)
    if (encounter.closedAt) {
      events.push({
        id:        `enc-close-${encounter.id}`,
        type:      "encounter_closed",
        timestamp: encounter.closedAt.toISOString(),
        summary:   `Dossier clôturé — ${encounter.closeReason ?? ""}`,
        sourceId:  encounter.id,
      });
    }

    // Sort chronologically
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    res.json({
      encounterId,
      encounterNumber: encounter.encounterNumber,
      total: events.length,
      events,
    });
  } catch (err) { next(err); }
});

export default router;
