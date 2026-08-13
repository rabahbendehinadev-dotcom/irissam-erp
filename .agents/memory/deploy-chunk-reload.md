---
name: Auto-récupération chunks après déploiement
description: Pourquoi les pages lazy cassent en prod après un push Dokploy et comment l'auto-reload les répare — ne pas retirer les gardes
---

# Chunks lazy + déploiement VPS = 404 sur onglets ouverts

## Symptôme
Après un push (Dokploy → VPS), un utilisateur avec un onglet DÉJÀ ouvert (surtout PWA iOS restée en mémoire des jours) navigue vers une page lazy pas encore visitée → le HTML en mémoire référence les ANCIENS hashes de chunks, supprimés par la nouvelle build → 404 → PageErrorBoundary « Une erreur est survenue lors du chargement de cette page ». Le bug semble aléatoire (« la page ne s'ouvre plus après le déploiement ») et disparaît après un refresh manuel.

## Pourquoi le SW n'y peut rien
sw.js est statique ; son URL ne change (`?v=BUILD_ID`) que via un NOUVEL index.html. Un onglet longtemps ouvert ne re-télécharge jamais index.html, donc `reg.update()` re-fetch le même sw.js octet-identique → aucune mise à jour détectée. La stratégie SW (statique cache-first versionné, navigation network-first) est correcte — le problème est le HTML en mémoire de l'onglet.

## Le correctif (à NE PAS retirer)
1. `main.tsx` : listener global `vite:preloadError` (émis par Vite quand un import dynamique échoue) → `location.reload()` UNE fois, garde anti-boucle 15 s en sessionStorage.
2. `PageErrorBoundary` : détection regex des erreurs de chunk (`Failed to fetch dynamically imported module`, etc.) → auto-reload une fois ; « Réessayer » fait un vrai reload pour ces erreurs (un reset d'état ne récupère JAMAIS un chunk disparu).

**Why:** un simple reset du boundary re-tente le même import 404 → écran d'erreur permanent ; seul un reload récupère le nouvel index.html (navigation = network-first).
**How to apply:** toute nouvelle app/portail avec pages lazy + SW doit embarquer les deux gardes ; ne pas « simplifier » Réessayer en reset pur ; en cas de rapport « page ne s'ouvre plus après déploiement », penser chunks avant de chercher un bug de code.
