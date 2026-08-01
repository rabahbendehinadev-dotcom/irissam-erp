import { useState } from 'react';
import {
  Heart, Wind, Thermometer, Droplets, Activity, Brain, Weight,
  Shield, ChevronDown, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmergencyDossier } from '@/contexts/EmergencyDossierContext';
import { ClinicalScores } from './ClinicalScores';
import type { VitalReading, ABCDEItemStatus } from '@/types/emergencyDossier';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' });
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ vals, color = '#3b82f6', w = 72, h = 28 }: { vals: number[]; color?: string; w?: number; h?: number }) {
  if (vals.length < 2) return null;
  const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1, pad = 3;
  const step = w / (vals.length - 1);
  const pts = vals.map((v, i) => `${(i * step).toFixed(1)},${(h - pad - ((v - mn) / rng) * (h - pad * 2)).toFixed(1)}`).join(' ');
  const lx = (vals.length - 1) * step, ly = h - pad - ((vals[vals.length - 1] - mn) / rng) * (h - pad * 2);
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
      <circle cx={lx} cy={ly} r={2.5} fill={color} />
    </svg>
  );
}

// ─── VitalCard ────────────────────────────────────────────────────────────────

function VitalCard({
  label, icon, value, unit, spark, normal, warn, color, accent,
}: {
  label: string; icon: React.ReactNode; value?: number | string; unit: string;
  spark?: number[]; normal: [number, number]; warn: [number, number];
  color: string; accent?: boolean;
}) {
  const numVal = typeof value === 'number' ? value : (typeof value === 'string' ? parseInt(value.split('/')[0], 10) : undefined);
  const status: 'normal' | 'warn' | 'crit' = numVal === undefined ? 'normal'
    : numVal >= normal[0] && numVal <= normal[1] ? 'normal'
    : numVal >= warn[0] && numVal <= warn[1] ? 'warn' : 'crit';
  const statusCls = status === 'normal' ? 'text-green-600 bg-green-50 border-green-200'
    : status === 'warn' ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-red-600 bg-red-50 border-red-200';
  const sparkColor = status === 'crit' ? '#ef4444' : status === 'warn' ? '#f59e0b' : color;

  return (
    <div className={cn('border rounded-xl p-3 flex flex-col gap-1.5', statusCls)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium opacity-70">{icon}<span>{label}</span></div>
        <span className={cn('text-[9px] font-bold uppercase px-1 py-0.5 rounded-full border',
          status === 'normal' ? 'border-green-300 text-green-700' : status === 'warn' ? 'border-amber-300 text-amber-700' : 'border-red-300 text-red-700'
        )}>
          {status === 'normal' ? 'N' : status === 'warn' ? '!' : '⚠'}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <span className="text-xl font-black">{value ?? '—'}</span>
          <span className="text-xs ml-0.5 opacity-60">{unit}</span>
        </div>
        {spark && spark.length >= 2 && <Sparkline vals={spark} color={sparkColor} />}
      </div>
    </div>
  );
}

// ─── Glasgow ──────────────────────────────────────────────────────────────────

const GCS_E = ['','Aucune','À la douleur','À la voix','Spontanée'];
const GCS_V = ['','Aucune','Sons','Mots','Confus','Orienté'];
const GCS_M = ['','Aucune','Extension','Flexion anorm.','Retrait','Localise','Obéit'];

function GlasgowCard() {
  const { dossier } = useEmergencyDossier();
  const g = dossier.glasgowHistory[dossier.glasgowHistory.length - 1];
  if (!g) return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 text-center text-gray-400 text-sm">GCS non évalué</div>
  );
  const total = g.eye + g.verbal + g.motor;
  const sevCls = total >= 13 ? 'text-green-700 bg-green-100 border-green-300' : total >= 9 ? 'text-amber-700 bg-amber-100 border-amber-300' : 'text-red-700 bg-red-100 border-red-300';
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2"><Brain size={13} className="text-purple-600" /><span className="font-semibold text-gray-800 text-sm">Glasgow</span></div>
        <div className="flex items-center gap-2">
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', sevCls)}>{total >= 13 ? 'Léger' : total >= 9 ? 'Modéré' : 'SÉVÈRE'}</span>
          <span className={cn('text-xl font-black', total >= 13 ? 'text-green-600' : total >= 9 ? 'text-amber-600' : 'text-red-600')}>{total}</span>
          <span className="text-xs text-gray-400">/15</span>
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {([['E','Yeux',4,g.eye,GCS_E],['V','Verbale',5,g.verbal,GCS_V],['M','Motrice',6,g.motor,GCS_M]] as const).map(([letter,name,max,val,labels]) => (
          <div key={letter} className="flex items-center px-4 py-2 gap-3">
            <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-black text-xs flex items-center justify-center flex-shrink-0">{letter}</span>
            <span className="text-xs text-gray-600 flex-1">{name}</span>
            <div className="flex gap-0.5">{Array.from({length:max}).map((_,i)=><div key={i} className={cn('h-3.5 w-3.5 rounded-sm border',i<val?'bg-purple-500 border-purple-600':'bg-gray-100 border-gray-200')}/>)}</div>
            <span className="text-xs font-bold text-purple-700 w-4 text-right">{val}</span>
            <span className="text-[10px] text-gray-400 w-24 text-right truncate">{labels[val as number]}</span>
          </div>
        ))}
      </div>
      <div className="px-4 py-1.5 bg-gray-50 border-t border-gray-100 flex justify-between">
        <span className="text-[10px] text-gray-400">Par {g.recordedBy}</span>
        <span className="text-[10px] text-gray-400">{fmtTime(g.recordedAt)}</span>
      </div>
    </div>
  );
}

