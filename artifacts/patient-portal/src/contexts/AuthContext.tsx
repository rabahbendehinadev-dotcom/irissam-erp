import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, setAccessToken, getAccessToken, refreshAccessToken } from "@/lib/api";
import type { PatientMe } from "@/lib/types";

interface PreviewInfo {
  staffName: string;
  expiresAt: string;
}

interface AuthContextType {
  patient: PatientMe | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPreview: boolean;
  previewInfo: PreviewInfo | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  startPreview: (token: string, accountId: string) => Promise<void>;
  exitPreview: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [patient, setPatient] = useState<PatientMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreview, setIsPreview] = useState(false);
  const [previewInfo, setPreviewInfo] = useState<PreviewInfo | null>(null);

  const refreshMe = useCallback(async () => {
    try {
      // Refresh via le point d'entrée dédupliqué de api.ts : le backend fait
      // de la rotation du refresh token, donc deux POST concurrents (double
      // effet StrictMode au boot) invalident la session. refreshAccessToken()
      // garantit UN SEUL POST partagé par tous les appelants.
      const accessToken = await refreshAccessToken();
      if (!accessToken) {
        setPatient(null);
        setAccessToken(null);
        return;
      }
      // Now fetch /me
      const me = await api.get<{ patient: PatientMe }>("/auth/me");
      setPatient(me.patient);
    } catch {
      setPatient(null);
      setAccessToken(null);
    }
  }, []);

  // On mount, try to restore session via refresh cookie
  useEffect(() => {
    // In preview mode, skip the refresh cookie flow — no cookie is available
    if (window.location.pathname.includes("/preview")) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    refreshMe().finally(() => setIsLoading(false));
  }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ accessToken: string; patient: PatientMe }>(
      "/auth/login",
      { email, password },
    );
    setAccessToken(res.accessToken);
    setPatient(res.patient);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    setAccessToken(null);
    setPatient(null);
  }, []);

  const startPreview = useCallback(async (token: string, accountId: string) => {
    const res = await fetch("/api/patient-portal/auth/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, accountId }),
    });
    if (!res.ok) {
      throw new Error("Preview authentication failed");
    }
    const data: { previewJwt: string; patientId: string; staffName: string; expiresAt: string } = await res.json();
    setAccessToken(data.previewJwt);
    // Fetch patient data using the preview JWT
    const me = await api.get<{ patient: PatientMe }>("/auth/me");
    setPatient(me.patient);
    setIsPreview(true);
    setPreviewInfo({ staffName: data.staffName, expiresAt: data.expiresAt });
  }, []);

  const exitPreview = useCallback(() => {
    setAccessToken(null);
    setPatient(null);
    setIsPreview(false);
    setPreviewInfo(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        patient,
        isLoading,
        isAuthenticated: !!patient,
        isPreview,
        previewInfo,
        login,
        logout,
        refreshMe,
        startPreview,
        exitPreview,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
