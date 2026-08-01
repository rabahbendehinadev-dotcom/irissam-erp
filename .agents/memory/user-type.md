---
name: User type shape
description: What fields the User interface actually has (not derivable from login screen)
---

# User type shape

Defined in `src/types/auth.ts`:

```ts
interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  siteId?: string;   // optional
}
```

**Why this matters:** `user.name` does NOT exist. Construct display names as `` `${user.firstName} ${user.lastName}` ``.

**How to apply:** Any time you write code that needs the user's display name, always concatenate firstName + lastName.
