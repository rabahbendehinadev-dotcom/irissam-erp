/**
 * Onglet Prescriptions de l'espace consultation — 100 % PostgreSQL.
 *
 * Liste : GET /prescriptions?encounterId=… (même table que le module Pharmacie).
 * Création : POST /prescriptions avec un médicament RÉEL du stock
 * (medication_id) — le serveur valide la permission
 * consultations.create_prescription, le patient, l'appartenance de
 * l'encounter et l'existence du médicament. Aucune donnée fictive.
 */
import { useMemo, useRef, useState } from 'react';
import {
  Pill, Plus, RefreshCw, AlertTriangle, Loader2, X, CheckCircle2, Clock, Package,
} from 'lucide-react';
import { useQuery } from '@/hooks/useQuery';
import { apiClient } from '@/lib/api-client';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Consultation } from '@/types/consultation';
import type { MedicationItem } from '@workspace/api-client-react';

// ─── Types (réponse réelle de /prescriptions) ────────────────────────────────

interface RxRow {
  id: string;
  medicationId: string | null;
  drug: string;
  dosage: string;
  route: string;
  frequency: string;
  duration: string | null;
  notes: string | null;
  status: 'prescrit' | 'prepare' | 'delivre' | 'annule';
  prescribedByName: string;
  prescribedAt: string | null;
  preparedByName: string | null;
  dispensedByName: string | null;
  dispensedAt: string | null;
  dispenserComment: string | null;
}

const RX_BADGE: Record<RxRow['status'], { label: string; cls: string; icon: React.ReactNode }> = {
  prescrit: { label: 'Prescrite', cls: 'bg-blue-100 text-blue-700 border-blue-200',     icon: <Clock size={11} /> },
  prepare:  { label: 'Préparée',  cls: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Package size={11} /> },
  delivre:  { label: 'Délivrée',  cls: 'bg-green-100 text-green-700 border-green-200',   icon: <CheckCircle2 size={11} /> },
  annule:   { label: 'Annulée',   cls: 'bg-gray-100 text-gray-500 border-gray-200',      icon: <X size={11} /> },
};

const ROUTE_OPTIONS = ['orale', 'IV', 'IM', 'SC', 'topique', 'inhalée'];

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

// ─── Formulaire de création ───────────────────────────────────────────────────

