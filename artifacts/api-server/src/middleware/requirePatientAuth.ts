/**
 * Patient Portal Auth Middleware
 * Verifies the patient Bearer JWT and attaches req.patient to the request.
 * This is completely separate from the staff requireAuth middleware.
 */
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface PatientJwtPayload {
  accountId: string;
  patientId: string;
  role: "patient";
}

export interface PatientRequest extends Request {
  patient?: {
    accountId: string;
    patientId: string;
  };
}

export function requirePatientAuth(
  req: PatientRequest,
  res: Response,
  next: NextFunction,
): void {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    res.status(500).json({ message: "Server misconfiguration." });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authentification requise.", code: "UNAUTHENTICATED" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, secret) as PatientJwtPayload;
    if (payload.role !== "patient") {
      res.status(403).json({ message: "Accès refusé.", code: "FORBIDDEN" });
      return;
    }
    req.patient = {
      accountId: payload.accountId,
      patientId: payload.patientId,
    };
    next();
  } catch {
    res.status(401).json({ message: "Token invalide ou expiré.", code: "TOKEN_EXPIRED" });
  }
}
