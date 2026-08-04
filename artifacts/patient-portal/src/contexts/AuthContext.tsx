import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, setAccessToken, getAccessToken } from "@/lib/api";
import type { PatientMe } from "@/lib/types";

interface AuthContextType {
  patient: PatientMe | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [patient, setPatient] = useState<PatientMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      // Try to refresh the access token first
      const res = await fetch("/api/patient-portal/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        setPatient(null);
        setAccessToken(null);
        return;
      }
      const { accessToken } = await res.json();
      setAccessToken(accessToken);
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

  return (
    <AuthContext.Provider
      value={{
        patient,
        isLoading,
        isAuthenticated: !!patient,
        login,
        logout,
        refreshMe,
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
