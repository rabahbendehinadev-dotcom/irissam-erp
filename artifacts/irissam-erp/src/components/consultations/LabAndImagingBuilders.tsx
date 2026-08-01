import { useState } from 'react';
import { Plus, Trash2, FlaskConical, Scan, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LabOrder, LabOrderStatus, ImagingOrder, ImagingOrderStatus } from '@/types/consultation';

// ─────────────────────────────────────────────────────────────────────────────
// LAB ORDER BUILDER
// ─────────────────────────────────────────────────────────────────────────────

const LAB_TYPES = [
  'NFS (Numération Formule Sanguine)',
  'CRP (Protéine C-Réactive)',
  'NFS + CRP',
  'Bilan hépatique (ASAT, ALAT, GGT, PAL)',
  'Bilan rénal (Urée, Créatinine)',
  'Glycémie à jeun',
  'HbA1c',
  'Bilan lipidique (CT, TG, HDL, LDL)',
  'Coagulation (TP, TCA)',
  'Ionogramme sanguin',
  'TSH (Thyroïde)',
  'Uricémie',
  'Marqueurs cardiaques (Troponine, BNP)',
  'D-Dimères',
  'Hémoculture',
  'ECBU (Examen cytobactériologique des urines)',
  'Sérologie VIH',
  'Groupage sanguin + Rhésus',
  'Ferritine + Fer sérique',
  'Examen parasitologique des selles',
];

const LAB_STATUS_MAP: Record<LabOrderStatus, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon',  cls: 'bg-gray-100 text-gray-600' },
  demandee:  { label: 'Demandée',   cls: 'bg-blue-100 text-blue-700' },
  prelevee:  { label: 'Prélevée',   cls: 'bg-yellow-100 text-yellow-700' },
  en_cours:  { label: 'En cours',   cls: 'bg-purple-100 text-purple-700' },
  validee:   { label: 'Validée',    cls: 'bg-green-100 text-green-700' },
  annulee:   { label: 'Annulée',    cls: 'bg-red-100 text-red-600' },
};

const SEL = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white';
const INP = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20';

interface LabProps {
  orders: LabOrder[];
  onChange: (o: LabOrder[]) => void;
  readOnly?: boolean;
}

