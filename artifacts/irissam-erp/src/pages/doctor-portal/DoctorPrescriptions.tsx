import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api/client';
import { DoctorPortalLayout } from '@/layouts/DoctorPortalLayout';
import { Plus, Lock, AlertCircle, RefreshCw, Pill, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Prescription {
  id: string;
  patient_name: string;
  mrn: string;
  drug_name: string;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  notes: string;
  status: 'prescrit' | 'prepare' | 'delivre' | 'annule';
  created_at: string;
  locked_at: string | null;
}

type RouteType = 'oral' | 'IV' | 'IM' | 'SC' | 'topique' | 'inhalé';

const STATUS_COLORS: Record<Prescription['status'], string> = {
  prescrit: 'bg-blue-100 text-blue-700',
  prepare: 'bg-yellow-100 text-yellow-700',
  delivre: 'bg-green-100 text-green-700',
  annule: 'bg-gray-100 text-gray-400',
};

const STATUS_LABELS: Record<Prescription['status'], string> = {
  prescrit: 'Prescrit',
  prepare: 'En préparation',
  delivre: 'Délivré',
  annule: 'Annulé',
};

interface NewPrescriptionForm {
  patientId: string;
  encounterId: string;
  drugName: string;
  dosage: string;
  route: RouteType;
  frequency: string;
  duration: string;
  notes: string;
}

const defaultForm: NewPrescriptionForm = {
  patientId: '',
  encounterId: '',
  drugName: '',
  dosage: '',
  route: 'oral',
  frequency: '',
  duration: '',
  notes: '',
};

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export default function DoctorPrescriptions() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<NewPrescriptionForm>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchPrescriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<Prescription[]>('/api/doctor-portal/prescriptions');
      setPrescriptions(Array.isArray(res) ? res : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrescriptions(); }, [fetchPrescriptions]);

  const signPrescription = async (id: string) => {
    setSigning((prev) => new Set(prev).add(id));
    try {
      await apiClient.post(`/api/doctor-portal/prescriptions/${id}/sign`, {});
      await fetchPrescriptions();
    } catch {
      // silent
    } finally {
      setSigning((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const handleSubmitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await apiClient.post('/api/doctor-portal/prescriptions', {
        patientId: form.patientId,
        encounterId: form.encounterId || undefined,
        drugName: form.drugName,
        dosage: form.dosage,
        route: form.route,
        frequency: form.frequency,
        duration: form.duration,
        notes: form.notes || undefined,
      });
      setModalOpen(false);
      setForm(defaultForm);
      await fetchPrescriptions();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  const updateForm = (field: keyof NewPrescriptionForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const ROUTES: RouteType[] = ['oral', 'IV', 'IM', 'SC', 'topique', 'inhalé'];

  return (
    <DoctorPortalLayout>
      <div className="p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Ordonnances</h1>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Nouvelle ordonnance
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500" />
            <p className="text-red-700 text-sm flex-1">{error}</p>
            <button onClick={fetchPrescriptions} className="text-sm text-red-600 flex items-center gap-1">
              <RefreshCw size={14} /> Réessayer
            </button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Patient', 'Médicament', 'Posologie', 'Fréquence', 'Durée', 'Statut', 'Date', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : prescriptions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-12 text-center">
                      <Pill size={32} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-gray-400">Aucune ordonnance</p>
                    </td>
                  </tr>
                ) : (
                  prescriptions.map((rx) => (
                    <tr key={rx.id} className={cn('hover:bg-gray-50', rx.status === 'annule' && 'opacity-60')}>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div>
                          <p className="font-medium text-gray-900">{rx.patient_name}</p>
                          <p className="text-xs text-gray-400">{rx.mrn}</p>
                        </div>
                      </td>
                      <td className={cn('px-3 py-3 font-medium', rx.status === 'annule' && 'line-through text-gray-400')}>
                        {rx.drug_name}
                      </td>
                      <td className="px-3 py-3 text-gray-600">{rx.dosage}</td>
                      <td className="px-3 py-3 text-gray-600">{rx.frequency}</td>
                      <td className="px-3 py-3 text-gray-600">{rx.duration}</td>
                      <td className="px-3 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full', STATUS_COLORS[rx.status])}>
                          {STATUS_LABELS[rx.status]}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(rx.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {rx.locked_at ? (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <Lock size={12} /> Signé
                            </span>
                          ) : (
                            <button
                              onClick={() => signPrescription(rx.id)}
                              disabled={signing.has(rx.id)}
                              className="text-xs px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
                            >
                              {signing.has(rx.id) ? '...' : 'Signer'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* New Prescription Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Nouvelle ordonnance</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitNew} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID Patient <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.patientId}
                    onChange={(e) => updateForm('patientId', e.target.value)}
                    required
                    placeholder="UUID du patient"
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID Encounter</label>
                  <input
                    type="text"
                    value={form.encounterId}
                    onChange={(e) => updateForm('encounterId', e.target.value)}
                    placeholder="UUID de l'encounter"
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Médicament <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.drugName}
                  onChange={(e) => updateForm('drugName', e.target.value)}
                  required
                  placeholder="Nom du médicament"
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Posologie <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.dosage}
                    onChange={(e) => updateForm('dosage', e.target.value)}
                    required
                    placeholder="ex: 500mg"
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Voie</label>
                  <select
                    value={form.route}
                    onChange={(e) => updateForm('route', e.target.value as RouteType)}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {ROUTES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fréquence <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.frequency}
                    onChange={(e) => updateForm('frequency', e.target.value)}
                    required
                    placeholder="ex: 3×/jour"
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Durée</label>
                  <input
                    type="text"
                    value={form.duration}
                    onChange={(e) => updateForm('duration', e.target.value)}
                    placeholder="ex: 7 jours"
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateForm('notes', e.target.value)}
                  rows={3}
                  placeholder="Instructions particulières…"
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Création…' : 'Créer l\'ordonnance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DoctorPortalLayout>
  );
}
