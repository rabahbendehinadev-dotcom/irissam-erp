import { useMemo } from 'react';
import { AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VitalReading } from '@/types/emergencyDossier';

// ─── NEWS2 ────────────────────────────────────────────────────────────────────

function news2(r: VitalReading): number {
  let score = 0;
  const rr = r.rr ?? 0;
  if (rr <= 8) score += 3; else if (rr <= 11) score += 1; else if (rr <= 20) score += 0; else if (rr <= 24) score += 2; else score += 3;
  const spo2 = r.spo2 ?? 100;
  if (spo2 <= 91) score += 3; else if (spo2 <= 93) score += 2; else if (spo2 <= 95) score += 1;
  const sys = r.sysBP ?? (r.bp ? parseInt(r.bp.split('/')[0], 10) : 120);
  if (sys <= 90) score += 3; else if (sys <= 100) score += 2; else if (sys <= 110) score += 1; else if (sys <= 219) score += 0; else score += 3;
  const hr = r.hr ?? 70;
  if (hr <= 40) score += 3; else if (hr <= 50) score += 1; else if (hr <= 90) score += 0; else if (hr <= 110) score += 1; else if (hr <= 130) score += 2; else score += 3;
  const temp = r.temp ?? 37.0;
  if (temp <= 35.0) score += 3; else if (temp <= 36.0) score += 1; else if (temp <= 38.0) score += 0; else if (temp <= 39.0) score += 1; else score += 2;
  const cons = r.consciousness;
  if (cons && cons !== 'alerte') score += 3;
  return score;
}

function news2Risk(n: number): { label: string; cls: string } {
  if (n <= 4) return { label: 'Faible', cls: 'text-green-700 bg-green-100 border-green-300' };
  if (n <= 6) return { label: 'Modéré', cls: 'text-amber-700 bg-amber-100 border-amber-300' };
  return { label: 'ÉLEVÉ', cls: 'text-red-700 bg-red-100 border-red-300' };
}

// ─── qSOFA ────────────────────────────────────────────────────────────────────

function qsofa(r: VitalReading): number {
  let score = 0;
  const gcs = r.gcs ?? 15;
  if (gcs < 15) score++;
  const rr = r.rr ?? 14;
  if (rr >= 22) score++;
  const sys = r.sysBP ?? (r.bp ? parseInt(r.bp.split('/')[0], 10) : 120);
  if (sys <= 100) score++;
  return score;
}

// ─── Shock Index ──────────────────────────────────────────────────────────────

function shockIndex(r: VitalReading): number {
  const hr = r.hr ?? 70;
  const sys = r.sysBP ?? (r.bp ? parseInt(r.bp.split('/')[0], 10) : 120);
  return sys > 0 ? Math.round((hr / sys) * 100) / 100 : 0;
}

function shockLevel(si: number): { label: string; cls: string } {
  if (si < 0.6)  return { label: 'Normal',  cls: 'text-green-700 bg-green-100 border-green-300' };
  if (si < 1.0)  return { label: 'Léger',   cls: 'text-amber-700 bg-amber-100 border-amber-300' };
  if (si < 1.4)  return { label: 'Modéré',  cls: 'text-orange-700 bg-orange-100 border-orange-300' };
  return { label: 'SÉVÈRE', cls: 'text-red-700 bg-red-100 border-red-300' };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { readings: VitalReading[] }

export function ClinicalScores({ readings }: Props) {
  const last = readings[readings.length - 1];

  const n2 = useMemo(() => last ? news2(last) : null, [last]);
  const n2r = n2 !== null ? news2Risk(n2) : null;
  const qs = useMemo(() => last ? qsofa(last) : null, [last]);
  const si = useMemo(() => last ? shockIndex(last) : null, [last]);
  const siL = si !== null ? shockLevel(si) : null;

  if (!last) return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 text-center text-gray-400 text-sm">
      Aucune constante disponible pour calculer les scores.
    </div>
  );

  const scores = [
    {
      name: 'NEWS2', value: n2!, risk: n2r!,
      desc: 'National Early Warning Score 2', max: 20,
      alert: n2! >= 7 ? 'Risque élevé — surveillance continue requise' : null,
      hint: 'Basé sur FR, SpO₂, PA, FC, T°, conscience',
    },
    {
      name: 'qSOFA', value: qs!, risk: qs! >= 2 ? { label: '⚠ Sepsis', cls: 'text-red-700 bg-red-100 border-red-300' } : { label: 'Normal', cls: 'text-green-700 bg-green-100 border-green-300' },
      desc: 'Quick SOFA — dépistage sepsis', max: 3,
      alert: qs! >= 2 ? 'Score ≥ 2 — Risque de sepsis élevé' : null,
      hint: 'GCS < 15 · FR ≥ 22 · PAS ≤ 100',
    },
    {
      name: 'Shock Index', value: si!, risk: siL!,
      desc: 'FC / Pression artérielle systolique', max: null,
      alert: si! >= 1.0 ? `Choc ${siL!.label.toLowerCase()} — évaluer remplissage` : null,
      hint: 'Normal < 0.6 · Choc sévère > 1.4',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {scores.map(s => (
        <div key={s.name} className={cn('rounded-xl border overflow-hidden', s.alert ? 'border-red-200' : 'border-gray-200 bg-white')}>
          <div className={cn('flex items-center justify-between px-3 py-2.5', s.alert ? 'bg-red-50' : 'bg-gray-50')}>
            <div className="flex items-center gap-2">
              <TrendingUp size={13} className={s.alert ? 'text-red-500' : 'text-blue-500'} />
              <span className="font-bold text-gray-800 text-sm">{s.name}</span>
            </div>
            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full border', s.risk.cls)}>
              {s.risk.label}
            </span>
          </div>
          <div className="px-3 py-2">
            <div className="flex items-end gap-1 mb-1">
              <span className={cn('text-2xl font-black', s.alert ? 'text-red-600' : 'text-gray-800')}>
                {typeof s.value === 'number' ? (s.max ? s.value : s.value.toFixed(2)) : '—'}
              </span>
              {s.max && <span className="text-xs text-gray-400 mb-1">/{s.max}</span>}
            </div>
            {s.max && (
              <div className="w-full h-1.5 bg-gray-200 rounded-full mb-1.5">
                <div
                  className={cn('h-1.5 rounded-full', s.alert ? 'bg-red-500' : 'bg-blue-500')}
                  style={{ width: `${Math.min(100, (s.value / s.max) * 100)}%` }}
                />
              </div>
            )}
            <p className="text-[10px] text-gray-400">{s.hint}</p>
            {s.alert && (
              <div className="mt-1.5 flex items-start gap-1 text-[10px] text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-1">
                <AlertTriangle size={9} className="flex-shrink-0 mt-0.5" />
                {s.alert}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