function NewPrescriptionForm({
  consultation, medications, onCreated, onCancel,
}: {
  consultation: Consultation;
  medications: MedicationItem[];
  onCreated: (drug: string) => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [medicationId, setMedicationId] = useState('');
  const [dosage, setDosage]       = useState('');
  const [route, setRoute]         = useState('orale');
  const [frequency, setFrequency] = useState('');
  const [duration, setDuration]   = useState('');
  const [notes, setNotes]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedMed = medications.find(m => String(m.id) === medicationId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicationId || !dosage.trim() || !frequency.trim() || submitting) return;
    setSubmitting(true);
    try {
      await apiClient.post('/prescriptions', {
        patientId:    consultation.patientId,
        encounterId:  consultation.encounterId,
        patientName:  consultation.patientName,
        medicationId,
        dosage:       dosage.trim(),
        route,
        frequency:    frequency.trim(),
        duration:     duration.trim() || undefined,
        notes:        notes.trim() || undefined,
        sourceModule: 'consultations',
      });
      toast({
        title: 'Prescription créée',
        description: `${selectedMed?.name ?? 'Médicament'} — transmise à la pharmacie (PostgreSQL + audit).`,
      });
      onCreated(selectedMed?.name ?? '');
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error
        ?? (err instanceof Error ? err.message : 'Création impossible');
      toast({ variant: 'destructive', title: 'Prescription refusée', description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <Pill size={14} className="text-blue-600" /> Nouvelle prescription
        </h4>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      {/* Médicament réel du stock */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Médicament (stock pharmacie) <span className="text-red-500">*</span>
        </label>
        <select
          required
          value={medicationId}
          onChange={e => setMedicationId(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Sélectionner un médicament —</option>
          {medications.map(m => (
            <option key={m.id} value={m.id} disabled={m.status === 'expired'}>
              {m.name} — stock : {m.quantity} {m.unit ?? 'unités'}
              {m.status === 'expired' ? ' (expiré)' : m.status === 'critical' ? ' (critique)' : m.status === 'low' ? ' (faible)' : ''}
            </option>
          ))}
        </select>
        {selectedMed && (
          <p className={cn(
            'text-[11px] mt-1',
            selectedMed.status === 'ok' ? 'text-gray-400' : 'text-amber-600 font-medium',
          )}>
            Stock disponible : {selectedMed.quantity} {selectedMed.unit ?? 'unités'}
            {selectedMed.expiryDate && ` · expire le ${new Date(selectedMed.expiryDate).toLocaleDateString('fr-FR')}`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Posologie <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="text"
            placeholder="Ex : 1 comprimé"
            value={dosage}
            onChange={e => setDosage(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Voie</label>
          <select
            value={route}
            onChange={e => setRoute(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ROUTE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Fréquence <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="text"
            placeholder="Ex : 2 fois par jour"
            value={frequency}
            onChange={e => setFrequency(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Durée</label>
          <input
            type="text"
            placeholder="Ex : 5 jours"
            value={duration}
            onChange={e => setDuration(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Instructions</label>
        <input
          type="text"
          placeholder="Instructions particulières…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3.5 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={submitting || !medicationId || !dosage.trim() || !frequency.trim()}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Prescrire
        </button>
      </div>
    </form>
  );
}

// ─── Panneau principal ────────────────────────────────────────────────────────

export function ConsultationPrescriptionsPanel({
  consultation, readOnly, onLog,
}: {
  consultation: Consultation;
  readOnly: boolean;
  /** Journal de session de l'espace de travail. */
  onLog?: (action: string) => void;
}) {
  const { can } = usePermission();
  const { toast } = useToast();
  const encounterId = consultation.encounterId ?? null;

  const [showForm, setShowForm] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const cancelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: rawRx, loading, error, refetch } = useQuery<unknown[]>(
    encounterId ? `/prescriptions?encounterId=${encounterId}` : null,
  );
  const prescriptions: RxRow[] = useMemo(
    () => (Array.isArray(rawRx) ? (rawRx as RxRow[]) : []),
    [rawRx],
  );

  const { data: medsRaw } = useQuery<{ data: MedicationItem[] }>(
    '/medications?page=1&pageSize=100',
  );
  const medications = medsRaw?.data ?? [];

  const canPrescribe = can('consultations.create_prescription') && !readOnly && !!encounterId;

  const armCancel = (id: string) => {
    setPendingCancelId(id);
    if (cancelTimer.current) clearTimeout(cancelTimer.current);
    cancelTimer.current = setTimeout(() => setPendingCancelId(null), 4000);
  };

  const handleCancelRx = async (rx: RxRow) => {
    if (cancellingId) return;
    setCancellingId(rx.id);
    try {
      await apiClient.patch(`/prescriptions/${rx.id}/status`, { status: 'annule' });
      toast({ title: 'Prescription annulée', description: rx.drug });
      onLog?.(`Prescription annulée — ${rx.drug}`);
      refetch();
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? 'Annulation impossible';
      toast({ variant: 'destructive', title: 'Erreur', description: msg });
    } finally {
      setCancellingId(null);
      setPendingCancelId(null);
    }
  };

  if (!encounterId) {
    return (
      <div className="text-center py-12 max-w-md mx-auto">
        <AlertTriangle size={36} className="mx-auto mb-3 text-amber-400" />
        <p className="text-sm font-medium text-gray-600">
          Aucun encounter clinique lié à cette consultation
        </p>
        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
          La prescription exige un encounter réel (traçabilité PostgreSQL).
          Cette consultation ancienne n'en possède pas — aucune prescription
          ne peut y être rattachée.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold text-gray-800">Prescriptions de la consultation</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Rattachées à l'encounter <code className="font-mono">{encounterId.slice(0, 8)}…</code> —
            flux pharmacie : prescrite → préparée → délivrée (stock déduit).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            title="Actualiser"
            className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={14} />
          </button>
          {canPrescribe && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} /> Nouvelle prescription
            </button>
          )}
        </div>
      </div>

      {showForm && canPrescribe && (
        <NewPrescriptionForm
          consultation={consultation}
          medications={medications}
          onCreated={(drug) => {
            setShowForm(false);
            onLog?.(`Prescription créée — ${drug}`);
            refetch();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
          <Loader2 size={16} className="animate-spin mr-2" /> Chargement des prescriptions…
        </div>
      ) : error ? (
        <div className="text-center py-10">
          <AlertTriangle size={28} className="mx-auto mb-2 text-red-400" />
          <p className="text-sm text-gray-600 font-medium">Impossible de charger les prescriptions</p>
          <button onClick={() => refetch()} className="mt-3 px-3.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Réessayer
          </button>
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Pill size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium text-gray-500">Aucune prescription pour cette consultation</p>
          {canPrescribe && (
            <p className="text-xs mt-1 opacity-70">Cliquez sur « Nouvelle prescription » pour prescrire un médicament du stock.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {prescriptions.map(rx => {
            const badge = RX_BADGE[rx.status] ?? RX_BADGE.prescrit;
            const cancellable = canPrescribe && (rx.status === 'prescrit' || rx.status === 'prepare');
            return (
              <div
                key={rx.id}
                className={cn(
                  'border border-gray-200 rounded-xl p-3.5 bg-white',
                  rx.status === 'annule' && 'opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{rx.drug}</p>
                      <span className={cn('px-2 py-0.5 rounded-full text-[11px] border flex items-center gap-1', badge.cls)}>
                        {badge.icon}{badge.label}
                      </span>
                      {!rx.medicationId && (
                        <span className="text-[10px] text-amber-600 font-medium">non lié au stock</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {rx.dosage} · {rx.route} · {rx.frequency}{rx.duration ? ` · ${rx.duration}` : ''}
                    </p>
                    {rx.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{rx.notes}</p>}
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      Prescrite par {rx.prescribedByName} · {fmtDateTime(rx.prescribedAt)}
                      {rx.status === 'prepare' && rx.preparedByName && ` — préparée par ${rx.preparedByName}`}
                      {rx.status === 'delivre' && rx.dispensedByName &&
                        ` — délivrée par ${rx.dispensedByName} le ${fmtDateTime(rx.dispensedAt)}`}
                    </p>
                    {rx.dispenserComment && (
                      <p className="text-[11px] text-green-700 mt-0.5">Pharmacie : {rx.dispenserComment}</p>
                    )}
                  </div>
                  {cancellable && (
                    <button
                      onClick={() => pendingCancelId === rx.id ? handleCancelRx(rx) : armCancel(rx.id)}
                      disabled={cancellingId === rx.id}
                      className={cn(
                        'px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors shrink-0',
                        pendingCancelId === rx.id
                          ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                          : 'text-red-600 border-red-200 hover:bg-red-50',
                      )}
                    >
                      {cancellingId === rx.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : pendingCancelId === rx.id ? "Confirmer l'annulation" : 'Annuler'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400">
        La préparation et la délivrance (avec déduction du stock) s'effectuent
        dans le module Pharmacie. Chaque étape est auditée côté serveur.
      </p>
    </div>
  );
}
