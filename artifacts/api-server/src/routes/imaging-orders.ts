/**
 * /imaging-orders routes — backed by ClinicalOrderService + ImagingOrderRepository.
 *
 * GET  /imaging-orders                   — list
 * GET  /imaging-orders/:id               — single
 * POST /imaging-orders                   — create
 * PATCH /imaging-orders/:id/status       — update status
 * POST /imaging-orders/:id/report        — validate report (sets interpretee)
 */
import { Router } from "express";
import { clinicalOrderService, ClinicalValidationError } from "../services/clinicalOrder";
import { repos } from "../repositories";
import { safeUuid } from "../repositories/types";
import { auditService } from "../services/audit";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import type { ActorCtx } from "../repositories/types";
import type { DbImagingOrder } from "../repositories/imagingOrder";

const router = Router();

function actor(req: AuthenticatedRequest): ActorCtx {
  return {
    userId:   req.auth?.userId ?? "system",
    userName: req.auth?.userId ?? "system",
    userRole: req.auth?.role   ?? "guest",
  };
}

function mapImagingOrder(o: DbImagingOrder) {
  return {
    id:                o.id,
    encounterId:       o.encounterId ?? null,
    patientId:         o.patientId,
    patientName:       o.patientName,
    visitId:           o.visitId ?? null,
    exam:              o.exam,
    region:            o.region,
    side:              o.side ?? null,
    urgency:           o.urgency,
    withContrast:      o.withContrast ?? false,
    requestedById:     o.requestedById ?? null,
    requestedByName:   o.requestedByName,
    requestedAt:       o.requestedAt?.toISOString() ?? null,
    status:            o.status,
    result:            o.result ?? null,
    resultAt:          o.resultAt?.toISOString() ?? null,
    report:            o.report ?? null,
    reportedById:      o.reportedById ?? null,
    reportedByName:    o.reportedByName ?? null,
    reportedAt:        o.reportedAt?.toISOString() ?? null,
    interpretedById:   o.interpretedById ?? null,
    interpretedByName: o.interpretedByName ?? null,
    interpretedAt:     o.interpretedAt?.toISOString() ?? null,
    sourceModule:      o.sourceModule,
    updatedAt:         o.updatedAt.toISOString(),
  };
}

/** GET /imaging-orders */
router.get("/", async (req, res, next) => {
  try {
    const { patientId, encounterId, status, limit, offset } = req.query as Record<string, string>;
    const result = await repos.imagingOrder.list({
      patientId,
      encounterId,
      status,
      limit:  limit  ? parseInt(limit,  10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    res.json(result.data.map(mapImagingOrder));
  } catch (err) { next(err); }
});

/** GET /imaging-orders/:id */
router.get("/:id", async (req, res, next) => {
  try {
    const row = await repos.imagingOrder.findById(String(req.params.id));
    if (!row) { res.status(404).json({ error: "Imaging order not found" }); return; }
    res.json(mapImagingOrder(row));
  } catch (err) { next(err); }
});

/** POST /imaging-orders */
router.post("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = req.body as {
      patientId?:      string;
      encounterId?:    string;
      patientName?:    string;
      visitId?:        string;
      exam?:           string;
      region?:         string;
      side?:           string;
      urgency?:        string;
      withContrast?:   boolean;
      requestedByName?:string;
      sourceModule?:   string;
    };
    if (!body.patientId)   { res.status(400).json({ error: "patientId requis" }); return; }
    if (!body.encounterId) { res.status(400).json({ error: "encounterId requis — aucun ordre sans encounter réel" }); return; }
    if (!body.exam?.trim()){ res.status(400).json({ error: "exam requis" }); return; }
    if (!body.region?.trim()){ res.status(400).json({ error: "region requis" }); return; }

    const a = actor(req);
    const order = await clinicalOrderService.createImagingOrder({
      patientId:       body.patientId,
      encounterId:     body.encounterId,
      patientName:     body.patientName ?? "",
      visitId:         body.visitId ?? null,
      exam:            body.exam.trim(),
      region:          body.region.trim(),
      side:            body.side ?? null,
      urgency:         (body.urgency as any) ?? "routine",
      withContrast:    body.withContrast ?? false,
      requestedById:   safeUuid(a.userId) ?? null,
      requestedByName: body.requestedByName ?? a.userName,
      sourceModule:    (body.sourceModule as any) ?? "urgences",
      status:          "demandee",
    }, a);

    res.status(201).json(mapImagingOrder(order));
  } catch (err) {
    if (err instanceof ClinicalValidationError) {
      res.status(400).json({ error: err.message }); return;
    }
    next(err);
  }
});

/** PATCH /imaging-orders/:id/status */
router.patch("/:id/status", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id       = String(req.params.id);
    const { status } = req.body as { status?: string };
    if (!status) { res.status(400).json({ error: "status requis" }); return; }
    const a = actor(req);
    const order = await repos.imagingOrder.update(id, {
      status: status as any,
      updatedAt: new Date(),
    }, { ...a });
    if (!order) { res.status(404).json({ error: "Imaging order introuvable" }); return; }
    await auditService.log({
      module: "imagerie", action: "status_changed",
      resourceType: "imaging_order", resourceId: id,
      newValue: { status },
      patientId: order.patientId ?? undefined,
      encounterId: order.encounterId ?? undefined,
    }, a);
    res.json(mapImagingOrder(order));
  } catch (err) { next(err); }
});

/** POST /imaging-orders/:id/report — validate imaging report */
router.post("/:id/report", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id   = String(req.params.id);
    const body = req.body as {
      report?:             string;
      interpretedByName?:  string;
    };
    if (!body.report?.trim()) { res.status(400).json({ error: "report requis" }); return; }

    const a   = actor(req);
    const now = new Date();
    const order = await repos.imagingOrder.update(id, {
      report:            body.report.trim(),
      interpretedById:   safeUuid(a.userId) ?? null,
      interpretedByName: body.interpretedByName ?? a.userName,
      interpretedAt:     now,
      reportedById:      safeUuid(a.userId) ?? null,
      reportedByName:    body.interpretedByName ?? a.userName,
      reportedAt:        now,
      status:            "interpretee" as any,
    }, { ...a });

    if (!order) { res.status(404).json({ error: "Imaging order introuvable" }); return; }

    await auditService.log({
      module:       "imagerie",
      action:       "report_validated",
      resourceType: "imaging_order",
      resourceId:   id,
      newValue:     { report: body.report },
      patientId:    order.patientId ?? undefined,
      encounterId:  order.encounterId ?? undefined,
    }, a);

    res.json(mapImagingOrder(order));
  } catch (err) { next(err); }
});

export default router;
