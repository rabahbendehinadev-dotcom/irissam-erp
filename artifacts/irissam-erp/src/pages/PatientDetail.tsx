import { useState, useEffect, useCallback } from 'react';
import { useRoute, useLocation } from 'wouter';
import { ArrowLeft, AlertTriangle, Phone, Droplets, User, Shield, Stethoscope, ChevronRight, PlusCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PatientProfileHeader } from '@/components/patients/PatientProfileHeader';
import { PatientTimeline } from '@/components/patients/PatientTimeline';
import { PatientDocumentsV2 } from '@/components/patients/PatientDocumentsV2';
import { PatientForm } from '@/components/patients/PatientForm';
import { SensitiveField } from '@/components/patients/SensitiveField';
import { PatientAlertBanner } from '@/components/patients/PatientAlertBanner';
import { PatientMedicalSummary } from '@/components/patients/PatientMedicalSummary';
import { PatientStatsCards } from '@/components/patients/PatientStatsCards';
import { PatientAuditLog } from '@/components/patients/PatientAuditLog';
import { PatientEmergencyContacts } from '@/components/patients/PatientEmergencyContacts';
import { PatientInsuranceDetail } from '@/components/patients/PatientInsuranceDetail';
import { PatientVaccinationsTab } from '@/components/patients/PatientVaccinationsTab';
import { PatientConsentsTab } from '@/components/patients/PatientConsentsTab';
import { PatientAllergyManager } from '@/components/patients/PatientAllergyManager';
import { PatientMedicalHistoryTab } from '@/components/patients/PatientMedicalHistoryTab';
import { PatientInvoicesTab } from '@/components/billing/PatientInvoicesTab';
import { PatientPaymentsTab } from '@/components/billing/PatientPaymentsTab';
import { PatientBillingTab } from '@/components/billing/PatientBillingTab';
import { PatientPortalTab } from '@/components/patients/PatientPortalTab';
import { PatientLabOrdersTab } from '@/components/patients/PatientLabOrdersTab';
import { PatientImagingOrdersTab } from '@/components/patients/PatientImagingOrdersTab';
import { PatientPrescriptionsTab } from '@/components/patients/PatientPrescriptionsTab';
import { PatientAppointmentsTab } from '@/components/patients/PatientAppointmentsTab';
import { PatientAdmissionsHistoryTab } from '@/components/patients/PatientAdmissionsHistoryTab';
import { PatientEmergencyVisitsTab } from '@/components/patients/PatientEmergencyVisitsTab';
import { ConsultationTable } from '@/components/consultations/ConsultationTable';
import { ConsultationForm } from '@/components/consultations/ConsultationForm';
import { ConsultationStatusBadge } from '@/components/consultations/ConsultationStatusBadge';
import type { Consultation } from '@/types/consultation';
import { useLanguage } from '@/i18n';
import { usePermission } from '@/hooks/usePermission';
import { useAuditLog } from '@/hooks/useAuditLog';
import { formatDate } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { Patient, PatientTimelineEvent } from '@/types';
import { apiClient } from '@/services/api/client';

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

// ─── Recent Consultations widget (overview tab) ───────────────────────────────

