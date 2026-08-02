/**
 * /medications routes — backed by PharmacyService + MedicationRepository.
 *
 * Schema alignment (medicationsTable):
 *  - id: UUID (not integer)
 *  - quantity: integer (not `stock`)
 *  - lowStockThreshold: integer (not `reorderLevel`)
 *  - Task #60: pharmacist-only enforcement in route middleware (role check)
 */
import { Router } from "express";
import { pharmacyService } from "../services/pharmacy";
import { repos } from "../repositories";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requirePermission";
import type { ActorCtx } from "../repositories/types";
import type { DbMedication } from "../repositories/medication";

const router = Router();

function actor(req: AuthenticatedRequest): ActorCtx {
  return {
    userId:   req.auth?.userId ?? "system",
    userName: req.auth?.userId ?? "system",
    userRole: req.auth?.role   ?? "guest",
  };
}

function computeStatus(m: DbMedication): "ok" | "low" | "critical" | "expired" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = m.expiryDate ? new Date(m.expiryDate) : null;

  if (expiry && expiry <= today)               return "expired";
  if (m.quantity === 0)                        return "critical";
  if (m.quantity <= m.lowStockThreshold)       return "low";
  return "ok";
}

function mapMedication(m: DbMedication) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDays = new Date(today);
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const expiry = m.expiryDate ? new Date(m.expiryDate) : null;

  return {
    id:                m.id,
    name:              m.name,
    genericName:       m.genericName   ?? undefined,
    form:              m.form          ?? undefined,
    unit:              m.unit,
    quantity:          m.quantity,
    lowStockThreshold: m.lowStockThreshold,
    expiryDate:        m.expiryDate    ?? null,
    expiringSoon:      expiry !== null && expiry > today && expiry <= thirtyDays,
    category:          m.category      ?? undefined,
    price:             m.price         ?? undefined,
    status:            computeStatus(m),
    createdAt:         m.createdAt.toISOString(),
  };
}

