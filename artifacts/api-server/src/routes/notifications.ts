/**
 * /notifications routes + SSE stream.
 *
 * GET    /notifications               — list (filtered by role/siteId)
 * PATCH  /notifications/:id/read      — mark one as read
 * PATCH  /notifications/read-all      — mark all as read
 * GET    /notifications/stream        — SSE realtime stream
 * POST   /notifications               — create (internal use + tests)
 *
 * SSE events are broadcast via the module-level `broadcast()` helper
 * which is imported by other route files (icu, surgical-requests, etc.).
 */
import { Router, type Response } from "express";
import { NotificationRepository } from "../repositories/notification";
import { safeUuid } from "../repositories/types";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import type { DbNotification } from "../repositories/notification";

const router = Router();
const notifRepo = new NotificationRepository();

// ── SSE client registry ────────────────────────────────────────────────────────

/** Connected SSE clients, keyed by siteId (or "global" for all sites). */
const sseClients = new Map<string, Set<Response>>();

/** Register a connected SSE client. */
function addSseClient(key: string, res: Response): void {
  if (!sseClients.has(key)) sseClients.set(key, new Set());
  sseClients.get(key)!.add(res);
}

/** Remove a disconnected SSE client. */
function removeSseClient(key: string, res: Response): void {
  sseClients.get(key)?.delete(res);
}

/** Broadcast an SSE event to all connected clients (or those matching siteId). */
export function broadcast(siteId: string | null, eventName: string, data: object): void {
  const msg = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  const targets: Response[] = [];

  if (siteId) {
    sseClients.get(siteId)?.forEach(r => targets.push(r));
  }
  // Always broadcast to "global" subscribers (e.g. admin dashboards)
  sseClients.get("global")?.forEach(r => targets.push(r));

  for (const client of targets) {
    try { client.write(msg); } catch { /* skip disconnected clients */ }
  }
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapNotification(n: DbNotification) {
  return {
    id:           n.id,
    type:         n.type,
    title:        n.title,
    message:      n.message,
    forRoles:     n.forRoles ?? [],
    priority:     n.priority,
    sourceModule: n.sourceModule,
    entityId:     n.entityId ?? null,
    entityType:   n.entityType ?? null,
    siteId:       n.siteId ?? null,
    readBy:       n.readBy ?? [],
    isDismissed:  n.isDismissed,
    createdAt:    n.createdAt.toISOString(),
  };
}

// ── SSE stream endpoint ────────────────────────────────────────────────────────

/**
 * GET /notifications/stream
 * Server-Sent Events stream. Clients auto-reconnect on disconnect.
 * Must be registered BEFORE /:id routes to avoid route conflict.
 */
router.get("/stream", (req: AuthenticatedRequest, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Send heartbeat every 25 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeat); }
  }, 25000);

  const key = "global"; // TODO: use req.auth?.siteId when available
  addSseClient(key, res);

  // Send initial connection confirmation
  res.write(`event: connected\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeSseClient(key, res);
  });
});

// ── REST endpoints ─────────────────────────────────────────────────────────────

/** GET /notifications */
router.get("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    const { siteId, limit, offset } = req.query as Record<string, string>;
    const result = await notifRepo.list({
      siteId,
      limit:  limit  ? parseInt(limit,  10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    res.json(result.data.map(mapNotification));
  } catch (err) { next(err); }
});

/** PATCH /notifications/read-all — must be before /:id to avoid conflict */
router.patch("/read-all", async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.auth?.userId ?? "";
    const count  = await notifRepo.markAllRead(userId);
    res.json({ marked: count });
  } catch (err) { next(err); }
});

/** PATCH /notifications/:id/read */
router.patch("/:id/read", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id     = String(req.params.id);
    const userId = req.auth?.userId ?? "";
    const updated = await notifRepo.markRead(id, userId);
    if (!updated) { res.status(404).json({ error: "Notification introuvable" }); return; }
    res.json(mapNotification(updated));
  } catch (err) { next(err); }
});

/**
 * POST /notifications — create a notification and broadcast via SSE.
 * Used internally by other services and for testing.
 */
router.post("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = req.body as {
      type?:         string;
      title?:        string;
      message?:      string;
      forRoles?:     string[];
      priority?:     string;
      sourceModule?: string;
      entityId?:     string;
      entityType?:   string;
      siteId?:       string;
    };
    if (!body.type?.trim())          { res.status(400).json({ error: "type requis" }); return; }
    if (!body.title?.trim())         { res.status(400).json({ error: "title requis" }); return; }
    if (!body.message?.trim())       { res.status(400).json({ error: "message requis" }); return; }
    if (!body.sourceModule?.trim())  { res.status(400).json({ error: "sourceModule requis" }); return; }

    const notification = await notifRepo.create({
      type:         body.type,
      title:        body.title,
      message:      body.message,
      forRoles:     body.forRoles ?? [],
      priority:     (body.priority as any) ?? "normal",
      sourceModule: (body.sourceModule as any) ?? "system",
      entityId:     body.entityId ?? null,
      entityType:   body.entityType ?? null,
      siteId:       body.siteId ?? null,
      readBy:       [],
      isDismissed:  false,
    });

    // Broadcast to connected SSE clients
    broadcast(body.siteId ?? null, body.type, mapNotification(notification));

    res.status(201).json(mapNotification(notification));
  } catch (err) { next(err); }
});

export default router;
