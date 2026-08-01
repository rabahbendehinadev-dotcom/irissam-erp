import { useState } from 'react';
import { Eye, Heart, Wind, Activity, PlusCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmergencyDossier } from '@/contexts/EmergencyDossierContext';
import { usePermission } from '@/hooks/usePermission';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' });
}

// ─── Mini SVG chart ───────────────────────────────────────────────────────────

function MiniChart({ vals, label, unit, color, normalMin, normalMax }: {
  vals: { time: string; val: number }[];
  label: string; unit: string; color: string; normalMin: number; normalMax: number;
}) {
  if (vals.length < 2) return null;
  const w = 220, h = 64, pad = 8;
  const mn = Math.min(...vals.map(v => v.val), normalMin);
  const mx = Math.max(...vals.map(v => v.val), normalMax);
  const rng = mx - mn || 1;
  const step = (w - pad * 2) / (vals.length - 1);

  const toY = (v: number) => pad + (h - pad * 2) * (1 - (v - mn) / rng);
  const pts = vals.map((v, i) => `${(pad + i * step).toFixed(1)},${toY(v.val).toFixed(1)}`).join(' ');
  const last = vals[vals.length - 1];
  const lx = pad + (vals.length - 1) * step;
  const ly = toY(last.val);

  // Normal range band
  const bandTop    = toY(normalMax);
  const bandBottom = toY(normalMin);
  const bandHeight = bandBottom - bandTop;

  const isAbnormal = last.val < normalMin || last.val > normalMax;

  return (
    <div className={cn('bg-white border rounded-xl p-3 flex flex-col gap-1.5', isAbnormal ? 'border-red-200 bg-red-50/40' : 'border-gray-200')}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <span className={cn('text-sm font-black', isAbnormal ? 'text-red-600' : 'text-gray-800')}>
          {last.val}<span className="text-[10px] text-gray-400 font-normal ml-0.5">{unit}</span>
        </span>
      </div>
      <svg width={w} height={h} className="overflow-visible" role="img">
        {/* Normal band */}
        <rect x={pad} y={bandTop} width={w - pad * 2} height={bandHeight} fill={color} opacity={0.08} />
        <line x1={pad} y1={bandTop}    x2={w - pad} y2={bandTop}    stroke={color} strokeWidth={0.5} opacity={0.3} strokeDasharray="3,2" />
        <line x1={pad} y1={bandBottom} x2={w - pad} y2={bandBottom} stroke={color} strokeWidth={0.5} opacity={0.3} strokeDasharray="3,2" />
        {/* Line */}
        <polyline points={pts} fill="none" stroke={isAbnormal ? '#ef4444' : color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {vals.map((v, i) => (
          <circle key={i} cx={pad + i * step} cy={toY(v.val)} r={2} fill={i === vals.length - 1 ? (isAbnormal ? '#ef4444' : color) : '#fff'} stroke={isAbnormal ? '#ef4444' : color} strokeWidth={1.5} />
        ))}
        {/* Last value label */}
        <text x={lx + 4} y={ly + 4} fontSize={8} fill={isAbnormal ? '#dc2626' : '#6b7280'}>{last.val}</text>
      </svg>
      <div className="flex justify-between text-[9px] text-gray-400">
        <span>{fmtTime(vals[0].time)}</span>
        <span>{fmtTime(last.time)}</span>
      </div>
    </div>
  );
}

// ─── Start observation form ───────────────────────────────────────────────────

function StartObsForm({ onClose }: { onClose: () => void }) {
  const { startObservation } = useEmergencyDossier();
  const [form, setForm] = useState({
    motif: '', frequency: 'Toutes les 30 min',
    responsibleDoctor: '', responsibleNurse: '',
  });
  return (
    <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 space-y-3 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Eye size={16} className="text-teal-600" />
        <p className="font-bold text-teal-700">Mettre en observation</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={form.motif} onChange={e => setForm(f=>({...f,motif:e.target.value}))} placeholder="Motif d'observation*" className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400 sm:col-span-2" />
        <select value={form.frequency} onChange={e => setForm(f=>({...f,frequency:e.target.value}))} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400 sm:col-span-2">
          {['Toutes les 15 min','Toutes les 30 min','Toutes les heures','Toutes les 2h','Toutes les 4h'].map(o=><option key={o}>{o}</option>)}
        </select>
        <input value={form.responsibleDoctor} onChange={e => setForm(f=>({...f,responsibleDoctor:e.target.value}))} placeholder="Médecin responsable*" className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400" />
        <input value={form.responsibleNurse} onChange={e => setForm(f=>({...f,responsibleNurse:e.target.value}))} placeholder="Infirmier responsable*" className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400" />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => {
            if (!form.motif.trim() || !form.responsibleDoctor.trim()) return;
            startObservation({ motif: form.motif, frequency: form.frequency, responsibleDoctor: form.responsibleDoctor, responsibleNurse: form.responsibleNurse, startedAt: new Date().toISOString() });
            onClose();
          }}
          className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-4 py-2 font-semibold"
        >
          Démarrer l'observation
        </button>
        <button onClick={onClose} className="text-xs border border-gray-200 text-gray-600 hover:border-gray-400 rounded-lg px-4 py-2">Annuler</button>
      </div>
    </div>
  );
}

// ─── Add vitals form ──────────────────────────────────────────────────────────

