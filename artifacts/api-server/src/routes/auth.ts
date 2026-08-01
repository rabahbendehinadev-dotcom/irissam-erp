import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";

const router = Router();

// Fail fast at startup — never allow a forgeable fallback secret.
const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "[auth] SESSION_SECRET environment variable is not set. " +
      "Set it to a strong random value before starting the server."
  );
}

const JWT_EXPIRES_IN = "24h";

/**
 * Seed users — temporary until task #12 migrates these to the database.
 * Passwords are bcrypt-hashed (cost 10); no plaintext credentials are stored here.
 * Bootstrap credentials must be obtained from the system administrator.
 */
const SEED_USERS = [
  {
    id: "user-1",
    firstName: "Hachichi",
    lastName: "Admin",
    email: "admin@irissam.dz",
    passwordHash: "$2b$10$xmUHlfcRs0Y4OHAShMtT9e366MX7siYhAUyW2ikZrDDy/CdA0A0fC",
    role: "administrateur" as const,
    siteId: "site-1",
    isActive: true,
  },
  {
    id: "user-2",
    firstName: "Dr. Amina",
    lastName: "Benali",
    email: "medecin@irissam.dz",
    passwordHash: "$2b$10$Co.P5JEeUbFh8gDnjr/6y.aFVWNd/tld1UC7j4aQUk/MRJlNRcV4m",
    role: "medecin" as const,
    siteId: "site-1",
    isActive: true,
  },
  {
    id: "user-3",
    firstName: "Karim",
    lastName: "Meziane",
    email: "caissier@irissam.dz",
    passwordHash: "$2b$10$kHS18.iBAEhXR1jNbQsX6uLgQO.dK55N6KQMwNcNVkk0oakUSMcsS",
    role: "finance" as const,
    siteId: "site-1",
    isActive: true,
  },
];

function toPublicUser(u: (typeof SEED_USERS)[number]) {
  const { passwordHash: _ph, ...pub } = u;
  return { ...pub, lastLogin: new Date() };
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { user, token }
 */
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ message: "Email et mot de passe requis." });
    return;
  }

  const user = SEED_USERS.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );

  if (!user || !user.isActive) {
    // Constant-time dummy compare to prevent user enumeration via timing
    await bcrypt.compare(password, "$2b$10$invalidhashpadding000000000000000000000000000000000000");
    res.status(401).json({ message: "Identifiants invalides." });
    return;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    res.status(401).json({ message: "Identifiants invalides." });
    return;
  }

  const publicUser = toPublicUser(user);
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  res.json({ user: publicUser, token });
});

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 * Returns: { user }
 */
router.get("/me", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Token manquant." });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    const user = SEED_USERS.find((u) => u.id === payload.userId);
    if (!user || !user.isActive) {
      res.status(401).json({ message: "Utilisateur introuvable." });
      return;
    }
    res.json({ user: toPublicUser(user) });
  } catch {
    res.status(401).json({ message: "Token invalide ou expiré." });
  }
});

export default router;
