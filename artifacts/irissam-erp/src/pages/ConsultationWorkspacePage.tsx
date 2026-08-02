import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { getAllConsultations } from '@/mock/consultations';
import { ConsultationWorkspace } from '@/components/consultations/ConsultationWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import type { Consultation, ConsultationStatus } from '@/types/consultation';
import { useGetConsultationsList } from '@workspace/api-client-react';
import { useAppointmentStore } from '@/store/AppointmentStore';

// The workspace page renders inside DashboardLayout (sidebar present).
// ConsultationWorkspace owns its own sticky header and tab bar.

export default function ConsultationWorkspacePage() {
  const [, params] = useRoute('/consultations/:id');
  const id = params?.id;

  // 1. Check mock data (c-* IDs)
  const mockMatch = getAllConsultations().find(c => c.id === id);

  // 2. Fetch API list (cached from Consultations page visit) for db-* IDs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: apiConsultations } = useGetConsultationsList({} as any);

  const [consultation, setConsultation] = useState<Consultation | undefined>(
    mockMatch as Consultation | undefined
  );

  // Hydrate from API data when available (handles db-* IDs navigated to from API-backed list)
  useEffect(() => {
    if (consultation) return; // already resolved from mock
    if (!id || !apiConsultations) return;
    const apiMatch = (apiConsultations as unknown as Consultation[]).find(c => c.id === id);
    if (apiMatch) setConsultation(apiMatch);
  }, [id, apiConsultations, consultation]);

  // ── Appointment sync — must be called unconditionally (Rules of Hooks) ─────
  const { syncFromConsultation } = useAppointmentStore();

  const handleChange = (updated: Consultation) => {
    setConsultation(updated);
  };

  const handleStatusChange = (status: ConsultationStatus) => {
    const appointmentId = consultation?.appointmentId;

    setConsultation(prev => prev ? {
      ...prev,
      status,
      startedAt: status === 'en_cours' && !prev.startedAt ? new Date().toISOString() : prev.startedAt,
      endedAt:   status === 'terminee' ? new Date().toISOString() : prev.endedAt,
      duration:  status === 'terminee' && prev.startedAt
        ? Math.round((Date.now() - new Date(prev.startedAt).getTime()) / 60000)
        : prev.duration,
      syncStatus: 'pending',
      updatedAt: new Date().toISOString(),
    } : prev);

    // Sync appointment after consultation state update.
    // The workspace operates on mock/local data so there is no API call to fail here;
    // the sync is the authoritative write for this flow.
    if (appointmentId) {
      syncFromConsultation(appointmentId, status);
    }
  };

  if (!consultation) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <div className="text-center text-gray-400">
            <p className="text-xl font-bold mb-2">Consultation introuvable</p>
            <p className="text-sm">
              L'identifiant{' '}
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{id}</code>{' '}
              ne correspond à aucune consultation.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout noPadding>
      <ConsultationWorkspace
        consultation={consultation}
        onChange={handleChange}
        onStatusChange={handleStatusChange}
      />
    </DashboardLayout>
  );
}
