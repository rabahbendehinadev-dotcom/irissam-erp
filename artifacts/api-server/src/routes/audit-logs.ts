/**
 * /audit-logs routes
 *
 * Security rules:
 *  - userId  is taken from the JWT session, NOT from the request body.
 *  - IP + User-Agent are extracted from the HTTP request.
 *  - The frontend may send action/module/patientId/encounterId/entityId/oldValue/newValue/metadata.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { auditLogsTable, userActivityLogsTable } from "@workspace/db";
import { desc, eq, and, gte, lte } from "drizzle-orm";
import { auditService } from "../services/audit";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import type { ActorCtx } from "../repositories/types";

const router = Router();

function actor(req: AuthenticatedRequest): ActorCtx {
  return {
    userId:   req.auth?.userId ?? "system",
    userName: req.auth?.userId ?? "system",
    userRole: req.auth?.role   ?? "guest",
  };
}

/** POST /audit-logs — receive an audit entry from the frontend */
router.post("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = req.body as {
      action:       string;
      module:       string;
      patientId?:   string;
      encounterId?: string;
      entityId?:    string;
      oldValue?:    unknown;
      newValue?:    unknown;
      metadata?:    Record<string, unknown>;
    };

    if (!body.action || !body.module) {
      res.status(400).json({ error: "action and module are required" });
      return;
    }

    const ip        = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
                      ?? req.socket.remoteAddress
                      ?? "unknown";
    const userAgent = req.headers["user-agent"] ?? "";
    const a = actor(req);

    // Normalise le module vers une valeur valide de l'enum source_module.
    // Le frontend envoie le nom de sa ressource (ex. "patient") ; une valeur
    // hors enum faisait échouer l'INSERT et l'événement était perdu
    // silencieusement alors que la route répondait quand même 201.
    const MODULE_ALIASES: Record<string, string> = {
      patient: "system", patients: "system", user: "system", users: "system",
      consultation: "consultations", urgence: "urgences", admission: "admissions",
      hospitalizations: "hospitalisation", laboratory: "laboratoire",
      imaging: "imagerie", pharmacy: "pharmacie",
    };
    const VALID_MODULES = new Set([
      "urgences", "consultations", "hospitalisation", "bloc", "reanimation",
      "pharmacie", "laboratoire", "imagerie", "admissions", "system",
    ]);
    let sourceModule = MODULE_ALIASES[body.module] ?? body.module;
    if (!VALID_MODULES.has(sourceModule)) {
      console.warn(`[audit-logs] module inconnu "${body.module}" — enregistré sous "system"`);
      sourceModule = "system";
    }

    // Log through the service (writes to DB audit_logs table)
    const written = await auditService.log({
      module:       sourceModule as any,
      action:       body.action,
      resourceType: "frontend_event",
      resourceId:   body.entityId ?? "unknown",
      oldValue:     body.oldValue as Record<string, unknown> | undefined,
      newValue:     (body.newValue ?? body.metadata) as Record<string, unknown> | undefined,
      patientId:    body.patientId,
      encounterId:  body.encounterId,
    }, a);

    if (!written) {
      // Échec explicite : ne jamais répondre 201 quand rien n'a été écrit.
      res.status(500).json({ error: "Failed to persist audit log" });
      return;
    }

    // Write user activity log only when the action is a valid enum value
    const VALID_UA_ACTIONS = new Set([
      "login","logout","session_expired","password_changed",
      "navigate","view","search","filter","print","export",
      "download","generate_pdf","access_denied","impersonate",
    ]);
    if (VALID_UA_ACTIONS.has(body.action)) {
      try {
        await db.insert(userActivityLogsTable).values({
          userName:  a.userName,
          userRole:  a.userRole,
          action:    body.action as any,
          module:    sourceModule as any,
          ip,
          userAgent: userAgent.slice(0, 500),
        });
      } catch (uaErr) {
        console.warn("[audit-logs] userActivity write skipped:", (uaErr as Error).message);
      }
    }

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("[audit-logs] POST failed:", err);
    res.status(500).json({ error: "Failed to persist audit log" });
  }
});

/** GET /audit-logs?patientId=&module=&action=&dateFrom=&dateTo=&limit= */
router.get("/", async (req, res, next) => {
  try {
    const { patientId, module: mod, action, dateFrom, dateTo, limit: limitStr } =
      req.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(limitStr ?? "100", 10) || 100, 500);

    // Build conditions using sql template for enum columns to avoid Drizzle type narrowing issues
    const conditions = [];
    if (patientId) conditions.push(eq(auditLogsTable.patientId, patientId));
    if (mod)       conditions.push(eq(auditLogsTable.module, mod as any));
    if (action)    conditions.push(eq(auditLogsTable.action, action));
    if (dateFrom)  conditions.push(gte(auditLogsTable.timestamp, new Date(dateFrom)));
    if (dateTo)    conditions.push(lte(auditLogsTable.timestamp, new Date(dateTo)));

    const rows = await db
      .select()
      .from(auditLogsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(auditLogsTable.timestamp))
      .limit(limit);

    res.json(rows.map((r) => ({
      id:           r.id,
      timestamp:    r.timestamp?.toISOString() ?? new Date().toISOString(),
      module:       r.module,
      action:       r.action,
      resourceType: r.resourceType,
      resourceId:   r.resourceId,
      patientId:    r.patientId,
      encounterId:  r.encounterId,
      userName:     r.userName,
      userRole:     r.userRole,
      oldValue:     r.oldValue,
      newValue:     r.newValue,
      ip:           r.ip,
      severity:     r.severity,
    })));
  } catch (err) {
    next(err);
  }
});

export default router;
