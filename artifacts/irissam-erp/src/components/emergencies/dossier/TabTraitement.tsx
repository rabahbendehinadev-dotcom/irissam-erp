import { useState } from 'react';
import { Pill, Activity, PlusCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmergencyDossier } from '@/contexts/EmergencyDossierContext';
import { usePermission } from '@/hooks/usePermission';
import type { Prescription, Procedure } from '@/types/emergencyDossier';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' });
}

const RX_STATUS_CFG: Record<Prescription['status'], { label: string; cls: string }> = {
  prescrit:   { label: 'Prescrit',   cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  prepare:    { label: 'Préparé',    cls: 'bg-purple-100 text-purple-700 border-purple-300' },
  administre: { label: 'Administré', cls: 'bg-green-100 text-green-700 border-green-300' },
  refuse:     { label: 'Refusé',     cls: 'bg-red-100 text-red-700 border-red-300' },
  retard:     { label: 'Retard',     cls: 'bg-amber-100 text-amber-700 border-amber-300' },
  annule:     { label: 'Annulé',     cls: 'bg-gray-100 text-gray-400 border-gray-200 line-through' },
};

const PROC_CAT_FR: Record<Procedure['category'], string> = {
  oxygene: 'Oxygène', perfusion: 'Perfusion', injection: 'Injection', pansement: 'Pansement',
  suture: 'Suture', immobilisation: 'Immobilisation', catheter: 'Cathéter', reanimation: 'Réanimation', autre: 'Autre',
};
const PROC_CAT_CLS: Record<Procedure['category'], string> = {
  oxygene: 'bg-cyan-100 text-cyan-700 border-cyan-200', perfusion: 'bg-blue-100 text-blue-700 border-blue-200',
  injection: 'bg-purple-100 text-purple-700 border-purple-200', pansement: 'bg-amber-100 text-amber-700 border-amber-200',
  suture: 'bg-orange-100 text-orange-700 border-orange-200', immobilisation: 'bg-teal-100 text-teal-700 border-teal-200',
  catheter: 'bg-indigo-100 text-indigo-700 border-indigo-200', reanimation: 'bg-red-100 text-red-700 border-red-200',
  autre: 'bg-gray-100 text-gray-500 border-gray-200',
};

const ROUTE_LABELS: Record<Prescription['route'], string> = {
  IV: 'IV', IM: 'IM', PO: 'PO', SC: 'SC', SL: 'SL', Inhalé: 'INH', Topique: 'TOP', Nasal: 'NAS',
};

// ─── Add Prescription Form ────────────────────────────────────────────────────

function AddRxForm({ onClose }: { onClose: () => void }) {
  const { addPrescription } = useEmergencyDossier();
  const [form, setForm] = useState({
    drug: '', dosage: '', route: 'IV' as Prescription['route'],
    frequency: '', duration: '', comment: '', scheduledAt: '',
  });
  const submit = () => {
    if (!form.drug.trim() || !form.dosage.trim()) return;
    addPrescription({ ...form, duration: form.duration || undefined, comment: form.comment || undefined, scheduledAt: form.scheduledAt || undefined });
    onClose();
  };
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-blue-700">Nouvelle prescription</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={form.drug} onChange={e => setForm(f=>({...f,drug:e.target.value}))} placeholder="Médicament*" className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 sm:col-span-2" />
        <input value={form.dosage} onChange={e => setForm(f=>({...f,dosage:e.target.value}))} placeholder="Dose* (ex: 500 mg)" className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <select value={form.route} onChange={e => setForm(f=>({...f,route:e.target.value as Prescription['route']}))} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
          {(Object.keys(ROUTE_LABELS) as Prescription['route'][]).map(r => <option key={r} value={r}>{ROUTE_LABELS[r]} — {r}</option>)}
        </select>
        <input value={form.frequency} onChange={e => setForm(f=>({...f,frequency:e.target.value}))} placeholder="Fréquence (ex: toutes les 6h)*" className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <input value={form.duration} onChange={e => setForm(f=>({...f,duration:e.target.value}))} placeholder="Durée (optionnel)" className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <input value={form.comment} onChange={e => setForm(f=>({...f,comment:e.target.value}))} placeholder="Commentaire / protocole" className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 sm:col-span-2" />
      </div>
      <div className="flex gap-2">
        <button onClick={submit} className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 font-semibold">Prescrire</button>
        <button onClick={onClose} className="text-xs border border-gray-200 hover:border-gray-400 text-gray-600 rounded-lg px-4 py-2">Annuler</button>
      </div>
    </div>
  );
}

// ─── Add Procedure Form ───────────────────────────────────────────────────────

