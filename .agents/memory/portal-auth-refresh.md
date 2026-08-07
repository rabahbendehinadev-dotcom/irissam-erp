---
name: Rotation refresh token + StrictMode
description: La rotation de refresh token casse la session au F5 si deux POST /refresh concurrents (StrictMode) — dédupliquer côté client + jamais clearCookie sur token inconnu
---

**Règle 1 — client** : tout appel de refresh (AuthContext au boot, retry-401 d'apiFetch) DOIT passer par un point d'entrée unique dédupliqué (`refreshAccessToken()` dans `lib/api.ts` du portail, promesse partagée `_refreshPromise`). Jamais de `fetch("/auth/refresh")` brut ailleurs.

**Règle 2 — serveur** : sur un endpoint /refresh à rotation, ne JAMAIS `clearCookie` dans la branche « token inconnu » (401 nu suffit). Un token inconnu est sans valeur ; le clearCookie, lui, est destructeur en cas de course.

**Why:** React StrictMode (dev) monte les effets deux fois → deux POST /refresh partent avec le même cookie. La rotation révoque l'ancien token au premier appel ; le second (1 ms après) tombe en « session invalide » et son `clearCookie` efface la cookie FRAÎCHE posée par le gagnant → session détruite à chaque F5, symptôme : retour au login après refresh, `context.cookies()` vide.

**How to apply:** vérifier ces deux règles pour toute nouvelle app à rotation de refresh token (portail patient irissam_pt, futurs portails). Contrat frontend du portail : réponses en camelCase + enveloppes exactes (`{labResults}`, `{labResult}`, login/me incluent `patient`) — c'est le backend qui s'adapte au frontend.
