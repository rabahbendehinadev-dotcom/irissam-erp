/**
 * AdmissionsContext — mutable in-memory state for admissions + beds.
 * All writes go through the provided actions so the whole app stays in sync.
 */
import { createContext, useContext, useState, useCallback } from 'react';
import { MOCK_ADMISSIONS, MOCK_BEDS } from '@/mock';
import type { Admission, Bed, DischargeType } from '@/types/admission';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AdmissionsState {
  admissions: Admission[];
  beds: Bed[];
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
}

// ─── Context ───────────────────────────────────────────────────────────────────

const AdmissionsContext = createContext<AdmissionsState | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function AdmissionsProvider({ children }: { children: React.ReactNode }) {
  const [admissions, setAdmissions] = useState<Admission[]>(() =>
    MOCK_ADMISSIONS.map(a => ({ ...a })),
  );
  const [beds, setBeds] = useState<Bed[]>(() => MOCK_BEDS.map(b => ({ ...b })));

  /** Free the bed associated with an admission (set to 'libre', clear patient info). */
  const freeBed = useCallback((bedId: string | undefined) => {
    if (!bedId) return;
    setBeds(prev =>
      prev.map(b =>
        b.id === bedId
          ? { ...b, status: 'libre' as const, patientId: undefined, patientName: undefined, admissionId: undefined }
          : b,
      ),
    );
  }, []);

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
      // Libérer le lit
      const adm = admissions.find(a => a.id === admissionId);
      freeBed(adm?.bedId);
    },
    [admissions, freeBed],
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
      const adm = admissions.find(a => a.id === admissionId);
      freeBed(adm?.bedId);
    },
    [admissions, freeBed],
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
      const adm = admissions.find(a => a.id === admissionId);
      freeBed(adm?.bedId);
    },
    [admissions, freeBed],
  );

  const addAdmission = useCallback((admission: Admission) => {
    setAdmissions(prev => [admission, ...prev]);
  }, []);

  const updateAdmission = useCallback((admission: Admission) => {
    setAdmissions(prev => prev.map(a => (a.id === admission.id ? admission : a)));
  }, []);

  return (
    <AdmissionsContext.Provider
      value={{ admissions, beds, discharge, transfer, cancel, addAdmission, updateAdmission }}
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
