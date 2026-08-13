/**
 * /consultation-favorites — favoris PERSONNELS du praticien : diagnostics,
 * médicaments (avec posologie par défaut) et traitements fréquents, pour
 * éviter la ressaisie en consultation. Recherche + épinglage + compteur
 * d'usage.
 *
 * Scope strictement personnel : chaque requête est filtrée par le user_id du
 * JWT — jamais de lecture/écriture cross-utilisateur. RBAC volontairement
 * léger (consultations.view) : les favoris n'exposent AUCUNE donnée patient.
 * Unicité (user_id, kind, lower(label)) garantie par index SQL (mig 048).
 */
import { Router, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { doctorFavoritesTable, medicationsTable } from "@workspace/db/schema";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import { requirePermission } from "../middleware/requirePermission";
import type { AuthenticatedRequest } from "../middleware/requireAuth";

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = ["diagnosis", "medication", "treatment"] as const;
type FavoriteKind = (typeof KINDS)[number];

function selfId(req: AuthenticatedRequest): string | null {
  const id = req.auth?.userId ?? "";
  return UUID_RE.test(id) ? id : null;
}

/** GET /consultation-favorites?kind=&q= — favoris de l'utilisateur connecté */
router.get("/", requirePermission("consultations.view"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = selfId(req);
    if (!userId) { res.status(401).json({ error: "Session invalide" }); return; }

    const { kind, q } = req.query as Record<string, string | undefined>;
    if (kind !== undefined && !(KINDS as readonly string[]).includes(kind)) {
      res.status(400).json({ error: `kind invalide — valeurs autorisées : ${KINDS.join(", ")}` });
      return;
    }

    const conditions = [eq(doctorFavoritesTable.userId, userId)];
    if (kind) conditions.push(eq(doctorFavoritesTable.kind, kind as FavoriteKind));
    if (q && q.trim()) conditions.push(ilike(doctorFavoritesTable.label, `%${q.trim()}%`));

    const rows = await db.select().from(doctorFavoritesTable)
      .where(and(...conditions))
      .orderBy(
        desc(doctorFavoritesTable.pinned),
        desc(doctorFavoritesTable.usageCount),
        asc(doctorFavoritesTable.label),
      )
      .limit(200);
    res.json(rows);
  } catch (err) { next(err); }
});

/** POST /consultation-favorites — ajout personnalisé */
router.post("/", requirePermission("consultations.view"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = selfId(req);
    if (!userId) { res.status(401).json({ error: "Session invalide" }); return; }

    const body = (req.body ?? {}) as {
      kind?: unknown; label?: unknown; medicationId?: unknown;
      dosage?: unknown; frequency?: unknown; duration?: unknown; instructions?: unknown;
      pinned?: unknown;
    };

    const kind = body.kind;
    if (typeof kind !== "string" || !(KINDS as readonly string[]).includes(kind)) {
      res.status(400).json({ error: `kind invalide — valeurs autorisées : ${KINDS.join(", ")}` });
      return;
    }
    const label = typeof body.label === "string" ? body.label.trim().replace(/\s+/g, " ") : "";
    if (label.length < 2 || label.length > 200) {
      res.status(400).json({ error: "label requis (2 à 200 caractères)" });
      return;
    }

    const textField = (v: unknown, name: string, max: number): string | null | { error: string } => {
      if (v === undefined || v === null) return null;
      if (typeof v !== "string") return { error: `${name} invalide (texte attendu)` };
      const t = v.trim();
      if (!t) return null;
      if (t.length > max) return { error: `${name} trop long (${max} caractères max)` };
      return t;
    };
    const dosage       = textField(body.dosage, "dosage", 200);
    const frequency    = textField(body.frequency, "frequency", 200);
    const duration     = textField(body.duration, "duration", 200);
    const instructions = textField(body.instructions, "instructions", 500);
    for (const f of [dosage, frequency, duration, instructions]) {
      if (f && typeof f === "object") { res.status(400).json({ error: f.error }); return; }
    }

    let medicationId: string | null = null;
    if (body.medicationId !== undefined && body.medicationId !== null && body.medicationId !== "") {
      if (typeof body.medicationId !== "string" || !UUID_RE.test(body.medicationId)) {
        res.status(400).json({ error: "medicationId invalide (UUID attendu)" });
        return;
      }
      const [med] = await db.select({ id: medicationsTable.id }).from(medicationsTable)
        .where(eq(medicationsTable.id, body.medicationId)).limit(1);
      if (!med) { res.status(400).json({ error: "Médicament introuvable dans le stock" }); return; }
      medicationId = med.id;
    }

    try {
      const [row] = await db.insert(doctorFavoritesTable).values({
        userId,
        kind:         kind as FavoriteKind,
        label,
        medicationId,
        dosage:       dosage as string | null,
        frequency:    frequency as string | null,
        duration:     duration as string | null,
        instructions: instructions as string | null,
        pinned:       body.pinned === true,
      }).returning();
      res.status(201).json(row);
    } catch (e: any) {
      if (e?.code === "23505") {
        res.status(409).json({ error: "Déjà dans vos favoris" });
        return;
      }
      throw e;
    }
  } catch (err) { next(err); }
});

