/**
 * AdmissionsContext — mutable state for admissions, persisted to localStorage.
 * Bed state has moved to MockRepository (Phase 6b).
 * Pages that need bed operations call useMockRepository() directly.
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { MOCK_ADMISSIONS } from '@/mock';
import type { Admission, DischargeType } from '@/types/admission';

// ─── Constants ─────────────────────────────────────────────────────────────────

const LS_KEY = 'irissam_admissions_v1';

// ─── localStorage helpers ──────────────────────────────────────────────────────

function loadFromStorage(): Admission[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as Admission[];
  } catch {
    return null;
  }
}

function saveToStorage(admissions: Admission[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(admissions));
  } catch {
    // Quota exceeded or private browsing — silently ignore
  }
}

export function clearAdmissionsStorage(): void {
  localStorage.removeItem(LS_KEY);
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AdmissionsState {
  admissions: Admission[];
  discharge: (
    admissionId: string,
    dischargeType: string,
    date: string,
    time: string,
    notes: string,
  ) => void;
  transfer: (
    admissionId: string,
    to: string,
    date: string,
    notes: string,
  ) => void;
  cancel: (admissionId: string) => void;
  addAdmission: (admission: Admission) => void;
  updateAdmission: (admission: Admission) => void;
  resetToDefaults: () => void;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const AdmissionsContext = createContext<AdmissionsState | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function AdmissionsProvider({ children }: { children: React.ReactNode }) {
  const [admissions, setAdmissions] = useState<Admission[]>(() => {
    const stored = loadFromStorage();
    return stored ?? MOCK_ADMISSIONS.map(a => ({ ...a }));
  });

  // Persist every change to localStorage
  useEffect(() => {
    saveToStorage(admissions);
  }, [admissions]);

  const discharge = useCallback(
    (admissionId: string, dischargeType: string, date: string, time: string, notes: string) => {
      setAdmissions(prev =>
        prev.map(a => {
          if (a.id !== admissionId) return a;
          return {
            ...a,
            status: 'discharged' as const,
            actualDischargeDate: date,
            actualDischargeTime: time,
            dischargeType: dischargeType as DischargeType,
            notes: notes || a.notes,
            updatedAt: new Date().toISOString(),
          };
        }),
      );
      // Bed release is handled by the calling page via repo.startBedCleaning()
    },
    [],
  );

  const transfer = useCallback(
    (admissionId: string, to: string, date: string, notes: string) => {
      setAdmissions(prev =>
        prev.map(a => {
          if (a.id !== admissionId) return a;
          return {
            ...a,
            status: 'transferred' as const,
            transferTo: to,
            transferDate: date,
            actualDischargeDate: date,
            notes: notes || a.notes,
            updatedAt: new Date().toISOString(),
          };
        }),
      );
      // Bed release is handled by the calling page via repo.startBedCleaning()
    },
    [],
  );

  const cancel = useCallback(
    (admissionId: string) => {
      setAdmissions(prev =>
        prev.map(a => {
          if (a.id !== admissionId) return a;
          return {
            ...a,
            status: 'cancelled' as const,
            updatedAt: new Date().toISOString(),
          };
        }),
      );
      // Bed release is handled by the calling page via repo.freeBed()
    },
    [],
  );

  const addAdmission = useCallback((admission: Admission) => {
    setAdmissions(prev => [admission, ...prev]);
  }, []);

  const updateAdmission = useCallback((admission: Admission) => {
    setAdmissions(prev => prev.map(a => (a.id === admission.id ? admission : a)));
  }, []);

  const resetToDefaults = useCallback(() => {
    clearAdmissionsStorage();
    setAdmissions(MOCK_ADMISSIONS.map(a => ({ ...a })));
  }, []);

  return (
    <AdmissionsContext.Provider
      value={{ admissions, discharge, transfer, cancel, addAdmission, updateAdmission, resetToDefaults }}
    >
      {children}
    </AdmissionsContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useAdmissions(): AdmissionsState {
  const ctx = useContext(AdmissionsContext);
  if (!ctx) throw new Error('useAdmissions must be used inside <AdmissionsProvider>');
  return ctx;
}
