import { useState } from 'react';
import { useRoute } from 'wouter';
import { MOCK_CONSULTATIONS } from '@/mock/consultations';
import { ConsultationWorkspace } from '@/components/consultations/ConsultationWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import type { Consultation, ConsultationStatus } from '@/types/consultation';

// The workspace page renders inside DashboardLayout (sidebar present).
// ConsultationWorkspace owns its own sticky header and tab bar.

export default function ConsultationWorkspacePage() {
  const [, params] = useRoute('/consultations/:id');
  const id = params?.id;

  const initial = MOCK_CONSULTATIONS.find(c => c.id === id);
  const [consultation, setConsultation] = useState<Consultation | undefined>(
    initial as Consultation | undefined
  );

  if (!consultation) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <div className="text-center text-gray-400">
            <p className="text-xl font-bold mb-2">Consultation introuvable</p>
            <p className="text-sm">L'identifiant <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{id}</code> ne correspond à aucune consultation.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const handleChange = (updated: Consultation) => {
    setConsultation(updated);
  };

  const handleStatusChange = (status: ConsultationStatus) => {
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
  };

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
