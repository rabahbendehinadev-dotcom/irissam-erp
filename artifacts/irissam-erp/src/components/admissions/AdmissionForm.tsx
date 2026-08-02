import { useState, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Loader2, Search, UserCheck, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { MOCK_PATIENTS, MOCK_SERVICES, MOCK_DOCTORS } from '@/mock';
import type { Patient } from '@/types';
import type { Admission, AdmissionType, AdmissionPriority } from '@/types/admission';
import type { OccupancyBed } from '@/types/repository';
import { useAuditLog } from '@/hooks/useAuditLog';
import { PatientSummaryCard } from '@/components/patients/PatientSummaryCard';
import { BedSelector } from './BedSelector';
import { formatDate } from '@/utils/format';

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

function generateAdmNumber() {
  return `ADM-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0')}`;
}

const inputCls  = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white';
const selectCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white';
const labelCls  = 'block text-xs font-medium text-gray-600 mb-1';

interface Props {
  admission?: Admission;
  onSave: (data: Admission) => void;
  onCancel: () => void;
}

export function AdmissionForm({ admission, onSave, onCancel }: Props) {
  const { t } = useLanguage();
  const { log } = useAuditLog();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 1 state — patient search
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[] | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(
    admission ? MOCK_PATIENTS.find(p => p.id === admission.patientId) ?? null : null,
  );

  // Step 3 state — bed (OccupancyBed from MockRepository)
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

  // Patient search
  const handleSearch = () => {
    if (!query.trim()) return;
    const q = query.toLowerCase();
    const results = MOCK_PATIENTS.filter(p =>
      p.mpiId.toLowerCase().includes(q) ||
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      (p.phone ?? '').includes(q)
    );
    setSearchResults(results);
  };

  const filteredDoctors = MOCK_DOCTORS.filter(d => !form.serviceId || d.serviceId === form.serviceId);

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
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [step, form, selectedPatient, t]);

  const handleNext = () => {
    if (!validate()) return;
    setStep(s => s + 1);
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    const service = MOCK_SERVICES.find(s => s.id === form.serviceId);
    const doctor  = MOCK_DOCTORS.find(d => d.id === form.doctorId);
    const now = new Date().toISOString();
    const result: Admission = {
      id:              admission?.id ?? `adm-${Date.now()}`,
      admissionNumber: admission?.admissionNumber ?? generateAdmNumber(),
      patientId:       selectedPatient!.id,
      patientMpiId:    selectedPatient!.mpiId,
      patientName:     `${selectedPatient!.lastName} ${selectedPatient!.firstName}`,
      type:            form.type,
      status:          form.type === 'preadmission' ? 'preadmission' : form.type === 'ambulatoire' ? 'ambulatoire' : 'active',
      priority:        form.priority,
      serviceId:       form.serviceId,
      serviceName:     service?.name ?? '',
      doctorId:        form.doctorId,
      doctorName:      doctor?.name ?? '',
      motif:           form.motif,
      admissionDate:   form.admissionDate,
      admissionTime:   form.admissionTime,
      expectedDischargeDate: form.expectedDischargeDate || undefined,
      preadmissionDate:      form.type === 'preadmission' ? form.preadmissionDate : undefined,
      notes:           form.notes || undefined,
      bedId:           selectedBed?.id,
      bedNumber:       selectedBed?.number,
      roomNumber:      selectedBed?.roomNumber,
      floorLabel:      selectedBed?.floorLabel,
      buildingName:    selectedBed?.buildingName,
      siteId:          'site-1',
      createdAt:       admission?.createdAt ?? now,
      updatedAt:       now,
      createdById:     'u-1',
    };
    log(admission ? 'update' : 'create', 'admission', result.id, `${form.type} — ${selectedPatient!.lastName}`);
    setSaving(false);
    onSave(result);
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
                  <button
                    onClick={() => { setSelectedPatient(null); setSearchResults(null); setQuery(''); }}
                    className="text-xs text-blue-600 underline"
                  >
                    {t('adm.form.search.change')}
                  </button>
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

              <div className="grid grid-cols-2 gap-4">
                <Field k="type" label={t('adm.form.type')} req>
                  <select value={form.type} onChange={set('type')} className={selectCls}>
                    {(['hospitalisation','ambulatoire','preadmission','urgence','maternite','chirurgie'] as const).map(v =>
                      <option key={v} value={v}>{t(`adm.type.${v}` as any)}</option>
                    )}
                  </select>
                </Field>
                <Field k="priority" label={t('adm.form.priority')} req>
                  <select value={form.priority} onChange={set('priority')} className={selectCls}>
                    {(['normal','urgent','tres_urgent','vital'] as const).map(v =>
                      <option key={v} value={v}>{t(`adm.priority.${v}` as any)}</option>
                    )}
                  </select>
                </Field>
              </div>

              <Field k="serviceId" label={t('adm.form.service')} req>
                <select value={form.serviceId} onChange={e => { set('serviceId')(e); setForm(f => ({ ...f, doctorId: '' })); }} className={selectCls}>
                  <option value="">— {t('adm.form.service')} —</option>
                  {MOCK_SERVICES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>

              <Field k="doctorId" label={t('adm.form.doctor')} req>
                <select value={form.doctorId} onChange={set('doctorId')} className={selectCls} disabled={!form.serviceId}>
                  <option value="">— {t('adm.form.doctor')} —</option>
                  {filteredDoctors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.speciality})</option>)}
                </select>
              </Field>

              <Field k="motif" label={t('adm.form.motif')} req>
                <textarea
                  value={form.motif}
                  onChange={set('motif')}
                  rows={3}
                  placeholder={t('adm.form.motif.placeholder')}
                  className={`${inputCls} resize-none`}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field k="admissionDate" label={t('adm.form.date')} req>
                  <input type="date" value={form.admissionDate} onChange={set('admissionDate')} className={inputCls} />
                </Field>
                <Field k="admissionTime" label={t('adm.form.time')} req>
                  <input type="time" value={form.admissionTime} onChange={set('admissionTime')} className={inputCls} />
                </Field>
              </div>

              {form.type === 'preadmission' ? (
                <Field k="preadmissionDate" label={t('adm.form.preadmission_date')}>
                  <input type="date" value={form.preadmissionDate} onChange={set('preadmissionDate')} className={inputCls} />
                </Field>
              ) : (
                <Field k="expectedDischargeDate" label={t('adm.form.expected_discharge')}>
                  <input type="date" value={form.expectedDischargeDate} onChange={set('expectedDischargeDate')} className={inputCls} />
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
              <BedSelector
                selectedBedId={selectedBed?.id}
                onSelect={bed => setSelectedBed(bed)}
              />
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
