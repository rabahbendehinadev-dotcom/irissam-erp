import { useState } from 'react';
import { FlaskConical, Scan, PlusCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmergencyDossier } from '@/contexts/EmergencyDossierContext';
import { usePermission } from '@/hooks/usePermission';
import type { LabRequest, ImagingRequest } from '@/types/emergencyDossier';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' });
}

const URG_CLS: Record<string, string> = {
  STAT:    'bg-red-100 text-red-700 border-red-300',
  urgent:  'bg-orange-100 text-orange-700 border-orange-300',
  routine: 'bg-gray-100 text-gray-500 border-gray-200',
};
const LAB_STATUS_CLS: Record<LabRequest['status'], string> = {
  demandee: 'bg-gray-100 text-gray-500 border-gray-200',
  prelevee: 'bg-blue-100 text-blue-700 border-blue-300',
  en_cours: 'bg-amber-100 text-amber-700 border-amber-300',
  validee:  'bg-green-100 text-green-700 border-green-300',
  annulee:  'bg-red-100 text-red-500 border-red-200',
};
const LAB_STATUS_FR: Record<LabRequest['status'], string> = {
  demandee: 'Demandée', prelevee: 'Prélevée', en_cours: 'En cours', validee: 'Validée', annulee: 'Annulée',
};
const IMG_STATUS_CLS: Record<ImagingRequest['status'], string> = {
  demandee:   'bg-gray-100 text-gray-500 border-gray-200',
  planifiee:  'bg-blue-100 text-blue-700 border-blue-300',
  realisee:   'bg-amber-100 text-amber-700 border-amber-300',
  interpretee:'bg-green-100 text-green-700 border-green-300',
  annulee:    'bg-red-100 text-red-500 border-red-200',
};
const IMG_STATUS_FR: Record<ImagingRequest['status'], string> = {
  demandee: 'Demandée', planifiee: 'Planifiée', realisee: 'Réalisée', interpretee: 'Interprétée', annulee: 'Annulée',
};

// ─── Add Lab Form ─────────────────────────────────────────────────────────────

function AddLabForm({ onClose }: { onClose: () => void }) {
  const { addLabRequest } = useEmergencyDossier();
  const [form, setForm] = useState({ test: '', category: 'Biochimie', urgency: 'urgent' as LabRequest['urgency'], laboratory: '' });
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-2 space-y-3">
      <p className="text-xs font-semibold text-blue-700">Nouvelle demande d'analyse</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={form.test} onChange={e => setForm(f=>({...f,test:e.target.value}))} placeholder="Nom de l'analyse*" className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 col-span-full" />
        <select value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
          {['Biochimie','Hématologie','Hémostase','Bactériologie','Immunologie','Hormonologie','Autre'].map(c=><option key={c}>{c}</option>)}
        </select>
        <select value={form.urgency} onChange={e => setForm(f=>({...f,urgency:e.target.value as LabRequest['urgency']}))} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="STAT">STAT (immédiat)</option>
          <option value="urgent">Urgent</option>
          <option value="routine">Routine</option>
        </select>
        <input value={form.laboratory} onChange={e => setForm(f=>({...f,laboratory:e.target.value}))} placeholder="Laboratoire (optionnel)" className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => { if (!form.test.trim()) return; addLabRequest({ test: form.test, category: form.category, urgency: form.urgency, laboratory: form.laboratory || undefined, status: 'demandee' }); onClose(); }} className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 font-semibold">Demander</button>
        <button onClick={onClose} className="text-xs border border-gray-200 hover:border-gray-400 text-gray-600 rounded-lg px-4 py-2">Annuler</button>
      </div>
    </div>
  );
}

// ─── Add Imaging Form ─────────────────────────────────────────────────────────

