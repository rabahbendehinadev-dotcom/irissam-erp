/**
 * /surgical-requests routes + /operating-rooms
 *
 * GET  /operating-rooms                       — list all ORs
 * GET  /surgical-requests                     — list
 * GET  /surgical-requests/:id                 — single
 * POST /surgical-requests                     — create
 * POST /surgical-requests/:id/schedule        — assign OR + time (conflict check)
 * POST /surgical-requests/:id/start           — OR status → en_intervention
 * POST /surgical-requests/:id/complete        — OR status → nettoyage
 * POST /surgical-requests/:id/cancel          — cancel
 *
 * surgical_status: demande | planifie | en_cours | termine | annule
 * or_status:       libre | reserve | en_preparation | en_intervention | nettoyage | hors_service | maintenance
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { SurgicalRequestRepository } from "../repositories/surgicalRequest";
import { safeUuid } from "../repositories/types";
import { auditService } from "../services/audit";
import { encounterService } from "../services/encounter";
import { broadcast } from "./notifications";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import type { ActorCtx, TxContext } from "../repositories/types";
import type { DbSurgicalRequest, DbOperatingRoom } from "../repositories/surgicalRequest";

const router = Router();
const surgRepo = new SurgicalRequestRepository();

function actor(req: AuthenticatedRequest): ActorCtx {
  return {
    userId:   req.auth?.userId ?? "system",
    userName: req.auth?.userId ?? "system",
    userRole: req.auth?.role   ?? "guest",
  };
}

function mapOR(r: DbOperatingRoom) {
  return {
    id:                       r.id,
    name:                     r.name,
    shortName:                r.shortName,
    specialty:                r.specialty ?? null,
    status:                   r.status,
    currentSurgicalRequestId: r.currentSurgicalRequestId ?? null,
    floorLabel:               r.floorLabel ?? null,
    updatedAt:                r.updatedAt.toISOString(),
  };
}

function mapRequest(r: DbSurgicalRequest) {
  return {
    id:              r.id,
    encounterId:     r.encounterId ?? null,
    patientId:       r.patientId,
    patientName:     r.patientName,
    intervention:    r.intervention,
    surgeonId:       r.surgeonId ?? null,
    surgeonName:     r.surgeonName ?? null,
    anesthesistId:   r.anesthesistId ?? null,
    anesthesistName: r.anesthesistName ?? null,
    urgencyDegree:   r.urgencyDegree,
    preOpPrep:       r.preOpPrep ?? null,
    consentSigned:   r.consentSigned,
    status:          r.status,
    requestedById:   r.requestedById ?? null,
    requestedByName: r.requestedByName ?? null,
    orRoomId:        r.orRoomId ?? null,
    scheduledAt:     r.scheduledAt?.toISOString() ?? null,
    createdAt:       r.createdAt.toISOString(),
    updatedAt:       r.updatedAt.toISOString(),
  };
}

/** GET /operating-rooms */
router.get("/operating-rooms", async (_req, res, next) => {
  try {
    const rooms = await surgRepo.listRooms();
    res.json(rooms.map(mapOR));
  } catch (err) { next(err); }
});

/** GET /surgical-requests */
router.get("/", async (req, res, next) => {
  try {
    const { patientId, encounterId, status, orRoomId } = req.query as Record<string, string>;
    const result = await surgRepo.list({ patientId, encounterId, status, orRoomId, limit: 200 });
    res.json(result.data.map(mapRequest));
  } catch (err) { next(err); }
});

/** GET /surgical-requests/:id */
router.get("/:id", async (req, res, next) => {
  try {
    const row = await surgRepo.findById(String(req.params.id));
    if (!row) { res.status(404).json({ error: "Demande de bloc introuvable" }); return; }
    res.json(mapRequest(row));
  } catch (err) { next(err); }
});

/** POST /surgical-requests — create */
router.post("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = req.body as {
      patientId?:       string;
      encounterId?:     string;
      patientName?:     string;
      intervention?:    string;
      surgeonName?:     string;
      anesthesistName?: string;
      urgencyDegree?:   string;
      preOpPrep?:       string;
      consentSigned?:   boolean;
      requestedByName?: string;
    };
    if (!body.patientId)         { res.status(400).json({ error: "patientId requis" }); return; }
    if (!body.encounterId)       { res.status(400).json({ error: "encounterId requis" }); return; }
    if (!body.intervention?.trim()){ res.status(400).json({ error: "intervention requise" }); return; }

    const a = actor(req);

    const req_ = await db.transaction(async (tx) => {
      const ctx: TxContext = { ...a, tx };
      const request = await surgRepo.create({
        patientId:       body.patientId!,
        encounterId:     body.encounterId ?? null,
        patientName:     body.patientName ?? "",
        intervention:    body.intervention!.trim(),
        surgeonName:     body.surgeonName ?? null,
        anesthesistName: body.anesthesistName ?? null,
        urgencyDegree:   (body.urgencyDegree as any) ?? "elective",
        preOpPrep:       body.preOpPrep ?? null,
        consentSigned:   body.consentSigned ?? false,
        requestedById:   safeUuid(a.userId) ?? null,
        requestedByName: body.requestedByName ?? a.userName,
        status:          "demande",
      }, ctx);

      if (body.encounterId) {
        try {
          await encounterService.linkRecord(
            body.encounterId,
            { recordType: "surgical_request", recordId: request.id, summary: `Bloc — ${body.intervention}` },
            a, ctx,
          );
        } catch { /* non-blocking */ }
      }

      await auditService.log({
        module: "bloc", action: "created",
        resourceType: "surgical_request", resourceId: request.id,
        newValue: { intervention: body.intervention },
        patientId: body.patientId, encounterId: body.encounterId,
      }, a, ctx);

      return request;
    });

    broadcast(null, "surgical_request_created", { requestId: req_.id, patientName: body.patientName, intervention: body.intervention });
    res.status(201).json(mapRequest(req_));
  } catch (err) { next(err); }
});

