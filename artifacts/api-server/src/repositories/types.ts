/**
 * Repository shared types — TxContext, QueryOptions, DbOrTx
 *
 * TxContext travels through every repository call so that:
 *  - Multiple repository operations can share a single transaction (ctx.tx)
 *  - Audit logging always knows who triggered the operation
 *
 * Rules:
 *  - Repositories NEVER start transactions — that is the service layer's job.
 *  - When ctx.tx is present, use it; otherwise fall back to the singleton db.
 */

import type { db } from "@workspace/db";

// ─── Transaction type ─────────────────────────────────────────────────────────
// Extracted from the drizzle overload so we don't import internal types.
export type DbTx = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

/** Anything that can run a Drizzle query: the db singleton OR an open transaction */
export type DbOrTx = typeof db | DbTx;

// ─── Actor context ────────────────────────────────────────────────────────────

export interface ActorCtx {
  userId:   string;
  userName: string;
  userRole: string;
  siteId?:  string;
}

/**
 * Transaction context passed to every repository write method.
 * `tx` is undefined for read-only calls or when no transaction is needed.
 */
export interface TxContext extends ActorCtx {
  tx?: DbTx;
}

// ─── Query options ────────────────────────────────────────────────────────────

export interface PaginationOpts {
  limit?:  number;   // default 50
  offset?: number;   // default 0
}

export interface SortOpts {
  field?:     string;
  direction?: "asc" | "desc";
}

export interface QueryOptions extends PaginationOpts, SortOpts {
  includeDeleted?: boolean;
}

// ─── Standard result shapes ───────────────────────────────────────────────────

export interface PagedResult<T> {
  data:   T[];
  total:  number;
  limit:  number;
  offset: number;
}

export function paged<T>(data: T[], total: number, opts: PaginationOpts): PagedResult<T> {
  return { data, total, limit: opts.limit ?? 50, offset: opts.offset ?? 0 };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve the query builder: tx wins over the global db singleton */
export function qb(db: DbOrTx, ctx?: Pick<TxContext, "tx">): DbOrTx {
  return ctx?.tx ?? db;
}