function DernieresConsultations({ consultations, onOpen, onNew }: {
  consultations: Consultation[];
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  // Show only the 5 most recent
  const recent = [...consultations]
    .sort((a, b) => (b.scheduledAt ?? b.date).localeCompare(a.scheduledAt ?? a.date))
    .slice(0, 5);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden md:col-span-2">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Stethoscope size={15} className="text-blue-600" />
          <h3 className="font-semibold text-gray-800 text-sm">Dernières consultations</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{consultations.length} au total</span>
          <button
            onClick={onNew}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
          >
            <PlusCircle size={11} /> Nouvelle
          </button>
        </div>
      </div>
      {recent.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400 space-y-1">
          <Stethoscope size={32} className="opacity-20" />
          <p className="text-sm">Aucune consultation enregistrée</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {recent.map(c => {
            const dateStr = c.scheduledAt ?? c.date;
            const diagnosis = c.diagnosis?.trim() ? c.diagnosis : '—';
            return (
              <div key={c.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex-shrink-0 text-right w-20">
                  <p className="text-xs font-semibold text-gray-700">
                    {new Date(dateStr).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit' })}
                  </p>
                  <p className="text-xs text-gray-400 font-mono">{dateStr.substring(11, 16)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-700">{c.doctorName}</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500">{c.specialty}</span>
                    <ConsultationStatusBadge status={c.status} />
                  </div>
                  <p className="text-xs text-gray-800 mt-0.5 font-medium truncate">{diagnosis}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{c.reason}</p>
                </div>
                <button onClick={() => onOpen(c.id)}
                  className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors">
                  Ouvrir <ChevronRight size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// (no more SOON_TABS — all tabs are now connected to real APIs)

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PatientDetailPage() {
  const { t } = useLanguage();
  const { can } = usePermission();
  const { log } = useAuditLog();
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/patients/:id');
  const patientId = params?.id;

  const [activeTab, setActiveTab] = useState('overview');
  const [showEdit,  setShowEdit]  = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showNewConsultation, setShowNewConsultation] = useState(false);

  // ── Real API fetch — no mock fallback ─────────────────────────────────────
  type LoadState = 'loading' | 'success' | 'not_found' | 'forbidden' | 'error';
  const [loadState,   setLoadState]   = useState<LoadState>('loading');
  const [patient,     setPatient]     = useState<Patient | null>(null);
  const [apiErrorMsg, setApiErrorMsg] = useState('');
  const [refetchTick, setRefetchTick] = useState(0);
  const refetch = useCallback(() => setRefetchTick(t => t + 1), []);

  useEffect(() => {
    if (!patientId) { setLoadState('not_found'); return; }
    let aborted = false;
    setLoadState('loading');
    setPatient(null);
    apiClient.get<Record<string, unknown>>(`/patients/${patientId}`)
      .then(r => {
        if (aborted) return;
        setPatient({
          id:                   r.id as string,
          mpiId:                (r.mpiId as string) ?? '',
          fileNumber:           (r.fileNumber as string) ?? (r.internalNumber as string) ?? (r.mpiId as string) ?? '',
          internalNumber:       (r.internalNumber as string) ?? '',
          firstName:            (r.firstName as string) ?? '',
          lastName:             (r.lastName as string) ?? '',
          maidenName:           (r.maidenName as string) ?? undefined,
          status:               (r.status as Patient['status']) ?? 'active',
          gender:               (r.gender as Patient['gender']) ?? 'M',
          dateOfBirth:          (r.dateOfBirth as string) ?? '',
          placeOfBirth:         (r.placeOfBirth as string) ?? undefined,
          nationality:          (r.nationality as string) ?? 'Algérienne',
          maritalStatus:        (r.maritalStatus as Patient['maritalStatus']) ?? undefined,
          idDocumentType:       (r.idDocumentType as Patient['idDocumentType']) ?? undefined,
          idDocumentNumber:     (r.idDocumentNumber as string) ?? undefined,
          socialSecurityNumber: (r.socialSecurityNumber as string) ?? undefined,
          bloodType:            (r.bloodType as Patient['bloodType']) ?? undefined,
          rhesus:               (r.rhesus as '+' | '-') ?? undefined,
          phone:                (r.phone as string) ?? '',
          phoneSecondary:       (r.phoneSecondary as string) ?? undefined,
          email:                (r.email as string) ?? undefined,
          address:              (r.address as string) ?? undefined,
          commune:              (r.commune as string) ?? undefined,
          wilaya:               (r.wilaya as string) ?? undefined,
          postalCode:           (r.postalCode as string) ?? undefined,
          country:              (r.country as string) ?? 'Algérie',
          isIncomplete:         Boolean(r.isIncomplete),
          potentialDuplicate:   Boolean(r.potentialDuplicate),
          syncStatus:           (r.syncStatus as Patient['syncStatus']) ?? 'synced',
          medical:              (r.medical as Patient['medical']) ?? { allergies: [], chronicDiseases: [], majorHistory: [] },
          emergencyContact:     (r.emergencyContact as Patient['emergencyContact']) ?? undefined,
          insurance:            (r.insurance as Patient['insurance']) ?? undefined,
          createdAt:            (r.createdAt as string) ?? new Date().toISOString(),
          updatedAt:            (r.updatedAt as string) ?? new Date().toISOString(),
          createdById:          'system',
          siteId:               'site-1',
        } as Patient);
        setLoadState('success');
      })
      .catch(err => {
        if (aborted) return;
        const status = (err as { status?: number }).status;
        if (status === 404)      setLoadState('not_found');
        else if (status === 403) setLoadState('forbidden');
        else { setApiErrorMsg(err?.message ?? 'Erreur réseau'); setLoadState('error'); }
      });
    return () => { aborted = true; };
  }, [patientId, refetchTick]);

  // ── Real patient-scoped consultations (Overview widget + Consultations tab) ──
  const [patientConsultations, setPatientConsultations] = useState<Consultation[]>([]);
  const [consultLoading, setConsultLoading] = useState(true);
  const [consultError, setConsultError] = useState(false);
  useEffect(() => {
    if (!patientId) return;
    let aborted = false;
    setConsultLoading(true); setConsultError(false);
    apiClient.get<Consultation[]>(`/consultations?patientId=${encodeURIComponent(patientId)}`)
      .then(rows => { if (!aborted) setPatientConsultations(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!aborted) setConsultError(true); })
      .finally(() => { if (!aborted) setConsultLoading(false); });
    return () => { aborted = true; };
  }, [patientId, refetchTick]);

  // ── Real patient-scoped timeline (GET /patients/:id/timeline) ──
  const [timeline, setTimeline] = useState<PatientTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineError, setTimelineError] = useState(false);
  useEffect(() => {
    if (!patientId) return;
    let aborted = false;
    setTimelineLoading(true); setTimelineError(false);
    apiClient.get<PatientTimelineEvent[]>(`/patients/${encodeURIComponent(patientId)}/timeline`)
      .then(rows => { if (!aborted) setTimeline(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!aborted) setTimelineError(true); })
      .finally(() => { if (!aborted) setTimelineLoading(false); });
    return () => { aborted = true; };
  }, [patientId, refetchTick]);

  // ── Permission guard (runs before load states to avoid waiting on patient data) ──
  if (!can('patients.view')) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-400">{t('pat.page.no_permission')}</p>
        </div>
      </DashboardLayout>
    );
  }

  // ── Load states ──────────────────────────────────────────────────────────────
  if (loadState === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-sm">Chargement du dossier patient…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (loadState === 'not_found') {
    return (
      <DashboardLayout>
        <div className="p-6">
          <button onClick={() => setLocation('/patients')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
            <ArrowLeft size={16} /> {t('pat.back_to_list')}
          </button>
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-400 space-y-2">
            <AlertTriangle size={48} className="opacity-30" />
            <p className="font-semibold">Patient introuvable</p>
            {patientId && <p className="text-xs font-mono text-gray-300">{patientId}</p>}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (loadState === 'forbidden') {
    return (
      <DashboardLayout>
        <div className="p-6">
          <button onClick={() => setLocation('/patients')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
            <ArrowLeft size={16} /> {t('pat.back_to_list')}
          </button>
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-400 space-y-2">
            <Shield size={48} className="opacity-30" />
            <p className="font-semibold">Accès refusé</p>
            <p className="text-sm">Vous n'avez pas les droits pour consulter ce dossier.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (loadState === 'error') {
    return (
      <DashboardLayout>
        <div className="p-6">
          <button onClick={() => setLocation('/patients')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
            <ArrowLeft size={16} /> {t('pat.back_to_list')}
          </button>
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-400 space-y-3">
            <AlertTriangle size={48} className="opacity-30" />
            <p className="font-semibold">Erreur de chargement</p>
            <p className="text-sm">{apiErrorMsg}</p>
            <div className="flex gap-3">
              <button
                onClick={refetch}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Réessayer
              </button>
              <button
                onClick={() => setLocation('/patients')}
                className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Retour à la liste
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // patient is guaranteed non-null when loadState === 'success'
  if (!patient) return null;

  const canViewSensitive = can('patients.view_sensitive');
  const canEdit    = can('patients.edit');
  const canArchive = can('patients.archive');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'audit') log('view_audit', 'patient', patient.id);
  };

  const handleQuickAction = (key: string) => {
    if (key === 'consultation') {
      setShowNewConsultation(true);
    }
    // Other quick actions handled by their respective tabs/modals
  };

  const fullName = `${patient.lastName} ${patient.firstName}`;

  return (
    <DashboardLayout>
      {/* Back link */}
      <div className="px-6 pt-4">
        <button onClick={() => setLocation('/patients')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft size={15} /> {t('pat.back_to_list')}
        </button>
      </div>

      {/* Alert Banner */}
      <PatientAlertBanner patient={patient} />

      {/* ── Feature 1: Smart Medical Summary Strip ───────────────────────── */}
      <PatientMedicalSummary
        patient={patient}
        timeline={timeline}
        onTabChange={handleTabChange}
      />

      {/* Sticky profile header with tabs */}
      <div className="sticky top-0 z-20">
        <PatientProfileHeader
          patient={patient}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onEdit={() => setShowEdit(true)}
          onArchive={() => setArchiving(true)}
          onQuickAction={handleQuickAction}
          canEdit={canEdit}
          canArchive={canArchive}
        />
      </div>

      {/* Tab content */}
      <div className="p-6">

        {/* ── Feature 9: Stats cards → clickable, navigate to matching tab ── */}
        {['overview', 'history', 'allergies', 'timeline'].includes(activeTab) && (
          <PatientStatsCards patient={patient} onCardClick={handleTabChange} />
        )}

        {/* ─── OVERVIEW ─── */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Section title={t('pat.overview.identity')} icon={<User size={16} />}>
              <InfoRow label="Nom complet" value={fullName} />
              <InfoRow label="Genre" value={patient.gender === 'M' ? t('pat.gender.m') : t('pat.gender.f')} />
              <InfoRow label="Date de naissance" value={formatDate(patient.dateOfBirth)} />
              {patient.placeOfBirth  && <InfoRow label="Lieu de naissance"  value={patient.placeOfBirth} />}
              {patient.nationality   && <InfoRow label="Nationalité"         value={patient.nationality} />}
              {patient.maritalStatus && <InfoRow label="Situation familiale" value={t(`pat.marital.${patient.maritalStatus}` as any)} />}
            </Section>

            <Section title={t('pat.overview.contact')} icon={<Phone size={16} />}>
              <InfoRow label="Téléphone"   value={patient.phone} />
              {patient.phoneSecondary && <InfoRow label="Téléphone 2" value={patient.phoneSecondary} />}
              {patient.email          && <InfoRow label="Email"        value={patient.email} />}
              {patient.address        && <InfoRow label="Adresse"      value={patient.address} />}
              {patient.commune        && <InfoRow label="Commune"      value={patient.commune} />}
              {patient.wilaya         && <InfoRow label="Wilaya"       value={patient.wilaya} />}
            </Section>

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

            {/* Dernières consultations — full width, real data */}
            <DernieresConsultations
              consultations={patientConsultations}
              onOpen={id => setLocation(`/consultations/${id}`)}
              onNew={() => setShowNewConsultation(true)}
            />
          </div>
        )}

        {/* ─── IDENTITY ─── */}
        {activeTab === 'identity' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Section title="État civil" icon={<User size={16} />}>
              <InfoRow label={t('pat.form.lastName')}   value={patient.lastName} />
              <InfoRow label={t('pat.form.firstName')}  value={patient.firstName} />
              {patient.maidenName && <InfoRow label={t('pat.form.maidenName')} value={patient.maidenName} />}
              <InfoRow label={t('pat.form.gender')}     value={patient.gender === 'M' ? t('pat.gender.m') : t('pat.gender.f')} />
              <InfoRow label={t('pat.form.dateOfBirth')} value={formatDate(patient.dateOfBirth)} />
              {patient.placeOfBirth  && <InfoRow label={t('pat.form.placeOfBirth')}  value={patient.placeOfBirth} />}
              {patient.nationality   && <InfoRow label={t('pat.form.nationality')}   value={patient.nationality} />}
              {patient.maritalStatus && <InfoRow label={t('pat.form.maritalStatus')} value={t(`pat.marital.${patient.maritalStatus}` as any)} />}
            </Section>
            <Section title="Identifiants" icon={<Shield size={16} />}>
              <InfoRow label={t('pat.form.mpiId')}          value={patient.mpiId}          mono />
              <InfoRow label={t('pat.form.fileNumber')}      value={patient.fileNumber}     mono />
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
              {patient.email          && <InfoRow label={t('pat.form.email')}           value={patient.email} />}
              {patient.address        && <InfoRow label={t('pat.form.address')}         value={patient.address} />}
              {patient.commune        && <InfoRow label={t('pat.form.commune')}         value={patient.commune} />}
              {patient.wilaya         && <InfoRow label={t('pat.form.wilaya')}          value={patient.wilaya} />}
              {patient.postalCode     && <InfoRow label={t('pat.form.postalCode')}      value={patient.postalCode} />}
              <InfoRow label={t('pat.form.country')} value={patient.country} />
            </Section>
            {patient.emergencyContact && (
              <Section title={t('pat.overview.emergency')} icon={<AlertTriangle size={16} />}>
                <InfoRow label={t('pat.form.emergency.name')}     value={patient.emergencyContact.name} />
                <InfoRow label={t('pat.form.emergency.relation')} value={patient.emergencyContact.relation} />
                <InfoRow label={t('pat.form.emergency.phone')}    value={patient.emergencyContact.phone} />
                {patient.emergencyContact.address && <InfoRow label={t('pat.form.emergency.address')} value={patient.emergencyContact.address} />}
              </Section>
            )}
          </div>
        )}

        {/* ─── INSURANCE ─── */}
        {activeTab === 'insurance' && <PatientInsuranceDetail patient={patient} />}

        {/* ─── DOCUMENTS ─── */}
        {activeTab === 'documents' && <PatientDocumentsV2 patientId={patient.id} />}

        {/* ─── HISTORY (Feature 5: categorized) ─── */}
        {activeTab === 'history' && <PatientMedicalHistoryTab patient={patient} />}

        {/* ─── ALLERGIES (Feature 4: professional manager) ─── */}
        {activeTab === 'allergies' && <PatientAllergyManager patient={patient} onChanged={refetch} />}

        {/* ─── EMERGENCY CONTACT ─── */}
        {activeTab === 'emergency_contact' && <PatientEmergencyContacts patient={patient} />}

        {/* ─── VACCINATIONS ─── */}
        {activeTab === 'vaccinations' && <PatientVaccinationsTab patientId={patient.id} />}

        {/* ─── CONSENTEMENTS ─── */}
        {activeTab === 'consents' && <PatientConsentsTab patientId={patient.id} />}

        {/* ─── CONSULTATIONS ─── */}
        {activeTab === 'consultations' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-800">Historique des consultations</h2>
                <p className="text-xs text-gray-400 mt-0.5">{patientConsultations.length} consultation{patientConsultations.length !== 1 ? 's' : ''} enregistrée{patientConsultations.length !== 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={() => setShowNewConsultation(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PlusCircle size={14} /> Nouvelle consultation
              </button>
            </div>
            {consultLoading ? (
              <div className="flex items-center justify-center min-h-[300px]">
                <div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              </div>
            ) : consultError ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] text-red-500 space-y-2">
                <AlertTriangle size={32} className="opacity-50" />
                <p className="text-sm font-medium">Impossible de charger les consultations de ce patient.</p>
                <button onClick={refetch} className="text-xs text-blue-600 hover:underline">Réessayer</button>
              </div>
            ) : patientConsultations.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-400 space-y-3">
                <Stethoscope size={40} className="opacity-20" />
                <p className="font-semibold">Aucune consultation enregistrée</p>
                <p className="text-sm">Créez la première consultation pour ce patient.</p>
              </div>
            ) : (
              <ConsultationTable
                consultations={patientConsultations}
                onPatientClick={undefined}
              />
            )}
          </div>
        )}

        {/* ─── TIMELINE (real per-patient events — GET /patients/:id/timeline) ─── */}
        {activeTab === 'timeline' && (
          timelineLoading ? (
            <div className="flex items-center justify-center min-h-[240px]">
              <div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : timelineError ? (
            <div className="flex flex-col items-center justify-center min-h-[240px] text-red-500 space-y-2">
              <AlertTriangle size={32} className="opacity-50" />
              <p className="text-sm font-medium">Impossible de charger l'historique de ce patient.</p>
              <button onClick={refetch} className="text-xs text-blue-600 hover:underline">Réessayer</button>
            </div>
          ) : <PatientTimeline events={timeline} />
        )}

        {/* ─── AUDIT (Feature 8: search + filter + export) ─── */}
        {activeTab === 'audit' && <PatientAuditLog patientId={patient.id} />}

        {/* ─── PORTAL ─── */}
        {activeTab === 'portal' && <PatientPortalTab patientId={patient.id} patientEmail={patient.email} />}

        {/* ─── BILLING TABS ─── */}
        {activeTab === 'invoices'  && <PatientInvoicesTab  patientId={patient.id} />}
        {activeTab === 'payments'  && <PatientPaymentsTab  patientId={patient.id} />}
        {activeTab === 'billing'   && <PatientBillingTab   patientId={patient.id} />}

        {/* ─── CLINICAL ORDER TABS ─── */}
        {activeTab === 'laboratory'      && <PatientLabOrdersTab    patientId={patient.id} />}
        {activeTab === 'imaging'         && <PatientImagingOrdersTab patientId={patient.id} />}
        {activeTab === 'prescriptions'   && <PatientPrescriptionsTab patientId={patient.id} />}

        {/* ─── SCHEDULING & MOVEMENT TABS ─── */}
        {activeTab === 'appointments'    && <PatientAppointmentsTab    patientId={patient.id} />}
        {activeTab === 'admissions'      && <PatientAdmissionsHistoryTab patientId={patient.id} />}
        {activeTab === 'hospitalizations'&& <PatientAdmissionsHistoryTab patientId={patient.id} typeFilter="hospitalisation" />}
        {activeTab === 'emergencies'     && <PatientEmergencyVisitsTab   patientId={patient.id} />}
      </div>

      {/* Edit form */}
      {showEdit && (
        <PatientForm
          patient={patient}
          onSave={() => { setShowEdit(false); refetch(); }}
          onCancel={() => setShowEdit(false)}
        />
      )}

      {/* New Consultation modal */}
      {showNewConsultation && (
        <ConsultationForm
          initialPatientId={patient.id}
          onClose={() => setShowNewConsultation(false)}
          onCreated={async () => {
            setShowNewConsultation(false);
            // Refresh the consultations tab + timeline (the record now exists in PostgreSQL)
            refetch();
            // Navigation to consultation workspace is handled by ConsultationForm on success
            return true;
          }}
        />
      )}

      {/* Archive confirmation */}
      {archiving && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setArchiving(false)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 w-full sm:max-w-sm max-h-[95dvh] overflow-y-auto">
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
