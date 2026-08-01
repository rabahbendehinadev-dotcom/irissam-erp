import { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { ArrowLeft, AlertTriangle, Phone, Droplets, User, Shield, Clock, Stethoscope, ChevronRight } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PatientProfileHeader } from '@/components/patients/PatientProfileHeader';
import { PatientTimeline } from '@/components/patients/PatientTimeline';
import { PatientDocumentsV2 } from '@/components/patients/PatientDocumentsV2';
import { PatientForm } from '@/components/patients/PatientForm';
import { SensitiveField } from '@/components/patients/SensitiveField';
import { PatientAlertBanner } from '@/components/patients/PatientAlertBanner';
import { PatientStatsCards } from '@/components/patients/PatientStatsCards';
import { PatientAuditLog } from '@/components/patients/PatientAuditLog';
import { PatientEmergencyContacts } from '@/components/patients/PatientEmergencyContacts';
import { PatientInsuranceDetail } from '@/components/patients/PatientInsuranceDetail';
import { PatientVaccinationsTab } from '@/components/patients/PatientVaccinationsTab';
import { PatientConsentsTab } from '@/components/patients/PatientConsentsTab';
import { MOCK_PATIENTS, MOCK_PATIENT_TIMELINES } from '@/mock';
import { useLanguage } from '@/i18n';
import { usePermission } from '@/hooks/usePermission';
import { useAuditLog } from '@/hooks/useAuditLog';
import { formatDate } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { Patient } from '@/types';

