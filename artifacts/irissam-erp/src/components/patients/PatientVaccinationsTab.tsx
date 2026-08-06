import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, AlertCircle, XCircle, Syringe, Plus, X, Save, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/services/api/client';
import { usePermission } from '@/hooks/usePermission';

// ─── Types (real API data only — /patients/:id/vaccinations) ─────────────────

type VaccineStatus = 'administre' | 'planifie' | 'en_retard' | 'refuse';

interface VaccineRecord {
  id: string;
  patientId: string;
  vaccine: string;
  disease?: string | null;
  doseLabel?: string | null;
  dateGiven?: string | null;
  nextDoseDate?: string | null;
  status: VaccineStatus;
  lotNumber?: string | null;
  administeredByName?: string | null;
  service?: string | null;
  notes?: string | null;
}

const STATUS_CFG: Record<VaccineStatus, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  administre: { label: 'Administré', cls: 'bg-green-100 text-green-700 border-green-200',   icon: CheckCircle2 },
  planifie:   { label: 'Planifié',   cls: 'bg-blue-100 text-blue-700 border-blue-200',      icon: Clock },
  en_retard:  { label: 'En retard',  cls: 'bg-amber-100 text-amber-700 border-amber-200',   icon: AlertCircle },
  refuse:     { label: 'Refusé',     cls: 'bg-gray-100 text-gray-500 border-gray-200',      icon: XCircle },
};

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const EMPTY_FORM = {
  vaccine: '', disease: '', doseLabel: '',
  status: 'administre' as VaccineStatus,
  dateGiven: '', nextDoseDate: '', lotNumber: '', notes: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function PatientVaccinationsTab({ patientId }: { patientId: string }) {
  const { can } = usePermission();
  const canEdit = can('patients.edit');

  const [records, setRecords] = useState<VaccineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    setLoading(true); setError(false);
    apiClient.get<VaccineRecord[]>(`/patients/${encodeURIComponent(patientId)}/vaccinations`)
      .then(rows => { if (!aborted) setRecords(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!aborted) setError(true); })
      .finally(() => { if (!aborted) setLoading(false); });
    return () => { aborted = true; };
  }, [patientId, tick]);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  const handleAdd = async () => {
    if (!form.vaccine.trim() || saving) return;
    setSaving(true); setActionError(null);
    try {
      await apiClient.post(`/patients/${encodeURIComponent(patientId)}/vaccinations`, {
        vaccine:      form.vaccine.trim(),
        disease:      form.disease.trim() || undefined,
        doseLabel:    form.doseLabel.trim() || undefined,
        status:       form.status,
        dateGiven:    form.dateGiven || undefined,
        nextDoseDate: form.nextDoseDate || undefined,
        lotNumber:    form.lotNumber.trim() || undefined,
        notes:        form.notes.trim() || undefined,
      });
      setForm(EMPTY_FORM);
      setShowAdd(false);
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkGiven = async (id: string) => {
    setActionError(null);
    try {
      await apiClient.patch(`/patients/${encodeURIComponent(patientId)}/vaccinations/${encodeURIComponent(id)}`, {
        status: 'administre',
        dateGiven: new Date().toISOString().slice(0, 10),
      });
      refresh();
    } catch {
      setActionError('Impossible de mettre à jour la vaccination.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer cette vaccination ?')) return;
    setActionError(null);
    try {
      await apiClient.delete(`/patients/${encodeURIComponent(patientId)}/vaccinations/${encodeURIComponent(id)}`);
      refresh();
    } catch {
      setActionError('Impossible de supprimer la vaccination.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[240px]">
        <div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[240px] text-red-500 space-y-2">
        <AlertTriangle size={32} className="opacity-50" />
        <p className="text-sm font-medium">Impossible de charger les vaccinations de ce patient.</p>
        <button onClick={refresh} className="text-xs text-blue-600 hover:underline">Réessayer</button>
      </div>
    );
  }

  const stats = {
    total:      records.length,
    administre: records.filter(r => r.status === 'administre').length,
    planifie:   records.filter(r => r.status === 'planifie').length,
    enRetard:   records.filter(r => r.status === 'en_retard').length,
  };

  return (
    <div className="space-y-4">
      {/* Stats + action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 min-w-[260px] max-w-xl">
          {[
            { label: 'Total',       value: stats.total,      cls: 'text-gray-800' },
            { label: 'Administrés', value: stats.administre, cls: 'text-green-600' },
            { label: 'Planifiés',   value: stats.planifie,   cls: 'text-blue-600' },
            { label: 'En retard',   value: stats.enRetard,   cls: 'text-amber-600' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-3 py-2">
              <p className={cn('text-lg font-bold leading-tight', s.cls)}>{s.value}</p>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>
        {canEdit && !showAdd && (
          <button
            onClick={() => { setShowAdd(true); setActionError(null); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} /> Ajouter une vaccination
          </button>
        )}
      </div>

      {actionError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertTriangle size={14} /> {actionError}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-gray-800 flex items-center gap-2">
              <Syringe size={15} className="text-blue-600" /> Nouvelle vaccination
            </h3>
            <button onClick={() => { setShowAdd(false); setForm(EMPTY_FORM); }} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2">
              <label className="text-xs text-gray-500">Vaccin *</label>
              <input value={form.vaccine} onChange={e => setForm(f => ({ ...f, vaccine: e.target.value }))}
                placeholder="Ex : BCG, Hépatite B…"
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Maladie ciblée</label>
              <input value={form.disease} onChange={e => setForm(f => ({ ...f, disease: e.target.value }))}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Dose</label>
              <input value={form.doseLabel} onChange={e => setForm(f => ({ ...f, doseLabel: e.target.value }))}
                placeholder="Ex : 1ère dose, Rappel"
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Statut</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as VaccineStatus }))}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option value="administre">Administré</option>
                <option value="planifie">Planifié</option>
                <option value="en_retard">En retard</option>
                <option value="refuse">Refusé</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Date d'administration</label>
              <input type="date" value={form.dateGiven} onChange={e => setForm(f => ({ ...f, dateGiven: e.target.value }))}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Prochaine dose</label>
              <input type="date" value={form.nextDoseDate} onChange={e => setForm(f => ({ ...f, nextDoseDate: e.target.value }))}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="text-xs text-gray-500">N° de lot</label>
              <input value={form.lotNumber} onChange={e => setForm(f => ({ ...f, lotNumber: e.target.value }))}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="text-xs text-gray-500">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowAdd(false); setForm(EMPTY_FORM); }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">Annuler</button>
            <button onClick={handleAdd} disabled={!form.vaccine.trim() || saving}
              className={cn('flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg text-white transition-colors',
                !form.vaccine.trim() || saving ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700')}>
              <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* List / empty state */}
      {records.length === 0 ? (
        !showAdd && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 space-y-2 bg-white border border-gray-200 rounded-xl">
            <Syringe size={36} className="opacity-20" />
            <p className="font-semibold text-sm">Aucune vaccination enregistrée pour ce patient</p>
            <p className="text-xs">{canEdit ? 'Utilisez « Ajouter une vaccination » pour renseigner le carnet vaccinal.' : 'Le carnet vaccinal de ce patient est vide.'}</p>
          </div>
        )
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100 bg-gray-50/60">
                  <th className="px-4 py-2.5 font-medium">Vaccin</th>
                  <th className="px-4 py-2.5 font-medium">Maladie</th>
                  <th className="px-4 py-2.5 font-medium">Dose</th>
                  <th className="px-4 py-2.5 font-medium">Statut</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Prochaine dose</th>
                  <th className="px-4 py-2.5 font-medium">Lot</th>
                  <th className="px-4 py-2.5 font-medium">Administré par</th>
                  {canEdit && <th className="px-4 py-2.5 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {records.map(r => {
                  const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.planifie;
                  const Icon = cfg.icon;
                  return (
                    <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{r.vaccine}</p>
                        {r.notes && <p className="text-xs text-gray-400 mt-0.5 max-w-[220px] truncate" title={r.notes}>{r.notes}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.disease || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{r.doseLabel || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium', cfg.cls)}>
                          <Icon size={11} /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(r.dateGiven)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(r.nextDoseDate)}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{r.lotNumber || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{r.administeredByName || '—'}</td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {(r.status === 'planifie' || r.status === 'en_retard') && (
                              <button onClick={() => handleMarkGiven(r.id)}
                                className="px-2 py-1 text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition-colors whitespace-nowrap">
                                Marquer administré
                              </button>
                            )}
                            <button onClick={() => handleDelete(r.id)} title="Supprimer"
                              className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
