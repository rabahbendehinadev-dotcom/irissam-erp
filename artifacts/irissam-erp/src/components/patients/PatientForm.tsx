import { useState, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Loader2, AlertTriangle, FileText, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/i18n';
import type { Patient, BloodType, PatientGender, MaritalStatus, IdDocumentType, InsuranceType } from '@/types';
import { useAuditLog } from '@/hooks/useAuditLog';
import { DuplicatePatientModal, type DuplicateCandidate } from './DuplicatePatientModal';
import { apiClient } from '@/services/api/client';

const WILAYAS = [
  'Adrar','Chlef','Laghouat','Oum El Bouaghi','Batna','Béjaïa','Biskra','Béchar',
  'Blida','Bouira','Tamanrasset','Tébessa','Tlemcen','Tiaret','Tizi Ouzou','Alger',
  'Djelfa','Jijel','Sétif','Saïda','Skikda','Sidi Bel Abbès','Annaba','Guelma',
  'Constantine','Médéa','Mostaganem',"M'Sila",'Mascara','Ouargla','Oran','El Bayadh',
  'Illizi','Bordj Bou Arréridj','Boumerdès','El Tarf','Tindouf','Tissemsilt',
  'El Oued','Khenchela','Souk Ahras','Tipaza','Mila','Aïn Defla','Naâma',
  'Aïn Témouchent','Ghardaïa','Relizane',
];

const BLOOD_TYPES: BloodType[] = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

type FormData = {
  lastName: string; firstName: string; maidenName: string;
  gender: PatientGender; dateOfBirth: string; placeOfBirth: string;
  nationality: string; maritalStatus: MaritalStatus | '';
  idDocumentType: IdDocumentType | ''; idDocumentNumber: string;
  socialSecurityNumber: string; fileNumber: string; mpiId: string; internalNumber: string;
  phone: string; phoneSecondary: string; email: string;
  address: string; commune: string; wilaya: string; postalCode: string; country: string;
  bloodType: BloodType | ''; rhesus: '+' | '-' | '';
  allergies: string; chronicDiseases: string; majorHistory: string;
  disability: string; criticalNotes: string;
  emergencyName: string; emergencyRelation: string; emergencyPhone: string; emergencyAddress: string;
  insuranceType: InsuranceType | ''; insuranceOrg: string; memberNumber: string; validUntil: string;
};

// IDs (mpiId, fileNumber, internalNumber) are generated server-side — never in the browser.
// The service assigns them atomically from the same sequential counter as the MRN.

/**
 * Ask the backend whether a patient with the given last name, first name, and
 * date of birth already exists.  Returns an array of matching candidates.
 * Throws on network/API error so the caller can surface it to the user.
 */
async function fetchDuplicateCandidates(
  lastName: string, firstName: string, dateOfBirth: string,
): Promise<DuplicateCandidate[]> {
  const params = new URLSearchParams({ lastName, firstName, dateOfBirth });
  const result = await apiClient.get<{ duplicates: DuplicateCandidate[] }>(
    `/patients/check-duplicates?${params.toString()}`
  );
  return result.duplicates ?? [];
}

const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white';
const selectCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const autoCls = 'w-full text-sm border border-gray-100 rounded-lg px-3 py-2 bg-gray-50 text-gray-500 font-mono cursor-not-allowed';

// ─── Field wrapper — défini EN DEHORS du composant parent pour éviter le
//     remount à chaque frappe (un composant défini à l'intérieur = nouvelle
//     référence à chaque render = démontage/remontage = perte du focus). ──────
interface FieldProps {
  k: keyof FormData;
  label: string;
  req?: boolean;
  errors: Partial<Record<keyof FormData, string>>;
  children: React.ReactNode;
}
function Field({ k, label, req, errors, children }: FieldProps) {
  return (
    <div>
      <label className={labelCls}>{label}{req && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
      {errors[k] && <p className="text-xs text-red-500 mt-0.5">{errors[k]}</p>}
    </div>
  );
}

interface Props {
  patient?: Patient;
  onSave: (data: Partial<Patient>) => void;
  onCancel: () => void;
}

export function PatientForm({ patient, onSave, onCancel }: Props) {
  const { t } = useLanguage();
  const { log } = useAuditLog();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [showDup, setShowDup] = useState(false);
  const [checkingDup, setCheckingDup] = useState(false);
  const [dupCheckError, setDupCheckError] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>(() => ({
    lastName: patient?.lastName ?? '', firstName: patient?.firstName ?? '',
    maidenName: patient?.maidenName ?? '',
    gender: patient?.gender ?? 'M',
    dateOfBirth: patient?.dateOfBirth ?? '', placeOfBirth: patient?.placeOfBirth ?? '',
    nationality: patient?.nationality ?? 'Algérienne',
    maritalStatus: (patient?.maritalStatus ?? '') as MaritalStatus | '',
    idDocumentType: (patient?.idDocumentType ?? '') as IdDocumentType | '',
    idDocumentNumber: patient?.idDocumentNumber ?? '',
    socialSecurityNumber: patient?.socialSecurityNumber ?? '',
    // IDs are server-generated — never set random values in the browser.
    // For new patients these are empty; the backend assigns the real values.
    fileNumber: patient?.fileNumber ?? '',
    mpiId: patient?.mpiId ?? '',
    internalNumber: patient?.internalNumber ?? '',
    phone: patient?.phone ?? '', phoneSecondary: patient?.phoneSecondary ?? '',
    email: patient?.email ?? '',
    address: patient?.address ?? '', commune: patient?.commune ?? '',
    wilaya: patient?.wilaya ?? '', postalCode: patient?.postalCode ?? '',
    country: patient?.country ?? 'Algérie',
    bloodType: (patient?.bloodType ?? '') as BloodType | '',
    rhesus: (patient?.rhesus ?? '') as '+' | '-' | '',
    allergies: patient?.medical?.allergies?.join(', ') ?? '',
    chronicDiseases: patient?.medical?.chronicDiseases?.join(', ') ?? '',
    majorHistory: patient?.medical?.majorHistory?.join(', ') ?? '',
    disability: patient?.medical?.disability ?? '',
    criticalNotes: patient?.medical?.criticalNotes ?? '',
    emergencyName: patient?.emergencyContact?.name ?? '',
    emergencyRelation: patient?.emergencyContact?.relation ?? '',
    emergencyPhone: patient?.emergencyContact?.phone ?? '',
    emergencyAddress: patient?.emergencyContact?.address ?? '',
    insuranceType: (patient?.insurance?.type ?? '') as InsuranceType | '',
    insuranceOrg: patient?.insurance?.organizationName ?? '',
    memberNumber: patient?.insurance?.memberNumber ?? '',
    validUntil: patient?.insurance?.validUntil ?? '',
  }));

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors(e2 => ({ ...e2, [key]: undefined }));
  };

  const validate = useCallback((): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (step === 0) {
      if (!form.lastName.trim()) errs.lastName = t('pat.form.required');
      if (!form.firstName.trim()) errs.firstName = t('pat.form.required');
      if (!form.gender) errs.gender = t('pat.form.required');
      if (!form.dateOfBirth) errs.dateOfBirth = t('pat.form.required');
      if (!form.nationality.trim()) errs.nationality = t('pat.form.required');
    }
    if (step === 2) {
      if (!form.phone.trim()) errs.phone = t('pat.form.required');
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [step, form, t]);

  const handleNext = async () => {
    if (!validate()) return;

    // On step 0 for new patients, run a real server-side duplicate check before advancing.
    if (step === 0 && !patient) {
      const { lastName, firstName, dateOfBirth } = form;
      if (lastName.trim() && firstName.trim() && dateOfBirth) {
        setCheckingDup(true);
        setDupCheckError(null);
        try {
          const candidates = await fetchDuplicateCandidates(lastName.trim(), firstName.trim(), dateOfBirth);
          if (candidates.length > 0) {
            setDuplicates(candidates);
            setShowDup(true);
            setCheckingDup(false);
            return; // user must acknowledge the modal before advancing
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erreur lors de la vérification des doublons';
          setDupCheckError(msg);
          setCheckingDup(false);
          return; // block advance — do not silently skip the check
        }
        setCheckingDup(false);
      }
    }

    setStep(s => s + 1);
  };

  const buildPayload = () => ({
    lastName: form.lastName, firstName: form.firstName, maidenName: form.maidenName || undefined,
    gender: form.gender, dateOfBirth: form.dateOfBirth, placeOfBirth: form.placeOfBirth || undefined,
    nationality: form.nationality, maritalStatus: (form.maritalStatus || undefined) as MaritalStatus | undefined,
    idDocumentType: (form.idDocumentType || undefined) as IdDocumentType | undefined,
    idDocumentNumber: form.idDocumentNumber || undefined,
    socialSecurityNumber: form.socialSecurityNumber || undefined,
    // Only include IDs when editing an existing patient (they were server-assigned).
    // For new patients, omit them so the backend generates collision-free values.
    ...(patient ? { fileNumber: form.fileNumber, mpiId: form.mpiId, internalNumber: form.internalNumber } : {}),
    phone: form.phone, phoneSecondary: form.phoneSecondary || undefined,
    email: form.email || undefined,
    address: form.address || undefined, commune: form.commune || undefined,
    wilaya: form.wilaya || undefined, postalCode: form.postalCode || undefined, country: form.country,
    bloodType: (form.bloodType || undefined) as BloodType | undefined,
    rhesus: (form.rhesus || undefined) as '+' | '-' | undefined,
    medical: {
      allergies: form.allergies ? form.allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
      chronicDiseases: form.chronicDiseases ? form.chronicDiseases.split(',').map(s => s.trim()).filter(Boolean) : [],
      majorHistory: form.majorHistory ? form.majorHistory.split(',').map(s => s.trim()).filter(Boolean) : [],
      disability: form.disability || undefined, criticalNotes: form.criticalNotes || undefined,
    },
    emergencyContact: form.emergencyName ? {
      name: form.emergencyName, relation: form.emergencyRelation,
      phone: form.emergencyPhone, address: form.emergencyAddress || undefined,
    } : undefined,
    insurance: form.insuranceType ? {
      type: form.insuranceType as InsuranceType,
      organizationName: form.insuranceOrg || undefined,
      memberNumber: form.memberNumber || undefined,
      validUntil: form.validUntil || undefined,
    } : undefined,
  });

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = buildPayload();
      let saved: Partial<Patient>;

      if (patient) {
        // Update existing patient
        const patientId = patient.id;
        saved = await apiClient.put<Partial<Patient>>(`/patients/${patientId}`, payload);
      } else {
        // Create new patient
        saved = await apiClient.post<Partial<Patient>>('/patients', payload);
      }

      log(patient ? 'update' : 'create', 'patient', patient?.id ?? saved.id, `${payload.lastName} ${payload.firstName}`);
      onSave(saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la sauvegarde';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const STEPS = [
    t('pat.form.step1'), t('pat.form.step2'), t('pat.form.step3'),
    t('pat.form.step4'), t('pat.form.step5'), t('pat.form.step6'), t('pat.form.step7'),
  ];

  return (
    <>
      <div className="fixed inset-0 z-40 flex">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
        <div className="relative ml-auto w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="font-bold text-gray-900">{patient ? t('pat.form.edit.title') : t('pat.form.create.title')}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{t('pat.form.step_of')} {step + 1} {t('pat.form.of')} {STEPS.length} — {STEPS[step]}</p>
            </div>
            <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={18} />
            </button>
          </div>

          {/* Step dots */}
          <div className="flex gap-1.5 px-6 py-3 border-b border-gray-100">
            {STEPS.map((s, i) => (
              <div key={i} className={`h-1.5 rounded-full flex-1 transition-colors ${i < step ? 'bg-green-500' : i === step ? 'bg-blue-600' : 'bg-gray-200'}`} />
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Step 0 — Identity */}
            {step === 0 && <>
              <div className="grid grid-cols-2 gap-4">
                <Field errors={errors} k="lastName" label={t('pat.form.lastName')} req>
                  <input value={form.lastName} onChange={set('lastName')} className={inputCls} />
                </Field>
                <Field errors={errors} k="firstName" label={t('pat.form.firstName')} req>
                  <input value={form.firstName} onChange={set('firstName')} className={inputCls} />
                </Field>
              </div>
              <Field errors={errors} k="maidenName" label={t('pat.form.maidenName')}>
                <input value={form.maidenName} onChange={set('maidenName')} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field errors={errors} k="gender" label={t('pat.form.gender')} req>
                  <select value={form.gender} onChange={set('gender')} className={selectCls}>
                    <option value="M">{t('pat.gender.m')}</option>
                    <option value="F">{t('pat.gender.f')}</option>
                  </select>
                </Field>
                <Field errors={errors} k="dateOfBirth" label={t('pat.form.dateOfBirth')} req>
                  <input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field errors={errors} k="placeOfBirth" label={t('pat.form.placeOfBirth')}>
                  <input value={form.placeOfBirth} onChange={set('placeOfBirth')} className={inputCls} />
                </Field>
                <Field errors={errors} k="nationality" label={t('pat.form.nationality')} req>
                  <input value={form.nationality} onChange={set('nationality')} className={inputCls} />
                </Field>
              </div>
              <Field errors={errors} k="maritalStatus" label={t('pat.form.maritalStatus')}>
                <select value={form.maritalStatus} onChange={set('maritalStatus')} className={selectCls}>
                  <option value="">—</option>
                  <option value="celibataire">{t('pat.marital.celibataire')}</option>
                  <option value="marie">{t('pat.marital.marie')}</option>
                  <option value="divorce">{t('pat.marital.divorce')}</option>
                  <option value="veuf">{t('pat.marital.veuf')}</option>
                </select>
              </Field>
            </>}

            {/* Step 1 — Identifiers */}
            {step === 1 && <>
              <div className="grid grid-cols-2 gap-4">
                <Field errors={errors} k="idDocumentType" label={t('pat.form.idType')}>
                  <select value={form.idDocumentType} onChange={set('idDocumentType')} className={selectCls}>
                    <option value="">—</option>
                    <option value="cni">{t('pat.id_type.cni')}</option>
                    <option value="passeport">{t('pat.id_type.passeport')}</option>
                    <option value="permis">{t('pat.id_type.permis')}</option>
                    <option value="autre">{t('pat.id_type.autre')}</option>
                  </select>
                </Field>
                <Field errors={errors} k="idDocumentNumber" label={t('pat.form.idNumber')}>
                  <input value={form.idDocumentNumber} onChange={set('idDocumentNumber')} className={inputCls} />
                </Field>
              </div>
              <Field errors={errors} k="socialSecurityNumber" label={t('pat.form.socialSecurity')}>
                <input value={form.socialSecurityNumber} onChange={set('socialSecurityNumber')} className={inputCls} />
              </Field>
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
                <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">
                  Identifiants {patient ? 'assignés' : '— attribués automatiquement à la création'}
                </p>
                {!patient && (
                  <p className="text-xs text-blue-600 italic">
                    Le MPI, le numéro de dossier et le numéro interne sont générés côté serveur
                    après validation du formulaire. Aucune valeur provisoire n'est utilisée.
                  </p>
                )}
                {patient && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>{t('pat.form.mpiId')}</label>
                      <input value={form.mpiId} readOnly className={autoCls} />
                    </div>
                    <div>
                      <label className={labelCls}>{t('pat.form.internalNumber')}</label>
                      <input value={form.internalNumber || '—'} readOnly className={autoCls} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>{t('pat.form.fileNumber')}</label>
                      <input value={form.fileNumber} readOnly className={autoCls} />
                    </div>
                  </div>
                )}
              </div>
            </>}

            {/* Step 2 — Contacts */}
            {step === 2 && <>
              <div className="grid grid-cols-2 gap-4">
                <Field errors={errors} k="phone" label={t('pat.form.phone')} req>
                  <input value={form.phone} onChange={set('phone')} className={inputCls} placeholder="0555 XX XX XX" />
                </Field>
                <Field errors={errors} k="phoneSecondary" label={t('pat.form.phoneSecondary')}>
                  <input value={form.phoneSecondary} onChange={set('phoneSecondary')} className={inputCls} />
                </Field>
              </div>
              <Field errors={errors} k="email" label={t('pat.form.email')}>
                <input type="email" value={form.email} onChange={set('email')} className={inputCls} />
              </Field>
              <Field errors={errors} k="address" label={t('pat.form.address')}>
                <input value={form.address} onChange={set('address')} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field errors={errors} k="commune" label={t('pat.form.commune')}>
                  <input value={form.commune} onChange={set('commune')} className={inputCls} />
                </Field>
                <Field errors={errors} k="wilaya" label={t('pat.form.wilaya')}>
                  <select value={form.wilaya} onChange={set('wilaya')} className={selectCls}>
                    <option value="">—</option>
                    {WILAYAS.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field errors={errors} k="postalCode" label={t('pat.form.postalCode')}>
                  <input value={form.postalCode} onChange={set('postalCode')} className={inputCls} />
                </Field>
                <Field errors={errors} k="country" label={t('pat.form.country')}>
                  <input value={form.country} onChange={set('country')} className={inputCls} />
                </Field>
              </div>
            </>}

            {/* Step 3 — Medical */}
            {step === 3 && <>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Field errors={errors} k="bloodType" label={t('pat.form.bloodType')}>
                    <select value={form.bloodType} onChange={set('bloodType')} className={selectCls}>
                      <option value="">—</option>
                      {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                    </select>
                  </Field>
                </div>
                <Field errors={errors} k="rhesus" label={t('pat.form.rhesus')}>
                  <select value={form.rhesus} onChange={set('rhesus')} className={selectCls}>
                    <option value="">—</option>
                    <option value="+">Positif (+)</option>
                    <option value="-">Négatif (−)</option>
                  </select>
                </Field>
              </div>
              <Field errors={errors} k="allergies" label={t('pat.form.allergies')}>
                <input value={form.allergies} onChange={set('allergies')} className={inputCls} placeholder={t('pat.form.allergies.hint')} />
              </Field>
              <Field errors={errors} k="chronicDiseases" label={t('pat.form.chronicDiseases')}>
                <textarea value={form.chronicDiseases} onChange={set('chronicDiseases')} rows={2} className={`${inputCls} resize-none`} placeholder={t('pat.form.allergies.hint')} />
              </Field>
              <Field errors={errors} k="majorHistory" label={t('pat.form.majorHistory')}>
                <textarea value={form.majorHistory} onChange={set('majorHistory')} rows={2} className={`${inputCls} resize-none`} placeholder={t('pat.form.allergies.hint')} />
              </Field>
              <Field errors={errors} k="disability" label={t('pat.form.disability')}>
                <input value={form.disability} onChange={set('disability')} className={inputCls} />
              </Field>
              {form.criticalNotes && (
                <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-600">{t('pat.form.criticalNotes.hint')}</p>
                </div>
              )}
              <Field errors={errors} k="criticalNotes" label={t('pat.form.criticalNotes')}>
                <textarea value={form.criticalNotes} onChange={set('criticalNotes')} rows={2} className={`${inputCls} resize-none`} />
              </Field>
            </>}

            {/* Step 4 — Emergency contact */}
            {step === 4 && <>
              <Field errors={errors} k="emergencyName" label={t('pat.form.emergency.name')}>
                <input value={form.emergencyName} onChange={set('emergencyName')} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field errors={errors} k="emergencyRelation" label={t('pat.form.emergency.relation')}>
                  <input value={form.emergencyRelation} onChange={set('emergencyRelation')} className={inputCls} placeholder="Épouse, Fils, Père..." />
                </Field>
                <Field errors={errors} k="emergencyPhone" label={t('pat.form.emergency.phone')}>
                  <input value={form.emergencyPhone} onChange={set('emergencyPhone')} className={inputCls} />
                </Field>
              </div>
              <Field errors={errors} k="emergencyAddress" label={t('pat.form.emergency.address')}>
                <input value={form.emergencyAddress} onChange={set('emergencyAddress')} className={inputCls} />
              </Field>
            </>}

            {/* Step 5 — Insurance */}
            {step === 5 && <>
              <Field errors={errors} k="insuranceType" label={t('pat.form.insurance.type')}>
                <select value={form.insuranceType} onChange={set('insuranceType')} className={selectCls}>
                  <option value="">—</option>
                  <option value="cnas">{t('pat.insurance.cnas')}</option>
                  <option value="casnos">{t('pat.insurance.casnos')}</option>
                  <option value="mutuelle">{t('pat.insurance.mutuelle')}</option>
                  <option value="militaire">{t('pat.insurance.militaire')}</option>
                  <option value="gratuite">{t('pat.insurance.gratuite')}</option>
                  <option value="payant">{t('pat.insurance.payant')}</option>
                </select>
              </Field>
              {form.insuranceType && form.insuranceType !== 'payant' && form.insuranceType !== 'gratuite' && <>
                <Field errors={errors} k="insuranceOrg" label={t('pat.form.insurance.org')}>
                  <input value={form.insuranceOrg} onChange={set('insuranceOrg')} className={inputCls} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field errors={errors} k="memberNumber" label={t('pat.form.insurance.memberNumber')}>
                    <input value={form.memberNumber} onChange={set('memberNumber')} className={inputCls} />
                  </Field>
                  <Field errors={errors} k="validUntil" label={t('pat.form.insurance.validUntil')}>
                    <input type="date" value={form.validUntil} onChange={set('validUntil')} className={inputCls} />
                  </Field>
                </div>
              </>}
            </>}

            {/* Step 6 — Documents */}
            {step === 6 && (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
                    <FileText size={24} className="text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Documents à ajouter après la création</p>
                    <p className="text-xs text-gray-400 mt-1 max-w-xs">
                      Une fois le dossier patient enregistré, vous pourrez joindre les documents depuis l'onglet&nbsp;<strong>Documents</strong> du dossier ou via le module&nbsp;<strong>GED</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Duplicate check error banner */}
          {dupCheckError && (
            <div className="mx-6 mb-2 flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-800 text-xs">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Impossible de vérifier les doublons</p>
                <p className="mt-0.5 text-orange-600">{dupCheckError}</p>
              </div>
              <button
                onClick={() => { setDupCheckError(null); void handleNext(); }}
                className="flex-shrink-0 flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 hover:bg-orange-200 rounded border border-orange-300 transition-colors"
              >
                <RefreshCw size={10} /> Réessayer
              </button>
            </div>
          )}

          {/* Save error banner */}
          {saveError && (
            <div className="mx-6 mb-2 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
              <AlertTriangle size={13} className="flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/50 flex-shrink-0">
            <button
              onClick={step === 0 ? onCancel : () => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-white transition-colors"
            >
              <ChevronLeft size={14} />
              {step === 0 ? t('pat.form.cancel') : t('pat.form.prev')}
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={checkingDup}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {checkingDup
                  ? <><Loader2 size={14} className="animate-spin" /> Vérification…</>
                  : <>{t('pat.form.next')}<ChevronRight size={14} /></>
                }
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
                {saving ? <><Loader2 size={14} className="animate-spin" />{t('pat.form.saving')}</> : <><Check size={14} />{t('pat.form.save')}</>}
              </button>
            )}
          </div>
        </div>
      </div>

      <DuplicatePatientModal
        open={showDup}
        candidates={duplicates}
        onContinue={reason => { log('override_duplicate', 'patient', undefined, reason); setShowDup(false); setStep(1); }}
        onOpenExisting={p => { setShowDup(false); onCancel(); window.location.href = `/patients/${p.id}`; }}
        onCancel={() => setShowDup(false)}
      />
    </>
  );
}
