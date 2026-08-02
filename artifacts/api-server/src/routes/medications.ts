import { Router } from "express";
import { db } from "@workspace/db";
import { medicationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

/** GET /medications — paginated list with optional status filter and name search */
router.get("/", async (req, res, next) => {
  try {
    const rows = await db.select().from(medicationsTable).orderBy(medicationsTable.name);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDays = new Date(today);
    thirtyDays.setDate(thirtyDays.getDate() + 30);

    const medications = rows.map((m) => {
      const expiry = m.expiryDate ? new Date(m.expiryDate) : null;
      let status: "ok" | "low" | "critical" | "expired";

      if (expiry && expiry <= today) {
        status = "expired";
      } else if (m.quantity === 0) {
        status = "critical";
      } else if (m.quantity <= m.lowStockThreshold) {
        status = "low";
      } else {
        status = "ok";
      }

      return {
        id: m.id,
        name: m.name,
        quantity: m.quantity,
        unit: m.unit,
        lowStockThreshold: m.lowStockThreshold,
        expiryDate: m.expiryDate ?? null,
        expiringSoon: expiry !== null && expiry > today && expiry <= thirtyDays,
        status,
        createdAt: m.createdAt.toISOString(),
      };
    });

    // Query filters
    const { status: statusFilter, search } = req.query as {
      status?: string;
      search?: string;
    };

    const filtered = medications.filter((m) => {
      const matchStatus = !statusFilter || statusFilter === "all" || m.status === statusFilter;
      const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });

    // Pagination
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt((req.query.pageSize as string) ?? "20", 10)));
    const total = filtered.length;
    const data = filtered.slice((page - 1) * pageSize, page * pageSize);

    res.json({ data, total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

/** GET /medications/low-stock — top N items closest to or below their threshold */
router.get("/low-stock", async (req, res, next) => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt((req.query.limit as string) ?? "3", 10)));

    const rows = await db.select().from(medicationsTable).orderBy(medicationsTable.name);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDays = new Date(today);
    thirtyDays.setDate(thirtyDays.getDate() + 30);

    const items = rows
      .map((m) => {
        const expiry = m.expiryDate ? new Date(m.expiryDate) : null;
        let status: "ok" | "low" | "critical" | "expired";

        if (expiry && expiry <= today) {
          status = "expired";
        } else if (m.quantity === 0) {
          status = "critical";
        } else if (m.quantity <= m.lowStockThreshold) {
          status = "low";
        } else {
          status = "ok";
        }

        return {
          id: m.id,
          name: m.name,
          quantity: m.quantity,
          unit: m.unit,
          lowStockThreshold: m.lowStockThreshold,
          status,
        };
      })
      // keep only items that are not "ok"
      .filter((m) => m.status !== "ok")
      // sort: critical first, then expired, then low; within same status sort by quantity ascending
      .sort((a, b) => {
        const priority: Record<string, number> = { critical: 0, expired: 1, low: 2 };
        const pd = priority[a.status] - priority[b.status];
        if (pd !== 0) return pd;
        return a.quantity - b.quantity;
      })
      .slice(0, limit);

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

/** POST /medications — create a new medication */
router.post("/", async (req, res, next) => {
  try {
    const body = req.body as {
      name?: unknown;
      unit?: unknown;
      quantity?: unknown;
      lowStockThreshold?: unknown;
      expiryDate?: unknown;
    };

    if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const insert: {
      name: string;
      unit?: string;
      quantity?: number;
      lowStockThreshold?: number;
      expiryDate?: string | null;
    } = { name: body.name.trim() };

    if (body.unit !== undefined) {
      if (typeof body.unit !== "string") {
        res.status(400).json({ error: "unit must be a string" });
        return;
      }
      insert.unit = body.unit;
    }

    if (body.quantity !== undefined) {
      if (typeof body.quantity !== "number" || !Number.isInteger(body.quantity) || body.quantity < 0) {
        res.status(400).json({ error: "quantity must be a non-negative integer" });
        return;
      }
      insert.quantity = body.quantity;
    }

    if (body.lowStockThreshold !== undefined) {
      if (
        typeof body.lowStockThreshold !== "number" ||
        !Number.isInteger(body.lowStockThreshold) ||
        body.lowStockThreshold < 0
      ) {
        res.status(400).json({ error: "lowStockThreshold must be a non-negative integer" });
        return;
      }
      insert.lowStockThreshold = body.lowStockThreshold;
    }

    if (body.expiryDate !== undefined) {
      if (body.expiryDate !== null && typeof body.expiryDate !== "string") {
        res.status(400).json({ error: "expiryDate must be a date string or null" });
        return;
      }
      insert.expiryDate = body.expiryDate as string | null;
    }

    const [created] = await db.insert(medicationsTable).values(insert).returning();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDays = new Date(today);
    thirtyDays.setDate(thirtyDays.getDate() + 30);

    const expiry = created.expiryDate ? new Date(created.expiryDate) : null;
    let status: "ok" | "low" | "critical" | "expired";
    if (expiry && expiry <= today) {
      status = "expired";
    } else if (created.quantity === 0) {
      status = "critical";
    } else if (created.quantity <= created.lowStockThreshold) {
      status = "low";
    } else {
      status = "ok";
    }

    res.status(201).json({
      id: created.id,
      name: created.name,
      quantity: created.quantity,
      unit: created.unit,
      lowStockThreshold: created.lowStockThreshold,
      expiryDate: created.expiryDate ?? null,
      expiringSoon: expiry !== null && expiry > today && expiry <= thirtyDays,
      status,
      createdAt: created.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/** PATCH /medications/:id — update medication fields (all fields supported) */
router.patch("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid medication id" });
      return;
    }

    const body = req.body as {
      name?: unknown;
      unit?: unknown;
      quantity?: unknown;
      lowStockThreshold?: unknown;
      expiryDate?: unknown;
    };

    const patch: {
      name?: string;
      unit?: string;
      quantity?: number;
      lowStockThreshold?: number;
      expiryDate?: string | null;
    } = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim() === "") {
        res.status(400).json({ error: "name must be a non-empty string" });
        return;
      }
      patch.name = body.name.trim();
    }

    if (body.unit !== undefined) {
      if (typeof body.unit !== "string") {
        res.status(400).json({ error: "unit must be a string" });
        return;
      }
      patch.unit = body.unit;
    }

    if (body.quantity !== undefined) {
      if (typeof body.quantity !== "number" || !Number.isInteger(body.quantity) || body.quantity < 0) {
        res.status(400).json({ error: "quantity must be a non-negative integer" });
        return;
      }
      patch.quantity = body.quantity;
    }

    if (body.lowStockThreshold !== undefined) {
      if (
        typeof body.lowStockThreshold !== "number" ||
        !Number.isInteger(body.lowStockThreshold) ||
        body.lowStockThreshold < 0
      ) {
        res.status(400).json({ error: "lowStockThreshold must be a non-negative integer" });
        return;
      }
      patch.lowStockThreshold = body.lowStockThreshold;
    }

    if (body.expiryDate !== undefined) {
      if (body.expiryDate !== null && typeof body.expiryDate !== "string") {
        res.status(400).json({ error: "expiryDate must be a date string or null" });
        return;
      }
      patch.expiryDate = body.expiryDate as string | null;
    }

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No valid fields provided" });
      return;
    }

    const [updated] = await db
      .update(medicationsTable)
      .set(patch)
      .where(eq(medicationsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Medication not found" });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDays = new Date(today);
    thirtyDays.setDate(thirtyDays.getDate() + 30);

    const expiry = updated.expiryDate ? new Date(updated.expiryDate) : null;
    let status: "ok" | "low" | "critical" | "expired";
    if (expiry && expiry <= today) {
      status = "expired";
    } else if (updated.quantity === 0) {
      status = "critical";
    } else if (updated.quantity <= updated.lowStockThreshold) {
      status = "low";
    } else {
      status = "ok";
    }

    res.json({
      id: updated.id,
      name: updated.name,
      quantity: updated.quantity,
      unit: updated.unit,
      lowStockThreshold: updated.lowStockThreshold,
      expiryDate: updated.expiryDate ?? null,
      expiringSoon: expiry !== null && expiry > today && expiry <= thirtyDays,
      status,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/** DELETE /medications/:id — remove a medication */
router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid medication id" });
      return;
    }

    const [deleted] = await db
      .delete(medicationsTable)
      .where(eq(medicationsTable.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Medication not found" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
