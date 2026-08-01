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

/** PATCH /medications/:id — update stock quantity */
router.patch("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid medication id" });
      return;
    }

    const { quantity } = req.body as { quantity?: unknown };
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 0) {
      res.status(400).json({ error: "quantity must be a non-negative integer" });
      return;
    }

    const [updated] = await db
      .update(medicationsTable)
      .set({ quantity })
      .where(eq(medicationsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Medication not found" });
      return;
    }

    res.json({ id: updated.id, quantity: updated.quantity });
  } catch (err) {
    next(err);
  }
});

export default router;
