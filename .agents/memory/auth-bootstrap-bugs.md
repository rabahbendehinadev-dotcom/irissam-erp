---
name: Auth Bootstrap Bugs
description: Two production bugs that caused infinite "Chargement..." on first deploy; root causes and fixes
---

## Bug 1 — GET /auth/me crashes with 500 on legacy mock JWT

**Symptom:** `error: invalid input syntax for type uuid: "user-1"` → HTTP 500  
**Root cause:** JWT `payload.userId = "user-1"` (old mock ID) passed directly to `WHERE id = $1`; PostgreSQL uuid column rejects non-UUID strings with a hard crash rather than returning 0 rows.  
**Fix:** UUID regex guard in `auth.ts` GET /me before the DB query — returns 401 for non-UUID userId.

```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(payload.userId ?? "")) {
  res.status(401).json({ message: "Token invalide." });
  return;
}
```

## Bug 2 — Refresh deadlock: isLoading stuck true forever

**Symptom:** App spins on "Chargement…" indefinitely; two POST /auth/refresh per cycle.  
**Root cause:** `authService.refresh()` called `apiClient.post('/auth/refresh', {})` WITHOUT `_skipRefresh: true`. When refresh returned 401, the apiClient 401-interceptor fired `handleUnauthorized()`, which called `authService.refresh()` again. `refreshingRef.current` was already set → returned the in-flight promise `p`. But `p` was waiting for the inner `authService.refresh()` call to complete, which was waiting for `apiClient.post` to complete, which was waiting for `handleUnauthorized()` to return `p`. **Circular wait = deadlock.** Promise never resolved → `isLoading` never became `false`.

**Fix:** Pass `{ _skipRefresh: true }` to the apiClient refresh call so 401 from the refresh endpoint never re-enters the 401 interceptor.

**Why:** The `_skipRefresh` flag already existed in the client exactly for this case — it was just not wired up in `authService.refresh()`.

## Auth bootstrap hardening (AuthContext.tsx rewrite)

- Async IIFE with `try/finally`-equivalent (`cancelled` flag + explicit setSession in all branches)  
- 10-second `Promise.race` timeout → shows error state with "Réessayer" button instead of infinite spinner  
- `networkError` + `retryInit` added to context  
- Debug log markers: `AUTH_INIT_START` / `AUTH_ME_SUCCESS` / `AUTH_ME_401` / `AUTH_REFRESH_START` / `AUTH_REFRESH_SUCCESS` / `AUTH_REFRESH_FAILED` / `AUTH_INIT_FINISHED`

## Production cookie settings

`SameSite=Strict`, `Secure` in production, `HttpOnly` — all correct for same-domain deployment. `origin: true` in CORS config (reflects Origin header) with `credentials: true` — correct.

## Rule to remember

Any call to an auth endpoint that returns 401 must use `_skipRefresh: true` to prevent the 401 interceptor from triggering a recursive refresh chain.