export function LabOrderBuilder({ orders, onChange, readOnly = false }: LabProps) {
  const [labSearch, setLabSearch] = useState<Record<number, string>>({});

  const add = () => onChange([...orders, {
    id: `lab-new-${Date.now()}`,
    analysisType: '', priority: 'normale', laboratory: 'Laboratoire Central',
    clinicalReason: '', fastingRequired: false, status: 'brouillon',
  }]);
  const update = (i: number, o: LabOrder) => onChange(orders.map((x, j) => j === i ? o : x));
  const remove = (i: number) => onChange(orders.filter((_, j) => j !== i));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical size={16} className="text-teal-600" />
          <div>
            <h4 className="font-semibold text-gray-800 text-sm">Demandes d'analyses</h4>
            <p className="text-xs text-gray-500">{orders.length} analyse{orders.length !== 1 ? 's' : ''} demandée{orders.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {!readOnly && (
          <button onClick={add} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            <Plus size={14} /> Ajouter une analyse
          </button>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <FlaskConical size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aucune analyse demandée</p>
          {!readOnly && <button onClick={add} className="text-sm text-teal-600 hover:underline mt-1">+ Ajouter une analyse</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o, i) => {
            const search = labSearch[i] ?? '';
            const results = search.length > 1
              ? LAB_TYPES.filter(t => t.toLowerCase().includes(search.toLowerCase())).slice(0, 5)
              : [];
            return (
              <div key={o.id} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', LAB_STATUS_MAP[o.status].cls)}>
                    {LAB_STATUS_MAP[o.status].label}
                  </span>
                  {!readOnly && (
                    <button onClick={() => remove(i)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                      <Trash2 size={13} /> Supprimer
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="relative sm:col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Type d'analyse *</label>
                    <input
                      type="text"
                      value={search || o.analysisType}
                      onChange={e => { setLabSearch(p => ({ ...p, [i]: e.target.value })); update(i, { ...o, analysisType: e.target.value }); }}
                      disabled={readOnly}
                      placeholder="NFS, glycémie, troponine…"
                      className={INP}
                    />
                    {results.length > 0 && (
                      <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        {results.map(r => (
                          <button key={r} className="w-full px-3 py-2 text-sm hover:bg-teal-50 text-left"
                            onClick={() => { update(i, { ...o, analysisType: r }); setLabSearch(p => ({ ...p, [i]: '' })); }}>
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Priorité</label>
                    <select value={o.priority} onChange={e => update(i, { ...o, priority: e.target.value as LabOrder['priority'] })} disabled={readOnly} className={SEL}>
                      <option value="normale">Normale</option>
                      <option value="urgente">Urgente</option>
                      <option value="tres_urgente">Très urgente</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Laboratoire</label>
                    <input type="text" value={o.laboratory} onChange={e => update(i, { ...o, laboratory: e.target.value })} disabled={readOnly} className={INP} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Date souhaitée</label>
                    <input type="date" value={o.requestedDate ?? ''} onChange={e => update(i, { ...o, requestedDate: e.target.value })} disabled={readOnly} className={INP} />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Motif clinique *</label>
                  <input type="text" value={o.clinicalReason} onChange={e => update(i, { ...o, clinicalReason: e.target.value })} disabled={readOnly} placeholder="Indication clinique…" className={INP} />
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={o.fastingRequired} onChange={e => update(i, { ...o, fastingRequired: e.target.checked })} disabled={readOnly}
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                  Jeûne requis
                </label>

                {o.priority !== 'normale' && (
                  <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    <AlertCircle size={13} /> Analyse {o.priority === 'urgente' ? 'urgente' : 'très urgente'} — traitement prioritaire au laboratoire
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGING ORDER BUILDER
// ─────────────────────────────────────────────────────────────────────────────

const EXAM_TYPES = ['Radiographie', 'Échographie', 'Scanner (TDM)', 'IRM', 'Mammographie', 'Ostéodensitométrie (DXA)', 'Scintigraphie', 'Artériographie', 'Fibroscopie', 'Écho-Doppler'];
const ZONES = ['Thorax', 'Abdomen', 'Pelvis', 'Rachis cervical', 'Rachis lombaire', 'Membres supérieurs', 'Membres inférieurs', 'Crâne', 'Sinus', 'Cœur', 'Vaisseaux', 'Corps entier'];
const IMG_SERVICES = ['Radiologie', 'Imagerie IRM', 'Scanner', 'Échographie', 'Médecine nucléaire'];

const IMG_STATUS_MAP: Record<ImagingOrderStatus, { label: string; cls: string }> = {
  brouillon:  { label: 'Brouillon',   cls: 'bg-gray-100 text-gray-600' },
  demandee:   { label: 'Demandée',    cls: 'bg-blue-100 text-blue-700' },
  planifiee:  { label: 'Planifiée',   cls: 'bg-yellow-100 text-yellow-700' },
  realisee:   { label: 'Réalisée',    cls: 'bg-purple-100 text-purple-700' },
  interpretee:{ label: 'Interprétée', cls: 'bg-green-100 text-green-700' },
  annulee:    { label: 'Annulée',     cls: 'bg-red-100 text-red-600' },
};

interface ImgProps {
  orders: ImagingOrder[];
  onChange: (o: ImagingOrder[]) => void;
  readOnly?: boolean;
}

export function ImagingOrderBuilder({ orders, onChange, readOnly = false }: ImgProps) {
  const add = () => onChange([...orders, {
    id: `img-new-${Date.now()}`,
    examType: '', anatomicZone: '', priority: 'normale',
    imagingService: 'Radiologie', clinicalReason: '',
    withContrast: false, status: 'brouillon',
  }]);
  const update = (i: number, o: ImagingOrder) => onChange(orders.map((x, j) => j === i ? o : x));
  const remove = (i: number) => onChange(orders.filter((_, j) => j !== i));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scan size={16} className="text-cyan-600" />
          <div>
            <h4 className="font-semibold text-gray-800 text-sm">Demandes d'imagerie</h4>
            <p className="text-xs text-gray-500">{orders.length} examen{orders.length !== 1 ? 's' : ''} demandé{orders.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {!readOnly && (
          <button onClick={add} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700">
            <Plus size={14} /> Ajouter un examen
          </button>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Scan size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aucun examen d'imagerie demandé</p>
          {!readOnly && <button onClick={add} className="text-sm text-cyan-600 hover:underline mt-1">+ Ajouter un examen</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o, i) => (
            <div key={o.id} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', IMG_STATUS_MAP[o.status].cls)}>
                  {IMG_STATUS_MAP[o.status].label}
                </span>
                {!readOnly && (
                  <button onClick={() => remove(i)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                    <Trash2 size={13} /> Supprimer
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Type d'examen *</label>
                  <select value={o.examType} onChange={e => update(i, { ...o, examType: e.target.value })} disabled={readOnly} className={SEL}>
                    <option value="">Sélectionner…</option>
                    {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Zone anatomique *</label>
                  <select value={o.anatomicZone} onChange={e => update(i, { ...o, anatomicZone: e.target.value })} disabled={readOnly} className={SEL}>
                    <option value="">Sélectionner…</option>
                    {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Priorité</label>
                  <select value={o.priority} onChange={e => update(i, { ...o, priority: e.target.value as ImagingOrder['priority'] })} disabled={readOnly} className={SEL}>
                    <option value="normale">Normale</option>
                    <option value="urgente">Urgente</option>
                    <option value="tres_urgente">Très urgente</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Service d'imagerie</label>
                  <select value={o.imagingService} onChange={e => update(i, { ...o, imagingService: e.target.value })} disabled={readOnly} className={SEL}>
                    {IMG_SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Date souhaitée</label>
                  <input type="date" value={o.requestedDate ?? ''} onChange={e => update(i, { ...o, requestedDate: e.target.value })} disabled={readOnly} className={INP} />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Motif clinique *</label>
                <input type="text" value={o.clinicalReason} onChange={e => update(i, { ...o, clinicalReason: e.target.value })} disabled={readOnly} placeholder="Indication clinique…" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Question clinique</label>
                <input type="text" value={o.clinicalQuestion ?? ''} onChange={e => update(i, { ...o, clinicalQuestion: e.target.value })} disabled={readOnly} placeholder="Que recherchez-vous ?" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Contre-indications</label>
                <input type="text" value={o.contraindications ?? ''} onChange={e => update(i, { ...o, contraindications: e.target.value })} disabled={readOnly} placeholder="Allergies au produit de contraste, claustrophobie…" className={INP} />
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={o.withContrast} onChange={e => update(i, { ...o, withContrast: e.target.checked })} disabled={readOnly}
                  className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
                Avec produit de contraste
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
