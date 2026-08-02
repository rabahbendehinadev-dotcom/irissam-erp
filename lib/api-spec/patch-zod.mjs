#!/usr/bin/env node
/**
 * Post-codegen patch script — fixes three issues left by orval v8:
 *
 * 1. [api-zod] zod.int() → zod.number().int()
 *    Orval v8 emits `zod.int()` (zod v4 syntax) for OpenAPI `integer` fields.
 *    Zod v3 (used by this project) only has `zod.number().int()`.
 *    Not touched: `zod.coerce.number().int()` — already correct.
 *
 * 2. [api-zod] Remove stray barrel export injected by orval into src/index.ts
 *    Orval appends `export * from './generated/types'` to lib/api-zod/src/index.ts.
 *    This causes TS2308 ambiguity errors because the same names are already
 *    exported as Zod schemas from ./generated/api. The hand-curated named
 *    `export type { ... }` block is the correct pattern.
 *
 * 3. [api-client-react] Inject UseQueryOptionsCompat + replace in hook signatures
 *    Orval v8 generates `UseQueryOptions<...>` for the `query?:` parameter in all
 *    hooks, which makes `queryKey` required. Call sites only pass `{ refetchInterval }`
 *    etc. without a `queryKey` (React Query infers it). The `UseQueryOptionsCompat`
 *    helper makes `queryKey` optional, matching the expected caller API.
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..", "..");

// ── helpers ──────────────────────────────────────────────────────────────────
function patch(label, filePath, transform) {
  const before = readFileSync(filePath, "utf8");
  const after = transform(before);
  if (after !== before) {
    writeFileSync(filePath, after, "utf8");
    console.log(`✔ patch [${label}]: patched`);
  } else {
    console.log(`✔ patch [${label}]: nothing to patch`);
  }
  return after !== before;
}

// ── 1. api-zod/src/generated/api.ts — zod.int() → zod.number().int() ────────
const apiZodTarget = resolve(
  root,
  "lib",
  "api-zod",
  "src",
  "generated",
  "api.ts"
);
patch("api-zod/api.ts: zod.int()", apiZodTarget, (src) => {
  const result = src.replace(/\bzod\.int\(/g, "zod.number().int(");
  if (result !== src) {
    const count = (src.match(/\bzod\.int\(/g) ?? []).length;
    process.stdout.write(
      `  → replaced ${count} occurrence(s) of zod.int() → zod.number().int()\n`
    );
  }
  return result;
});

// ── 2. api-zod/src/index.ts — remove stray `export * from './generated/types'`
const apiZodIndex = resolve(root, "lib", "api-zod", "src", "index.ts");
patch("api-zod/index.ts: stray barrel", apiZodIndex, (src) =>
  src.replace(/\nexport \* from ['"]\.\/generated\/types['"];?/g, "")
);

// ── 3. api-client-react/src/generated/api.ts — UseQueryOptionsCompat ─────────
const COMPAT_TYPE = `
// Compatibility shim: makes queryKey optional so callers can omit it (e.g. pass
// only { refetchInterval: 30_000 }) without TypeScript demanding queryKey.
// Orval v8 generates UseQueryOptions<...> which marks queryKey as required; this
// wrapper loosens that to match the expected caller API (React Query infers queryKey).
type UseQueryOptionsCompat<
  TQueryFnData,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = Omit<UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>, "queryKey"> & {
  queryKey?: TQueryKey;
};

`;

const apiClientTarget = resolve(
  root,
  "lib",
  "api-client-react",
  "src",
  "generated",
  "api.ts"
);
patch("api-client-react/api.ts: UseQueryOptionsCompat", apiClientTarget, (src) => {
  let result = src;

  // Inject the compat type before `type AwaitedInput` (the first non-import type)
  // but only if it isn't already present.
  if (!result.includes("UseQueryOptionsCompat")) {
    result = result.replace(
      /^(type AwaitedInput)/m,
      `${COMPAT_TYPE}$1`
    );
  }

  // Replace query parameter positions: `query?:UseQueryOptions<` → `query?:UseQueryOptionsCompat<`
  // This targets only the hook option parameter signature, not return-type casts.
  result = result.replace(
    /(\bquery\?:\s*)UseQueryOptions</g,
    "$1UseQueryOptionsCompat<"
  );

  return result;
});