/** POST /surgical-requests/:id/schedule — assign OR + time, check conflicts. */
router.post("/:id/schedule", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id   = String(req.params.id);
    const body = req.body as { orRoomId?: string; scheduledAt?: string };
    if (!body.orRoomId)    { res.status(400).json({ error: "orRoomId requis" }); return; }
    if (!body.scheduledAt) { res.status(400).json({ error: "scheduledAt requis" }); return; }

    const a = actor(req);
    const start = new Date(body.scheduledAt);
    const end   = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2h window

    // Conflict check
    const available = await surgRepo.isRoomAvailable(body.orRoomId, start, end, id);
    if (!available) {
      res.status(409).json({ error: "La salle opératoire est déjà réservée sur ce créneau" });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const ctx: TxContext = { ...a, tx };
      await surgRepo.updateRoomStatus(body.orRoomId!, "reserve", id, ctx);
      const updated = await surgRepo.update(id, {
        orRoomId:    body.orRoomId!,
        scheduledAt: start,
        status:      "planifie",
      }, ctx);
      if (!updated) throw new Error("Demande introuvable");
      await auditService.log({
        module: "bloc", action: "scheduled",
        resourceType: "surgical_request", resourceId: id,
        newValue: { orRoomId: body.orRoomId, scheduledAt: body.scheduledAt },
        patientId: updated.patientId, encounterId: updated.encounterId ?? undefined,
      }, a, ctx);
      return updated;
    });

    broadcast(null, "operating_room_ready", { requestId: id, orRoomId: body.orRoomId, scheduledAt: body.scheduledAt });
    res.json(mapRequest(result));
  } catch (err) { next(err); }
});

/** POST /surgical-requests/:id/start */
router.post("/:id/start", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const a  = actor(req);

    const result = await db.transaction(async (tx) => {
      const ctx: TxContext = { ...a, tx };
      const sr = await surgRepo.findById(id, ctx);
      if (!sr) throw Object.assign(new Error("Demande introuvable"), { status: 404 });
      if (sr.orRoomId) {
        await surgRepo.updateRoomStatus(sr.orRoomId, "en_intervention", id, ctx);
      }
      const updated = await surgRepo.updateStatus(id, "en_cours", ctx);
      await auditService.log({
        module: "bloc", action: "started",
        resourceType: "surgical_request", resourceId: id,
        newValue: { status: "en_cours" },
        patientId: sr.patientId, encounterId: sr.encounterId ?? undefined,
      }, a, ctx);
      return updated;
    });

    res.json(result ? mapRequest(result) : { error: "Démarrage échoué" });
  } catch (err: any) {
    if (err.status === 404) { res.status(404).json({ error: err.message }); return; }
    next(err);
  }
});

/** POST /surgical-requests/:id/complete */
router.post("/:id/complete", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const a  = actor(req);

    const result = await db.transaction(async (tx) => {
      const ctx: TxContext = { ...a, tx };
      const sr = await surgRepo.findById(id, ctx);
      if (!sr) throw Object.assign(new Error("Demande introuvable"), { status: 404 });
      if (sr.orRoomId) {
        await surgRepo.updateRoomStatus(sr.orRoomId, "nettoyage", null, ctx);
      }
      const updated = await surgRepo.updateStatus(id, "termine", ctx);
      await auditService.log({
        module: "bloc", action: "completed",
        resourceType: "surgical_request", resourceId: id,
        newValue: { status: "termine" },
        patientId: sr.patientId, encounterId: sr.encounterId ?? undefined,
      }, a, ctx);
      return updated;
    });

    res.json(result ? mapRequest(result) : { error: "Clôture échouée" });
  } catch (err: any) {
    if (err.status === 404) { res.status(404).json({ error: err.message }); return; }
    next(err);
  }
});

/** POST /surgical-requests/:id/cancel */
router.post("/:id/cancel", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const a  = actor(req);

    const result = await db.transaction(async (tx) => {
      const ctx: TxContext = { ...a, tx };
      const sr = await surgRepo.findById(id, ctx);
      if (!sr) throw Object.assign(new Error("Demande introuvable"), { status: 404 });
      if (sr.orRoomId) {
        await surgRepo.updateRoomStatus(sr.orRoomId, "libre", null, ctx);
      }
      const updated = await surgRepo.updateStatus(id, "annule", ctx);
      await auditService.log({
        module: "bloc", action: "cancelled",
        resourceType: "surgical_request", resourceId: id,
        newValue: { status: "annule" },
        patientId: sr.patientId, encounterId: sr.encounterId ?? undefined,
      }, a, ctx);
      return updated;
    });

    res.json(result ? mapRequest(result) : { error: "Annulation échouée" });
  } catch (err: any) {
    if (err.status === 404) { res.status(404).json({ error: err.message }); return; }
    next(err);
  }
});

export default router;
