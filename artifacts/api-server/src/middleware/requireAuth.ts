import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../routes/auth";

export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    role: string;
    permissions: string[];
    siteId: string | null;
  };
}

/**
 * JWT authentication middleware.
 * Verifies the Bearer token and attaches the decoded payload (including
 * permissions) to req.auth.  Returns 401 on missing / invalid / expired token.
 */
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
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
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.auth = {
      userId:      payload.userId,
      role:        payload.role,
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
      siteId:      payload.siteId ?? null,
    };
    next();
  } catch {
    res.status(401).json({ message: "Token invalide ou expiré." });
  }
}
