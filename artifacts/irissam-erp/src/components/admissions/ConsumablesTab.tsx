import { useState, useEffect, useCallback } from 'react';
import {
  Syringe, Pill, Package, PlusCircle, Loader2, AlertTriangle,
} from 'lucide-react';
import { apiClient } from '@/services/api/client';
import { usePermission } from '@/hooks/usePermission';
import { useAuditLog } from '@/hooks/useAuditLog';
import { formatDate } from '@/utils/format';
import type { Admission, AdmissionConsumable, ConsumableItemType } from '@/types/admission';

/** Valeur par défaut d'un <input type="datetime-local"> : maintenant, en heure locale. */
function nowLocalInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const TYPE_META: Record<ConsumableItemType, { label: string; icon: React.ReactNode; cls: string }> = {
  medicament:  { label: 'Médicament',  icon: <Pill size={11} />,    cls: 'bg-blue-50 text-blue-700' },
  consommable: { label: 'Consommable', icon: <Package size={11} />, cls: 'bg-gray-100 text-gray-600' },
};

/**
 * Fiche consommable du séjour — étape 1 : saisie libre (désignation texte),
 * volontairement SANS liaison Stock Médical / Pharmacie (étape 2 prévue).
 * Liste servie par GET /admissions/:id/consumables, ajout par POST.
 */
export function ConsumablesTab({ admission }: { admission: Admission }) {
  const { can } = usePermission();
  const { log } = useAuditLog();

  const [entries,   setEntries]   = useState<AdmissionConsumable[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState('');

  // Formulaire d'ajout
  const [designation, setDesignation] = useState('');
  const [itemType,    setItemType]    = useState<ConsumableItemType>('consommable');
  const [qty,         setQty]         = useState('1');
  const [usedAt,      setUsedAt]      = useState(nowLocalInput());
  const [note,        setNote]        = useState('');
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const rows = (await apiClient.get(`/admissions/${admission.id}/consumables`)) as AdmissionConsumable[];
      setEntries(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setLoadError(e?.data?.error ?? e?.data?.message ?? e?.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [admission.id]);

  useEffect(() => { void load(); }, [load]);

  // Statuts où l'enregistrement n'a pas de sens (le serveur les refuse aussi).
  const blockedReason =
    admission.status === 'cancelled'
      ? 'Admission annulée — fiche en lecture seule.'
      : admission.status === 'preadmission'
        ? "Patient non encore admis — confirmez l'admission pour enregistrer des consommations."
        : '';
  const canRecord = can('admissions.edit') && !blockedReason;

  const qtyNum = parseInt(qty, 10);
  const formValid = designation.trim().length > 0 && Number.isInteger(qtyNum) && qtyNum >= 1 && qtyNum <= 9999;

  const submit = async () => {
    if (!formValid || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      await apiClient.post(`/admissions/${admission.id}/consumables`, {
        designation: designation.trim(),
        itemType,
        quantity: qtyNum,
        usedAt: usedAt ? new Date(usedAt).toISOString() : undefined,
        note: note.trim() || undefined,
      });
      log('create', 'admission', admission.id, `Fiche consommable : ${designation.trim()} × ${qtyNum}`);
      setDesignation('');
      setItemType('consommable');
      setQty('1');
      setUsedAt(nowLocalInput());
      setNote('');
      await load();
    } catch (e: any) {
      setSaveError(e?.data?.error ?? e?.data?.message ?? e?.message ?? "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Formulaire d'ajout */}
      {canRecord ? (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 mb-3">
            Enregistrer un médicament ou consommable utilisé
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Désignation *</label>
              <input
                type="text"
                value={designation}
                onChange={e => setDesignation(e.target.value)}
                maxLength={200}
                placeholder="Ex. : Paracétamol 1g inj., compresses stériles…"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select
                value={itemType}
                onChange={e => setItemType(e.target.value as ConsumableItemType)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              >
                <option value="consommable">Consommable</option>
                <option value="medicament">Médicament</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Quantité *</label>
              <input
                type="number"
                min={1}
                max={9999}
                value={qty}
                onChange={e => setQty(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date / heure d'utilisation</label>
              <input
                type="datetime-local"
                value={usedAt}
                max={nowLocalInput()}
                onChange={e => setUsedAt(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Note</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Précision éventuelle (voie, contexte…)"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
          </div>
          {saveError && (
            <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
              <AlertTriangle size={12} /> {saveError}
            </p>
          )}
          <div className="flex justify-end mt-3">
            <button
              onClick={submit}
              disabled={!formValid || saving}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <PlusCircle size={13} />}
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      ) : blockedReason ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 flex items-center gap-2">
          <AlertTriangle size={15} className="flex-shrink-0" />
          {blockedReason}
        </div>
      ) : null}

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-500 space-y-2">
          <AlertTriangle size={28} className="text-red-400" />
          <p className="text-sm">{loadError}</p>
          <button
            onClick={() => void load()}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Réessayer
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Syringe size={36} className="opacity-30 mb-2" />
          <p className="text-sm">Aucun médicament ou consommable enregistré pour ce séjour</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">
            {entries.length} enregistrement{entries.length > 1 ? 's' : ''}
          </p>
          {entries.map(c => {
            const meta = TYPE_META[c.itemType] ?? TYPE_META.consommable;
            return (
              <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 break-words">{c.designation}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${meta.cls}`}>
                        {meta.icon} {meta.label}
                      </span>
                      <span className="text-xs text-gray-500">Quantité : <span className="font-semibold text-gray-700">{c.quantity}</span></span>
                    </div>
                    {c.note && <p className="text-xs text-gray-500 italic mt-2 break-words">{c.note}</p>}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 text-xs text-gray-400">
                  <span className="font-medium text-gray-600">{c.recordedByName}</span>
                  <span>
                    {formatDate(c.usedAt)} à {new Date(c.usedAt).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