function AddProcForm({ onClose }: { onClose: () => void }) {
  const { addProcedure } = useEmergencyDossier();
  const [form, setForm] = useState({ name: '', category: 'autre' as Procedure['category'], result: '', notes: '' });
  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-indigo-700">Nouvelle procédure</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Nom de la procédure*" className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:col-span-2" />
        <select value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value as Procedure['category']}))} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400">
          {(Object.keys(PROC_CAT_FR) as Procedure['category'][]).map(c => <option key={c} value={c}>{PROC_CAT_FR[c]}</option>)}
        </select>
        <input value={form.result} onChange={e => setForm(f=>({...f,result:e.target.value}))} placeholder="Résultat (optionnel)" className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <input value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Notes" className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:col-span-2" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => { if (!form.name.trim()) return; addProcedure({ ...form, result: form.result || undefined, notes: form.notes || undefined }); onClose(); }} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 font-semibold">Enregistrer</button>
        <button onClick={onClose} className="text-xs border border-gray-200 hover:border-gray-400 text-gray-600 rounded-lg px-4 py-2">Annuler</button>
      </div>
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function TabTraitement() {
  const { dossier, updatePrescriptionStatus } = useEmergencyDossier();
  const { can } = usePermission();
  const [showAddRx, setShowAddRx] = useState(false);
  const [showAddProc, setShowAddProc] = useState(false);
  const canPrescribe = can('emergencies.prescribe');
  const canAdminister = can('emergencies.administer_medication');

  const pending = dossier.prescriptions.filter(p => p.status === 'prescrit' || p.status === 'prepare');
  const done    = dossier.prescriptions.filter(p => p.status === 'administre' || p.status === 'annule' || p.status === 'refuse');

  return (
    <div className="space-y-4">
      {/* Prescriptions */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <Pill size={14} className="text-blue-600" />
            <span className="font-semibold text-gray-800 text-sm">Prescriptions</span>
            <span className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full font-bold">{dossier.prescriptions.length}</span>
            {pending.length > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full font-bold">{pending.length} en attente</span>
            )}
          </div>
          {canPrescribe && (
            <button onClick={() => setShowAddRx(v => !v)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
              <PlusCircle size={13} />Prescrire
            </button>
          )}
        </div>
        {showAddRx && <div className="px-4 pb-3 pt-2"><AddRxForm onClose={() => setShowAddRx(false)} /></div>}

        {dossier.prescriptions.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">Aucune prescription</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {dossier.prescriptions.map(rx => {
              const cfg = RX_STATUS_CFG[rx.status];
              const isActive = rx.status === 'prescrit' || rx.status === 'prepare';
              return (
                <div key={rx.id} className={cn('px-4 py-3', !isActive ? 'opacity-60' : '')}>
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className={cn('mt-0.5 w-2 h-2 rounded-full flex-shrink-0', isActive ? 'bg-blue-500' : 'bg-gray-300')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('font-bold text-sm text-gray-800', rx.status === 'annule' ? 'line-through text-gray-400' : '')}>
                          {rx.drug}
                        </span>
                        <span className="text-xs font-bold text-gray-600">{rx.dosage}</span>
                        <span className="text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200 px-1.5 py-0.5 rounded">{ROUTE_LABELS[rx.route]}</span>
                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border', cfg.cls)}>{cfg.label}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {rx.frequency}{rx.duration && ` · ${rx.duration}`}
                        {rx.comment && <span className="ml-2 italic text-gray-400">{rx.comment}</span>}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>Prescrit par {rx.prescribedBy} à {fmtTime(rx.prescribedAt)}</span>
                        {rx.administeredAt && <span>· Administré par {rx.administeredBy ?? '—'} à {fmtTime(rx.administeredAt)}</span>}
                      </div>
                    </div>
                    {canAdminister && isActive && (
                      <button
                        onClick={() => updatePrescriptionStatus(rx.id, 'administre', new Date().toISOString(), '')}
                        className="flex items-center gap-1 text-[10px] text-green-600 hover:text-green-700 border border-green-300 hover:border-green-500 bg-green-50 hover:bg-green-100 rounded-lg px-2 py-1 font-semibold transition-colors flex-shrink-0"
                      >
                        <CheckCircle2 size={11} />Administré
                      </button>
                    )}
                    {canAdminister && isActive && (
                      <select
                        value={rx.status}
                        onChange={e => updatePrescriptionStatus(rx.id, e.target.value as Prescription['status'])}
                        className="text-[10px] border border-gray-200 rounded px-1.5 py-1 text-gray-600 flex-shrink-0"
                      >
                        {(Object.keys(RX_STATUS_CFG) as Prescription['status'][]).map(s => (
                          <option key={s} value={s}>{RX_STATUS_CFG[s].label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Procedures */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-indigo-600" />
            <span className="font-semibold text-gray-800 text-sm">Procédures</span>
            <span className="text-[10px] bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full font-bold">{dossier.procedures.length}</span>
          </div>
          {canAdminister && (
            <button onClick={() => setShowAddProc(v => !v)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
              <PlusCircle size={13} />Ajouter
            </button>
          )}
        </div>
        {showAddProc && <div className="px-4 pb-3 pt-2"><AddProcForm onClose={() => setShowAddProc(false)} /></div>}
        {dossier.procedures.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">Aucune procédure enregistrée</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {dossier.procedures.map(p => (
              <div key={p.id} className="px-4 py-3 flex items-start gap-3">
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border mt-0.5 flex-shrink-0', PROC_CAT_CLS[p.category])}>
                  {PROC_CAT_FR[p.category]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800">{p.name}</p>
                  {p.result && <p className="text-xs text-green-700 mt-0.5">{p.result}</p>}
                  {p.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{p.notes}</p>}
                  <p className="text-[10px] text-gray-400 mt-0.5">Par {p.performedBy} à {fmtTime(p.performedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
