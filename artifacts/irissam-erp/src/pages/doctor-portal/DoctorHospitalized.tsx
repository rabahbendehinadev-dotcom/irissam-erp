import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { apiClient } from '@/services/api/client';
import { DoctorPortalLayout } from '@/layouts/DoctorPortalLayout';
import { BedDouble, AlertCircle, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HospitalizedPatient {
  id: string;
  patient_id: string;
  encounter_id: string;
  patient_name: string;
  mrn: string;
  service: string;
  room: string;
  bed: string;
  diagnosis: string;
  hospitalization_days: number;
  active_prescriptions_count: number;
  recent_labs: {
    is_critical: boolean;
    test_name: string;
    result_value: string;
  }[];
  vitals: {
    heart_rate?: number;
    blood_pressure?: string;
    temperature?: number;
    spo2?: number;
  } | null;
  allergies: string[];
}

interface NoteModalState {
  open: boolean;
  patient: HospitalizedPatient | null;
  content: string;
  submitting: boolean;
  success: boolean;
  error: string | null;
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('bg-gray-200 rounded-lg animate-pulse', className)} />;
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-24 lg:bottom-6 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3">
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="text-white/80 hover:text-white">
        <X size={16} />
      </button>
    </div>
  );
}

export default function DoctorHospitalized() {
  const [, setLocation] = useLocation();
  const [patients, setPatients] = useState<HospitalizedPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [noteModal, setNoteModal] = useState<NoteModalState>({
    open: false,
    patient: null,
    content: '',
    submitting: false,
    success: false,
    error: null,
  });

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<HospitalizedPatient[]>('/api/doctor-portal/hospitalized');
      setPatients(Array.isArray(res) ? res : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  const openNoteModal = (patient: HospitalizedPatient) => {
    setNoteModal({ open: true, patient, content: '', submitting: false, success: false, error: null });
  };

  const closeNoteModal = () => {
    setNoteModal((prev) => ({ ...prev, open: false, patient: null }));
  };

  const submitNote = async () => {
    if (!noteModal.patient || !noteModal.content.trim()) return;
    setNoteModal((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      await apiClient.post('/api/doctor-portal/clinical-notes', {
        patientId: noteModal.patient.patient_id,
        encounterId: noteModal.patient.encounter_id,
        type: 'note_visite',
        content: noteModal.content,
      });
      setNoteModal((prev) => ({ ...prev, submitting: false, open: false }));
      setToast('Note enregistrée');
      setTimeout(() => setToast(null), 3000);
    } catch (err: unknown) {
      setNoteModal((prev) => ({
        ...prev,
        submitting: false,
        error: err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement',
      }));
    }
  };

  return (
    <DoctorPortalLayout>
      <div className="p-4 sm:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Patients hospitalisés</h1>
          <button
            onClick={fetchPatients}
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
            <button onClick={fetchPatients} className="text-sm text-red-600 flex items-center gap-1">
              <RefreshCw size={14} /> Réessayer
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-52" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && patients.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <BedDouble size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">Aucun patient hospitalisé sous votre responsabilité</p>
          </div>
        )}

        {/* Patient cards */}
        {!loading && !error && patients.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {patients.map((patient) => {
              const hasCritical = patient.recent_labs.some((l) => l.is_critical);
              const longStay = patient.hospitalization_days > 7;
              return (
                <div
                  key={patient.id}
                  className={cn(
                    'bg-white rounded-xl border shadow-sm p-4 space-y-3',
                    hasCritical ? 'border-red-200' : 'border-gray-100',
                  )}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{patient.patient_name}</p>
                      <p className="text-xs text-gray-400">{patient.mrn}</p>
                    </div>
                    <span
                      className={cn(
                        'text-xs px-2 py-1 rounded-full flex-shrink-0 font-medium',
                        longStay ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600',
                      )}
                    >
                      Jour {patient.hospitalization_days}
                    </span>
                  </div>

                  {/* Location */}
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{patient.service}</span>
                    {patient.room && ` — Chambre ${patient.room}`}
                    {patient.bed && ` — Lit ${patient.bed}`}
                  </div>

                  {/* Diagnosis */}
                  {patient.diagnosis && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded p-2 line-clamp-2">
                      {patient.diagnosis}
                    </p>
                  )}

                  {/* Vitals */}
                  {patient.vitals && (
                    <div className="grid grid-cols-4 gap-1 text-center">
                      {patient.vitals.heart_rate !== undefined && (
                        <div className="bg-red-50 rounded p-1.5">
                          <p className="text-xs text-red-600 font-semibold">{patient.vitals.heart_rate}</p>
                          <p className="text-[10px] text-gray-400">FC</p>
                        </div>
                      )}
                      {patient.vitals.blood_pressure && (
                        <div className="bg-blue-50 rounded p-1.5">
                          <p className="text-xs text-blue-600 font-semibold">{patient.vitals.blood_pressure}</p>
                          <p className="text-[10px] text-gray-400">TA</p>
                        </div>
                      )}
                      {patient.vitals.temperature !== undefined && (
                        <div className="bg-amber-50 rounded p-1.5">
                          <p className="text-xs text-amber-600 font-semibold">{patient.vitals.temperature}°</p>
                          <p className="text-[10px] text-gray-400">T°</p>
                        </div>
                      )}
                      {patient.vitals.spo2 !== undefined && (
                        <div className="bg-teal-50 rounded p-1.5">
                          <p className="text-xs text-teal-600 font-semibold">{patient.vitals.spo2}%</p>
                          <p className="text-[10px] text-gray-400">SpO2</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {patient.active_prescriptions_count > 0 && (
                      <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                        {patient.active_prescriptions_count} prescription{patient.active_prescriptions_count > 1 ? 's' : ''}
                      </span>
                    )}
                    {hasCritical && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                        <AlertTriangle size={10} /> Labo critique
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => openNoteModal(patient)}
                      className="text-xs px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                    >
                      Note de visite
                    </button>
                    <button
                      onClick={() => setLocation(`/doctor-portal/prescriptions/new?patientId=${patient.patient_id}`)}
                      className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Prescrire
                    </button>
                    <button
                      onClick={() => setLocation(`/doctor-portal/lab-orders/new?patientId=${patient.patient_id}`)}
                      className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Demander analyse
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Note modal */}
      {noteModal.open && noteModal.patient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Note de visite</h2>
              <button onClick={closeNoteModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-500">{noteModal.patient.patient_name} — {noteModal.patient.mrn}</p>

            {noteModal.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {noteModal.error}
              </div>
            )}

            <textarea
              value={noteModal.content}
              onChange={(e) => setNoteModal((prev) => ({ ...prev, content: e.target.value }))}
              placeholder="Contenu de la note de visite…"
              rows={6}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />

            <div className="flex gap-3">
              <button
                onClick={closeNoteModal}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={submitNote}
                disabled={noteModal.submitting || !noteModal.content.trim()}
                className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {noteModal.submitting ? 'Enregistrement…' : 'Enregistrer'}
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
