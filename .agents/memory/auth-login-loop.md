---
name: Auth login loop root cause and fix
description: Why the login form showed loading → blank form instead of error messages, and what was required to fix it.
---

## The root cause

`AuthContext.login()` called `setSession(s => ({ ...s, isLoading: true }))` at the start of every login attempt.
The Router's `/login` route renders `<AuthLoadingScreen />` when `isLoading === true`, which **unmounts the LoginPage**.
When the attempt failed, the LoginPage remounted with fresh state — the error message went to the stale (unmounted) component instance and was silently dropped.

A second compounding bug: `apiClient.post('/auth/login')` without `_skipRefresh: true` meant a 401 "wrong password" response triggered `handleUnauthorized()` → refresh attempt → failure → `auth:logout` event → `setSession({ isLoading: false })`. This set `isLoading` back to false and reset auth state before the login function's own catch had a chance to set the error.

## The fix

1. **Remove `setSession({ isLoading: true })` from `login()`** — only the initial auth bootstrap should touch `isLoading`. The LoginPage manages its own local `loading` state for the button spinner.

2. **Add `_skipRefresh: true`** to every `apiClient` call that returns a 401 for a *user error* rather than an *expired session*:
   - `authService.login()` — wrong credentials return 401
   - `authService.changePassword()` — wrong current-password returns 401

3. **Return the user** from `AuthContext.login()` so callers can check `user.forcePasswordChange` and navigate accordingly.

## Why this matters

Any future API call where a 401 means "bad user input, not an expired token" MUST include `_skipRefresh: true`. Without it, the interceptor will call `handleUnauthorized()`, attempt a refresh, and on failure emit `auth:logout` — which destroys auth state and redirects to /login from wherever the user was.

**How to apply:** whenever you add a new `apiClient.post/put/patch/delete` call inside a form handler (login, register, change-password, etc.), ask: "Can this endpoint return 401 for a reason other than an expired session?" If yes → `_skipRefresh: true`.
