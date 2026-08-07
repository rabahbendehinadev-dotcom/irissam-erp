---
name: wouter fallback multi-segments
description: Le pattern "/:rest*" de wouter v3 ne matche PAS les chemins multi-segments — fallback de Switch = Route SANS path
---

**Règle** : dans wouter v3 (parser regexparam), un pattern `"/:rest*"` ne matche que des chemins à UN segment (`/lab-results` oui, `/lab-results/:id` ou `/appointments/request` NON → `[false,null]`). Pour un fallback de `<Switch>`, utiliser un `<Route>` **sans prop path** (matche toujours).

**Why:** un Switch dont le fallback `"/:rest*"` ne matche pas rend `null` → page entièrement blanche, SANS erreur console, SANS requête réseau (le composant ne monte jamais). Symptôme trompeur : on soupçonne un crash React alors que c'est un non-match silencieux du routeur. Vérifiable en node : `matchRoute(rp.parse, "/:rest*", path)`.

**How to apply:** tout Switch wouter avec routes imbriquées multi-segments (portail patient, ERP) : fallback = `<Route>` nu. En cas de page blanche sans erreur ni fetch, tester la matcher AVANT de chercher un crash composant.
