---
name: Verrouillage maintenance
description: Contrat de sécurité du mode maintenance complet pour l'ERP.
---

Quand le mode maintenance est activé, il doit bloquer sans exception tous les accès à l'ERP : nouvelles connexions, renouvellements de session et requêtes authentifiées, y compris pour les rôles administrateurs et les adresses IP autorisées.

**Why:** le propriétaire a demandé une maintenance pendant laquelle aucune personne ne peut entrer dans le système. Un bypass de rôle rendrait ce verrouillage incomplet.

**How to apply:** conserver la page publique de maintenance sur la connexion et les réponses API 503 correspondantes ; ne pas réintroduire de liste de rôles ou d'IP autorisés tant que ce contrat de verrouillage total est attendu.