function InfoRow({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-sm text-gray-800 font-medium ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-blue-600">{icon}</span>
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function PlaceholderTab({ label }: { label: string }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-400 space-y-3">
      <Clock size={40} className="opacity-30" />
      <p className="font-semibold">{label}</p>
      <p className="text-sm">{t('page.coming_soon_desc')}</p>
    </div>
  );
}

// ─── Mock recent consultations ────────────────────────────────────────────────

interface RecentConsult {
  id: string;
  date: string;
  doctor: string;
  specialty: string;
  diagnosis: string;
  prescription: string;
  status: 'terminee' | 'en_cours' | 'suspendue';
}

const MOCK_RECENT_CONSULTATIONS: RecentConsult[] = [
  {
    id: 'con-1',
    date: '2026-08-01T09:14:00',
    doctor: 'Dr. Meziane Farid',
    specialty: 'Médecine interne',
    diagnosis: 'Hypertension artérielle (I10) — HTA stable',
    prescription: 'Amlodipine 5 mg + Perindopril 4 mg',
    status: 'terminee',
  },
  {
    id: 'con-2',
    date: '2026-06-20T10:30:00',
    doctor: 'Dr. Benamara Karim',
    specialty: 'Cardiologie',
    diagnosis: 'Cardiopathie ischémique chronique (I25) + HTA résistante',
    prescription: 'Bisoprolol 5 mg + Furosémide 40 mg',
    status: 'terminee',
  },
  {
    id: 'con-3',
    date: '2026-05-20T22:30:00',
    doctor: 'Dr. Merabet',
    specialty: 'Urgences médicales',
    diagnosis: 'Douleur thoracique atypique (R07) — bilan négatif',
    prescription: 'Surveillance — aucune prescription',
    status: 'terminee',
  },
  {
    id: 'con-4',
    date: '2026-01-20T10:30:00',
    doctor: 'Dr. Meziane Farid',
    specialty: 'Médecine interne',
    diagnosis: 'HTA déséquilibrée — ajustement thérapeutique',
    prescription: 'Renforcement : Bisoprolol 2.5 mg ajouté',
    status: 'terminee',
  },
  {
    id: 'con-5',
    date: '2025-11-05T09:00:00',
    doctor: 'Dr. Meziane Farid',
    specialty: 'Médecine interne',
    diagnosis: 'Diabète de type 2 (E11) — HbA1c : 7.8%',
    prescription: 'Metformine 500 mg × 2/jour',
    status: 'terminee',
  },
];

const STATUS_CONSULT_CFG = {
  terminee:   { label: 'Terminée',  color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  en_cours:   { label: 'En cours',  color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  suspendue:  { label: 'Suspendue', color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
};

function DernieresConsultations({ patientId, onOpen }: { patientId: string; onOpen: (id: string) => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden md:col-span-2">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Stethoscope size={15} className="text-blue-600" />
          <h3 className="font-semibold text-gray-800 text-sm">Dernières consultations</h3>
        </div>
        <span className="text-xs text-gray-400">{MOCK_RECENT_CONSULTATIONS.length} consultations</span>
      </div>
      <div className="divide-y divide-gray-50">
        {MOCK_RECENT_CONSULTATIONS.map(c => {
          const cfg = STATUS_CONSULT_CFG[c.status];
          return (
            <div key={c.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
              {/* Date */}
              <div className="flex-shrink-0 text-right w-20">
                <p className="text-xs font-semibold text-gray-700">
                  {new Date(c.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </p>
                <p className="text-xs text-gray-400 font-mono">{c.date.substring(11, 16)}</p>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-gray-700">{c.doctor}</span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-500">{c.specialty}</span>
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full border font-medium', cfg.color, cfg.bg, cfg.border)}>
                    {cfg.label}
                  </span>
                </div>
                <p className="text-xs text-gray-800 mt-0.5 font-medium">{c.diagnosis}</p>
                <p className="text-xs text-gray-400 mt-0.5">💊 {c.prescription}</p>
              </div>

              {/* Action */}
              <button
                onClick={() => onOpen(c.id)}
                className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                Ouvrir <ChevronRight size={11} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tabs that remain as placeholders ────────────────────────────────────────

const SOON_TABS = [
  'appointments', 'admissions', 'consultations', 'emergencies', 'hospitalizations',
  'laboratory', 'imaging', 'prescriptions', 'invoices',
  'billing', 'payments',
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PatientDetailPage() {
  const { t } = useLanguage();
  const { can } = usePermission();
  const { log } = useAuditLog();
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/patients/:id');
  const patientId = params?.id;

  const [activeTab,  setActiveTab]  = useState('overview');
  const [showEdit,   setShowEdit]   = useState(false);
  const [archiving,  setArchiving]  = useState(false);

  const patient  = MOCK_PATIENTS.find(p => p.id === patientId);
  const timeline = MOCK_PATIENT_TIMELINES[patientId ?? ''] ?? [];

  if (!can('patients.view')) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-400">{t('pat.page.no_permission')}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!patient) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <button onClick={() => setLocation('/patients')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
            <ArrowLeft size={16} /> {t('pat.back_to_list')}
          </button>
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-400 space-y-2">
            <AlertTriangle size={48} className="opacity-30" />
            <p className="font-semibold">Patient introuvable</p>
            <p className="text-sm">ID : {patientId}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const canViewSensitive = can('patients.view_sensitive');
  const canEdit    = can('patients.edit');
  const canArchive = can('patients.archive');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'audit') log('view_audit', 'patient', patient.id);
  };

  const fullName = `${patient.lastName} ${patient.firstName}`;

  return (
    <DashboardLayout>
      {/* Back link */}
      <div className="px-6 pt-4">
        <button
          onClick={() => setLocation('/patients')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={15} />
          {t('pat.back_to_list')}
        </button>
      </div>

      {/* Alert Banner */}
      <PatientAlertBanner patient={patient} />

      {/* Sticky profile header with tabs */}
      <div className="sticky top-0 z-20">
        <PatientProfileHeader
          patient={patient}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onEdit={() => setShowEdit(true)}
          onArchive={() => setArchiving(true)}
          canEdit={canEdit}
          canArchive={canArchive}
        />
      </div>

      {/* Tab content */}
      <div className="p-6">

        {/* Stats cards — shown on overview and clinical tabs */}
        {['overview', 'history', 'allergies', 'timeline'].includes(activeTab) && (
          <PatientStatsCards patient={patient} />
        )}

        {/* ─── OVERVIEW ─── */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Identity */}
            <Section title={t('pat.overview.identity')} icon={<User size={16} />}>
              <InfoRow label="Nom complet" value={fullName} />
              <InfoRow label="Genre" value={patient.gender === 'M' ? t('pat.gender.m') : t('pat.gender.f')} />
              <InfoRow label="Date de naissance" value={formatDate(patient.dateOfBirth)} />
              {patient.placeOfBirth  && <InfoRow label="Lieu de naissance"  value={patient.placeOfBirth} />}
              {patient.nationality   && <InfoRow label="Nationalité"         value={patient.nationality} />}
              {patient.maritalStatus && <InfoRow label="Situation familiale" value={t(`pat.marital.${patient.maritalStatus}` as any)} />}
            </Section>

            {/* Contact */}
            <Section title={t('pat.overview.contact')} icon={<Phone size={16} />}>
              <InfoRow label="Téléphone"   value={patient.phone} />
              {patient.phoneSecondary && <InfoRow label="Téléphone 2" value={patient.phoneSecondary} />}
              {patient.email          && <InfoRow label="Email"        value={patient.email} />}
              {patient.address        && <InfoRow label="Adresse"      value={patient.address} />}
              {patient.commune        && <InfoRow label="Commune"      value={patient.commune} />}
              {patient.wilaya         && <InfoRow label="Wilaya"       value={patient.wilaya} />}
            </Section>

            {/* Medical */}
            <Section title={t('pat.overview.medical')} icon={<Droplets size={16} />}>
              {patient.bloodType && (
                <InfoRow label="Groupe sanguin" value={`${patient.bloodType} (Rh ${patient.rhesus ?? '?'})`} />
              )}
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-400 uppercase tracking-wide">{t('pat.form.allergies')}</span>
                {patient.medical?.allergies?.length
                  ? <div className="flex flex-wrap gap-1 mt-1">{patient.medical.allergies.map(a => <span key={a} className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">{a}</span>)}</div>
                  : <span className="text-sm text-gray-400">{t('pat.overview.no_allergy')}</span>}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-400 uppercase tracking-wide">{t('pat.form.chronicDiseases')}</span>
                {patient.medical?.chronicDiseases?.length
                  ? <div className="flex flex-wrap gap-1 mt-1">{patient.medical.chronicDiseases.map(d => <span key={d} className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">{d}</span>)}</div>
                  : <span className="text-sm text-gray-400">{t('pat.overview.no_disease')}</span>}
              </div>
            </Section>

            {/* Insurance */}
            <Section title={t('pat.overview.insurance')} icon={<Shield size={16} />}>
              {patient.insurance?.type
                ? <>
                    <InfoRow label="Type"     value={t(`pat.insurance.${patient.insurance.type}` as any)} />
                    {patient.insurance.organizationName && <InfoRow label="Organisme"      value={patient.insurance.organizationName} />}
                    {patient.insurance.memberNumber && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-gray-400 uppercase tracking-wide">N° Adhérent</span>
                        <SensitiveField value={patient.insurance.memberNumber} canView={canViewSensitive} />
                      </div>
                    )}
                    {patient.insurance.validUntil && <InfoRow label="Valide jusqu'au" value={formatDate(patient.insurance.validUntil)} />}
                  </>
                : <span className="text-sm text-gray-400">{t('pat.overview.no_insurance')}</span>}
            </Section>

            {/* Dernières consultations — full width */}
            <DernieresConsultations
              patientId={patient.id}
              onOpen={id => alert(`Ouverture consultation ${id} — disponible avec le backend`)}
            />
          </div>
        )}

        {/* ─── IDENTITY ─── */}
        {activeTab === 'identity' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Section title="État civil" icon={<User size={16} />}>
              <InfoRow label={t('pat.form.lastName')}   value={patient.lastName} />
              <InfoRow label={t('pat.form.firstName')}  value={patient.firstName} />
              {patient.maidenName && <InfoRow label={t('pat.form.maidenName')}  value={patient.maidenName} />}
              <InfoRow label={t('pat.form.gender')}     value={patient.gender === 'M' ? t('pat.gender.m') : t('pat.gender.f')} />
              <InfoRow label={t('pat.form.dateOfBirth')} value={formatDate(patient.dateOfBirth)} />
              {patient.placeOfBirth  && <InfoRow label={t('pat.form.placeOfBirth')}   value={patient.placeOfBirth} />}
              {patient.nationality   && <InfoRow label={t('pat.form.nationality')}    value={patient.nationality} />}
              {patient.maritalStatus && <InfoRow label={t('pat.form.maritalStatus')} value={t(`pat.marital.${patient.maritalStatus}` as any)} />}
            </Section>
            <Section title="Identifiants" icon={<Shield size={16} />}>
              <InfoRow label={t('pat.form.mpiId')}          value={patient.mpiId}         mono />
              <InfoRow label={t('pat.form.fileNumber')}      value={patient.fileNumber}    mono />
              <InfoRow label={t('pat.form.internalNumber')}  value={patient.internalNumber} mono />
              {patient.idDocumentType   && <InfoRow label={t('pat.form.idType')} value={t(`pat.id_type.${patient.idDocumentType}` as any)} />}
              {patient.idDocumentNumber && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-gray-400 uppercase tracking-wide">{t('pat.form.idNumber')}</span>
                  <SensitiveField value={patient.idDocumentNumber} canView={canViewSensitive} />
                </div>
              )}
              {patient.socialSecurityNumber && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-gray-400 uppercase tracking-wide">{t('pat.form.socialSecurity')}</span>
                  <SensitiveField value={patient.socialSecurityNumber} canView={canViewSensitive} />
                </div>
              )}
            </Section>
          </div>
        )}

        {/* ─── CONTACTS ─── */}
        {activeTab === 'contacts' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Section title="Coordonnées" icon={<Phone size={16} />}>
              <InfoRow label={t('pat.form.phone')}          value={patient.phone} />
              {patient.phoneSecondary && <InfoRow label={t('pat.form.phoneSecondary')} value={patient.phoneSecondary} />}
              {patient.email          && <InfoRow label={t('pat.form.email')}          value={patient.email} />}
              {patient.address        && <InfoRow label={t('pat.form.address')}        value={patient.address} />}
              {patient.commune        && <InfoRow label={t('pat.form.commune')}        value={patient.commune} />}
              {patient.wilaya         && <InfoRow label={t('pat.form.wilaya')}         value={patient.wilaya} />}
              {patient.postalCode     && <InfoRow label={t('pat.form.postalCode')}     value={patient.postalCode} />}
              <InfoRow label={t('pat.form.country')} value={patient.country} />
            </Section>
            {patient.emergencyContact && (
              <Section title={t('pat.overview.emergency')} icon={<AlertTriangle size={16} />}>
                <InfoRow label={t('pat.form.emergency.name')}      value={patient.emergencyContact.name} />
                <InfoRow label={t('pat.form.emergency.relation')}  value={patient.emergencyContact.relation} />
                <InfoRow label={t('pat.form.emergency.phone')}     value={patient.emergencyContact.phone} />
                {patient.emergencyContact.address && <InfoRow label={t('pat.form.emergency.address')} value={patient.emergencyContact.address} />}
              </Section>
            )}
          </div>
        )}

        {/* ─── INSURANCE ─── */}
        {activeTab === 'insurance' && <PatientInsuranceDetail patient={patient} />}

        {/* ─── DOCUMENTS ─── */}
        {activeTab === 'documents' && <PatientDocumentsV2 patientId={patient.id} />}

        {/* ─── HISTORY ─── */}
        {activeTab === 'history' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Section title={t('pat.form.majorHistory')} icon={<AlertTriangle size={16} />}>
              {patient.medical?.majorHistory?.length
                ? <ul className="space-y-2">{patient.medical.majorHistory.map((h, i) => <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-blue-500">•</span>{h}</li>)}</ul>
                : <p className="text-sm text-gray-400">{t('pat.overview.no_history')}</p>}
            </Section>
            <Section title={t('pat.form.chronicDiseases')} icon={<AlertTriangle size={16} />}>
              {patient.medical?.chronicDiseases?.length
                ? <ul className="space-y-2">{patient.medical.chronicDiseases.map((d, i) => <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-orange-500">•</span>{d}</li>)}</ul>
                : <p className="text-sm text-gray-400">{t('pat.overview.no_disease')}</p>}
            </Section>
            {patient.medical?.disability && (
              <div className="md:col-span-2">
                <Section title={t('pat.form.disability')} icon={<User size={16} />}>
                  <p className="text-sm text-gray-700">{patient.medical.disability}</p>
                </Section>
              </div>
            )}
          </div>
        )}

        {/* ─── ALLERGIES ─── */}
        {activeTab === 'allergies' && (
          <div className="max-w-xl space-y-4">
            {patient.medical?.criticalNotes && (
              <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-red-700">{patient.medical.criticalNotes}</p>
              </div>
            )}
            {patient.medical?.allergies?.length ? (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="font-semibold text-gray-800 mb-3 text-sm">{t('pat.form.allergies')}</h3>
                <div className="flex flex-wrap gap-2">
                  {patient.medical.allergies.map(a => (
                    <span key={a} className="text-sm px-3 py-1.5 bg-red-100 text-red-700 border border-red-200 rounded-full font-medium">{a}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
                <p className="text-green-700 font-medium">{t('pat.overview.no_allergy')}</p>
              </div>
            )}
          </div>
        )}

        {/* ─── EMERGENCY CONTACT ─── */}
        {activeTab === 'emergency_contact' && <PatientEmergencyContacts patient={patient} />}

        {/* ─── VACCINATIONS ─── */}
        {activeTab === 'vaccinations' && <PatientVaccinationsTab />}

        {/* ─── CONSENTEMENTS ─── */}
        {activeTab === 'consents' && <PatientConsentsTab />}

        {/* ─── TIMELINE ─── */}
        {activeTab === 'timeline' && <PatientTimeline events={timeline} />}

        {/* ─── AUDIT ─── */}
        {activeTab === 'audit' && <PatientAuditLog />}

        {/* ─── PLACEHOLDER TABS ─── */}
        {SOON_TABS.includes(activeTab) && (
          <PlaceholderTab label={t(`pat.tab.${activeTab}` as any)} />
        )}
      </div>

      {/* Edit form */}
      {showEdit && (
        <PatientForm
          patient={patient}
          onSave={() => setShowEdit(false)}
          onCancel={() => setShowEdit(false)}
        />
      )}

      {/* Archive confirmation */}
      {archiving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setArchiving(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900">{t('pat.confirm.archive.title')}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">{t('pat.confirm.archive.desc')}</p>
            <div className="flex gap-3">
              <button onClick={() => setArchiving(false)} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                {t('pat.confirm.archive.no')}
              </button>
              <button
                onClick={() => { log('archive', 'patient', patient.id); setArchiving(false); setLocation('/patients'); }}
                className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                {t('pat.confirm.archive.yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
