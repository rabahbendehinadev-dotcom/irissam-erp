import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { apiClient } from '@/services/api/client';
import { DoctorPortalLayout } from '@/layouts/DoctorPortalLayout';
import { AlertCircle, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Priority = 'P1' | 'P2' | 'P3' | 'P4';
type Decision = 'Sortie' | 'Hospitalisation' | 'Réanimation' | 'Bloc opératoire' | 'Transfert';

interface EmergencyPatient {
  id: string;
  patient_id: string;
  encounter_id: string;
  patient_name: string;
  mrn: string;
  age: number;
  gender: string;
  priority: Priority;
  wait_time_minutes: number;
  chief_complaint: string;
  status: string;
  allergies: string[];
  latest_vitals: {
    heart_rate?: number;
    blood_pressure?: string;
    temperature?: number;
    spo2?: number;
  } | null;
}

const PRIORITY_LABELS: Record<Priority, string> = {
  P1: '🔴 Critique',
  P2: '🟠 Urgent',
  P3: '🟡 Semi-urgent',
  P4: '🟢 Non urgent',
};

const PRIORITY_BORDER: Record<Priority, string> = {
  P1: 'border-red-500',
  P2: 'border-orange-400',
  P3: 'border-yellow-400',
  P4: 'border-green-400',
};

const PRIORITY_BG: Record<Priority, string> = {
  P1: 'bg-red-50',
  P2: 'bg-orange-50',
  P3: 'bg-yellow-50',
  P4: 'bg-green-50',
};

function formatWaitTime(minutes: number): string {
  if (minutes <= 0) return '0 min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

interface DecisionModalState {
  open: boolean;
  patient: EmergencyPatient | null;
  decision: Decision | '';
  motif: string;
  submitting: boolean;
  error: string | null;
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-24 lg:bottom-6 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3">
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="text-white/80 hover:text-white"><X size={16} /></button>
    </div>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('bg-gray-200 rounded-lg animate-pulse', className)} />;
}

export default function DoctorEmergencies() {
  const [, setLocation] = useLocation();
  const [patients, setPatients] = useState<EmergencyPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [decisionModal, setDecisionModal] = useState<DecisionModalState>({
    open: false,
    patient: null,
    decision: '',
    motif: '',
    submitting: false,
    error: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEmergencies = useCallback(async () => {
    setError(null);
    try {
      const res = await apiClient.get<EmergencyPatient[]>('/api/doctor-portal/emergencies');
      setPatients(Array.isArray(res) ? res : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchEmergencies();
    intervalRef.current = setInterval(fetchEmergencies, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchEmergencies]);

  const openDecisionModal = (patient: EmergencyPatient) => {
    setDecisionModal({ open: true, patient, decision: '', motif: '', submitting: false, error: null });
  };

  const closeDecisionModal = () => {
    setDecisionModal((prev) => ({ ...prev, open: false, patient: null }));
  };

  const submitDecision = async () => {
    if (!decisionModal.patient || !decisionModal.decision || !decisionModal.motif.trim()) return;
    setDecisionModal((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      await apiClient.post(`/api/doctor-portal/emergencies/${decisionModal.patient.id}/decision`, {
        decision: decisionModal.decision,
        motif: decisionModal.motif,
      });
      const removedId = decisionModal.patient.id;
      setDecisionModal((prev) => ({ ...prev, submitting: false, open: false }));
      setPatients((prev) => prev.filter((p) => p.id !== removedId));
      setToast('Décision enregistrée avec succès');
      setTimeout(() => setToast(null), 3000);
    } catch (err: unknown) {
      setDecisionModal((prev) => ({
        ...prev,
        submitting: false,
        error: err instanceof Error ? err.message : 'Erreur lors de la soumission',
      }));
    }
  };

  const DECISIONS: Decision[] = ['Sortie', 'Hospitalisation', 'Réanimation', 'Bloc opératoire', 'Transfert'];

  return (
    <DoctorPortalLayout>
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Urgences</h1>
          <button
            onClick={() => { setLoading(true); fetchEmergencies(); }}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <RefreshCw size={18} className={cn(loading && 'animate-spin')} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500" />
            <p className="text-red-700 text-sm flex-1">{error}</p>
            <button onClick={() => { setLoading(true); fetchEmergencies(); }} className="text-sm text-red-600 flex items-center gap-1">
              <RefreshCw size={14} /> Réessayer
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-44" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && patients.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <AlertCircle size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">Aucune urgence assignée</p>
          </div>
        )}

        {/* Patient cards */}
        {!loading && !error && patients.length > 0 && (
          <div className="space-y-4">
            {patients.map((patient) => (
              <div
                key={patient.id}
                className={cn(
                  'bg-white rounded-xl border-l-4 border border-gray-100 shadow-sm p-4 space-y-3',
                  PRIORITY_BORDER[patient.priority],
                  patient.priority === 'P1' && PRIORITY_BG[patient.priority],
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{patient.patient_name}</p>
                      <span className="text-xs text-gray-400">{patient.mrn}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{patient.age} ans</span>
                      <span>{patient.gender}</span>
                      <span className="text-amber-600 font-medium">
                        Attente: {formatWaitTime(patient.wait_time_minutes)}
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'text-xs px-2.5 py-1.5 rounded-full font-semibold flex-shrink-0',
                      patient.priority === 'P1' && 'bg-red-100 text-red-700 animate-pulse',
                      patient.priority === 'P2' && 'bg-orange-100 text-orange-700',
                      patient.priority === 'P3' && 'bg-yellow-100 text-yellow-700',
                      patient.priority === 'P4' && 'bg-green-100 text-green-700',
                    )}
                  >
                    {PRIORITY_LABELS[patient.priority]}
                  </span>
                </div>

                {/* Chief complaint */}
                {patient.chief_complaint && (
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-2">
                    <strong>Motif:</strong> {patient.chief_complaint}
                  </p>
                )}

                {/* Vitals */}
                {patient.latest_vitals && (
                  <div className="grid grid-cols-4 gap-1 text-center">
                    {patient.latest_vitals.heart_rate !== undefined && (
                      <div className="bg-red-50 rounded p-1.5">
                        <p className="text-xs text-red-600 font-semibold">{patient.latest_vitals.heart_rate}</p>
                        <p className="text-[10px] text-gray-400">FC</p>
                      </div>
                    )}
                    {patient.latest_vitals.blood_pressure && (
                      <div className="bg-blue-50 rounded p-1.5">
                        <p className="text-xs text-blue-600 font-semibold">{patient.latest_vitals.blood_pressure}</p>
                        <p className="text-[10px] text-gray-400">TA</p>
                      </div>
                    )}
                    {patient.latest_vitals.temperature !== undefined && (
                      <div className="bg-amber-50 rounded p-1.5">
                        <p className="text-xs text-amber-600 font-semibold">{patient.latest_vitals.temperature}°</p>
                        <p className="text-[10px] text-gray-400">T°</p>
                      </div>
                    )}
                    {patient.latest_vitals.spo2 !== undefined && (
                      <div className="bg-teal-50 rounded p-1.5">
                        <p className="text-xs text-teal-600 font-semibold">{patient.latest_vitals.spo2}%</p>
                        <p className="text-[10px] text-gray-400">SpO2</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Allergy warning */}
                {patient.allergies.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2 py-1.5 rounded-lg">
                    <AlertTriangle size={12} />
                    <span>Allergies: {patient.allergies.join(', ')}</span>
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {patient.status}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => setLocation(`/doctor-portal/lab-orders/new?patientId=${patient.patient_id}&encounterId=${patient.encounter_id}`)}
                    className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Lab
                  </button>
                  <button
                    onClick={() => setLocation(`/doctor-portal/imaging-orders/new?patientId=${patient.patient_id}&encounterId=${patient.encounter_id}`)}
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Imagerie
                  </button>
                  <button
                    onClick={() => setLocation(`/doctor-portal/prescriptions/new?patientId=${patient.patient_id}&encounterId=${patient.encounter_id}`)}
                    className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Prescrire
                  </button>
                  <button
                    onClick={() => openDecisionModal(patient)}
                    className="text-xs px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors ml-auto"
                  >
                    Décision finale
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Decision Modal */}
      {decisionModal.open && decisionModal.patient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Décision médicale</h2>
              <button onClick={closeDecisionModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-500">{decisionModal.patient.patient_name} — {decisionModal.patient.mrn}</p>

            {decisionModal.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {decisionModal.error}
              </div>
            )}

            {/* Decision radios */}
            <div className="space-y-2">
              {DECISIONS.map((d) => (
                <label key={d} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                  <input
                    type="radio"
                    name="decision"
                    value={d}
                    checked={decisionModal.decision === d}
                    onChange={() => setDecisionModal((prev) => ({ ...prev, decision: d }))}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-800">{d}</span>
                </label>
              ))}
            </div>

            {/* Motif */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motif <span className="text-red-500">*</span>
              </label>
              <textarea
                value={decisionModal.motif}
                onChange={(e) => setDecisionModal((prev) => ({ ...prev, motif: e.target.value }))}
                placeholder="Justification de la décision…"
                rows={4}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeDecisionModal}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={submitDecision}
                disabled={decisionModal.submitting || !decisionModal.decision || !decisionModal.motif.trim()}
                className="flex-1 px-4 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors"
              >
                {decisionModal.submitting ? 'Enregistrement…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </DoctorPortalLayout>
  );
}
