import { useState, useEffect } from 'react';
import {
  Home, Building2, Heart, Scissors, ArrowRightLeft, Eye, Moon, CheckCircle2, AlertTriangle, Bed,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmergencyDossier } from '@/contexts/EmergencyDossierContext';
import { usePermission } from '@/hooks/usePermission';
import { apiClient } from '@/services/api/client';
import type { FinalDecisionType, FinalDecision } from '@/types/emergencyDossier';

// ─── BedSelector ──────────────────────────────────────────────────────────────

interface AvailableBed {
  id: string;
  number: string;
  roomNumber: string | null;
  floorLabel: string | null;
  buildingName: string | null;
  type: string;
}

function BedSelector({
  label,
  bedType,
  selectedBedId,
  onSelect,
  accentClass,
}: {
  label: string;
  bedType: 'standard' | 'soins_intensifs';
  selectedBedId: string | undefined;
  onSelect: (bedId: string, bedNumber: string) => void;
  accentClass: string;
}) {
  const [beds, setBeds] = useState<AvailableBed[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient.get<AvailableBed[]>(`/occupancy-beds/available?type=${bedType}`)
      .then(data => { if (!cancelled) { setBeds(Array.isArray(data) ? data : []); } })
      .catch(() => { if (!cancelled) setBeds([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bedType]);

  return (
    <div>
      <label className={cn('text-[10px] font-bold text-gray-500 uppercase mb-1 block flex items-center gap-1')}>
        <Bed size={10} /> {label} <span className="text-red-500">*</span>
      </label>
      {loading ? (
        <div className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-400">
          Chargement des lits disponibles…
        </div>
      ) : beds.length === 0 ? (
        <div className="w-full text-sm border border-amber-200 rounded-lg px-3 py-2 bg-amber-50 text-amber-700">
          ⚠ Aucun lit disponible actuellement
        </div>
      ) : (
        <select
          value={selectedBedId ?? ''}
          onChange={e => {
            const bed = beds.find(b => b.id === e.target.value);
            if (bed) onSelect(bed.id, bed.number);
          }}
          className={cn('w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none', accentClass)}
        >
          <option value="">Sélectionner un lit…</option>
          {beds.map(b => (
            <option key={b.id} value={b.id}>
              {b.number}
              {b.roomNumber ? ` — Chambre ${b.roomNumber}` : ''}
              {b.floorLabel ? ` — ${b.floorLabel}` : ''}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

// ─── Decision options ─────────────────────────────────────────────────────────

const DECISIONS: Array<{
  key: FinalDecisionType;
  label: string;
  icon: React.ReactNode;
  desc: string;
  color: string;
  cls: string;
  selectedCls: string;
}> = [
  { key: 'domicile',              label: 'Retour domicile',        icon: <Home size={22} />,          desc: 'Sortie avec ordonnance et consignes', color: '#22c55e', cls: 'border-green-200 bg-green-50',   selectedCls: 'border-green-500 bg-green-100 ring-green-400' },
  { key: 'hospitalisation',       label: 'Hospitalisation',        icon: <Building2 size={22} />,     desc: 'Admission en service hospitalier',    color: '#3b82f6', cls: 'border-blue-200 bg-blue-50',     selectedCls: 'border-blue-500 bg-blue-100 ring-blue-400' },
  { key: 'reanimation',           label: 'Réanimation / Soins Int',icon: <Heart size={22} />,         desc: 'Transfert unité de réanimation',      color: '#ef4444', cls: 'border-red-200 bg-red-50',       selectedCls: 'border-red-500 bg-red-100 ring-red-400' },
  { key: 'bloc',                  label: 'Bloc opératoire',        icon: <Scissors size={22} />,      desc: 'Intervention chirurgicale urgente',   color: '#8b5cf6', cls: 'border-purple-200 bg-purple-50', selectedCls: 'border-purple-500 bg-purple-100 ring-purple-400' },
  { key: 'transfert',             label: 'Transfert',              icon: <ArrowRightLeft size={22} />,desc: 'Vers autre établissement',            color: '#06b6d4', cls: 'border-cyan-200 bg-cyan-50',     selectedCls: 'border-cyan-500 bg-cyan-100 ring-cyan-400' },
  { key: 'observation_prolongee', label: 'Observation prolongée',  icon: <Eye size={22} />,           desc: 'Maintien en observation urgences',    color: '#f59e0b', cls: 'border-amber-200 bg-amber-50',   selectedCls: 'border-amber-500 bg-amber-100 ring-amber-400' },
  { key: 'deces',                 label: 'Décès',                  icon: <Moon size={22} />,          desc: 'Constatation de décès',               color: '#374151', cls: 'border-gray-300 bg-gray-100',   selectedCls: 'border-gray-600 bg-gray-200 ring-gray-500' },
];

// ─── Per-decision forms ───────────────────────────────────────────────────────

function FormDomicile({ d, u }: { d: FinalDecision; u: (p: Partial<FinalDecision>) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2">
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Ordonnance de sortie</label>
        <textarea rows={3} value={d.ordonnance ?? ''} onChange={e => u({ ordonnance: e.target.value })} placeholder="Médicaments, doses, durée…" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Consignes de retour</label>
        <textarea rows={3} value={d.conseils ?? ''} onChange={e => u({ conseils: e.target.value })} placeholder="Repos, régime, activité physique…" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Signes d'alarme</label>
        <textarea rows={3} value={d.signesAlerte ?? ''} onChange={e => u({ signesAlerte: e.target.value })} placeholder="Reconsulter si…" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Accompagnant</label>
        <input value={d.accompagnant ?? ''} onChange={e => u({ accompagnant: e.target.value })} placeholder="Nom accompagnant" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">RDV de contrôle</label>
        <input type="date" value={d.controlDate ?? ''} onChange={e => u({ controlDate: e.target.value })} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400" />
      </div>
    </div>
  );
}

function FormHospitalisation({ d, u }: { d: FinalDecision; u: (p: Partial<FinalDecision>) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Service d'admission</label>
        <select value={d.ward ?? ''} onChange={e => u({ ward: e.target.value })} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">Sélectionner…</option>
          {['Médecine interne','Cardiologie','Pneumologie','Neurologie','Gastroentérologie','Chirurgie générale','Orthopédie','Pédiatrie','Maternité','Traumatologie'].map(s=><option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Médecin recevant</label>
        <input value={d.doctorName ?? ''} onChange={e => u({ doctorName: e.target.value })} placeholder="Nom du médecin" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>
      <div className="sm:col-span-2">
        <BedSelector
          label="Lit d'hospitalisation"
          bedType="standard"
          selectedBedId={d.bedId}
          onSelect={(bedId, bedNumber) => u({ bedId, bedPlaceholder: bedNumber })}
          accentClass="focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Résumé pour le service</label>
        <textarea rows={4} value={d.medicalSummary ?? ''} onChange={e => u({ medicalSummary: e.target.value })} placeholder="Motif d'admission, diagnostic, traitement en cours, éléments critiques…" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
      </div>
    </div>
  );
}

function FormReanimation({ d, u }: { d: FinalDecision; u: (p: Partial<FinalDecision>) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Motif de réanimation</label>
        <input value={d.icuMotif ?? ''} onChange={e => u({ icuMotif: e.target.value })} placeholder="Défaillance respiratoire, choc…" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Priorité</label>
        <select value={d.icuPriority ?? ''} onChange={e => u({ icuPriority: e.target.value })} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400">
          <option value="">Sélectionner…</option>
          <option>P1 — Immédiat</option><option>P2 — Urgent</option><option>P3 — Semi-urgent</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <BedSelector
          label="Lit de réanimation"
          bedType="soins_intensifs"
          selectedBedId={d.icuBedId}
          onSelect={(bedId, bedNumber) => u({ icuBedId: bedId, icuBed: bedNumber })}
          accentClass="focus:ring-2 focus:ring-red-400"
        />
      </div>
      <div className="flex items-center gap-2 mt-4">
        <input type="checkbox" id="teamNotif" checked={!!d.icuTeamNotified} onChange={e => u({ icuTeamNotified: e.target.checked })} className="rounded" />
        <label htmlFor="teamNotif" className="text-sm text-gray-700">Équipe de réanimation notifiée</label>
      </div>
    </div>
  );
}

function FormBloc({ d, u }: { d: FinalDecision; u: (p: Partial<FinalDecision>) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Intervention</label>
        <input value={d.intervention ?? ''} onChange={e => u({ intervention: e.target.value })} placeholder="Type d'intervention" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Chirurgien</label>
        <input value={d.surgeon ?? ''} onChange={e => u({ surgeon: e.target.value })} placeholder="Dr." className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Anesthésiste</label>
        <input value={d.anesthesist ?? ''} onChange={e => u({ anesthesist: e.target.value })} placeholder="Dr." className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Degré d'urgence</label>
        <select value={d.urgencyDegree ?? ''} onChange={e => u({ urgencyDegree: e.target.value })} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400">
          <option value="">Sélectionner…</option>
          <option>Immédiat ({'<'}30 min)</option><option>Urgent ({'<'}2h)</option><option>Urgent différé ({'<'}8h)</option><option>Semi-urgent</option>
        </select>
      </div>
      <div className="flex items-center gap-2 mt-4">
        <input type="checkbox" id="consent" checked={!!d.consentSigned} onChange={e => u({ consentSigned: e.target.checked })} className="rounded" />
        <label htmlFor="consent" className="text-sm text-gray-700">Consentement signé</label>
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Préparation pré-op</label>
        <input value={d.preOpPrep ?? ''} onChange={e => u({ preOpPrep: e.target.value })} placeholder="À jeun depuis, bilan…" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400" />
      </div>
    </div>
  );
}

function FormTransfert({ d, u }: { d: FinalDecision; u: (p: Partial<FinalDecision>) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Établissement de destination</label>
        <input value={d.destEtablissement ?? ''} onChange={e => u({ destEtablissement: e.target.value })} placeholder="Nom de l'établissement" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Médecin recevant</label>
        <input value={d.destDoctor ?? ''} onChange={e => u({ destDoctor: e.target.value })} placeholder="Contact médecin" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Motif du transfert</label>
        <input value={d.destMotif ?? ''} onChange={e => u({ destMotif: e.target.value })} placeholder="Raison du transfert" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Ambulance / SMUR</label>
        <input value={d.ambulance ?? ''} onChange={e => u({ ambulance: e.target.value })} placeholder="Type et matricule" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400" />
      </div>
    </div>
  );
}

function FormDeces({ d, u }: { d: FinalDecision; u: (p: Partial<FinalDecision>) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Heure du décès</label>
        <input type="datetime-local" value={d.deathTime ?? ''} onChange={e => u({ deathTime: e.target.value })} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Médecin constatant</label>
        <input value={d.declaringDoctor ?? ''} onChange={e => u({ declaringDoctor: e.target.value })} placeholder="Dr." className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Cause présumée</label>
        <input value={d.provisionalCause ?? ''} onChange={e => u({ provisionalCause: e.target.value })} placeholder="Cause présumée du décès" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Famille notifiée</label>
        <input value={d.personNotified ?? ''} onChange={e => u({ personNotified: e.target.value })} placeholder="Nom et lien de parenté" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400" />
      </div>
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function TabDecision() {
  const { dossier, updateDecision, confirmDecision } = useEmergencyDossier();
  const { can } = usePermission();
  const d = dossier.finalDecision;
  const canDecide = can('emergencies.decide');
  const isConfirmed = !!d.decidedAt;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await confirmDecision();
    } finally {
      setIsSubmitting(false);
    }
  };

  const formMap: Partial<Record<NonNullable<FinalDecisionType>, React.FC<{ d: FinalDecision; u: (p: Partial<FinalDecision>) => void }>>> = {
    domicile: FormDomicile,
    hospitalisation: FormHospitalisation,
    reanimation: FormReanimation,
    bloc: FormBloc,
    transfert: FormTransfert,
    deces: FormDeces,
  };

  const ActiveForm = d.decision ? formMap[d.decision] : undefined;

  return (
    <div className="space-y-4">
      {/* Confirmed banner */}
      {isConfirmed && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-green-800 text-sm">Décision confirmée</p>
            <p className="text-[11px] text-green-600">
              {d.decidedBy} — {d.decidedAt ? new Date(d.decidedAt).toLocaleString('fr-DZ') : ''}
            </p>
          </div>
          {!canDecide && <span className="ml-auto text-xs font-bold text-green-700 bg-green-200 px-2 py-1 rounded-full">{d.decision}</span>}
        </div>
      )}

      {/* Decision cards */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Décision médicale</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
          {DECISIONS.map(opt => {
            const selected = d.decision === opt.key;
            return (
              <button
                key={opt.key}
                disabled={!canDecide || isConfirmed}
                onClick={() => updateDecision({ decision: opt.key })}
                className={cn(
                  'border-2 rounded-xl p-3 flex flex-col items-center gap-1.5 text-center transition-all',
                  selected ? opt.selectedCls + ' ring-2 ring-offset-1 shadow-md' : opt.cls,
                  (!canDecide || isConfirmed) ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90 cursor-pointer',
                )}
              >
                <span style={{ color: selected ? opt.color : '#6b7280' }}>{opt.icon}</span>
                <span className={cn('text-[10px] font-bold leading-tight', selected ? 'text-gray-900' : 'text-gray-600')}>{opt.label}</span>
                <span className="text-[9px] text-gray-400 leading-tight">{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Per-decision form */}
      {d.decision && ActiveForm && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
            <span className="text-xs font-semibold text-gray-700">Détails — {DECISIONS.find(o=>o.key===d.decision)?.label}</span>
          </div>
          <div className="p-4">
            <ActiveForm d={d} u={updateDecision} />
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
          <span className="text-xs font-semibold text-gray-700">Commentaires / Motif</span>
        </div>
        <div className="px-4 py-3">
          <textarea
            rows={3}
            disabled={!canDecide || isConfirmed}
            value={d.notes}
            onChange={e => updateDecision({ notes: e.target.value })}
            placeholder="Justification clinique de la décision…"
            className="w-full text-sm text-gray-800 bg-transparent border-0 outline-none resize-none leading-relaxed placeholder:text-gray-300 disabled:opacity-50"
          />
        </div>
      </div>

      {/* Confirm button */}
      {canDecide && !isConfirmed && d.decision && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800 flex-1">
            Confirmer la décision <strong>{DECISIONS.find(o=>o.key===d.decision)?.label}</strong> — cette action enregistre la décision finale et transition le statut du dossier.
          </p>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl px-5 py-2.5 transition-colors flex-shrink-0"
          >
            {isSubmitting
              ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />En cours…</>
              : <><CheckCircle2 size={15} />Confirmer</>
            }
          </button>
        </div>
      )}
    </div>
  );
}