function AddImagingForm({ onClose }: { onClose: () => void }) {
  const { addImagingRequest } = useEmergencyDossier();
  const [form, setForm] = useState({ exam: '', region: '', side: '', urgency: 'urgent' as ImagingRequest['urgency'], withContrast: false, contraindications: '' });
  return (
    <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 mt-2 space-y-3">
      <p className="text-xs font-semibold text-cyan-700">Nouvelle demande d'imagerie</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={form.exam} onChange={e => setForm(f=>({...f,exam:e.target.value}))} placeholder="Type d'examen*" className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400" />
        <input value={form.region} onChange={e => setForm(f=>({...f,region:e.target.value}))} placeholder="Zone anatomique*" className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400" />
        <input value={form.side} onChange={e => setForm(f=>({...f,side:e.target.value}))} placeholder="Côté (D/G/Bilatéral)" className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400" />
        <select value={form.urgency} onChange={e => setForm(f=>({...f,urgency:e.target.value as ImagingRequest['urgency']}))} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400">
          <option value="STAT">STAT</option><option value="urgent">Urgent</option><option value="routine">Routine</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer col-span-full">
          <input type="checkbox" checked={form.withContrast} onChange={e => setForm(f=>({...f,withContrast:e.target.checked}))} className="rounded" />
          Avec produit de contraste
        </label>
        <input value={form.contraindications} onChange={e => setForm(f=>({...f,contraindications:e.target.value}))} placeholder="Contre-indications" className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400 col-span-full" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => { if (!form.exam.trim() || !form.region.trim()) return; addImagingRequest({ exam: form.exam, region: form.region, side: form.side || undefined, urgency: form.urgency, withContrast: form.withContrast, contraindications: form.contraindications || undefined, status: 'demandee' }); onClose(); }} className="text-xs bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg px-4 py-2 font-semibold">Demander</button>
        <button onClick={onClose} className="text-xs border border-gray-200 hover:border-gray-400 text-gray-600 rounded-lg px-4 py-2">Annuler</button>
      </div>
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function TabOrdres() {
  const { dossier, updateLabStatus, updateImagingStatus } = useEmergencyDossier();
  const { can } = usePermission();
  const [showAddLab, setShowAddLab] = useState(false);
  const [showAddImg, setShowAddImg] = useState(false);
  const [expandedLab, setExpandedLab] = useState<string | null>(null);
  const [expandedImg, setExpandedImg] = useState<string | null>(null);
  const canOrderLab = can('emergencies.order_lab');
  const canOrderImg = can('emergencies.order_imaging');

  return (
    <div className="space-y-4">
      {/* Lab */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <FlaskConical size={14} className="text-green-600" />
            <span className="font-semibold text-gray-800 text-sm">Biologie</span>
            <span className="text-[10px] bg-green-100 text-green-700 border border-green-300 px-1.5 py-0.5 rounded-full font-bold">{dossier.labRequests.length}</span>
            {dossier.labRequests.some(r => r.isCritical && r.status === 'validee') && (
              <span className="text-[10px] bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.5 rounded-full font-bold animate-pulse">⚠ CRITIQUE</span>
            )}
          </div>
          {canOrderLab && (
            <button onClick={() => setShowAddLab(v => !v)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
              <PlusCircle size={13} />Ajouter
            </button>
          )}
        </div>
        {showAddLab && <div className="px-4 pb-2"><AddLabForm onClose={() => setShowAddLab(false)} /></div>}
        {dossier.labRequests.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">Aucune demande de biologie</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {dossier.labRequests.map(r => (
              <div key={r.id} className={cn('px-4 py-3', r.isCritical && r.status === 'validee' ? 'bg-red-50' : '')}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800 text-sm flex-1 truncate">{r.test}</span>
                  <span className="text-[10px] text-gray-400">{r.category}</span>
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border', URG_CLS[r.urgency])}>{r.urgency}</span>
                  <select
                    value={r.status}
                    onChange={e => updateLabStatus(r.id, e.target.value as LabRequest['status'])}
                    className={cn('text-[10px] font-bold px-2 py-0.5 rounded border cursor-pointer', LAB_STATUS_CLS[r.status])}
                  >
                    {(Object.keys(LAB_STATUS_FR) as LabRequest['status'][]).map(s => (
                      <option key={s} value={s}>{LAB_STATUS_FR[s]}</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">{fmtTime(r.requestedAt)}</span>
                  {r.result && (
                    <button onClick={() => setExpandedLab(expandedLab === r.id ? null : r.id)} className="text-[10px] text-green-600 flex items-center gap-0.5">
                      Résultat {expandedLab === r.id ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                    </button>
                  )}
                </div>
                {expandedLab === r.id && r.result && (
                  <div className={cn('mt-2 text-xs rounded-lg px-3 py-2', r.isCritical ? 'bg-red-100 text-red-800 font-semibold border border-red-300' : 'bg-green-50 text-green-800 border border-green-200')}>
                    {r.isCritical && '⚠ RÉSULTAT CRITIQUE — '}{r.result}
                    {r.resultAt && <span className="text-[10px] text-gray-500 ml-2">({fmtTime(r.resultAt)})</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Imaging */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <Scan size={14} className="text-cyan-600" />
            <span className="font-semibold text-gray-800 text-sm">Imagerie</span>
            <span className="text-[10px] bg-cyan-100 text-cyan-700 border border-cyan-300 px-1.5 py-0.5 rounded-full font-bold">{dossier.imagingRequests.length}</span>
          </div>
          {canOrderImg && (
            <button onClick={() => setShowAddImg(v => !v)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
              <PlusCircle size={13} />Ajouter
            </button>
          )}
        </div>
        {showAddImg && <div className="px-4 pb-2"><AddImagingForm onClose={() => setShowAddImg(false)} /></div>}
        {dossier.imagingRequests.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">Aucune demande d'imagerie</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {dossier.imagingRequests.map(r => (
              <div key={r.id} className="px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800 text-sm flex-1 truncate">{r.exam}</span>
                  <span className="text-[10px] text-gray-500">{r.region}{r.side ? ` (${r.side})` : ''}{r.withContrast ? ' · avec contraste' : ''}</span>
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border', URG_CLS[r.urgency])}>{r.urgency}</span>
                  <select
                    value={r.status}
                    onChange={e => updateImagingStatus(r.id, e.target.value as ImagingRequest['status'])}
                    className={cn('text-[10px] font-bold px-2 py-0.5 rounded border cursor-pointer', IMG_STATUS_CLS[r.status])}
                  >
                    {(Object.keys(IMG_STATUS_FR) as ImagingRequest['status'][]).map(s => (
                      <option key={s} value={s}>{IMG_STATUS_FR[s]}</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">{fmtTime(r.requestedAt)}</span>
                  {r.result && (
                    <button onClick={() => setExpandedImg(expandedImg === r.id ? null : r.id)} className="text-[10px] text-green-600 flex items-center gap-0.5">
                      CR {expandedImg === r.id ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                    </button>
                  )}
                </div>
                {r.contraindications && <p className="text-[10px] text-red-600 mt-0.5">CI: {r.contraindications}</p>}
                {expandedImg === r.id && r.result && (
                  <div className="mt-2 text-xs bg-green-50 text-green-800 border border-green-200 rounded-lg px-3 py-2">
                    {r.result}
                    {r.resultAt && <span className="text-[10px] text-gray-500 ml-2">({fmtTime(r.resultAt)})</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
