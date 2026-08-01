import { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  ArrowLeft, Printer, Save, CheckCircle2, AlertTriangle, Activity,
  Heart, Wind, Thermometer, Droplets, Brain, FlaskConical, Scan,
  Pill, Scissors, FileText, Shield, Clock, User, ChevronDown,
  ChevronRight, Home, Building2, Zap, Truck, ClipboardList,
  Stethoscope, PlusCircle, XCircle, CheckCircle, Info,
  AlertCircle, BarChart3, Eye, MessageSquare, History, BadgeCheck,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { cn } from '@/lib/utils';
import { PRIORITY_CFG, EmergencyPriorityBadge } from '@/components/emergencies/EmergencyPriorityBadge';
import { MOCK_EMERGENCY_PATIENTS } from '@/mock';
import { getMockDossier } from '@/mock/emergencyDossier';
import type { EmergencyPatient } from '@/types/emergency';
import type {
  EmergencyDossier, VitalReading, FinalDecisionType, GlasgowBreakdown,
} from '@/types/emergencyDossier';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' });
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-DZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function waitStr(iso: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}min` : `${m} min`;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ values, color = '#3b82f6', w = 80, h = 30 }: {
  values: number[]; color?: string; w?: number; h?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 3;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last = values[values.length - 1];
  const lx = (values.length - 1) * step;
  const ly = h - pad - ((last - min) / range) * (h - pad * 2);
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
      <circle cx={lx} cy={ly} r={2.5} fill={color} />
    </svg>
  );
}

// ─── VitalCard ────────────────────────────────────────────────────────────────

interface VitalMeta {
  label: string; unit: string; icon: React.ReactNode;
  getValue: (r: VitalReading) => number | undefined;
  fmt?: (v: number) => string;
  normal: [number, number]; warn: [number, number];
  color: string; critColor: string;
}

const VITAL_META: VitalMeta[] = [
  {
    label: 'Fréq. cardiaque', unit: 'bpm', icon: <Heart size={14} />,
    getValue: r => r.hr, normal: [60, 100], warn: [50, 130],
    color: '#ef4444', critColor: '#dc2626',
  },
  {
    label: 'SpO₂', unit: '%', icon: <Droplets size={14} />,
    getValue: r => r.spo2, normal: [95, 100], warn: [90, 100],
    color: '#06b6d4', critColor: '#0891b2',
  },
  {
    label: 'Température', unit: '°C', icon: <Thermometer size={14} />,
    getValue: r => r.temp,
    fmt: v => v.toFixed(1),
    normal: [36.1, 37.5], warn: [35.5, 38.5],
    color: '#f97316', critColor: '#ea580c',
  },
  {
    label: 'Fréq. respiratoire', unit: '/min', icon: <Wind size={14} />,
    getValue: r => r.rr, normal: [12, 20], warn: [10, 28],
    color: '#10b981', critColor: '#059669',
  },
  {
    label: 'Glasgow (GCS)', unit: '/15', icon: <Brain size={14} />,
    getValue: r => r.gcs, normal: [13, 15], warn: [9, 12],
    color: '#8b5cf6', critColor: '#7c3aed',
  },
  {
    label: 'Douleur', unit: '/10', icon: <Activity size={14} />,
    getValue: r => r.painLevel, normal: [0, 3], warn: [4, 6],
    color: '#f59e0b', critColor: '#d97706',
  },
];

function vitalStatus(value: number, meta: VitalMeta): 'normal' | 'warn' | 'crit' {
  if (value >= meta.normal[0] && value <= meta.normal[1]) return 'normal';
  if (value >= meta.warn[0] && value <= meta.warn[1]) return 'warn';
  return 'crit';
}

function VitalCard({ meta, readings }: { meta: VitalMeta; readings: VitalReading[] }) {
  const allVals = readings.map(r => meta.getValue(r)).filter((v): v is number => v !== undefined);
  const current = allVals[allVals.length - 1];
  if (current === undefined) return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-gray-400 text-xs">{meta.icon}<span>{meta.label}</span></div>
      <span className="text-gray-300 text-xl font-bold">—</span>
    </div>
  );
  const status = vitalStatus(current, meta);
  const statusCls = status === 'normal' ? 'text-green-600 bg-green-50 border-green-200'
    : status === 'warn' ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-red-600 bg-red-50 border-red-200';
  const valStr = meta.fmt ? meta.fmt(current) : String(current);
  const sparkColor = status === 'crit' ? '#ef4444' : status === 'warn' ? '#f59e0b' : meta.color;
  // BP is a string — special case handled at parent
  const displayVal = meta.label === 'Pression artérielle'
    ? (readings[readings.length - 1]?.bp ?? '—')
    : valStr;

  return (
    <div className={cn('border rounded-xl p-3 flex flex-col gap-2', statusCls)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium opacity-80">
          {meta.icon}<span>{meta.label}</span>
        </div>
        <span className={cn('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border',
          status === 'normal' ? 'border-green-300 text-green-700'
            : status === 'warn' ? 'border-amber-300 text-amber-700'
            : 'border-red-300 text-red-700',
        )}>
          {status === 'normal' ? 'Normal' : status === 'warn' ? 'Vigilance' : 'Critique'}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <span className="text-2xl font-bold">{displayVal}</span>
          <span className="text-xs ml-1 opacity-70">{meta.unit}</span>
        </div>
        {allVals.length >= 2 && <Sparkline values={allVals} color={sparkColor} />}
      </div>
    </div>
  );
}

// Blood pressure card (string values)
function BPCard({ readings }: { readings: VitalReading[] }) {
  const bpValues = readings.map(r => r.bp).filter(Boolean) as string[];
  const current = bpValues[bpValues.length - 1] ?? '—';
  const sys = parseInt(current.split('/')[0] ?? '0', 10);
  const status = sys >= 90 && sys <= 140 ? 'normal' : sys < 90 || sys > 180 ? 'crit' : 'warn';
  const statusCls = status === 'normal' ? 'text-green-600 bg-green-50 border-green-200'
    : status === 'warn' ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-red-600 bg-red-50 border-red-200';
  const sysVals = readings.map(r => parseInt((r.bp ?? '0').split('/')[0], 10)).filter(v => !isNaN(v) && v > 0);
  return (
    <div className={cn('border rounded-xl p-3 flex flex-col gap-2', statusCls)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium opacity-80">
          <Activity size={14} /><span>Pression artérielle</span>
        </div>
        <span className={cn('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border',
          status === 'normal' ? 'border-green-300 text-green-700'
            : status === 'warn' ? 'border-amber-300 text-amber-700'
            : 'border-red-300 text-red-700',
        )}>
          {status === 'normal' ? 'Normal' : status === 'warn' ? 'Vigilance' : 'Critique'}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <span className="text-2xl font-bold">{current}</span>
          <span className="text-xs ml-1 opacity-70">mmHg</span>
        </div>
        {sysVals.length >= 2 && <Sparkline values={sysVals} color={status === 'crit' ? '#ef4444' : status === 'warn' ? '#f59e0b' : '#3b82f6'} />}
      </div>
    </div>
  );
}

// ─── Glasgow Card ─────────────────────────────────────────────────────────────

const GCS_E = ['', 'Aucune', 'À la douleur', 'À la voix', 'Spontanée'];
const GCS_V = ['', 'Aucune', 'Sons', 'Mots', 'Confus', 'Orienté'];
const GCS_M = ['', 'Aucune', 'Extension', 'Flexion anormale', 'Retrait', 'Localise', 'Obéit'];

function GlasgowCard({ g }: { g: GlasgowBreakdown }) {
  const total = g.eye + g.verbal + g.motor;
  const severity = total >= 13 ? 'léger' : total >= 9 ? 'modéré' : 'sévère';
  const sevCls = total >= 13 ? 'text-green-700 bg-green-100 border-green-300'
    : total >= 9 ? 'text-amber-700 bg-amber-100 border-amber-300'
    : 'text-red-700 bg-red-100 border-red-300';
  const rows = [
    { letter: 'E', name: 'Ouverture des yeux', max: 4, val: g.eye, desc: GCS_E[g.eye] },
    { letter: 'V', name: 'Réponse verbale', max: 5, val: g.verbal, desc: GCS_V[g.verbal] },
    { letter: 'M', name: 'Réponse motrice', max: 6, val: g.motor, desc: GCS_M[g.motor] },
  ];
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <Brain size={15} className="text-purple-600" />
          <span className="font-semibold text-gray-800 text-sm">Glasgow Coma Scale</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', sevCls)}>
            {severity.toUpperCase()}
          </span>
          <span className={cn('text-xl font-black', total >= 13 ? 'text-green-600' : total >= 9 ? 'text-amber-600' : 'text-red-600')}>
            {total}
          </span>
          <span className="text-xs text-gray-400">/15</span>
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {rows.map(r => (
          <div key={r.letter} className="flex items-center px-4 py-2.5 gap-3">
            <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
              {r.letter}
            </span>
            <span className="text-xs text-gray-600 flex-1">{r.name}</span>
            <div className="flex gap-0.5">
              {Array.from({ length: r.max }).map((_, i) => (
                <div key={i} className={cn('h-4 w-4 rounded-sm border',
                  i < r.val
                    ? 'bg-purple-500 border-purple-600'
                    : 'bg-gray-100 border-gray-200',
                )} />
              ))}
            </div>
            <span className="text-xs font-bold text-purple-700 w-5 text-right">{r.val}</span>
            <span className="text-xs text-gray-500 w-28 text-right truncate">{r.desc}</span>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <span className="text-[10px] text-gray-400">Évalué par {g.recordedBy}</span>
        <span className="text-[10px] text-gray-400">{fmtDateTime(g.recordedAt)}</span>
      </div>
    </div>
  );
}

// ─── Pain Scale ───────────────────────────────────────────────────────────────

function PainScale({ level }: { level: number }) {
  const COLORS = ['#22c55e','#4ade80','#a3e635','#facc15','#fbbf24','#fb923c','#f97316','#ef4444','#dc2626','#b91c1c','#991b1b'];
  const FACES = ['😊','😐','😕','😟','😣','😫','😩','😭','🤯','😱','💀'];
  const desc = level <= 2 ? 'Légère' : level <= 4 ? 'Modérée' : level <= 6 ? 'Significative' : level <= 8 ? 'Sévère' : 'Insupportable';
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <Activity size={15} className="text-amber-500" />
        <span className="font-semibold text-gray-800 text-sm">Échelle de douleur (EVA)</span>
        <span className="ml-auto text-2xl">{FACES[Math.min(level, 10)]}</span>
        <div className="text-right">
          <span className="text-xl font-black" style={{ color: COLORS[Math.min(level, 10)] }}>{level}</span>
          <span className="text-xs text-gray-400">/10</span>
        </div>
      </div>
      <div className="px-4 py-3">
        <div className="flex gap-1 mb-2">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={cn('h-6 rounded transition-all', i <= level ? 'opacity-100' : 'opacity-20')}
                style={{ backgroundColor: COLORS[i], width: '100%', borderRadius: 3 }}
              />
              {(i === 0 || i === 5 || i === 10) && (
                <span className="text-[9px] text-gray-400 font-medium">{i}</span>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-center font-semibold mt-1" style={{ color: COLORS[Math.min(level, 10)] }}>
          {desc}
        </p>
      </div>
    </div>
  );
}

// ─── ABCDE Assessment ─────────────────────────────────────────────────────────

function ABCDECard({ a }: { a: EmergencyDossier['currentAbcde'] }) {
  const airwayCls = a.airway.status === 'libre' ? 'text-green-600 bg-green-50 border-green-200'
    : a.airway.status === 'compromis' ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-red-600 bg-red-50 border-red-200';
  const breathCls = a.breathing.pattern === 'normal' ? 'text-green-600 bg-green-50 border-green-200'
    : a.breathing.spo2 < 90 ? 'text-red-600 bg-red-50 border-red-200'
    : 'text-amber-600 bg-amber-50 border-amber-200';
  const circSys = parseInt(a.circulation.bp.split('/')[0] ?? '0', 10);
  const circCls = circSys < 90 ? 'text-red-600 bg-red-50 border-red-200'
    : circSys > 160 ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-green-600 bg-green-50 border-green-200';
  const gcsCls = a.disability.gcs >= 13 ? 'text-green-600 bg-green-50 border-green-200'
    : a.disability.gcs >= 9 ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-red-600 bg-red-50 border-red-200';
  const tempCls = a.exposure.temp >= 36.1 && a.exposure.temp <= 37.5
    ? 'text-green-600 bg-green-50 border-green-200' : 'text-amber-600 bg-amber-50 border-amber-200';

  const rows = [
    {
      letter: 'A', name: 'Airway — Voies aériennes', cls: airwayCls,
      summary: a.airway.status.toUpperCase(), detail: a.airway.notes,
    },
    {
      letter: 'B', name: 'Breathing — Respiration', cls: breathCls,
      summary: `${a.breathing.rate}/min · ${a.breathing.pattern} · SpO₂ ${a.breathing.spo2}%`,
      detail: a.breathing.notes,
    },
    {
      letter: 'C', name: 'Circulation', cls: circCls,
      summary: `FC ${a.circulation.hr} bpm · PA ${a.circulation.bp} · TRC ${a.circulation.capRefill}`,
      detail: a.circulation.notes,
    },
    {
      letter: 'D', name: 'Disability — Neurologie', cls: gcsCls,
      summary: `GCS ${a.disability.gcs}/15 · Pupilles: ${a.disability.pupils}${a.disability.glucose ? ` · Glycémie ${a.disability.glucose} mmol/L` : ''}`,
      detail: a.disability.notes,
    },
    {
      letter: 'E', name: 'Exposure — Examen complet', cls: tempCls,
      summary: `T° ${a.exposure.temp.toFixed(1)}°C · ${a.exposure.findings}`,
      detail: a.exposure.notes,
    },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <Shield size={15} className="text-blue-600" />
        <span className="font-semibold text-gray-800 text-sm">Évaluation ABCDE</span>
        <span className="ml-auto text-[10px] text-gray-400">
          {fmtDateTime(a.recordedAt)} — {a.recordedBy}
        </span>
      </div>
      <div className="divide-y divide-gray-100">
        {rows.map(r => (
          <div key={r.letter} className="px-4 py-3 flex items-start gap-3">
            <span className={cn('w-7 h-7 rounded-full font-black text-sm flex items-center justify-center flex-shrink-0 border', r.cls)}>
              {r.letter}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-700">{r.name}</span>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', r.cls)}>
                  {r.summary}
                </span>
              </div>
              {r.detail && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{r.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Timeline Strip ───────────────────────────────────────────────────────────

function TimelineStrip({ patient, dossier }: { patient: EmergencyPatient; dossier: EmergencyDossier }) {
  type TEvent = { time: string; label: string; color: string; dot: string };
  const events: TEvent[] = [
    { time: fmtTime(patient.arrivalTime), label: 'Arrivée', color: 'border-blue-500 bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
    ...dossier.vitalReadings.slice(0, 1).map(r => ({
      time: fmtTime(r.timestamp), label: 'Triage', color: 'border-purple-500 bg-purple-50 text-purple-700', dot: 'bg-purple-500',
    })),
    ...dossier.labRequests.slice(0, 2).map(r => ({
      time: fmtTime(r.requestedAt), label: r.test.split(' ')[0], color: 'border-green-500 bg-green-50 text-green-700', dot: 'bg-green-500',
    })),
    ...dossier.imagingRequests.slice(0, 2).map(r => ({
      time: fmtTime(r.requestedAt), label: r.exam.split(' ')[0], color: 'border-cyan-500 bg-cyan-50 text-cyan-700', dot: 'bg-cyan-500',
    })),
    ...dossier.prescriptions.slice(0, 2).map(r => ({
      time: fmtTime(r.prescribedAt), label: r.drug.split(' ')[0], color: 'border-amber-500 bg-amber-50 text-amber-700', dot: 'bg-amber-500',
    })),
    ...(dossier.finalDecision.decidedAt ? [{
      time: fmtTime(dossier.finalDecision.decidedAt), label: 'Décision', color: 'border-red-500 bg-red-50 text-red-700', dot: 'bg-red-500',
    }] : []),
  ].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 overflow-x-auto print-hide">
      <div className="flex items-center gap-0 min-w-max">
        {events.map((ev, i) => (
          <div key={i} className="flex items-center">
            <div className={cn('flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg border text-center min-w-[64px]', ev.color)}>
              <span className="text-[9px] font-bold opacity-70">{ev.time}</span>
              <div className="flex items-center gap-1">
                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', ev.dot)} />
                <span className="text-[10px] font-semibold leading-tight max-w-[60px] truncate">{ev.label}</span>
              </div>
            </div>
            {i < events.length - 1 && (
              <div className="h-px w-4 bg-gray-300 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  attente_triage: { label: 'Attente triage', cls: 'bg-gray-100 text-gray-700 border-gray-300' },
  en_triage:      { label: 'En triage',       cls: 'bg-purple-100 text-purple-700 border-purple-300' },
  attente_soins:  { label: 'Attente soins',   cls: 'bg-orange-100 text-orange-700 border-orange-300' },
  en_soins:       { label: 'En soins',         cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  observation:    { label: 'Observation',      cls: 'bg-teal-100 text-teal-700 border-teal-300' },
  hospitalise:    { label: 'Hospitalisé',      cls: 'bg-green-100 text-green-700 border-green-300' },
  sorti:          { label: 'Sorti',            cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  transfere:      { label: 'Transféré',        cls: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  decede:         { label: 'Décédé',           cls: 'bg-gray-800 text-white border-gray-900' },
};

// ─── Urgency / Status Badges ──────────────────────────────────────────────────

function UrgBadge({ u }: { u: string }) {
  const cls = u === 'STAT' ? 'bg-red-100 text-red-700 border-red-300'
    : u === 'urgent' ? 'bg-orange-100 text-orange-700 border-orange-300'
    : 'bg-gray-100 text-gray-600 border-gray-200';
  return <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border', cls)}>{u}</span>;
}
function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = {
    en_attente: 'bg-gray-100 text-gray-600 border-gray-200',
    en_cours:   'bg-blue-100 text-blue-700 border-blue-300',
    disponible: 'bg-green-100 text-green-700 border-green-300',
    annule:     'bg-red-100 text-red-600 border-red-200',
    prescrit:   'bg-amber-100 text-amber-700 border-amber-300',
    administré: 'bg-green-100 text-green-700 border-green-300',
  };
  const labels: Record<string, string> = {
    en_attente: 'En attente', en_cours: 'En cours', disponible: 'Disponible',
    annule: 'Annulé', prescrit: 'Prescrit', administré: 'Administré',
  };
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', m[s] ?? 'bg-gray-100 text-gray-500 border-gray-200')}>
      {labels[s] ?? s}
    </span>
  );
}

// ─── Tab: Évaluation ──────────────────────────────────────────────────────────

function TabEvaluation({ patient, dossier }: { patient: EmergencyPatient; dossier: EmergencyDossier }) {
  const latestGcs = dossier.glasgowHistory[dossier.glasgowHistory.length - 1];
  const lastVital = dossier.vitalReadings[dossier.vitalReadings.length - 1];
  const painLevel = lastVital?.painLevel ?? 0;

  return (
    <div className="space-y-4">
      {/* Vitals row */}
      <section>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Activity size={12} />Signes vitaux
          <span className="font-normal normal-case text-[10px] ml-1 text-gray-400">
            Dernière mesure : {dossier.vitalReadings.length > 0 ? fmtDateTime(dossier.vitalReadings[dossier.vitalReadings.length - 1].timestamp) : '—'}
          </span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          {VITAL_META.map(m => (
            <VitalCard key={m.label} meta={m} readings={dossier.vitalReadings} />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 xl:col-span-6">
          <BPCard readings={dossier.vitalReadings} />
        </div>
      </section>

      {/* Glasgow + Pain */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {latestGcs ? <GlasgowCard g={latestGcs} /> : (
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center text-gray-400 text-sm">
            GCS non évalué
          </div>
        )}
        <PainScale level={painLevel} />
      </div>

      {/* ABCDE */}
      <ABCDECard a={dossier.currentAbcde} />

      {/* Clinical text */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TextCard icon={<Stethoscope size={14} className="text-blue-600" />}
          title="Motif de consultation" content={dossier.chiefComplaint} />
        <TextCard icon={<History size={14} className="text-blue-600" />}
          title="Histoire de la maladie actuelle" content={dossier.illnessHistory} />
        <TextCard icon={<ClipboardList size={14} className="text-blue-600" />}
          title="Examen clinique" content={dossier.clinicalExam} />
        <TextCard icon={<BadgeCheck size={14} className="text-blue-600" />}
          title="Diagnostic provisoire" content={dossier.provisionalDiagnosis} accent />
      </div>
    </div>
  );
}

function TextCard({ icon, title, content, accent = false }: {
  icon: React.ReactNode; title: string; content: string; accent?: boolean;
}) {
  return (
    <div className={cn('rounded-xl border overflow-hidden', accent ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white')}>
      <div className={cn('flex items-center gap-2 px-4 py-2.5 border-b', accent ? 'border-blue-200 bg-blue-100/50' : 'border-gray-100 bg-gray-50')}>
        {icon}
        <span className="text-xs font-semibold text-gray-700">{title}</span>
      </div>
      <div className="px-4 py-3">
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {content || <span className="italic text-gray-400">Non renseigné</span>}
        </p>
      </div>
    </div>
  );
}

// ─── Tab: Ordres ──────────────────────────────────────────────────────────────

function TabOrdres({ dossier }: { dossier: EmergencyDossier }) {
  return (
    <div className="space-y-4">
      {/* Lab */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <FlaskConical size={14} className="text-green-600" />
            <span className="font-semibold text-gray-800 text-sm">Demandes de biologie</span>
            <span className="text-[10px] bg-green-100 text-green-700 border border-green-300 px-1.5 py-0.5 rounded-full font-bold">
              {dossier.labRequests.length}
            </span>
          </div>
          <button className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
            <PlusCircle size={13} />Ajouter
          </button>
        </div>
        {dossier.labRequests.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">Aucune demande</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Analyse','Catégorie','Urgence','Demandé par','Heure','Statut','Résultat'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dossier.labRequests.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-gray-800">{r.test}</td>
                    <td className="px-3 py-2.5 text-gray-500">{r.category}</td>
                    <td className="px-3 py-2.5"><UrgBadge u={r.urgency} /></td>
                    <td className="px-3 py-2.5 text-gray-600">{r.requestedBy}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtTime(r.requestedAt)}</td>
                    <td className="px-3 py-2.5"><StatusBadge s={r.status} /></td>
                    <td className="px-3 py-2.5 text-gray-600 max-w-[200px]">
                      {r.result ? (
                        <span className="text-green-700 font-medium">{r.result}</span>
                      ) : (
                        <span className="text-gray-300 italic">En attente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Imaging */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <Scan size={14} className="text-cyan-600" />
            <span className="font-semibold text-gray-800 text-sm">Demandes d'imagerie</span>
            <span className="text-[10px] bg-cyan-100 text-cyan-700 border border-cyan-300 px-1.5 py-0.5 rounded-full font-bold">
              {dossier.imagingRequests.length}
            </span>
          </div>
          <button className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
            <PlusCircle size={13} />Ajouter
          </button>
        </div>
        {dossier.imagingRequests.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">Aucune demande</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Examen','Région','Urgence','Demandé par','Heure','Statut','Résultat'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dossier.imagingRequests.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-gray-800">{r.exam}</td>
                    <td className="px-3 py-2.5 text-gray-500">{r.region}{r.side ? ` (${r.side})` : ''}</td>
                    <td className="px-3 py-2.5"><UrgBadge u={r.urgency} /></td>
                    <td className="px-3 py-2.5 text-gray-600">{r.requestedBy}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtTime(r.requestedAt)}</td>
                    <td className="px-3 py-2.5"><StatusBadge s={r.status} /></td>
                    <td className="px-3 py-2.5 text-gray-600 max-w-[200px]">
                      {r.result ? (
                        <span className="text-green-700 font-medium">{r.result}</span>
                      ) : (
                        <span className="text-gray-300 italic">En attente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Traitement ──────────────────────────────────────────────────────────

const ROUTE_CLS: Record<string, string> = {
  IV: 'bg-red-100 text-red-700 border-red-200',
  IM: 'bg-orange-100 text-orange-700 border-orange-200',
  PO: 'bg-green-100 text-green-700 border-green-200',
  SC: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  SL: 'bg-purple-100 text-purple-700 border-purple-200',
  Inhalé: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  Topique: 'bg-gray-100 text-gray-600 border-gray-200',
  Nasal: 'bg-teal-100 text-teal-700 border-teal-200',
};

function TabTraitement({ dossier }: { dossier: EmergencyDossier }) {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <Pill size={14} className="text-amber-600" />
            <span className="font-semibold text-gray-800 text-sm">Prescriptions</span>
            <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full font-bold">
              {dossier.prescriptions.length}
            </span>
          </div>
          <button className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
            <PlusCircle size={13} />Prescrire
          </button>
        </div>
        {dossier.prescriptions.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">Aucune prescription</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Médicament','Posologie','Voie','Fréquence','Prescrit par','Heure','Statut'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dossier.prescriptions.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 font-semibold text-gray-800">{p.drug}</td>
                    <td className="px-3 py-2.5 text-gray-700 font-medium">{p.dosage}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border', ROUTE_CLS[p.route] ?? 'bg-gray-100 text-gray-600 border-gray-200')}>
                        {p.route}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{p.frequency}</td>
                    <td className="px-3 py-2.5 text-gray-500">{p.prescribedBy}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                      {fmtTime(p.prescribedAt)}
                      {p.administeredAt && <div className="text-[9px] text-green-600">Adm. {fmtTime(p.administeredAt)}</div>}
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge s={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <Scissors size={14} className="text-purple-600" />
            <span className="font-semibold text-gray-800 text-sm">Procédures réalisées</span>
            <span className="text-[10px] bg-purple-100 text-purple-700 border border-purple-300 px-1.5 py-0.5 rounded-full font-bold">
              {dossier.procedures.length}
            </span>
          </div>
          <button className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
            <PlusCircle size={13} />Ajouter
          </button>
        </div>
        {dossier.procedures.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">Aucune procédure</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {dossier.procedures.map(p => (
              <div key={p.id} className="flex items-start gap-3 px-4 py-3">
                <div className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{p.name}</span>
                    <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-200 px-1.5 py-0.5 rounded font-medium">
                      {p.category}
                    </span>
                  </div>
                  {p.notes && <p className="text-xs text-gray-500 mt-0.5">{p.notes}</p>}
                  <p className="text-[10px] text-gray-400 mt-0.5">{p.performedBy} · {fmtDateTime(p.performedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Notes ───────────────────────────────────────────────────────────────

function NoteCard({ note }: { note: { id: string; content: string; author: string; role: string; createdAt: string; isPinned?: boolean } }) {
  return (
    <div className={cn('rounded-xl border p-4 relative', note.isPinned ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white')}>
      {note.isPinned && (
        <span className="absolute top-2 right-3 text-[10px] font-bold text-amber-600 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-full">
          📌 Épinglé
        </span>
      )}
      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap pr-16">{note.content}</p>
      <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-gray-100">
        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <User size={11} className="text-blue-600" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-700">{note.author}</p>
          <p className="text-[10px] text-gray-400">{note.role} · {fmtDateTime(note.createdAt)}</p>
        </div>
      </div>
    </div>
  );
}

function TabNotes({ dossier }: { dossier: EmergencyDossier }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Stethoscope size={12} />Notes médicales ({dossier.medicalNotes.length})
          </h3>
          <button className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
            <PlusCircle size={13} />Ajouter
          </button>
        </div>
        {dossier.medicalNotes.length === 0
          ? <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">Aucune note médicale</div>
          : dossier.medicalNotes.map(n => <NoteCard key={n.id} note={n} />)
        }
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <MessageSquare size={12} />Notes infirmières ({dossier.nursingNotes.length})
          </h3>
          <button className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
            <PlusCircle size={13} />Ajouter
          </button>
        </div>
        {dossier.nursingNotes.length === 0
          ? <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">Aucune note infirmière</div>
          : dossier.nursingNotes.map(n => <NoteCard key={n.id} note={n} />)
        }
      </div>
    </div>
  );
}

// ─── Tab: Décision Finale ─────────────────────────────────────────────────────

const DECISIONS: Array<{
  key: FinalDecisionType;
  label: string;
  sub: string;
  icon: React.ReactNode;
  cls: string;
  activeCls: string;
}> = [
  { key: 'domicile',       label: 'Retour à domicile',    sub: 'Sortie avec ordonnance',        icon: <Home size={22} />,        cls: 'border-green-200 hover:border-green-400 hover:bg-green-50',  activeCls: 'border-green-500 bg-green-50 ring-2 ring-green-400' },
  { key: 'hospitalisation',label: 'Hospitalisation',      sub: 'Transfert en service',          icon: <Building2 size={22} />,   cls: 'border-blue-200 hover:border-blue-400 hover:bg-blue-50',     activeCls: 'border-blue-500 bg-blue-50 ring-2 ring-blue-400' },
  { key: 'bloc',           label: 'Bloc opératoire',      sub: 'Chirurgie urgente',             icon: <Scissors size={22} />,    cls: 'border-purple-200 hover:border-purple-400 hover:bg-purple-50',activeCls: 'border-purple-500 bg-purple-50 ring-2 ring-purple-400' },
  { key: 'reanimation',    label: 'Réanimation / USI',    sub: 'Soins intensifs',               icon: <Zap size={22} />,         cls: 'border-red-200 hover:border-red-400 hover:bg-red-50',        activeCls: 'border-red-500 bg-red-50 ring-2 ring-red-400' },
  { key: 'transfert',      label: 'Transfert',            sub: 'Autre établissement',           icon: <Truck size={22} />,       cls: 'border-orange-200 hover:border-orange-400 hover:bg-orange-50',activeCls: 'border-orange-500 bg-orange-50 ring-2 ring-orange-400' },
  { key: 'deces',          label: 'Décès',                sub: 'Constat de décès',              icon: <XCircle size={22} />,     cls: 'border-gray-300 hover:border-gray-500 hover:bg-gray-50',     activeCls: 'border-gray-700 bg-gray-100 ring-2 ring-gray-600' },
];

function TabDecision({ dossier }: { dossier: EmergencyDossier }) {
  const [selected, setSelected] = useState<FinalDecisionType>(dossier.finalDecision.decision);
  const [notes, setNotes] = useState(dossier.finalDecision.notes);
  const [confirmed, setConfirmed] = useState(!!dossier.finalDecision.decidedAt);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {DECISIONS.map(d => (
          <button
            key={d.key}
            onClick={() => { setSelected(d.key); setConfirmed(false); }}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer text-center',
              selected === d.key ? d.activeCls : d.cls,
            )}
          >
            <span className={cn(selected === d.key ? 'opacity-100' : 'opacity-50')}>{d.icon}</span>
            <div>
              <p className="font-bold text-sm text-gray-800">{d.label}</p>
              <p className="text-[10px] text-gray-500">{d.sub}</p>
            </div>
            {selected === d.key && (
              <CheckCircle2 size={16} className="text-current opacity-70" />
            )}
          </button>
        ))}
      </div>

      {selected && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <label className="block text-xs font-semibold text-gray-700">
            Service / Destination <span className="text-gray-400 font-normal">(facultatif)</span>
          </label>
          <input
            type="text"
            placeholder={selected === 'hospitalisation' ? 'Ex: Cardiologie — Lit 12' : selected === 'transfert' ? 'Ex: CHU Mustapha Bacha' : selected === 'bloc' ? 'Ex: Bloc orthopédie' : ''}
            defaultValue={dossier.finalDecision.ward ?? dossier.finalDecision.transferDestination ?? ''}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <label className="block text-xs font-semibold text-gray-700 mt-2">Notes de décision</label>
          <textarea
            rows={3}
            value={notes}
            onChange={e => { setNotes(e.target.value); setConfirmed(false); }}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Justification clinique, instructions de sortie…"
          />
          <button
            onClick={() => setConfirmed(true)}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-colors',
              confirmed ? 'bg-green-100 text-green-700 border border-green-400' : 'bg-blue-600 hover:bg-blue-700 text-white',
            )}
          >
            {confirmed ? <><CheckCircle2 size={15} /> Décision confirmée</> : <><BadgeCheck size={15} /> Confirmer la décision</>}
          </button>
        </div>
      )}

      {!selected && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-700 text-sm">
          <AlertCircle size={16} className="flex-shrink-0" />
          Sélectionnez une décision pour le patient.
        </div>
      )}
    </div>
  );
}

// ─── Tab: Audit ───────────────────────────────────────────────────────────────

const AUDIT_CAT_CLS: Record<string, string> = {
  admin:        'bg-gray-100 text-gray-600 border-gray-200',
  clinical:     'bg-blue-100 text-blue-700 border-blue-200',
  prescription: 'bg-amber-100 text-amber-700 border-amber-200',
  lab:          'bg-green-100 text-green-700 border-green-200',
  imaging:      'bg-cyan-100 text-cyan-700 border-cyan-200',
  nursing:      'bg-pink-100 text-pink-700 border-pink-200',
  system:       'bg-purple-100 text-purple-600 border-purple-200',
};
const AUDIT_CAT_FR: Record<string, string> = {
  admin: 'Admin', clinical: 'Clinique', prescription: 'Prescription',
  lab: 'Biologie', imaging: 'Imagerie', nursing: 'Soins', system: 'Système',
};

function TabAudit({ dossier }: { dossier: EmergencyDossier }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <History size={14} className="text-gray-600" />
        <span className="font-semibold text-gray-800 text-sm">Journal d'audit — Traçabilité complète</span>
        <span className="ml-auto text-[10px] text-gray-400">{dossier.auditLog.length} événements</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>{['Heure','Catégorie','Action','Détails','Effectué par','Rôle'].map(h => (
              <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {dossier.auditLog.map(e => (
              <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap font-mono text-[10px]">{fmtDateTime(e.timestamp)}</td>
                <td className="px-3 py-2.5">
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', AUDIT_CAT_CLS[e.category] ?? 'bg-gray-100 text-gray-500 border-gray-200')}>
                    {AUDIT_CAT_FR[e.category] ?? e.category}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-semibold text-gray-800">{e.action}</td>
                <td className="px-3 py-2.5 text-gray-600 max-w-[240px]">{e.details}</td>
                <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{e.performedBy}</td>
                <td className="px-3 py-2.5 text-gray-400">{e.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { label: 'Évaluation', icon: <Stethoscope size={13} /> },
  { label: 'Ordres',     icon: <FlaskConical size={13} /> },
  { label: 'Traitement', icon: <Pill size={13} /> },
  { label: 'Notes',      icon: <FileText size={13} /> },
  { label: 'Décision',   icon: <BadgeCheck size={13} /> },
  { label: 'Audit',      icon: <History size={13} /> },
];

export default function EmergencyPatientDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const patientId = params.id ?? '';
  const patient = MOCK_EMERGENCY_PATIENTS.find(p => p.id === patientId);
  const dossier = getMockDossier(patientId);

  const [activeTab, setActiveTab] = useState(0);
  const [alertOpen, setAlertOpen] = useState(true);
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [waitStr2, setWaitStr2] = useState('');

  // Live wait timer
  useEffect(() => {
    if (!patient) return;
    const update = () => setWaitStr2(waitStr(patient.arrivalTime));
    update();
    const iv = setInterval(update, 30_000);
    return () => clearInterval(iv);
  }, [patient]);

  // Auto-save simulation
  const triggerSave = useCallback(() => {
    setSaveState('saving');
    setTimeout(() => setSaveState('saved'), 1200);
  }, []);
  useEffect(() => {
    if (saveState === 'saving') return;
    const t = setTimeout(() => { if (saveState === 'saved') setSaveState('idle'); }, 3000);
    return () => clearTimeout(t);
  }, [saveState]);

  if (!patient) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <AlertCircle size={32} className="text-gray-300" />
          <p className="text-gray-500 font-medium">Patient introuvable.</p>
          <button onClick={() => setLocation('/emergencies')}
            className="text-sm text-blue-600 hover:underline">← Retour aux urgences</button>
        </div>
      </DashboardLayout>
    );
  }

  const pCfg = PRIORITY_CFG[patient.priority];
  const statusCfg = STATUS_LABELS[patient.status] ?? { label: patient.status, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
  const hasAlerts = dossier.allergies.length > 0 || dossier.chronicDiseases.length > 0
    || dossier.bloodThinners || dossier.pregnant || dossier.infectiousDisease;

  // count pending orders for badge
  const pendingLab = dossier.labRequests.filter(r => r.status === 'en_attente' || r.status === 'en_cours').length;
  const pendingImg = dossier.imagingRequests.filter(r => r.status === 'en_attente' || r.status === 'en_cours').length;

  return (
    <DashboardLayout>
      <style>{`
        @media print {
          .print-hide { display: none !important; }
          .print-noscroll { overflow: visible !important; max-height: none !important; }
        }
      `}</style>

      {/* ── Sticky Patient Header ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm print-hide">
        <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
          {/* Back */}
          <button
            onClick={() => setLocation('/emergencies')}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 rounded-lg px-2 py-1.5 transition-colors flex-shrink-0"
          >
            <ArrowLeft size={13} />Urgences
          </button>

          {/* Priority badge */}
          <EmergencyPriorityBadge priority={patient.priority} size="md" showLabel="both" />

          {/* Patient identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h1 className="font-black text-gray-900 text-base leading-none truncate">
                {patient.lastName} {patient.firstName}
              </h1>
              <span className="text-xs text-gray-500 flex-shrink-0">
                {patient.age} ans · {patient.gender === 'M' ? 'Masculin' : 'Féminin'}
              </span>
              <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">#{dossier.dossierNumber}</span>
              {dossier.bloodType && (
                <span className="text-[10px] font-bold bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  {dossier.bloodType}
                </span>
              )}
              {patient.isMinor && (
                <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 border border-yellow-300 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  MINEUR
                </span>
              )}
              {patient.byAmbulance && (
                <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  🚑 SMUR
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', statusCfg.cls)}>
                {statusCfg.label}
              </span>
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <Clock size={10} />Arrivée {fmtTime(patient.arrivalTime)}
              </span>
              <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-1">
                ⏱ {waitStr2 || waitStr(patient.arrivalTime)}
              </span>
              {patient.assignedDoctor && (
                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                  <Stethoscope size={10} />{patient.assignedDoctor}
                </span>
              )}
              {patient.assignedNurse && (
                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                  <User size={10} />{patient.assignedNurse}
                </span>
              )}
              {patient.assignedRoom && (
                <span className="text-[10px] text-gray-500">🛏 {patient.assignedRoom}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            {saveState === 'saving' && (
              <span className="text-[10px] text-amber-600 flex items-center gap-1 animate-pulse">
                <Save size={11} />Sauvegarde…
              </span>
            )}
            {saveState === 'saved' && (
              <span className="text-[10px] text-green-600 flex items-center gap-1">
                <CheckCircle2 size={11} />Sauvegardé
              </span>
            )}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-400 rounded-lg px-2.5 py-1.5 transition-colors"
            >
              <Printer size={13} />Imprimer
            </button>
            <button
              onClick={triggerSave}
              className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2.5 py-1.5 transition-colors font-semibold"
            >
              <Save size={13} />Sauvegarder
            </button>
          </div>
        </div>
      </div>

      {/* ── Medical Alert Banner ───────────────────────────────────────────── */}
      {hasAlerts && (
        <div className={cn('border-b border-red-200 bg-red-50 transition-all print-hide', alertOpen ? '' : 'hidden')}>
          <div className="flex items-start gap-3 px-4 py-2.5">
            <AlertTriangle size={15} className="text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 flex flex-wrap gap-x-4 gap-y-1.5">
              {dossier.allergies.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-black text-red-700 uppercase tracking-wide">⚠ Allergies :</span>
                  {dossier.allergies.map(a => (
                    <span key={a} className="text-[10px] font-bold bg-red-200 text-red-800 border border-red-400 px-1.5 py-0.5 rounded-full">{a}</span>
                  ))}
                </div>
              )}
              {dossier.chronicDiseases.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-black text-orange-700 uppercase tracking-wide">Antécédents :</span>
                  {dossier.chronicDiseases.map(d => (
                    <span key={d} className="text-[10px] bg-orange-100 text-orange-800 border border-orange-300 px-1.5 py-0.5 rounded-full">{d}</span>
                  ))}
                </div>
              )}
              {dossier.bloodThinners && (
                <span className="text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-400 px-1.5 py-0.5 rounded-full">
                  💊 Anticoagulant / Antiplaquettaire
                </span>
              )}
              {dossier.pregnant && (
                <span className="text-[10px] font-bold bg-pink-100 text-pink-800 border border-pink-400 px-1.5 py-0.5 rounded-full">
                  🤰 Grossesse en cours
                </span>
              )}
              {dossier.infectiousDisease && (
                <span className="text-[10px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-400 px-1.5 py-0.5 rounded-full">
                  🦠 {dossier.infectiousDisease}
                </span>
              )}
            </div>
            <button onClick={() => setAlertOpen(false)} className="text-red-400 hover:text-red-600 p-0.5 flex-shrink-0">
              <ChevronDown size={13} />
            </button>
          </div>
        </div>
      )}
      {hasAlerts && !alertOpen && (
        <button
          onClick={() => setAlertOpen(true)}
          className="w-full flex items-center gap-2 px-4 py-1.5 bg-red-100 border-b border-red-200 text-[10px] text-red-600 font-semibold hover:bg-red-200 transition-colors print-hide"
        >
          <AlertTriangle size={11} />Alertes médicales masquées — cliquer pour afficher
        </button>
      )}

      {/* ── Timeline strip ────────────────────────────────────────────────── */}
      <div className="print-hide">
        <div className="flex items-center justify-between px-4 py-1 bg-gray-50 border-b border-gray-100">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Chronologie</span>
          <button onClick={() => setTimelineOpen(o => !o)} className="text-gray-400 hover:text-gray-600">
            <ChevronRight size={13} className={cn('transition-transform', timelineOpen ? 'rotate-90' : '')} />
          </button>
        </div>
        {timelineOpen && <TimelineStrip patient={patient} dossier={dossier} />}
      </div>

      {/* ── Tab Navigation ────────────────────────────────────────────────── */}
      <div className="sticky top-[55px] z-20 bg-white border-b border-gray-200 print-hide">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map((tab, i) => {
            const badge = i === 1 && (pendingLab + pendingImg) > 0 ? pendingLab + pendingImg : 0;
            return (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors relative flex-shrink-0',
                  activeTab === i
                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50',
                )}
              >
                {tab.icon}{tab.label}
                {badge > 0 && (
                  <span className="w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ───────────────────────────────────────────────────── */}
      <div className="p-4" onChange={triggerSave}>
        {activeTab === 0 && <TabEvaluation patient={patient} dossier={dossier} />}
        {activeTab === 1 && <TabOrdres dossier={dossier} />}
        {activeTab === 2 && <TabTraitement dossier={dossier} />}
        {activeTab === 3 && <TabNotes dossier={dossier} />}
        {activeTab === 4 && <TabDecision dossier={dossier} />}
        {activeTab === 5 && <TabAudit dossier={dossier} />}
      </div>
    </DashboardLayout>
  );
}
