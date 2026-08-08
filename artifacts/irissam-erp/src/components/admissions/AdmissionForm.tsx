import { useState, useCallback, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Loader2, Search, UserCheck, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { useGetPatientsList } from '@workspace/api-client-react';
import { apiClient } from '@/services/api/client';
import { mapApiAdmission } from '@/hooks/useAdmissionsApi';
import type { Patient } from '@/types';
import type { Admission, AdmissionType, AdmissionPriority } from '@/types/admission';
import type { OccupancyBed } from '@/types/repository';
import { useAuditLog } from '@/hooks/useAuditLog';
import { PatientSummaryCard } from '@/components/patients/PatientSummaryCard';
import { BedSelector } from './BedSelector';

// ─── Form state ──────────────────────────────────────────────────────────────

type FormData = {
  type: AdmissionType;
  serviceId: string;
  doctorId: string;
  motif: string;
  priority: AdmissionPriority;
  admissionDate: string;
  admissionTime: string;
  expectedDischargeDate: string;
  preadmissionDate: string;
  notes: string;
};

/** Référentiel réel chargé depuis /directory (PostgreSQL). */
interface DirectoryDoctor { id: string; firstName: string; lastName: string; fullName: string; specialty: string }
interface DirectoryDepartment { id: string; name: string }

/** Map a raw API patient record to the local Patient type. */
function apiToPatient(r: Record<string, unknown>): Patient {
  return {
    id:               r.id as string,
    mpiId:            (r.mpiId as string) ?? '',
    fileNumber:       (r.fileNumber as string) ?? (r.internalNumber as string) ?? '',
    internalNumber:   (r.internalNumber as string) ?? '',
    firstName:        (r.firstName as string) ?? '',
    lastName:         (r.lastName as string) ?? '',
    status:           (r.status as Patient['status']) ?? 'active',
    gender:           (r.gender as Patient['gender']) ?? 'M',
    dateOfBirth:      (r.dateOfBirth as string) ?? '',
    phone:            (r.phone as string) ?? '',
    phoneSecondary:   (r.phoneSecondary as string) ?? undefined,
    bloodType:        (r.bloodType as Patient['bloodType']) ?? undefined,
    rhesus:           (r.rhesus as '+' | '-') ?? undefined,
    isIncomplete:     Boolean(r.isIncomplete),
    potentialDuplicate: Boolean(r.potentialDuplicate),
    syncStatus:       (r.syncStatus as Patient['syncStatus']) ?? 'synced',
    medical:          (r.medical as Patient['medical']) ?? { allergies: [], chronicDiseases: [], majorHistory: [] },
    createdAt:        (r.createdAt as string) ?? new Date().toISOString(),
    updatedAt:        (r.updatedAt as string) ?? new Date().toISOString(),
    siteId:           'site-1',
    createdById:      'system',
  } as Patient;
}

const inputCls  = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white';
const selectCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white disabled:bg-gray-50 disabled:text-gray-500';
const labelCls  = 'block text-xs font-medium text-gray-600 mb-1';

interface Props {
  admission?: Admission;
  /** Pré-sélectionne le patient en mode création (Actions rapides du dossier patient) */
  initialPatientId?: string;
  onSave: (data: Admission) => void;
  onCancel: () => void;
}

export function AdmissionForm({ admission, initialPatientId, onSave, onCancel }: Props) {
  const { t } = useLanguage();
  const { log } = useAuditLog();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEdit = !!admission;

  // API patient list — used for local search filtering (no mock data)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: apiPatients } = useGetPatientsList({} as any);

  // Référentiel réel : départements (services) + médecins depuis PostgreSQL
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

  // Step 1 state — patient search
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[] | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Patient imposé : édition d'une admission existante OU pré-sélection
  // depuis « Actions rapides » du dossier patient (initialPatientId)
  const presetPatientId = admission?.patientId ?? initialPatientId;
  useEffect(() => {
    if (!presetPatientId) return;
    const list = Array.isArray(apiPatients) ? apiPatients : [];
    const found = list.find((p: any) => p.id === presetPatientId);
    if (found) { setSelectedPatient(apiToPatient(found as any)); return; }
    // Fallback: direct fetch by ID
    apiClient.get<Record<string, unknown>>(`/patients/${presetPatientId}`)
      .then(r => setSelectedPatient(apiToPatient(r)))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetPatientId]);

  // Step 3 state — bed (OccupancyBed, occupé côté serveur par admit())
  const [selectedBed, setSelectedBed] = useState<OccupancyBed | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [form, setForm] = useState<FormData>(() => ({
    type:                  (admission?.type ?? 'hospitalisation') as AdmissionType,
    serviceId:             admission?.serviceId ?? '',
    doctorId:              admission?.doctorId ?? '',
    motif:                 admission?.motif ?? '',
    priority:              (admission?.priority ?? 'normal') as AdmissionPriority,
    admissionDate:         admission?.admissionDate ?? today,
    admissionTime:         admission?.admissionTime ?? nowTime,
    expectedDischargeDate: admission?.expectedDischargeDate ?? '',
    preadmissionDate:      admission?.preadmissionDate ?? '',
    notes:                 admission?.notes ?? '',
  }));

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [key]: e.target.value }));
    setErrors(e2 => ({ ...e2, [key]: '' }));
  };

  // Patient search — filters from the real API list (no mock data)
  const handleSearch = () => {
    if (!query.trim()) return;
    const q = query.toLowerCase();
    const list = Array.isArray(apiPatients) ? apiPatients as unknown as Record<string, unknown>[] : [];
    const results: Patient[] = list
      .filter(p =>
        `${p.mpiId} ${p.firstName} ${p.lastName} ${p.phone ?? ''}`.toLowerCase().includes(q)
      )
      .map(r => apiToPatient(r));
    setSearchResults(results);
  };

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (step === 0) {
      if (!selectedPatient) errs.patient = t('adm.form.search.required');
    }
    if (step === 1) {
      if (!form.serviceId) errs.serviceId = t('adm.form.required');
      if (!form.doctorId)  errs.doctorId  = t('adm.form.required');
      if (!form.motif.trim()) errs.motif  = t('adm.form.required');
      if (!form.admissionDate)  errs.admissionDate = t('adm.form.required');
      if (!form.admissionTime)  errs.admissionTime = t('adm.form.required');
      if (form.expectedDischargeDate && form.admissionDate && form.expectedDischargeDate < form.admissionDate) {
        errs.expectedDischargeDate = 'La date de sortie prévue ne peut pas précéder la date d\'admission.';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [step, form, selectedPatient, t]);

  const handleNext = () => {
    if (!validate()) return;
    setStep(s => s + 1);
  };

  /**
   * Enregistrement réel :
   *  - création → POST /admissions (le backend crée l'encounter, occupe le lit
   *    et écrit l'audit dans la même transaction)
   *  - édition  → PATCH /admissions/:id (seuls notes / date de sortie prévue
   *    sont modifiables après création)
   */
  const handleSave = async () => {
    if (!selectedPatient) return;
    if (!isEdit && !selectedBed) {
      setErrors(e => ({ ...e, bed: 'Sélectionnez un lit — l\'admission occupe un lit réel.' }));
      return;
    }
    if (form.expectedDischargeDate && form.admissionDate && form.expectedDischargeDate < form.admissionDate) {
      setErrors(e => ({ ...e, expectedDischargeDate: 'La date de sortie prévue ne peut pas précéder la date d\'admission.' }));
      return;
    }
    setSaving(true);
    setErrors(e => ({ ...e, submit: '' }));

    try {
      if (isEdit && admission) {
        const updated = await apiClient.patch<Record<string, unknown>>(`/admissions/${admission.id}`, {
          notes:                 form.notes || undefined,
          expectedDischargeDate: form.expectedDischargeDate || undefined,
        });
        log('update', 'admission', admission.id, `${form.type} — ${selectedPatient.lastName}`);
        onSave(mapApiAdmission(updated));
      } else {
        const service = services.find(s => s.id === form.serviceId);
        const doctor  = doctors.find(d => d.id === form.doctorId);
        const created = await apiClient.post<Record<string, unknown>>('/admissions', {
          patientId:     selectedPatient.id,
          patientMpiId:  selectedPatient.mpiId,
          patientName:   `${selectedPatient.lastName} ${selectedPatient.firstName}`,
          type:          form.type,
          priority:      form.priority,
          serviceId:     form.serviceId,
          serviceName:   service?.name ?? '',
          doctorId:      form.doctorId,
          doctorName:    doctor ? `Dr ${doctor.fullName}` : '',
          motif:         form.motif,
          admissionDate: form.admissionDate,
          admissionTime: form.admissionTime,
          expectedDischargeDate: form.expectedDischargeDate || undefined,
          notes:         form.notes || undefined,
          bedId:         selectedBed!.id,
          bedNumber:     selectedBed!.number,
        });
        log('create', 'admission', (created as any).id, `${form.type} — ${selectedPatient.lastName}`);
        const mapped = mapApiAdmission(created);
        onSave({
          ...mapped,
          bedNumber:    mapped.bedNumber    || selectedBed?.number       || '',
          roomNumber:   mapped.roomNumber   || selectedBed?.roomNumber   || '',
          floorLabel:   mapped.floorLabel   || selectedBed?.floorLabel   || '',
          buildingName: mapped.buildingName || selectedBed?.buildingName || '',
        });
      }
    } catch (err: any) {
      setErrors(e => ({ ...e, submit: err?.message ?? "Échec de l'enregistrement — réessayez." }));
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  const STEPS = [t('adm.form.step1'), t('adm.form.step2'), t('adm.form.step3')];

  const Field = ({ k, label, req, children }: { k: string; label: string; req?: boolean; children: React.ReactNode }) => (
    <div>
      <label className={labelCls}>{label}{req && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
      {errors[k] && <p className="text-xs text-red-500 mt-0.5">{errors[k]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative ml-auto w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="font-bold text-gray-900">{admission ? t('adm.form.title.edit') : t('adm.form.title.create')}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {t('adm.form.step_of')} {step + 1} {t('adm.form.of')} {STEPS.length} — {STEPS[step]}
            </p>
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5 px-6 py-3 border-b border-gray-100">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full flex-1 transition-colors ${i < step ? 'bg-green-500' : i === step ? 'bg-blue-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* ─── STEP 0 : Patient search ─── */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-700 flex items-center gap-2">
                  <AlertCircle size={15} className="flex-shrink-0" />
                  {t('adm.form.search.hint')}
                </p>
              </div>

              <Field k="patient" label={t('adm.form.search.label')} req>
                <div className="flex gap-2">
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder={t('adm.form.search.placeholder')}
                    className={inputCls}
                  />
                  <button
                    onClick={handleSearch}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex-shrink-0"
                  >
                    <Search size={14} />
                    {t('adm.form.search.button')}
                  </button>
                </div>
              </Field>

              {/* Selected patient */}
              {selectedPatient && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-green-700">
                    <UserCheck size={14} /> {t('adm.form.search.selected')}
                  </div>
                  <PatientSummaryCard patient={selectedPatient} />
                  {!isEdit && (
                    <button
                      onClick={() => { setSelectedPatient(null); setSearchResults(null); setQuery(''); }}
                      className="text-xs text-blue-600 underline"
                    >
                      {t('adm.form.search.change')}
                    </button>
                  )}
                </div>
              )}

              {/* Search results */}
              {!selectedPatient && searchResults !== null && (
                <div className="space-y-2">
                  {searchResults.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">{t('adm.form.search.not_found')}</p>
                  ) : (
                    searchResults.slice(0, 5).map(patient => (
                      <div key={patient.id} className="relative">
                        <PatientSummaryCard patient={patient} />
                        <button
                          onClick={() => { setSelectedPatient(patient); setSearchResults(null); }}
                          className="absolute top-2 right-2 text-xs px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          {t('adm.form.search.select')}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── STEP 1 : Admission info ─── */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Selected patient banner */}
              {selectedPatient && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                  <UserCheck size={15} className="text-green-600 flex-shrink-0" />
                  <p className="text-sm text-green-700 font-medium">
                    {selectedPatient.lastName} {selectedPatient.firstName} — {selectedPatient.mpiId}
                  </p>
                </div>
              )}

              {isEdit && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs text-amber-700">
                    Après création, seuls les notes et la date de sortie prévue sont modifiables.
                    Le changement de lit se fait via l'action « Transfert ».
                  </p>
                </div>
              )}

              {dirError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs text-red-600">
                    Impossible de charger le référentiel (services / médecins). Fermez et réessayez.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field k="type" label={t('adm.form.type')} req>
                  <select value={form.type} onChange={set('type')} className={selectCls} disabled={isEdit}>
                    {(['hospitalisation','ambulatoire','preadmission','urgence','maternite','chirurgie'] as const).map(v =>
                      <option key={v} value={v}>{t(`adm.type.${v}` as any)}</option>
                    )}
                  </select>
                </Field>
                <Field k="priority" label={t('adm.form.priority')} req>
                  <select value={form.priority} onChange={set('priority')} className={selectCls} disabled={isEdit}>
                    {(['normal','urgent','tres_urgent','vital'] as const).map(v =>
                      <option key={v} value={v}>{t(`adm.priority.${v}` as any)}</option>
                    )}
                  </select>
                </Field>
              </div>

              <Field k="serviceId" label={t('adm.form.service')} req>
                <select value={form.serviceId} onChange={set('serviceId')} className={selectCls} disabled={isEdit}>
                  <option value="">— {t('adm.form.service')} —</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>

              <Field k="doctorId" label={t('adm.form.doctor')} req>
                <select value={form.doctorId} onChange={set('doctorId')} className={selectCls} disabled={isEdit}>
                  <option value="">— {t('adm.form.doctor')} —</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>
                      Dr {d.fullName}{d.specialty ? ` (${d.specialty})` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field k="motif" label={t('adm.form.motif')} req>
                <textarea
                  value={form.motif}
                  onChange={set('motif')}
                  rows={3}
                  placeholder={t('adm.form.motif.placeholder')}
                  className={`${inputCls} resize-none`}
                  disabled={isEdit}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field k="admissionDate" label={t('adm.form.date')} req>
                  <input type="date" value={form.admissionDate} onChange={set('admissionDate')} className={inputCls} disabled={isEdit} />
                </Field>
                <Field k="admissionTime" label={t('adm.form.time')} req>
                  <input type="time" value={form.admissionTime} onChange={set('admissionTime')} className={inputCls} disabled={isEdit} />
                </Field>
              </div>

              {form.type === 'preadmission' ? (
                <Field k="preadmissionDate" label={t('adm.form.preadmission_date')}>
                  <input type="date" value={form.preadmissionDate} onChange={set('preadmissionDate')} className={inputCls} />
                </Field>
              ) : (
                <Field k="expectedDischargeDate" label={t('adm.form.expected_discharge')}>
                  <input type="date" min={form.admissionDate || new Date().toISOString().slice(0, 10)} value={form.expectedDischargeDate} onChange={set('expectedDischargeDate')} className={inputCls} />
                </Field>
              )}

              <Field k="notes" label={t('adm.form.notes')}>
                <textarea
                  value={form.notes}
                  onChange={set('notes')}
                  rows={2}
                  placeholder={t('adm.form.notes.placeholder')}
                  className={`${inputCls} resize-none`}
                />
              </Field>
            </div>
          )}

          {/* ─── STEP 2 : Bed ─── */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800">{t('adm.form.bed.title')}</h3>
              {isEdit ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-700">
                    Lit actuel : <span className="font-semibold">{admission?.bedNumber || '—'}</span>.
                    Pour changer de lit, utilisez l'action « Transfert » depuis la liste des admissions.
                  </p>
                </div>
              ) : (
                <>
                  <BedSelector
                    selectedBedId={selectedBed?.id}
                    onSelect={bed => setSelectedBed(bed)}
                  />
                  {errors.bed && <p className="text-xs text-red-500">{errors.bed}</p>}
                </>
              )}
              {errors.submit && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs text-red-600">{errors.submit}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/50 flex-shrink-0">
          <button
            onClick={step === 0 ? onCancel : () => setStep(s => s - 1)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-white transition-colors"
          >
            <ChevronLeft size={14} />
            {step === 0 ? t('adm.form.cancel') : t('adm.form.prev')}
          </button>

          {step < STEPS.length - 1 ? (
            <button onClick={handleNext} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              {t('adm.form.next')} <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium">
              {saving
                ? <><Loader2 size={14} className="animate-spin" /> {t('adm.form.saving')}</>
                : <><Check size={14} /> {t('adm.form.save')}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
