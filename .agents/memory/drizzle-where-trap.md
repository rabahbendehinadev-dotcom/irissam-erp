---
name: Drizzle $dynamic .where() trap
description: .where() on a $dynamic() builder REPLACES the previous clause — caused a cross-patient data leak on the patient fiche
---
**Rule:** Never chain multiple `.where()` calls on a Drizzle `$dynamic()` query — each call REPLACES the previous clause. Accumulate conditions in an array and apply once: `.where(and(...conditions))`.

**Why:** GET /admissions chained one `.where()` per optional filter; `?patientId=X&type=hospitalisation` silently dropped the patientId condition and displayed 14 other patients' hospitalisations on a patient's fiche (UAT blocker, Aug 2026).

**How to apply:** Audit any route using `$dynamic()` with conditional filters. Pattern: `const conditions = [isNull(t.deletedAt)]; if (x) conditions.push(eq(...)); await db.select().from(t).where(and(...conditions))`. Bonus trap: hand-written union casts like `type as "a" | "b"` can drift from the real pgEnum — use `(typeof table.col.enumValues)[number]` instead.
