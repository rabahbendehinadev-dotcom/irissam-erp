import { useState, useRef, useEffect } from 'react';
import {
  X, Search, ChevronRight, ChevronLeft, Stethoscope, User, UserPlus,
  Check, ExternalLink, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { PatientAvatar } from '@/components/shared/PatientAvatar';
import { apiClient } from '@/services/api/client';
import { useAuth } from '@/store/AuthContext';
import { useGetPatientsList } from '@workspace/api-client-react';
import type { Patient } from '@/types';
import type {
  ConsultationType, ConsultationOrigin, ConsultationPriority,
} from '@/types/consultation';

// ─── Référentiel réel (PostgreSQL via /directory) ────────────────────────────

/** Département (service hospitalier) réel — /directory/departments. */
interface DirectoryDepartment { id: string; name: string }
/** Médecin réel (users.role = doctor) — /directory/doctors. */
interface DirectoryDoctor { id: string; firstName: string; lastName: string; fullName: string; specialty: string }

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
  walk_in:         'sans_rdv',
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

// ─── Step 1bis : Patient de passage (walk-in) ─────────────────────────────────

interface WalkInState { fullName: string; phone: string; birthDate: string; gender: '' | 'M' | 'F' }

function WalkInFieldsStep({ value, onChange }: { value: WalkInState; onChange: (w: WalkInState) => void }) {
  const set = <K extends keyof WalkInState>(k: K, v: WalkInState[K]) => onChange({ ...value, [k]: v });
  const today = new Date().toISOString().slice(0, 10);
  const INP = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';
  return (
    <div className="space-y-4">
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
        <p className="font-semibold mb-0.5">Patient de passage — sans dossier permanent</p>
        <p>
          Identité minimale pour ne pas bloquer la prise en charge. Un identifiant
          provisoire <span className="font-mono">EXT-…</span> sera attribué ; la consultation pourra être
          <strong> rattachée plus tard</strong> à un dossier patient réel, sans ressaisie ni doublon.
        </p>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Nom complet *</label>
        <input
          type="text"
          value={value.fullName}
          onChange={e => set('fullName', e.target.value)}
          placeholder="Nom et prénom du patient"
          maxLength={200}
          autoFocus
          className={INP}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Téléphone <span className="font-normal">(optionnel)</span></label>
          <input type="tel" value={value.phone} onChange={e => set('phone', e.target.value)}
            placeholder="05 XX XX XX XX" maxLength={30} className={INP} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Date de naissance <span className="font-normal">(optionnel)</span></label>
          <input type="date" value={value.birthDate} max={today} onChange={e => set('birthDate', e.target.value)} className={INP} />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Sexe <span className="font-normal">(optionnel)</span></label>
        <div className="flex gap-2">
          {([['', 'Non précisé'], ['M', 'Masculin'], ['F', 'Féminin']] as const).map(([v, label]) => (
            <button
              key={v || 'na'}
              type="button"
              onClick={() => set('gender', v)}
              className={cn('flex-1 py-2 px-3 rounded-lg border-2 text-xs font-semibold transition-all',
                value.gender === v
                  ? 'bg-blue-50 text-blue-700 border-blue-400'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Context Form ─────────────────────────────────────────────────────

interface CtxState {
  serviceId: string; doctorId: string;
  date: string; time: string;
  type: ConsultationType; origin: ConsultationOrigin;
  reason: string; reasonDescription: string;
  companion: string; priority: ConsultationPriority;
}

function ContextFormStep({ form, onChange, patient, services, doctors, dirError, doctorLocked }: {
  form: CtxState; onChange: (f: CtxState) => void; patient: Patient | null;
  services: DirectoryDepartment[]; doctors: DirectoryDoctor[]; dirError: boolean;
  doctorLocked?: boolean;
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

  // Référentiel réel : la spécialité affichée est déduite du médecin choisi
  const selectedDoctor = doctors.find(d => d.id === form.doctorId);

  const handleServiceChange = (id: string) => onChange({ ...form, serviceId: id });
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

      {/* Référentiel réel PostgreSQL : Service + Médecin (spécialité déduite) */}
      <div className="space-y-3">
        {dirError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>Impossible de charger le référentiel réel (services / médecins). Vérifiez la connexion puis rouvrez le formulaire.</span>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Service *</label>
          <select value={form.serviceId} onChange={e => handleServiceChange(e.target.value)} className={SEL()}>
            <option value="">Sélectionner un service…</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Médecin *</label>
          <select
            value={form.doctorId}
            onChange={e => set('doctorId', e.target.value)}
            disabled={doctorLocked}
            className={SEL(doctorLocked)}
          >
            <option value="">Sélectionner un médecin…</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>Dr {d.fullName}{d.specialty ? ` — ${d.specialty}` : ''}</option>
            ))}
          </select>
          {doctorLocked && (
            <p className="text-[11px] text-gray-400 mt-1">
              Verrouillé sur votre identité — chaque consultation est tracée au nom du médecin connecté.
            </p>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-400 mb-1 block">Spécialité <span className="font-normal">(déduite du médecin)</span></label>
          <input type="text" value={selectedDoctor?.specialty ?? ''} disabled placeholder="—" className={cn(INP, 'bg-gray-50 text-gray-500')} />
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

// ─── Main Wizard ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, icon: User,        label: 'Patient' },
  { id: 2, icon: Stethoscope, label: 'Contexte' },
];

interface Props {
  onClose: () => void;
  /** Rafraîchit la liste depuis l'API après création — résout à true si OK. */
  onCreated: () => Promise<boolean>;
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
  const { user } = useAuth();
  const isDoctor = user?.role === 'doctor';
  const [step, setStep] = useState(1);
  const [patient, setPatient] = useState<Patient | null>(null);
  // Patient enregistré ou patient de passage (walk-in, identité minimale)
  const [mode, setMode] = useState<'registered' | 'walkin'>('registered');
  const [walkIn, setWalkIn] = useState<WalkInState>({ fullName: '', phone: '', birthDate: '', gender: '' });

  // If opened with a pre-selected patient ID, fetch it from the real API.
  // Échec visible (pas de catch silencieux) : l'utilisateur peut toujours
  // rechercher le patient manuellement à l'étape 1.
  useEffect(() => {
    if (!initialPatientId) return;
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
      .catch(() => {
        setSubmitError('Impossible de charger le patient présélectionné — recherchez-le manuellement ci-dessous.');
      });
  }, [initialPatientId]);
  const { date: today, time: nowTime } = getNow();
  const [ctx, setCtx] = useState<CtxState>({
    serviceId: '', doctorId: '',
    date: today, time: nowTime,
    type: 'programmee', origin: 'rdv',
    reason: '', reasonDescription: '', companion: '',
    priority: 'normale',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Référentiel réel : départements + médecins depuis PostgreSQL (/directory)
  const [services, setServices] = useState<DirectoryDepartment[]>([]);
  const [doctors, setDoctors] = useState<DirectoryDoctor[]>([]);
  const [dirError, setDirError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiClient.get<DirectoryDepartment[]>('/directory/departments'),
      apiClient.get<DirectoryDoctor[]>('/directory/doctors'),
    ])
      .then(([depts, docs]) => {
        if (cancelled) return;
        setServices(Array.isArray(depts) ? depts : []);
        setDoctors(Array.isArray(docs) ? docs : []);
      })
      .catch(() => { if (!cancelled) setDirError(true); });
    return () => { cancelled = true; };
  }, []);

  // Médecin connecté : identité verrouillée (traçabilité — pas de consultation
  // au nom d'un confrère). Le serveur applique la même règle (403).
  useEffect(() => {
    if (!isDoctor || !user?.id) return;
    setCtx(prev => (prev.doctorId === user.id ? prev : { ...prev, doctorId: user.id }));
  }, [isDoctor, user?.id]);

  const selectedService = services.find(s => s.id === ctx.serviceId);
  const selectedDoctor  = doctors.find(d => d.id === ctx.doctorId);

  const walkInValid =
    walkIn.fullName.trim().length >= 2 &&
    (!walkIn.birthDate || walkIn.birthDate <= today);

  const canNext = step === 1
    ? (mode === 'registered' ? !!patient : walkInValid)
    : !!(ctx.doctorId && ctx.serviceId && ctx.date && ctx.time && ctx.reason);

  const handleCreate = async () => {
    if (isSubmitting) return;
    setSubmitError(null);
    setIsSubmitting(true);

    // Valeurs du wizard → enums PostgreSQL (consultations.type / .origin)
    const API_TYPE: Record<string, string> = {
      programmee: 'consultation_externe', sans_rdv: 'consultation_externe',
      controle: 'consultation_externe', specialisee: 'consultation_externe',
      ambulatoire: 'consultation_externe', teleconsultation: 'teleconsultation',
      urgences: 'urgence', hospitalisation: 'hospitalier',
    };
    const API_ORIGIN: Record<string, string> = {
      rdv: 'rdv', sans_rdv: 'walk_in', urgence: 'urgence',
      hospitalisation: 'hospitalisation', admission: 'hospitalisation', controle: 'rdv',
    };

    const reason = ctx.reason + (ctx.reasonDescription ? `\n${ctx.reasonDescription}` : '');

    try {
      // Persistance réelle d'abord : la consultation existe en PostgreSQL
      // avec un vrai UUID et un vrai numéro CONS-… (plus de `c-new-*` volatile).
      // Identifiants RÉELS uniquement : le serveur vérifie patientId/doctorId
      // en base, résout lui-même les noms/MPI et le service (400 sinon).
      const created = await apiClient.post<{ id: string; number: string }>('/consultations', {
        // Patient enregistré (patientId réel) OU patient de passage (walkIn :
        // identité minimale → MPI provisoire EXT-… généré par le serveur).
        ...(mode === 'walkin'
          ? {
              walkIn: {
                fullName:  walkIn.fullName.trim(),
                phone:     walkIn.phone.trim() || undefined,
                birthDate: walkIn.birthDate || undefined,
                gender:    walkIn.gender || undefined,
              },
            }
          : { patientId: patient!.id }),
        doctorId:    ctx.doctorId,
        serviceName: selectedService?.name,
        specialty:   selectedDoctor?.specialty || undefined,
        scheduledAt: `${ctx.date}T${ctx.time}:00`,
        type:        API_TYPE[ctx.type] ?? 'consultation_externe',
        origin:      mode === 'walkin' ? 'walk_in' : (API_ORIGIN[ctx.origin] ?? 'rdv'),
        motif:       reason,
        status:      'en_attente',
      });

      // La ligne affichée provient ensuite du refetch API (PostgreSQL) —
      // aucune copie de session, aucune donnée fictive.
      const success = await onCreated();
      setIsSubmitting(false);

      if (success) {
        setLocation(`/consultations/${created.id}`);
      } else {
        setSubmitError("Échec de l'enregistrement – veuillez réessayer");
      }
    } catch (e) {
      setIsSubmitting(false);
      setSubmitError(e instanceof Error ? e.message : "Échec de l'enregistrement – veuillez réessayer");
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
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('registered')}
                  className={cn('flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all',
                    mode === 'registered'
                      ? 'bg-blue-50 text-blue-700 border-blue-400'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300')}
                >
                  <User size={14} /> Patient enregistré
                </button>
                <button
                  type="button"
                  onClick={() => setMode('walkin')}
                  className={cn('flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all',
                    mode === 'walkin'
                      ? 'bg-amber-50 text-amber-700 border-amber-400'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300')}
                >
                  <UserPlus size={14} /> Patient de passage
                </button>
              </div>
              {mode === 'registered'
                ? <PatientSelector selected={patient} onSelect={setPatient} />
                : <WalkInFieldsStep value={walkIn} onChange={setWalkIn} />}
            </div>
          )}
          {step === 2 && (
            <ContextFormStep
              form={ctx}
              onChange={setCtx}
              patient={mode === 'registered' ? patient : null}
              services={services}
              doctors={doctors}
              dirError={dirError}
              doctorLocked={isDoctor}
            />
          )}
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
              onClick={step < 2 ? () => setStep(s => s + 1) : handleCreate}
              disabled={!canNext || isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {step < 2
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