/** GET /medications — paginated list with optional status/search filters */
router.get("/", async (req, res, next) => {
  try {
    const { status: statusFilter, search } = req.query as {
      status?: string;
      search?: string;
    };

    const page     = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt((req.query.pageSize as string) ?? "20", 10)));

    // Fetch all, filter in-memory (dataset is modest)
    const result = await repos.medication.list({ limit: 1000 });
    let medications = result.data.map(mapMedication);

    if (statusFilter && statusFilter !== "all") {
      medications = medications.filter((m) => m.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      medications = medications.filter((m) => m.name.toLowerCase().includes(q));
    }

    const total = medications.length;
    const data  = medications.slice((page - 1) * pageSize, page * pageSize);

    res.json({ data, total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

/** GET /medications/low-stock — top N items at or below their threshold */
router.get("/low-stock", async (req, res, next) => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt((req.query.limit as string) ?? "3", 10)));

    const result = await repos.medication.list({ lowStock: true, limit: 100 });

    const items = result.data
      .map((m) => ({
        id:                m.id,
        name:              m.name,
        quantity:          m.quantity,
        unit:              m.unit,
        lowStockThreshold: m.lowStockThreshold,
        status:            computeStatus(m),
      }))
      .sort((a, b) => {
        const priority: Record<string, number> = { critical: 0, expired: 1, low: 2 };
        const pd = (priority[a.status] ?? 3) - (priority[b.status] ?? 3);
        return pd !== 0 ? pd : a.quantity - b.quantity;
      })
      .slice(0, limit);

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

/** POST /medications — create a new medication (requires pharmacy.manage_stock) */
router.post("/", requirePermission("pharmacy.manage_stock"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = req.body as {
      name?: unknown;
      genericName?: unknown;
      form?: unknown;
      unit?: unknown;
      quantity?: unknown;
      lowStockThreshold?: unknown;
      expiryDate?: unknown;
      category?: unknown;
      price?: unknown;
    };

    if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
      res.status(400).json({ error: "name is required" });
      return;
    }
    if (body.quantity !== undefined &&
        (typeof body.quantity !== "number" || !Number.isInteger(body.quantity) || body.quantity < 0)) {
      res.status(400).json({ error: "quantity must be a non-negative integer" });
      return;
    }
    if (body.lowStockThreshold !== undefined &&
        (typeof body.lowStockThreshold !== "number" || !Number.isInteger(body.lowStockThreshold) || body.lowStockThreshold < 0)) {
      res.status(400).json({ error: "lowStockThreshold must be a non-negative integer" });
      return;
    }

    const created = await pharmacyService.createMedication({
      name:              body.name.trim(),
      genericName:       typeof body.genericName === "string" ? body.genericName : null,
      form:              typeof body.form        === "string" ? body.form        : null,
      unit:              typeof body.unit        === "string" ? body.unit        : "unité",
      quantity:          typeof body.quantity    === "number" ? body.quantity    : 0,
      lowStockThreshold: typeof body.lowStockThreshold === "number" ? body.lowStockThreshold : 50,
      expiryDate:        typeof body.expiryDate  === "string" ? body.expiryDate  : null,
      category:          typeof body.category    === "string" ? (body.category as any)  : null,
      price:             typeof body.price       === "number" ? body.price       : null,
    }, actor(req));

    res.status(201).json(mapMedication(created));
  } catch (err) {
    next(err);
  }
});

/** PATCH /medications/:id — update medication fields (requires pharmacy.manage_stock) */
router.patch("/:id", requirePermission("pharmacy.manage_stock"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const body = req.body as {
      name?: unknown;
      genericName?: unknown;
      form?: unknown;
      unit?: unknown;
      quantity?: unknown;
      lowStockThreshold?: unknown;
      expiryDate?: unknown;
      category?: unknown;
      price?: unknown;
    };

    const patch: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim() === "") {
        res.status(400).json({ error: "name must be a non-empty string" });
        return;
      }
      patch.name = body.name.trim();
    }
    if (body.genericName !== undefined) patch.genericName = body.genericName ?? null;
    if (body.form        !== undefined) patch.form        = body.form ?? null;
    if (body.unit        !== undefined) patch.unit        = body.unit;
    if (body.quantity    !== undefined) {
      if (typeof body.quantity !== "number" || !Number.isInteger(body.quantity) || body.quantity < 0) {
        res.status(400).json({ error: "quantity must be a non-negative integer" });
        return;
      }
      patch.quantity = body.quantity;
    }
    if (body.lowStockThreshold !== undefined) {
      if (typeof body.lowStockThreshold !== "number" || !Number.isInteger(body.lowStockThreshold) || body.lowStockThreshold < 0) {
        res.status(400).json({ error: "lowStockThreshold must be a non-negative integer" });
        return;
      }
      patch.lowStockThreshold = body.lowStockThreshold;
    }
    if (body.expiryDate !== undefined) patch.expiryDate = body.expiryDate ?? null;
    if (body.category   !== undefined) patch.category   = body.category ?? null;
    if (body.price      !== undefined) patch.price      = body.price ?? null;

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No valid fields provided" });
      return;
    }

    const updated = await pharmacyService.updateMedication(id, patch as any, actor(req));
    res.json(mapMedication(updated));
  } catch (err) {
    if (err instanceof Error && err.message.includes("introuvable")) {
      res.status(404).json({ error: err.message });
      return;
    }
    next(err);
  }
});

/** DELETE /medications/:id — soft-delete (requires pharmacy.manage_stock) */
router.delete("/:id", requirePermission("pharmacy.manage_stock"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    await pharmacyService.deleteMedication(id, actor(req));
    res.status(204).send();
  } catch (err) {
    if (err instanceof Error && err.message.includes("introuvable")) {
      res.status(404).json({ error: err.message });
      return;
    }
    next(err);
  }
});

export default router;