function AddObsReading({ onClose }: { onClose: () => void }) {
  const { addObservationReading } = useEmergencyDossier();
  const [form, setForm] = useState({ hr: '', sysBP: '', diasBP: '', spo2: '', temp: '', rr: '', gcs: '', painLevel: '', glucose: '' });
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-gray-700">Saisie constantes</p>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {([['hr','FC (bpm)'],['sysBP','PAS (mmHg)'],['diasBP','PAD (mmHg)'],['spo2','SpO₂ (%)'],['temp','T° (°C)'],['rr','FR (/min)'],['gcs','GCS /15'],['painLevel','Douleur /10'],['glucose','Glyc. (mmol/L)']] as const).map(([k,lbl])=>(
          <div key={k}>
            <label className="text-[10px] text-gray-500 block mb-0.5">{lbl}</label>
            <input
              type="number" step="0.1"
              value={form[k]}
              onChange={e => setForm(f=>({...f,[k]:e.target.value}))}
              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => {
            const r: Record<string, number> = {};
            Object.entries(form).forEach(([k, v]) => { if (v !== '') r[k] = parseFloat(v); });
            addObservationReading({ ...r, recordedBy: 'Infirmier(e)' } as Parameters<typeof addObservationReading>[0]);
            onClose();
          }}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 font-semibold"
        >
          Enregistrer
        </button>
        <button onClick={onClose} className="text-xs border border-gray-200 text-gray-600 hover:border-gray-400 rounded-lg px-4 py-2">Annuler</button>
      </div>
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function TabObservation() {
  const { dossier } = useEmergencyDossier();
  const { can } = usePermission();
  const [showStart, setShowStart] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const obs = dossier.observation;
  const reads = obs ? obs.readings : dossier.vitalReadings;
  const canAdminister = can('emergencies.administer_medication') || can('emergencies.update');

  if (!obs && !showStart) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Eye size={40} className="text-gray-200" />
        <p className="text-sm text-gray-500">Aucune session d'observation active</p>
        {canAdminister && (
          <button
            onClick={() => setShowStart(true)}
            className="flex items-center gap-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-5 py-2.5 font-semibold"
          >
            <Eye size={15} />Démarrer une observation
          </button>
        )}
        {reads.length > 0 && (
          <p className="text-xs text-gray-400">Les constantes enregistrées sur les autres onglets sont visibles dans les graphes ci-dessous.</p>
        )}
        {reads.length > 0 && <VitalsCharts reads={reads} />}
      </div>
    );
  }

  if (!obs && showStart) {
    return (
      <div className="py-8">
        <StartObsForm onClose={() => setShowStart(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Obs header */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Eye size={14} className="text-teal-600" />
          <span className="font-semibold text-teal-700 text-sm">Observation en cours</span>
          <span className="text-[10px] text-teal-600">Motif: {obs!.motif}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-teal-700 flex-wrap">
          <span className="flex items-center gap-1"><Clock size={9} />Depuis {fmtTime(obs!.startedAt)}</span>
          <span>Fréquence: {obs!.frequency}</span>
          <span>Dr. {obs!.responsibleDoctor}</span>
          <span>Inf. {obs!.responsibleNurse}</span>
        </div>
        {canAdminister && (
          <button onClick={() => setShowAdd(v => !v)} className="flex items-center gap-1 text-xs text-teal-700 hover:text-teal-900 font-medium border border-teal-300 hover:border-teal-500 rounded-lg px-2.5 py-1.5 transition-colors">
            <PlusCircle size={12} />Saisir constantes
          </button>
        )}
      </div>

      {showAdd && <AddObsReading onClose={() => setShowAdd(false)} />}

      {/* Charts */}
      <VitalsCharts reads={reads} />

      {/* Table */}
      {reads.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <p className="px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
            Tableau des constantes ({reads.length} mesures)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Heure','FC','PAS','PAD','SpO₂','T°','FR','GCS','Douleur','Par'].map(h=>(
                  <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...reads].reverse().map(r => (
                  <tr key={r.timestamp} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-[10px] text-gray-500 whitespace-nowrap">{fmtTime(r.timestamp)}</td>
                    <td className="px-3 py-2">{r.hr ?? '—'}</td>
                    <td className="px-3 py-2">{r.sysBP ?? '—'}</td>
                    <td className="px-3 py-2">{r.diasBP ?? '—'}</td>
                    <td className="px-3 py-2">{r.spo2 ?? '—'}%</td>
                    <td className="px-3 py-2">{r.temp?.toFixed(1) ?? '—'}</td>
                    <td className="px-3 py-2">{r.rr ?? '—'}</td>
                    <td className="px-3 py-2">{r.gcs ?? '—'}</td>
                    <td className="px-3 py-2">{r.painLevel ?? '—'}/10</td>
                    <td className="px-3 py-2 text-[10px] text-gray-400">{r.recordedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Vitals charts ────────────────────────────────────────────────────────────

function VitalsCharts({ reads }: { reads: ReturnType<typeof useEmergencyDossier>['dossier']['vitalReadings'] }) {
  const makeVals = (key: keyof typeof reads[0]) =>
    reads.filter(r => r[key] !== undefined).map(r => ({ time: r.timestamp, val: r[key] as number }));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      <MiniChart label="Fréquence cardiaque" unit="bpm" color="#ef4444" normalMin={60} normalMax={100} vals={makeVals('hr')} />
      <MiniChart label="PA systolique" unit="mmHg" color="#3b82f6" normalMin={90} normalMax={140} vals={makeVals('sysBP')} />
      <MiniChart label="SpO₂" unit="%" color="#06b6d4" normalMin={95} normalMax={100} vals={makeVals('spo2')} />
      <MiniChart label="Température" unit="°C" color="#f97316" normalMin={36.1} normalMax={37.5} vals={makeVals('temp')} />
      <MiniChart label="Fréquence respiratoire" unit="/min" color="#10b981" normalMin={12} normalMax={20} vals={makeVals('rr')} />
      <MiniChart label="Glasgow" unit="/15" color="#8b5cf6" normalMin={13} normalMax={15} vals={makeVals('gcs')} />
    </div>
  );
}
