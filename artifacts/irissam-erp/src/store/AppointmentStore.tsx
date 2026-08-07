/**
 * AppointmentStore — Shared in-memory appointment state
 *
 * Acts as the single source of truth for appointment status during a session.
 * Both the Appointments page (display) and Consultations page (trigger) consume this context.
 * When a consultation starts/ends/is cancelled, the linked appointment is synced immediately.
 *
 * Design invariant:
 *   Status overrides are stored in a separate `pendingOverrides` map keyed by appointment ID.
 *   This ensures an override survives even when the appointment record hasn't been loaded yet
 *   from the API.  Every time appointments are merged, overrides are applied on top.
 *
 * Source de vérité : PostgreSQL via l'API. Aucune donnée mock — le store démarre
 * vide et se remplit exclusivement via mergeApiAppointments.
 */

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { Appointment, AppointmentStatus } from '@/types';
import type { ConsultationStatus } from '@/types/consultation';

// ─── Consultation → Appointment status mapping ────────────────────────────────

const CONSULTATION_TO_APPOINTMENT_STATUS: Partial<Record<ConsultationStatus, AppointmentStatus>> = {
  en_cours:       'in_progress',
  terminee:       'completed',
  annulee:        'cancelled',
  patient_absent: 'no_show',
};

// ─── Context contract ─────────────────────────────────────────────────────────

export interface AppointmentStoreContextType {
  /** Current appointment list with all overrides applied */
  appointments: Appointment[];

  /**
   * Sync the appointment linked to a consultation when the consultation status changes.
   * Works even when the appointment has not yet been loaded from the API —
   * the override is stored and applied the next time the record appears.
   */
  syncFromConsultation: (appointmentId: string | undefined, consultationStatus: ConsultationStatus) => void;

  /** Directly update a single appointment's status (e.g. rollback on mutation failure). */
  updateAppointmentStatus: (appointmentId: string, status: AppointmentStatus) => void;

  /** Merge a fresh list from the API into the store, applying any pending overrides. */
  mergeApiAppointments: (apiList: Appointment[]) => void;
}

const AppointmentStoreContext = createContext<AppointmentStoreContextType | null>(null);

// ─── Helper: apply pending overrides to an appointment list ──────────────────

function applyOverrides(list: Appointment[], overrides: Map<string, AppointmentStatus>): Appointment[] {
  if (overrides.size === 0) return list;
  return list.map(a => {
    const override = overrides.get(a.id);
    return override !== undefined ? { ...a, status: override } : a;
  });
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppointmentStoreProvider({ children }: { children: React.ReactNode }) {
  // Separate override map: appointment ID → desired status
  // Using a ref so mutations inside callbacks always see the latest map without
  // triggering re-renders themselves; the setAppointments call triggers the render.
  const pendingOverrides = useRef<Map<string, AppointmentStatus>>(new Map());

  // Démarre vide — la liste réelle arrive de l'API (PostgreSQL) via mergeApiAppointments.
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const syncFromConsultation = useCallback(
    (appointmentId: string | undefined, consultationStatus: ConsultationStatus) => {
      if (!appointmentId) return;
      const mapped = CONSULTATION_TO_APPOINTMENT_STATUS[consultationStatus];
      if (!mapped) return;

      // Always record the override regardless of whether the appointment is in store yet
      pendingOverrides.current.set(appointmentId, mapped);

      setAppointments(prev => {
        const found = prev.some(a => a.id === appointmentId);
        if (found) {
          // Appointment already in store — update in place
          return prev.map(a => a.id === appointmentId ? { ...a, status: mapped } : a);
        }
        // Not yet in store — will be applied when API data arrives via mergeApiAppointments
        return prev;
      });
    },
    []
  );

  const updateAppointmentStatus = useCallback(
    (appointmentId: string, status: AppointmentStatus) => {
      pendingOverrides.current.set(appointmentId, status);
      setAppointments(prev =>
        prev.map(a => (a.id === appointmentId ? { ...a, status } : a))
      );
    },
    []
  );

  const mergeApiAppointments = useCallback(
    (apiList: Appointment[]) => {
      setAppointments(() => {
        // L'API est la source de vérité : la liste remplace l'état local.
        // Seuls les overrides de statut en attente sont ré-appliqués par-dessus.
        return applyOverrides(apiList.map(a => ({ ...a })), pendingOverrides.current);
      });
    },
    []
  );

  return (
    <AppointmentStoreContext.Provider
      value={{ appointments, syncFromConsultation, updateAppointmentStatus, mergeApiAppointments }}
    >
      {children}
    </AppointmentStoreContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAppointmentStore(): AppointmentStoreContextType {
  const ctx = useContext(AppointmentStoreContext);
  if (!ctx) throw new Error('useAppointmentStore must be used inside AppointmentStoreProvider');
  return ctx;
}