/** PATCH /consultation-favorites/:id — épingler / modifier les valeurs par défaut */
router.patch("/:id", requirePermission("consultations.view"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = selfId(req);
    if (!userId) { res.status(401).json({ error: "Session invalide" }); return; }
    const id = String(req.params.id);
    if (!UUID_RE.test(id)) { res.status(404).json({ error: "Favori introuvable" }); return; }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (body.pinned !== undefined) {
      if (typeof body.pinned !== "boolean") { res.status(400).json({ error: "pinned invalide (booléen attendu)" }); return; }
      data.pinned = body.pinned;
    }
    for (const [field, max] of [["label", 200], ["dosage", 200], ["frequency", 200], ["duration", 200], ["instructions", 500]] as const) {
      const v = body[field];
      if (v === undefined) continue;
      if (v === null || v === "") { data[field] = field === "label" ? undefined : null; continue; }
      if (typeof v !== "string" || v.trim().length > max) {
        res.status(400).json({ error: `${field} invalide (texte ≤ ${max} caractères)` });
        return;
      }
      data[field] = v.trim();
    }
    if (data.label !== undefined && typeof data.label === "string" && data.label.length < 2) {
      res.status(400).json({ error: "label requis (2 à 200 caractères)" });
      return;
    }
    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "Aucun champ modifiable fourni" });
      return;
    }

    try {
      const [row] = await db.update(doctorFavoritesTable)
        .set(data)
        .where(and(eq(doctorFavoritesTable.id, id), eq(doctorFavoritesTable.userId, userId)))
        .returning();
      if (!row) { res.status(404).json({ error: "Favori introuvable" }); return; }
      res.json(row);
    } catch (e: any) {
      if (e?.code === "23505") { res.status(409).json({ error: "Déjà dans vos favoris" }); return; }
      throw e;
    }
  } catch (err) { next(err); }
});

/** POST /consultation-favorites/:id/use — compteur d'usage (tri intelligent) */
router.post("/:id/use", requirePermission("consultations.view"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = selfId(req);
    if (!userId) { res.status(401).json({ error: "Session invalide" }); return; }
    const id = String(req.params.id);
    if (!UUID_RE.test(id)) { res.status(404).json({ error: "Favori introuvable" }); return; }

    const [row] = await db.update(doctorFavoritesTable)
      .set({ usageCount: sql`${doctorFavoritesTable.usageCount} + 1`, lastUsedAt: new Date() })
      .where(and(eq(doctorFavoritesTable.id, id), eq(doctorFavoritesTable.userId, userId)))
      .returning();
    if (!row) { res.status(404).json({ error: "Favori introuvable" }); return; }
    res.json(row);
  } catch (err) { next(err); }
});

/** DELETE /consultation-favorites/:id */
router.delete("/:id", requirePermission("consultations.view"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = selfId(req);
    if (!userId) { res.status(401).json({ error: "Session invalide" }); return; }
    const id = String(req.params.id);
    if (!UUID_RE.test(id)) { res.status(404).json({ error: "Favori introuvable" }); return; }

    const [row] = await db.delete(doctorFavoritesTable)
      .where(and(eq(doctorFavoritesTable.id, id), eq(doctorFavoritesTable.userId, userId)))
      .returning();
    if (!row) { res.status(404).json({ error: "Favori introuvable" }); return; }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