// ─── Pain Scale ───────────────────────────────────────────────────────────────

function PainScale({ level }: { level: number }) {
  const COLS = ['#22c55e','#4ade80','#a3e635','#facc15','#fbbf24','#fb923c','#f97316','#ef4444','#dc2626','#b91c1c','#991b1b'];
  const desc = level<=2?'Légère':level<=4?'Modérée':level<=6?'Significative':level<=8?'Sévère':'Insupportable';
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2"><Activity size={13} className="text-amber-500" /><span className="font-semibold text-gray-800 text-sm">Douleur EVA</span></div>
        <div className="flex items-center gap-1">
          <span className="text-xl font-black" style={{color:COLS[Math.min(level,10)]}}>{level}</span>
          <span className="text-xs text-gray-400">/10</span>
        </div>
      </div>
      <div className="px-4 py-3">
        <div className="flex gap-0.5 mb-1.5">{Array.from({length:11}).map((_,i)=>(
          <div key={i} className="flex-1" style={{height:20,borderRadius:3,backgroundColor:COLS[i],opacity:i<=level?1:0.2}} />
        ))}</div>
        <p className="text-xs font-semibold text-center" style={{color:COLS[Math.min(level,10)]}}>{desc}</p>
      </div>
    </div>
  );
}

// ─── ABCDE ────────────────────────────────────────────────────────────────────

const STATUS_CLS: Record<ABCDEItemStatus, string> = {
  normal:     'text-green-700 bg-green-100 border-green-300',
  anormal:    'text-red-700 bg-red-100 border-red-300',
  non_evalue: 'text-gray-500 bg-gray-100 border-gray-200',
};
const STATUS_FR: Record<ABCDEItemStatus, string> = { normal: 'Normal', anormal: 'Anormal', non_evalue: 'Non évalué' };

