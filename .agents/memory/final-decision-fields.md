---
name: FinalDecision field names
description: Actual field names in FinalDecision type — easy to guess wrong
---

# FinalDecision Field Names

Defined in `src/types/emergencyDossier.ts`.

## Common wrong guesses → correct names

| Wrong (do NOT use)  | Correct field name     |
|---------------------|------------------------|
| `service`           | `ward`                 |
| `reanimationMotif`  | `icuMotif`             |
| `priority`          | `icuPriority`          |
| `teamNotified`      | `icuTeamNotified`      |
| `medicalSummary` ✓  | `medicalSummary` (OK)  |
| `intervention` ✓    | `intervention` (OK)    |

**Why:** These were caught as TypeScript errors when wiring `confirmDecision` to the repository. The ICU fields are all prefixed with `icu`.
