import { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation } from 'wouter';
import { apiClient } from '@/services/api/client';
import { DoctorPortalLayout } from '@/layouts/DoctorPortalLayout';
import { ScrollableTabBar } from '@/components/ui/ScrollableTabBar';
import type { TabBarItem } from '@/components/ui/ScrollableTabBar';
import {
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  ShieldOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PatientSummary {
  id: string;
  patient_name: string;
  mrn: string;
  date_of_birth: string;
  gender: string;
  blood_type: string | null;
  allergies: string[];
  activeAdmission: {
    service: string;
    bed: string;
    admission_date: string;
  } | null;
  activeEncounter: {
    id: string;
    encounter_number: string;
  } | null;
  recentConsultations: {
    id: string;
    consultation_date: string;
    reason: string;
    diagnosis: string;
    status: string;
  }[];
  recentLabs: {
    id: string;
    test_name: string;
    result_value: string;
    result_unit: string;
    result_at: string;
    is_critical: boolean;
  }[];
  recentImaging: {
    id: string;
    exam_type: string;
    report_summary: string;
    reported_at: string;
  }[];
  activePrescriptions: {
    id: string;
    drug_name: string;
    dosage: string;
    frequency: string;
    status: string;
  }[];
}

function calcAge(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('bg-gray-200 rounded-lg animate-pulse', className)} />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    in_progress: 'bg-purple-100 text-purple-700',
    pending: 'bg-amber-100 text-amber-700',
    active: 'bg-blue-100 text-blue-700',
    prescrit: 'bg-blue-100 text-blue-700',
    delivre: 'bg-green-100 text-green-700',
    annule: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full', map[status] ?? 'bg-gray-100 text-gray-600')}>
      {status}
    </span>
  );
}

const TABS: TabBarItem[] = [
  { id: 'resume', label: 'Résumé' },
  { id: 'consultations', label: 'Consultations' },
  { id: 'labs', label: 'Labo' },
  { id: 'imaging', label: 'Imagerie' },
  { id: 'medications', label: 'Médicaments' },
  { id: 'timeline', label: 'Timeline' },
];