function ABCDECard() {
  const { dossier, updateAbcde } = useEmergencyDossier();
  const a = dossier.currentAbcde;
  const rows = [
    { letter: 'A', name: 'Airway — Voies aériennes', key: 'airway' as const,
      summary: a.airway.detail ?? '', notes: a.airway.notes },
    { letter: 'B', name: 'Breathing — Respiration', key: 'breathing' as const,
      summary: [a.breathing.rate && `${a.breathing.rate}/min`, a.breathing.pattern, a.breathing.spo2 && `SpO₂ ${a.breathing.spo2}%`].filter(Boolean).join(' · '), notes: a.breathing.notes },
    { letter: 'C', name: 'Circulation', key: 'circulation' as const,
      summary: [a.circulation.hr && `FC ${a.circulation.hr}`, a.circulation.bp && `PA ${a.circulation.bp}`, a.circulation.capRefill].filter(Boolean).join(' · '), notes: a.circulation.notes },
    { letter: 'D', name: 'Disability — Neurologie', key: 'disability' as const,
      summary: [a.disability.gcs && `GCS ${a.disability.gcs}/15`, a.disability.pupils, a.disability.glucose && `Glyc. ${a.disability.glucose} mmol/L`].filter(Boolean).join(' · '), notes: a.disability.notes },
    { letter: 'E', name: 'Exposure — Examen général', key: 'exposure' as const,
      summary: [a.exposure.temp && `T° ${a.exposure.temp.toFixed(1)}°C`, a.exposure.findings].filter(Boolean).join(' · '), notes: a.exposure.notes },
  ];
  const cycleStatus = (key: typeof rows[number]['key']) => {
    const order: ABCDEItemStatus[] = ['normal','anormal','non_evalue'];
    const current = a[key].status;
    const next = order[(order.indexOf(current) + 1) % 3];
    updateAbcde({ ...a, [key]: { ...a[key], status: next } });
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <Shield size={13} className="text-blue-600" />
        <span className="font-semibold text-gray-800 text-sm">Évaluation ABCDE</span>
        <span className="ml-auto text-[10px] text-gray-400">{fmtTime(a.recordedAt)} — {a.recordedBy}</span>
      </div>
      <div className="divide-y divide-gray-100">
        {rows.map(r => (
          <div key={r.letter} className="flex items-start gap-3 px-4 py-2.5">
            <button
              onClick={() => cycleStatus(r.key)}
              title="Cliquer pour changer le statut"
              className={cn('w-7 h-7 rounded-full font-black text-sm flex items-center justify-center flex-shrink-0 border cursor-pointer hover:opacity-80 transition-opacity', STATUS_CLS[a[r.key].status])}
            >
              {r.letter}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-700">{r.name}</span>
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border', STATUS_CLS[a[r.key].status])}>
                  {STATUS_FR[a[r.key].status]}
                </span>
                {r.summary && <span className="text-[10px] text-gray-500">{r.summary}</span>}
              </div>
              {r.notes && <p className="text-xs text-gray-500 mt-0.5">{r.notes}</p>}
              {a[r.key].actionImmédiate && (
                <p className="text-[10px] font-semibold text-red-600 mt-0.5">→ {a[r.key].actionImmédiate}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function TabEvaluation() {
  const { dossier, updateClinicalText } = useEmergencyDossier();
  const [histOpen, setHistOpen] = useState(false);
  const reads = dossier.vitalReadings;
  const last = reads[reads.length - 1];
  const pain = last?.painLevel ?? 0;
  const hrVals = reads.map(r => r.hr).filter((v): v is number => v !== undefined);
  const sysVals = reads.map(r => r.sysBP ?? (r.bp ? parseInt(r.bp.split('/')[0], 10) : NaN)).filter(v => !isNaN(v));
  const spo2Vals = reads.map(r => r.spo2).filter((v): v is number => v !== undefined);
  const tempVals = reads.map(r => r.temp).filter((v): v is number => v !== undefined);
  const rrVals = reads.map(r => r.rr).filter((v): v is number => v !== undefined);
  const gcsVals = reads.map(r => r.gcs).filter((v): v is number => v !== undefined);

  return (
    <div className="space-y-4">
      {/* Vitals */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Signes vitaux</h3>
          {last && <span className="text-[10px] text-gray-400">Dernière mesure: {fmtTime(last.timestamp)}</span>}
          <button onClick={() => setHistOpen(o => !o)} className="ml-auto text-[10px] text-blue-600 hover:text-blue-700 flex items-center gap-1">
            Historique {histOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          <VitalCard label="FC" icon={<Heart size={12}/>} value={last?.hr} unit="bpm" spark={hrVals} normal={[60,100]} warn={[50,130]} color="#ef4444" />
          <VitalCard label="PA syst." icon={<Activity size={12}/>} value={last?.sysBP ?? last?.bp?.split('/')[0]} unit="mmHg" spark={sysVals} normal={[90,140]} warn={[80,160]} color="#3b82f6" />
          <VitalCard label="SpO₂" icon={<Droplets size={12}/>} value={last?.spo2} unit="%" spark={spo2Vals} normal={[95,100]} warn={[90,95]} color="#06b6d4" />
          <VitalCard label="T°" icon={<Thermometer size={12}/>} value={last?.temp !== undefined ? last.temp.toFixed(1) : undefined} unit="°C" spark={tempVals} normal={[36.1,37.5]} warn={[35.5,38.5]} color="#f97316" />
          <VitalCard label="FR" icon={<Wind size={12}/>} value={last?.rr} unit="/min" spark={rrVals} normal={[12,20]} warn={[10,28]} color="#10b981" />
          <VitalCard label="GCS" icon={<Brain size={12}/>} value={last?.gcs} unit="/15" spark={gcsVals} normal={[13,15]} warn={[9,12]} color="#8b5cf6" />
        </div>
        {/* Extra vitals row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
          {last?.glucose !== undefined && (
            <VitalCard label="Glycémie" icon={<Activity size={12}/>} value={last.glucose.toFixed(1)} unit="mmol/L" spark={[]} normal={[3.9,6.1]} warn={[2.8,11]} color="#f59e0b" />
          )}
          {last?.weight !== undefined && (
            <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs text-gray-500"><Weight size={12}/>Poids</div>
              <span className="text-xl font-black text-gray-800">{last.weight} <span className="text-xs text-gray-400 font-normal">kg</span></span>
            </div>
          )}
          {last?.height !== undefined && (
            <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs text-gray-500"><Activity size={12}/>Taille</div>
              <span className="text-xl font-black text-gray-800">{last.height} <span className="text-xs text-gray-400 font-normal">cm</span></span>
            </div>
          )}
          {last?.bmi !== undefined && (
            <div className={cn('border rounded-xl p-3 flex flex-col gap-1.5', last.bmi>=30?'bg-amber-50 border-amber-200':'bg-white border-gray-200')}>
              <div className="flex items-center gap-1.5 text-xs text-gray-500"><Activity size={12}/>IMC</div>
              <span className={cn('text-xl font-black', last.bmi>=30?'text-amber-700':'text-gray-800')}>{last.bmi.toFixed(1)}</span>
            </div>
          )}
          {last?.oxygenAdministered && (
            <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs text-cyan-700"><Wind size={12}/>O₂ administré</div>
              <span className="text-xl font-black text-cyan-700">{last.o2Flow ?? '?'} <span className="text-xs font-normal">L/min</span></span>
            </div>
          )}
        </div>

        {/* Vitals history table */}
        {histOpen && reads.length > 1 && (
          <div className="mt-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>{['Heure','FC','PA','SpO₂','T°','FR','GCS','Douleur','Par'].map(h=>(
                    <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...reads].reverse().map(r => (
                    <tr key={r.timestamp} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-500 font-mono text-[10px] whitespace-nowrap">{fmtTime(r.timestamp)}</td>
                      <td className="px-3 py-2">{r.hr ?? '—'}</td>
                      <td className="px-3 py-2">{r.bp ?? '—'}</td>
                      <td className="px-3 py-2">{r.spo2 ?? '—'}%</td>
                      <td className="px-3 py-2">{r.temp?.toFixed(1) ?? '—'}</td>
                      <td className="px-3 py-2">{r.rr ?? '—'}</td>
                      <td className="px-3 py-2">{r.gcs ?? '—'}</td>
                      <td className="px-3 py-2">{r.painLevel ?? '—'}/10</td>
                      <td className="px-3 py-2 text-gray-400 text-[10px]">{r.recordedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Scores */}
      <section>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Scores automatiques</h3>
        <ClinicalScores readings={reads} />
      </section>

      {/* Glasgow + Pain */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <GlasgowCard />
        <PainScale level={pain} />
      </div>

      {/* ABCDE */}
      <ABCDECard />

      {/* Clinical text */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {[
          { key: 'chiefComplaint' as const, label: 'Motif principal' },
          { key: 'illnessHistory' as const, label: 'Histoire de la maladie' },
        ].map(({ key, label }) => (
          <div key={key} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <span className="text-xs font-semibold text-gray-700">{label}</span>
            </div>
            <div className="px-4 py-3">
              <textarea
                rows={4}
                defaultValue={dossier[key]}
                onBlur={e => updateClinicalText(key, e.target.value)}
                className="w-full text-sm text-gray-800 bg-transparent border-0 outline-none resize-none leading-relaxed placeholder:text-gray-300"
                placeholder="À documenter…"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
