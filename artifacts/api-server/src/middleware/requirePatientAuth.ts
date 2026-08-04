/**
 * Patient Portal Auth Middleware
 *
 * Verifies the patient Bearer JWT and attaches req.patient.
 * Handles both normal patient sessions and staff preview sessions.
 *
 * In preview mode (isPreview: true):
 *   - GET requests are allowed (read-only view)
 *   - POST / PATCH / PUT / DELETE → 403 PREVIEW_READ_ONLY
 */
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface PatientJwtPayload {
  accountId: string;
  patientId: string;
  role: "patient";
  isPreview?: boolean;
  staffUserId?: string;
  staffName?: string;
  previewExpiresAt?: string;
}

export interface PatientRequest extends Request {
  patient?: {
    accountId: string;
    patientId: string;
    isPreview: boolean;
    staffUserId?: string;
    staffName?: string;
    previewExpiresAt?: string;
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

    // Preview mode: block all write operations
    if (payload.isPreview && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      res.status(403).json({
        message: "Opération non autorisée en mode aperçu employé.",
        code: "PREVIEW_READ_ONLY",
      });
      return;
    }

    req.patient = {
      accountId: payload.accountId,
      patientId: payload.patientId,
      isPreview: payload.isPreview ?? false,
      staffUserId: payload.staffUserId,
      staffName: payload.staffName,
      previewExpiresAt: payload.previewExpiresAt,
    };
    next();
  } catch {
    res.status(401).json({ message: "Token invalide ou expiré.", code: "TOKEN_EXPIRED" });
  }
}
