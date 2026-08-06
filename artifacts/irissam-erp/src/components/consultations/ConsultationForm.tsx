import { useState, useRef, useEffect } from 'react';
import {
  X, Search, ChevronRight, ChevronLeft, Stethoscope, User,
  Activity, Check, ExternalLink, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { PatientAvatar } from '@/components/shared/PatientAvatar';
import { addSessionConsultation } from '@/mock';
import { useGetPatientsList } from '@workspace/api-client-react';
import type { Patient } from '@/types';
import type {
  Consultation, ConsultationType, ConsultationOrigin,
  ConsultationPriority, VitalSigns,
} from '@/types/consultation';

// ─── Cascade Data (Service → Spécialité → Médecin) ───────────────────────────

const SERVICE_TREE = [
  {
    id: 'svc-card', label: 'Cardiologie',
    specialties: [
      { id: 'sp-cardio', label: 'Cardiologie',
        doctors: [{ id: 'doc-hamidou', name: 'Dr. Hamidou Karim', title: 'Cardiologue' }] },
    ],
  },
  {
    id: 'svc-med', label: 'Médecine interne',
    specialties: [
      { id: 'sp-med-int', label: 'Médecine interne',
        doctors: [{ id: 'doc-meziane', name: 'Dr. Meziane Farid', title: 'Médecin interniste' }] },
      { id: 'sp-med-gen', label: 'Médecine générale',
        doctors: [{ id: 'doc-meziane', name: 'Dr. Meziane Farid', title: 'Médecin interniste' }] },
    ],
  },
  {
    id: 'svc-neur', label: 'Neurologie',
    specialties: [
      { id: 'sp-neur', label: 'Neurologie',
        doctors: [{ id: 'doc-tahir', name: 'Dr. Tahir Mohamed', title: 'Neurologue' }] },
    ],
  },
  {
    id: 'svc-chir', label: 'Chirurgie',
    specialties: [
      { id: 'sp-chir-gen', label: 'Chirurgie générale',
        doctors: [{ id: 'doc-bensalah', name: 'Dr. Bensalah Nadia', title: 'Chirurgien général' }] },
      { id: 'sp-ortho', label: 'Orthopédie',
        doctors: [{ id: 'doc-bensalah', name: 'Dr. Bensalah Nadia', title: 'Chirurgien' }] },
    ],
  },
  {
    id: 'svc-pneu', label: 'Pneumologie',
    specialties: [
      { id: 'sp-pneu', label: 'Pneumologie',
        doctors: [{ id: 'doc-ghezali', name: 'Dr. Ghezali Leila', title: 'Pneumologue' }] },
    ],
  },
  {
    id: 'svc-mat', label: 'Maternité',
    specialties: [
      { id: 'sp-gyn', label: 'Gynécologie-Obstétrique',
        doctors: [{ id: 'doc-kheloufi', name: 'Dr. Kheloufi Souad', title: 'Gynécologue-obstétricien' }] },
    ],
  },
  {
    id: 'svc-ped', label: 'Pédiatrie',
    specialties: [
      { id: 'sp-ped', label: 'Pédiatrie',
        doctors: [{ id: 'doc-belkacemi', name: 'Dr. Belkacemi Riad', title: 'Pédiatre' }] },
    ],
  },
  {
    id: 'svc-urg', label: 'Urgences',
    specialties: [
      { id: 'sp-urg', label: "Médecine d'urgence",
        doctors: [{ id: 'doc-amrani', name: 'Dr. Amrani Yacine', title: 'Urgentiste' }] },
    ],
  },
  {
    id: 'svc-rea', label: 'Réanimation',
    specialties: [
      { id: 'sp-rea', label: 'Réanimation',
        doctors: [{ id: 'doc-rahmani', name: 'Dr. Rahmani Omar', title: 'Réanimateur' }] },
    ],
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPES: { value: ConsultationType; label: string }[] = [
  { value: 'programmee',       label: 'Consultation programmée' },
  { value: 'sans_rdv',         label: 'Sans rendez-vous' },
  { value: 'controle',         label: 'Consultation de contrôle' },
  { value: 'specialisee',      label: 'Consultation spécialisée' },
  { value: 'ambulatoire',      label: 'Consultation ambulatoire' },
  { value: 'teleconsultation', label: 'Téléconsultation' },
  { value: 'urgences',         label: "Issue des urgences" },
  { value: 'hospitalisation',  label: 'Liée à une hospitalisation' },
];

const EXTENDED_ORIGINS: { value: ConsultationOrigin; label: string }[] = [
  { value: 'rdv',             label: 'Rendez-vous' },
  { value: 'sans_rdv',        label: 'Sans rendez-vous' },
  { value: 'urgence',         label: 'Urgence' },
  { value: 'hospitalisation', label: 'Hospitalisation' },
  { value: 'admission',       label: 'Admission' },
  { value: 'controle',        label: 'Contrôle' },
];

const ORIGIN_TYPE_MAP: Record<ConsultationOrigin, ConsultationType> = {
  rdv:             'programmee',
  sans_rdv:        'sans_rdv',
  urgence:         'urgences',
  hospitalisation: 'hospitalisation',
  admission:       'hospitalisation',
  controle:        'controle',
};

const MOTIF_SUGGESTIONS = [
  'Fièvre', 'Douleur thoracique', 'Contrôle diabète', 'Suivi grossesse',
  'Hypertension', 'Traumatisme', 'Douleur abdominale', 'Céphalées',
  'Toux', 'Contrôle post-opératoire', 'Palpitations', 'Dyspnée',
  'Vertiges', 'Douleur lombaire', 'Œdèmes des membres inférieurs',
];

const PRIORITY_CONFIG: Record<ConsultationPriority, { label: string; color: string; bg: string; dot: string }> = {
  normale:      { label: 'Normale',      color: 'text-gray-600',  bg: 'bg-gray-100',  dot: 'bg-gray-400' },
  urgente:      { label: 'Urgente',      color: 'text-amber-700', bg: 'bg-amber-100', dot: 'bg-amber-500' },
  tres_urgente: { label: 'Très urgente', color: 'text-red-700',   bg: 'bg-red-100',   dot: 'bg-red-500' },
};

// ─── Medical Alert Banner ─────────────────────────────────────────────────────

function MedicalAlertBanner({ patient }: { patient: Patient | null }) {
  if (!patient) return null;

  type AlertItem = { label: string; color: string };
  const alerts: AlertItem[] = [];

  const allergies = patient.medical?.allergies ?? [];
  const diseases  = patient.medical?.chronicDiseases ?? [];

  allergies.forEach(a => alerts.push({ label: `Allergie : ${a}`, color: 'red' }));
  if (diseases.some(d => /diab/i.test(d)))        alerts.push({ label: 'Diabète',              color: 'amber' });
  if (diseases.some(d => /hypert/i.test(d)))      alerts.push({ label: 'Hypertension',          color: 'orange' });
  if (diseases.some(d => /grossesse|grav/i.test(d))) alerts.push({ label: 'Grossesse',          color: 'pink' });
  if (diseases.some(d => /anticoag/i.test(d)))    alerts.push({ label: 'Anticoagulant',         color: 'purple' });
  const rareGroups = ['AB-', 'B-', 'A-', 'O-'];
  // @ts-ignore — bloodGroup optional on Patient
  if (rareGroups.includes(patient.bloodGroup))    alerts.push({ label: `Groupe sanguin rare : ${patient.bloodGroup}`, color: 'violet' });
  const other = diseases.filter(d => !/diab|hypert|grossesse|grav|anticoag/i.test(d));
  if (other.length) alerts.push({ label: `Maladie chronique : ${other.join(', ')}`, color: 'blue' });
  if (patient.medical?.criticalNotes)             alerts.push({ label: 'Patient à risque critique', color: 'red' });

  if (!alerts.length) return null;

  const colorMap: Record<string, string> = {
    red:    'bg-red-50 border-red-200 text-red-700',
    amber:  'bg-amber-50 border-amber-200 text-amber-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    pink:   'bg-pink-50 border-pink-200 text-pink-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    violet: 'bg-violet-50 border-violet-200 text-violet-700',
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
  };

  return (
    <div className="border border-red-200 rounded-xl bg-red-50 px-4 py-3 mb-2">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={13} className="text-red-600 shrink-0" />
        <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Alertes médicales</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {alerts.map((a, i) => (
          <span key={i} className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', colorMap[a.color])}>
            {a.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Step 1: Patient Selector ─────────────────────────────────────────────────

function PatientSelector({ selected, onSelect }: { selected: Patient | null; onSelect: (p: Patient | null) => void }) {
  const [query, setQuery] = useState('');
  const [, setLocation] = useLocation();
  const q = query.toLowerCase();

  // Use the real API patient list for search (no mock data)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: apiPatients } = useGetPatientsList({} as any);
  const patientList = Array.isArray(apiPatients) ? apiPatients as unknown as Record<string, unknown>[] : [];

  const results: Patient[] = q.length > 1
    ? patientList
        .filter(p => `${p.lastName} ${p.firstName} ${p.mpiId} ${p.phone}`.toLowerCase().includes(q))
        .slice(0, 6)
        .map(p => ({
          id:          p.id as string,
          mpiId:       (p.mpiId as string) ?? '',
          fileNumber:  (p.internalNumber as string) ?? '',
          firstName:   (p.firstName as string) ?? '',
          lastName:    (p.lastName as string) ?? '',
          status:      (p.status as Patient['status']) ?? 'active',
          gender:      (p.gender as Patient['gender']) ?? 'M',
          dateOfBirth: (p.dateOfBirth as string) ?? '',
          phone:       (p.phone as string) ?? '',
          isIncomplete: false, potentialDuplicate: false, syncStatus: 'synced' as const,
          createdAt:   (p.createdAt as string) ?? '', updatedAt: (p.updatedAt as string) ?? '',
          siteId: 'site-1', createdById: 'system',
        } as Patient))
    : [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Recherchez un patient existant par nom, MPI ou téléphone.</p>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Nom, prénom, N° MPI, téléphone…"
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          autoFocus
        />
      </div>

      {results.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-50">
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => { onSelect(p); setQuery(''); }}
              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-blue-50 transition-colors text-left"
            >
              <PatientAvatar firstName={p.firstName} lastName={p.lastName} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{p.lastName} {p.firstName}</p>
                <p className="text-xs text-gray-500 font-mono">{p.mpiId} · {p.phone}</p>
              </div>
              {p.medical?.criticalNotes && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex-shrink-0">⚠ Critique</span>
              )}
            </button>
          ))}
        </div>
      )}

      {query.length > 1 && results.length === 0 && (
        <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-xl space-y-2">
          <p className="text-sm">Aucun patient trouvé pour « {query} »</p>
          <button
            onClick={() => setLocation('/patients')}
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
          >
            <ExternalLink size={13} /> Créer un nouveau patient dans le module Patients
          </button>
        </div>
      )}

      {selected && (
        <div className="border-2 border-blue-500 rounded-xl p-4 bg-blue-50">
          <div className="flex items-start gap-3">
            <PatientAvatar firstName={selected.firstName} lastName={selected.lastName} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-900">{selected.lastName} {selected.firstName}</p>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono">{selected.mpiId}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{selected.phone}{selected.wilaya ? ` · ${selected.wilaya}` : ''}</p>
              {(selected.medical?.allergies?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {selected.medical!.allergies.map(a => (
                    <span key={a} className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">⚠ {a}</span>
                  ))}
                </div>
              )}
              {(selected.medical?.chronicDiseases?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {selected.medical!.chronicDiseases.map(d => (
                    <span key={d} className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">{d}</span>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => onSelect(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Context Form ─────────────────────────────────────────────────────

interface CtxState {
  serviceId: string; specialtyId: string; doctorId: string;
  date: string; time: string;
  type: ConsultationType; origin: ConsultationOrigin;
  reason: string; reasonDescription: string;
  companion: string; priority: ConsultationPriority;
}

function ContextFormStep({ form, onChange, patient }: {
  form: CtxState; onChange: (f: CtxState) => void; patient: Patient | null;
}) {
  const [motifOpen, setMotifOpen] = useState(false);
  const motifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (motifRef.current && !motifRef.current.contains(e.target as Node)) setMotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const set = <K extends keyof CtxState>(k: K, v: CtxState[K]) => onChange({ ...form, [k]: v });

  // Cascade
  const serviceNode    = SERVICE_TREE.find(s => s.id === form.serviceId);
  const availableSpecs = serviceNode?.specialties ?? [];
  const specialtyNode  = availableSpecs.find(sp => sp.id === form.specialtyId);
  const availableDocs  = specialtyNode?.doctors ?? [];

  const handleServiceChange = (id: string) => onChange({ ...form, serviceId: id, specialtyId: '', doctorId: '' });
  const handleSpecialtyChange = (id: string) => onChange({ ...form, specialtyId: id, doctorId: '' });
  const handleOriginChange = (origin: ConsultationOrigin) => {
    onChange({ ...form, origin, type: ORIGIN_TYPE_MAP[origin] ?? form.type });
  };

  const filteredMotif = MOTIF_SUGGESTIONS.filter(m =>
    form.reason.length === 0 || m.toLowerCase().includes(form.reason.toLowerCase())
  );

  const SEL = (disabled = false) => cn(
    'w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors',
    disabled ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-gray-200'
  );
  const INP = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';

  return (
    <div className="space-y-4">
      <MedicalAlertBanner patient={patient} />

      {/* Priorité */}
      <div>
        <label className="text-xs font-medium text-gray-600 mb-2 block">Priorité *</label>
        <div className="flex gap-2">
          {(Object.entries(PRIORITY_CONFIG) as [ConsultationPriority, typeof PRIORITY_CONFIG[ConsultationPriority]][]).map(([key, cfg]) => (
            <button key={key} type="button"
              onClick={() => set('priority', key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border-2 text-xs font-semibold transition-all',
                form.priority === key
                  ? `${cfg.bg} ${cfg.color} border-current`
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              )}
            >
              <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cascade: Service → Spécialité → Médecin */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Service *</label>
          <select value={form.serviceId} onChange={e => handleServiceChange(e.target.value)} className={SEL()}>
            <option value="">Sélectionner un service…</option>
            {SERVICE_TREE.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={cn('text-xs font-medium mb-1 block', form.serviceId ? 'text-gray-600' : 'text-gray-400')}>
            Spécialité *
            {!form.serviceId && <span className="font-normal"> — sélectionnez d'abord un service</span>}
          </label>
          <select value={form.specialtyId} onChange={e => handleSpecialtyChange(e.target.value)}
            disabled={!form.serviceId} className={SEL(!form.serviceId)}>
            <option value="">Sélectionner une spécialité…</option>
            {availableSpecs.map(sp => <option key={sp.id} value={sp.id}>{sp.label}</option>)}
          </select>
        </div>
        <div>
          <label className={cn('text-xs font-medium mb-1 block', form.specialtyId ? 'text-gray-600' : 'text-gray-400')}>
            Médecin *
            {!form.specialtyId && <span className="font-normal"> — sélectionnez d'abord une spécialité</span>}
          </label>
          <select value={form.doctorId} onChange={e => set('doctorId', e.target.value)}
            disabled={!form.specialtyId} className={SEL(!form.specialtyId)}>
            <option value="">Sélectionner un médecin…</option>
            {availableDocs.map(d => <option key={d.id} value={d.id}>{d.name} — {d.title}</option>)}
          </select>
        </div>
      </div>

      {/* Origine → Type */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Origine</label>
          <select value={form.origin}
            onChange={e => handleOriginChange(e.target.value as ConsultationOrigin)}
            className={SEL()}>
            {EXTENDED_ORIGINS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Type de consultation *
            <span className="font-normal text-gray-400 ml-1">(auto-rempli)</span>
          </label>
          <select value={form.type} onChange={e => set('type', e.target.value as ConsultationType)} className={SEL()}>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* Date & Heure (24h) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Date *</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={INP} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Heure * <span className="font-normal text-gray-400">(24h)</span></label>
          <input type="time" value={form.time} onChange={e => set('time', e.target.value)} className={INP} />
        </div>
      </div>

      {/* Motif avec autocomplete */}
      <div ref={motifRef} className="relative">
        <label className="text-xs font-medium text-gray-600 mb-1 block">Motif de consultation *</label>
        <input
          type="text"
          value={form.reason}
          onChange={e => { set('reason', e.target.value); setMotifOpen(true); }}
          onFocus={() => setMotifOpen(true)}
          placeholder="Fièvre, douleur thoracique, contrôle…"
          className={INP}
          autoComplete="off"
        />
        {motifOpen && filteredMotif.length > 0 && (
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
            {filteredMotif.slice(0, 8).map(m => (
              <button key={m} type="button"
                onMouseDown={() => { set('reason', m); setMotifOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Description complémentaire */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Description complémentaire <span className="font-normal">(optionnel)</span></label>
        <textarea value={form.reasonDescription} onChange={e => set('reasonDescription', e.target.value)}
          rows={2} placeholder="Précisions supplémentaires sur le motif…"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
      </div>

      {/* Accompagnant */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Accompagnant <span className="font-normal">(optionnel)</span></label>
        <input type="text" value={form.companion} onChange={e => set('companion', e.target.value)}
          placeholder="Nom de l'accompagnant" className={INP} />
      </div>
    </div>
  );
}

// ─── Step 3: Vital Signs ──────────────────────────────────────────────────────

type VS = Partial<VitalSigns>;

function VitalsStep({ vitals, onChange, patient }: { vitals: VS; onChange: (v: VS) => void; patient: Patient | null }) {
  const setNum = (k: keyof VS, raw: string) => {
    const num = parseFloat(raw);
    const next: VS = { ...vitals, [k]: isNaN(num) ? undefined : num };
    if (next.weight && next.height) {
      next.bmi = parseFloat((next.weight / Math.pow(next.height / 100, 2)).toFixed(1));
    }
    onChange(next);
  };
  const setStr = (k: keyof VS, v: string) => onChange({ ...vitals, [k]: v || undefined });
  const setBool = (k: keyof VS, v: boolean) => onChange({ ...vitals, [k]: v });

  const INP = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';
  const alertCls = (k: keyof VS, lo: number, hi: number) => {
    const v = vitals[k] as number | undefined;
    return !v ? '' : (v < lo || v > hi) ? 'border-red-400 bg-red-50' : 'border-green-300';
  };
  const isAbn = (k: keyof VS, lo: number, hi: number) => {
    const v = vitals[k] as number | undefined;
    return v !== undefined && (v < lo || v > hi);
  };

  const abnLabels: string[] = [
    isAbn('temperature',     36,   38.5) && 'Température',
    isAbn('systolicBP',      90,   140)  && 'Tension systolique',
    isAbn('diastolicBP',     60,   90)   && 'Tension diastolique',
    isAbn('heartRate',       60,   100)  && 'Fréq. cardiaque',
    isAbn('respiratoryRate', 12,   20)   && 'Fréq. respiratoire',
    isAbn('oxygenSaturation',95,   100)  && 'Saturation O₂',
    isAbn('bloodGlucose',    3.9,  7.8)  && 'Glycémie',
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <MedicalAlertBanner patient={patient} />

      {abnLabels.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>Valeurs anormales détectées : <strong>{abnLabels.join(', ')}</strong></span>
        </div>
      )}

      {/* Standard numeric vitals */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {([
          { key: 'weight',            label: 'Poids',              unit: 'kg',     lo: 30,  hi: 300  },
          { key: 'height',            label: 'Taille',             unit: 'cm',     lo: 50,  hi: 250  },
          { key: 'temperature',       label: 'Température',        unit: '°C',     lo: 36,  hi: 38.5 },
          { key: 'systolicBP',        label: 'Tension syst.',      unit: 'mmHg',   lo: 90,  hi: 140  },
          { key: 'diastolicBP',       label: 'Tension diast.',     unit: 'mmHg',   lo: 60,  hi: 90   },
          { key: 'heartRate',         label: 'Fréq. cardiaque',    unit: 'bpm',    lo: 60,  hi: 100  },
          { key: 'respiratoryRate',   label: 'Fréq. respiratoire', unit: '/min',   lo: 12,  hi: 20   },
          { key: 'oxygenSaturation',  label: 'Saturation O₂',      unit: '%',      lo: 95,  hi: 100  },
          { key: 'bloodGlucose',      label: 'Glycémie',           unit: 'mmol/L', lo: 3.9, hi: 7.8  },
          { key: 'painLevel',         label: 'Douleur (0–10)',      unit: '/10',    lo: 0,   hi: 10   },
        ] as const).map(f => (
          <div key={f.key}>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{f.label}</label>
            <div className="flex gap-1.5 items-center">
              <input type="number" step="0.1"
                value={(vitals[f.key as keyof VS] as number | undefined) ?? ''}
                onChange={e => setNum(f.key as keyof VS, e.target.value)}
                className={cn(INP, 'flex-1', alertCls(f.key as keyof VS, f.lo, f.hi))}
                placeholder="—" />
              <span className="text-xs text-gray-400 whitespace-nowrap">{f.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Auto-BMI */}
      {vitals.bmi && (
        <div className={cn('flex items-center gap-3 p-3 rounded-lg text-sm font-medium',
          vitals.bmi < 18.5 ? 'bg-blue-50 text-blue-700' :
          vitals.bmi < 25   ? 'bg-green-50 text-green-700' :
          vitals.bmi < 30   ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'
        )}>
          <span>IMC calculé :</span>
          <span className="font-bold">{vitals.bmi}</span>
          <span>
            {vitals.bmi < 18.5 ? '— Insuffisance pondérale' :
             vitals.bmi < 25   ? '— Poids normal ✓' :
             vitals.bmi < 30   ? '— Surpoids' : '— Obésité'}
          </span>
        </div>
      )}

      {/* Additional fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Tour de taille</label>
          <div className="flex gap-1.5 items-center">
            <input type="number" step="0.5"
              value={vitals.waistCircumference ?? ''}
              onChange={e => setNum('waistCircumference', e.target.value)}
              className={cn(INP, 'flex-1')} placeholder="—" />
            <span className="text-xs text-gray-400">cm</span>
          </div>
        </div>
        <div>
          <label className={cn('text-xs font-medium text-gray-600 mb-1 block')}>
            Score de Glasgow <span className="font-normal text-gray-400">(optionnel)</span>
          </label>
          <div className="flex gap-1.5 items-center">
            <input type="number" step="1" min={3} max={15}
              value={vitals.glasgowScore ?? ''}
              onChange={e => setNum('glasgowScore', e.target.value)}
              className={cn(INP, 'flex-1',
                vitals.glasgowScore !== undefined && vitals.glasgowScore < 8  ? 'border-red-400 bg-red-50' :
                vitals.glasgowScore !== undefined && vitals.glasgowScore < 14 ? 'border-amber-400 bg-amber-50' : ''
              )} placeholder="3–15" />
            <span className="text-xs text-gray-400">/15</span>
          </div>
        </div>
      </div>

      {/* État de conscience */}
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">État de conscience</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([
            { value: 'alerte',      label: 'Alerte',              color: 'green' },
            { value: 'voix',        label: 'Répond à la voix',    color: 'blue'  },
            { value: 'douleur',     label: 'Répond à la douleur', color: 'amber' },
            { value: 'inconscient', label: 'Inconscient',         color: 'red'   },
          ] as const).map(opt => {
            const sel = vitals.consciousnessState === opt.value;
            const colMap: Record<string, string> = {
              green: 'border-green-500 bg-green-50 text-green-700',
              blue:  'border-blue-500 bg-blue-50 text-blue-700',
              amber: 'border-amber-500 bg-amber-50 text-amber-700',
              red:   'border-red-500 bg-red-50 text-red-700',
            };
            return (
              <button key={opt.value} type="button"
                onClick={() => setStr('consciousnessState', sel ? '' : opt.value)}
                className={cn(
                  'py-2 px-2 rounded-lg border-2 text-xs font-medium transition-all text-center',
                  sel ? colMap[opt.color] : 'border-gray-200 text-gray-500 hover:border-gray-300'
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Oxygène */}
      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox"
            checked={vitals.oxygenAdministered ?? false}
            onChange={e => onChange({
              ...vitals,
              oxygenAdministered: e.target.checked,
              oxygenFlowRate: e.target.checked ? vitals.oxygenFlowRate : undefined,
            })}
            className="rounded border-gray-300 text-blue-600" />
          Oxygène administré
        </label>
        {vitals.oxygenAdministered && (
          <div className="flex items-center gap-2">
            <input type="number" step="0.5" min={0} max={15}
              value={vitals.oxygenFlowRate ?? ''}
              onChange={e => setNum('oxygenFlowRate', e.target.value)}
              className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="—" />
            <span className="text-xs text-gray-500">L/min</span>
          </div>
        )}
      </div>

      {/* Grossesse */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox"
          checked={vitals.pregnancy ?? false}
          onChange={e => setBool('pregnancy', e.target.checked)}
          className="rounded border-gray-300 text-blue-600" />
        Grossesse en cours
      </label>

      {/* Commentaire clinique */}
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Commentaire clinique</label>
        <textarea value={vitals.clinicalComment ?? ''} onChange={e => setStr('clinicalComment', e.target.value)}
          rows={2} placeholder="Observations cliniques rapides…"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
      </div>

      {/* Notes infirmières */}
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Notes infirmières</label>
        <textarea value={vitals.nursingNotes ?? ''} onChange={e => setStr('nursingNotes', e.target.value)}
          rows={2} placeholder="Observations infirmières…"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, icon: User,        label: 'Patient' },
  { id: 2, icon: Stethoscope, label: 'Contexte' },
  { id: 3, icon: Activity,    label: 'Signes vitaux' },
];

interface Props {
  onClose: () => void;
  onCreated: (c: Partial<Consultation>) => Promise<boolean>;
  initialPatientId?: string;
}

function getNow() {
  const d = new Date();
  const date = d.toISOString().split('T')[0];
  const hh   = String(d.getHours()).padStart(2, '0');
  const mm   = String(d.getMinutes()).padStart(2, '0');
  return { date, time: `${hh}:${mm}` };
}

export function ConsultationForm({ onClose, onCreated, initialPatientId }: Props) {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [patient, setPatient] = useState<Patient | null>(null);

  // If opened with a pre-selected patient ID, fetch it from the real API
  useEffect(() => {
    if (!initialPatientId) return;
    import('@/services/api/client').then(({ apiClient }) =>
      apiClient.get<Record<string, unknown>>(`/patients/${initialPatientId}`)
        .then(r => setPatient({
          id:          r.id as string,
          mpiId:       (r.mpiId as string) ?? '',
          fileNumber:  (r.internalNumber as string) ?? '',
          firstName:   (r.firstName as string) ?? '',
          lastName:    (r.lastName as string) ?? '',
          status:      (r.status as Patient['status']) ?? 'active',
          gender:      (r.gender as Patient['gender']) ?? 'M',
          dateOfBirth: (r.dateOfBirth as string) ?? '',
          phone:       (r.phone as string) ?? '',
          isIncomplete: false, potentialDuplicate: false, syncStatus: 'synced' as const,
          createdAt: '', updatedAt: '', siteId: 'site-1', createdById: 'system',
        } as Patient))
        .catch(() => {})
    );
  }, [initialPatientId]);
  const { date: today, time: nowTime } = getNow();
  const [ctx, setCtx] = useState<CtxState>({
    serviceId: '', specialtyId: '', doctorId: '',
    date: today, time: nowTime,
    type: 'programmee', origin: 'rdv',
    reason: '', reasonDescription: '', companion: '',
    priority: 'normale',
  });
  const [vitals, setVitals] = useState<VS>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedService  = SERVICE_TREE.find(s => s.id === ctx.serviceId);
  const selectedSpecialty = selectedService?.specialties.find(sp => sp.id === ctx.specialtyId);
  const selectedDoctor    = selectedSpecialty?.doctors.find(d => d.id === ctx.doctorId);

  const canNext = step === 1
    ? !!patient
    : step === 2
    ? !!(ctx.doctorId && ctx.specialtyId && ctx.serviceId && ctx.date && ctx.time && ctx.reason)
    : true;

  const handleCreate = async () => {
    if (isSubmitting) return;
    setSubmitError(null);
    setIsSubmitting(true);

    const now = new Date().toISOString();
    const id  = `c-new-${Date.now()}`;
    const num = `CON-2026-${String(Math.floor(Math.random() * 900) + 100).padStart(4, '0')}`;

    const newConsultation = {
      id, number: num,
      patientId:   patient!.id,
      patientName: `${patient!.lastName} ${patient!.firstName}`,
      patientMpi:  patient!.mpiId,
      doctorId:    ctx.doctorId,
      doctorName:  selectedDoctor?.name ?? ctx.doctorId,
      specialty:   selectedSpecialty?.label ?? ctx.specialtyId,
      serviceId:   ctx.serviceId,
      serviceName: selectedService?.label ?? ctx.serviceId,
      siteId:      'site-main',
      siteName:    'IRISSAM Hospital',
      date:        ctx.date,
      scheduledAt: `${ctx.date}T${ctx.time}:00`,
      type:        ctx.type,
      origin:      ctx.origin,
      reason:      ctx.reason + (ctx.reasonDescription ? `\n${ctx.reasonDescription}` : ''),
      companion:   ctx.companion || undefined,
      priority:    ctx.priority,
      status:      'en_attente' as const,
      syncStatus:  'pending'    as const,
      vitalSigns:  Object.keys(vitals).length > 0 ? (vitals as VitalSigns) : undefined,
      createdAt:   now,
      updatedAt:   now,
      createdById: 'u-current',
    } as Consultation;

    addSessionConsultation(newConsultation);
    const success = await onCreated(newConsultation);
    setIsSubmitting(false);

    if (success) {
      setLocation(`/consultations/${id}`);
    } else {
      setSubmitError("Échec de l'enregistrement – veuillez réessayer");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[95dvh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900 text-lg">Nouvelle consultation</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center px-6 pt-4 pb-3">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const done   = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                    done   ? 'bg-green-500 text-white' :
                    active ? 'bg-blue-600 text-white' :
                             'bg-gray-100 text-gray-400'
                  )}>
                    {done ? <Check size={14} /> : <Icon size={14} />}
                  </div>
                  <span className={cn('text-xs whitespace-nowrap',
                    active ? 'font-semibold text-blue-700' : done ? 'text-green-600' : 'text-gray-400')}>
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={cn('flex-1 h-px mx-2 mb-4', step > s.id ? 'bg-green-400' : 'bg-gray-200')} />
                )}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 1 && <PatientSelector selected={patient} onSelect={setPatient} />}
          {step === 2 && <ContextFormStep form={ctx} onChange={setCtx} patient={patient} />}
          {step === 3 && <VitalsStep vitals={vitals} onChange={setVitals} patient={patient} />}
        </div>

        {/* Submission error banner */}
        {submitError && (
          <div className="mx-6 mb-0 mt-0 flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
            <AlertTriangle size={14} className="shrink-0" />
            <span className="flex-1">{submitError}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={step === 1 ? onClose : () => setStep(s => s - 1)}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-50"
          >
            <ChevronLeft size={15} /> {step === 1 ? 'Annuler' : 'Retour'}
          </button>

          <div className="flex items-center gap-3">
            {/* Priority badge in footer (steps 2+) */}
            {step >= 2 && ctx.priority !== 'normale' && (
              <span className={cn('text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5',
                PRIORITY_CONFIG[ctx.priority].bg, PRIORITY_CONFIG[ctx.priority].color)}>
                <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_CONFIG[ctx.priority].dot)} />
                {PRIORITY_CONFIG[ctx.priority].label}
              </span>
            )}
            <button
              onClick={step < 3 ? () => setStep(s => s + 1) : handleCreate}
              disabled={!canNext || isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {step < 3
                ? <><ChevronRight size={15} /> Suivant</>
                : isSubmitting
                ? <><RefreshCw size={15} className="animate-spin" /> Enregistrement…</>
                : submitError
                ? <><Check size={15} /> Réessayer</>
                : <><Check size={15} /> Créer la consultation</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
