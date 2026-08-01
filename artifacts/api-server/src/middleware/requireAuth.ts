import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  auth?: { userId: string; role: string };
}

/**
 * JWT authentication middleware.
 * Attaches decoded payload to req.auth when a valid Bearer token is present.
 * Returns 401 if the token is missing, malformed, or expired.
 */
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    res.status(500).json({ message: "Server misconfiguration: SESSION_SECRET not set." });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, secret) as { userId: string; role: string };
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ message: "Token invalide ou expiré." });
  }
}