export default function DoctorPatientWorkspace() {
  const params = useParams<{ id: string }>();
  const patientId = params.id;
  const [, setLocation] = useLocation();
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [activeTab, setActiveTab] = useState('resume');

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const res = await apiClient.get<PatientSummary>(`/api/doctor-portal/patients/${patientId}/summary`);
      setSummary(res as PatientSummary);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
        setForbidden(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  if (loading) {
    return (
      <DoctorPortalLayout>
        <div className="p-4 sm:p-6 space-y-4">
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-10" />
          <SkeletonBlock className="h-64" />
        </div>
      </DoctorPortalLayout>
    );
  }

  if (forbidden) {
    return (
      <DoctorPortalLayout>
        <div className="p-6 flex items-center justify-center min-h-[60vh]">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
            <ShieldOff size={40} className="mx-auto text-red-400 mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Accès refusé</h2>
            <p className="text-gray-500 text-sm mb-4">
              Ce patient n'est pas dans votre liste de patients.
            </p>
            <button
              onClick={() => setLocation('/doctor-portal/my-patients')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              Retour à mes patients
            </button>
          </div>
        </div>
      </DoctorPortalLayout>
    );
  }

  if (error || !summary) {
    return (
      <DoctorPortalLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <AlertCircle className="mx-auto text-red-400 mb-3" size={32} />
            <p className="text-red-700 font-medium mb-4">{error ?? 'Impossible de charger le dossier'}</p>
            <button
              onClick={fetchSummary}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              <RefreshCw size={14} /> Réessayer
            </button>
          </div>
        </div>
      </DoctorPortalLayout>
    );
  }

  const age = summary.date_of_birth ? calcAge(summary.date_of_birth) : null;
  const hasCritical = summary.recentLabs.some((l) => l.is_critical);

  const allTimelineItems = [
    ...summary.recentConsultations.map((c) => ({
      date: c.consultation_date,
      type: 'consultation',
      label: c.reason,
      sub: c.diagnosis,
      color: 'bg-blue-500',
    })),
    ...summary.recentLabs.map((l) => ({
      date: l.result_at,
      type: 'lab',
      label: `${l.test_name}: ${l.result_value} ${l.result_unit}`,
      sub: l.is_critical ? 'CRITIQUE' : '',
      color: l.is_critical ? 'bg-red-500' : 'bg-purple-500',
    })),
    ...summary.recentImaging.map((i) => ({
      date: i.reported_at,
      type: 'imaging',
      label: i.exam_type,
      sub: i.report_summary,
      color: 'bg-teal-500',
    })),
    ...summary.activePrescriptions.map((p) => ({
      date: '',
      type: 'prescription',
      label: `${p.drug_name} ${p.dosage}`,
      sub: p.frequency,
      color: 'bg-indigo-500',
    })),
  ].sort((a, b) => (b.date > a.date ? 1 : -1));

  return (
    <DoctorPortalLayout>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white shadow-sm border-b border-gray-100">
        <div className="px-4 sm:px-6 pt-4 pb-3 space-y-2">
          {/* Name + identifiers */}
          <div className="flex items-start gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{summary.patient_name}</h1>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-mono self-center">
              {summary.mrn}
            </span>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            {age !== null && <span>{age} ans</span>}
            {summary.gender && <span>• {summary.gender}</span>}
            {summary.blood_type && (
              <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-xs font-medium">
                {summary.blood_type}
              </span>
            )}
            {summary.allergies.map((allergy) => (
              <span key={allergy} className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
                <AlertTriangle size={10} /> {allergy}
              </span>
            ))}
          </div>

          {/* Status pills */}
          <div className="flex flex-wrap gap-2">
            {summary.activeAdmission && (
              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                🏥 {summary.activeAdmission.service} — Lit {summary.activeAdmission.bed}
              </span>
            )}
            {summary.activeEncounter && (
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                Encounter #{summary.activeEncounter.encounter_number}
              </span>
            )}
          </div>

          {/* Critical banner */}
          {hasCritical && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-700 font-medium">⚠ Résultat critique — Action requise</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="px-4 sm:px-6">
          <ScrollableTabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4 sm:p-6 pb-24">
        {/* RESUME */}
        {activeTab === 'resume' && (
          <div className="space-y-4">
            {summary.activeAdmission && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h3 className="font-semibold text-green-800 mb-2">Admission active</h3>
                <p className="text-sm text-green-700">
                  Service: <strong>{summary.activeAdmission.service}</strong> — Lit: <strong>{summary.activeAdmission.bed}</strong>
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Depuis le {new Date(summary.activeAdmission.admission_date).toLocaleDateString('fr-FR')}
                </p>
              </div>
            )}
            {summary.activeEncounter && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="font-semibold text-blue-800 mb-1">Encounter en cours</h3>
                <p className="text-sm text-blue-700">#{summary.activeEncounter.encounter_number}</p>
              </div>
            )}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="font-semibold text-gray-800 mb-3">Dernières consultations</h3>
              {summary.recentConsultations.slice(0, 3).length === 0 ? (
                <p className="text-sm text-gray-400">Aucune consultation récente</p>
              ) : (
                <div className="space-y-2">
                  {summary.recentConsultations.slice(0, 3).map((c) => (
                    <div key={c.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                      <div className="text-xs text-gray-400 flex-shrink-0 pt-0.5">
                        {new Date(c.consultation_date).toLocaleDateString('fr-FR')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.reason}</p>
                        {c.diagnosis && <p className="text-xs text-gray-500 truncate">{c.diagnosis}</p>}
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONSULTATIONS */}
        {activeTab === 'consultations' && (
          <div className="space-y-3">
            {summary.recentConsultations.length === 0 ? (
              <p className="text-center text-gray-400 py-10">Aucune consultation</p>
            ) : (
              summary.recentConsultations.map((c) => (
                <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900">{c.reason}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  {c.diagnosis && <p className="text-sm text-gray-600">{c.diagnosis}</p>}
                  <p className="text-xs text-gray-400">
                    {new Date(c.consultation_date).toLocaleDateString('fr-FR', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* LABS */}
        {activeTab === 'labs' && (
          <div className="space-y-3">
            {summary.recentLabs.length === 0 ? (
              <p className="text-center text-gray-400 py-10">Aucun résultat de labo</p>
            ) : (
              summary.recentLabs.map((lab) => (
                <div
                  key={lab.id}
                  className={cn(
                    'bg-white rounded-xl border p-4 flex items-center gap-3',
                    lab.is_critical ? 'border-red-300 bg-red-50' : 'border-gray-100',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{lab.test_name}</p>
                    <p className={cn('text-sm font-semibold', lab.is_critical ? 'text-red-600' : 'text-gray-700')}>
                      {lab.result_value} {lab.result_unit}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {lab.result_at ? new Date(lab.result_at).toLocaleDateString('fr-FR') : ''}
                    </p>
                  </div>
                  {lab.is_critical && (
                    <span className="text-xs bg-red-600 text-white px-2 py-1 rounded-full flex-shrink-0 animate-pulse">
                      CRITIQUE
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* IMAGING */}
        {activeTab === 'imaging' && (
          <div className="space-y-3">
            {summary.recentImaging.length === 0 ? (
              <p className="text-center text-gray-400 py-10">Aucune imagerie</p>
            ) : (
              summary.recentImaging.map((img) => (
                <div key={img.id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-1">
                  <p className="font-medium text-gray-900">{img.exam_type}</p>
                  {img.report_summary && (
                    <p className="text-sm text-gray-600 line-clamp-3">{img.report_summary}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    {img.reported_at ? new Date(img.reported_at).toLocaleDateString('fr-FR') : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* MEDICATIONS */}
        {activeTab === 'medications' && (
          <div className="space-y-3">
            {summary.activePrescriptions.length === 0 ? (
              <p className="text-center text-gray-400 py-10">Aucune prescription active</p>
            ) : (
              summary.activePrescriptions.map((med) => (
                <div key={med.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{med.drug_name}</p>
                    <p className="text-sm text-gray-600">
                      {med.dosage} — {med.frequency}
                    </p>
                  </div>
                  <StatusBadge status={med.status} />
                </div>
              ))
            )}
          </div>
        )}

        {/* TIMELINE */}
        {activeTab === 'timeline' && (
          <div className="space-y-3">
            {allTimelineItems.length === 0 ? (
              <p className="text-center text-gray-400 py-10">Aucun événement</p>
            ) : (
              <div className="relative pl-6">
                <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200" />
                {allTimelineItems.map((item, idx) => (
                  <div key={idx} className="relative mb-4">
                    <div className={cn('absolute -left-4 w-3 h-3 rounded-full flex-shrink-0', item.color)} />
                    <div className="bg-white rounded-xl border border-gray-100 p-3 ml-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{item.type}</p>
                      <p className="text-sm font-medium text-gray-900 mt-0.5">{item.label}</p>
                      {item.sub && <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>}
                      {item.date && (
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(item.date).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-30 bg-white border-t border-gray-200 p-3 flex gap-2 overflow-x-auto">
        <button
          onClick={() => setLocation(`/doctor-portal/patients-today?patientId=${patientId}`)}
          className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Nouvelle consult
        </button>
        <button
          onClick={() => setLocation(`/doctor-portal/lab-orders/new?patientId=${patientId}`)}
          className="flex-shrink-0 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
        >
          Demander analyse
        </button>
        <button
          onClick={() => setLocation(`/doctor-portal/prescriptions/new?patientId=${patientId}`)}
          className="flex-shrink-0 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Prescrire
        </button>
        <button
          onClick={() => setLocation(`/doctor-portal/notes/new?patientId=${patientId}`)}
          className="flex-shrink-0 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
        >
          Ajouter note
        </button>
      </div>
    </DoctorPortalLayout>
  );
}
