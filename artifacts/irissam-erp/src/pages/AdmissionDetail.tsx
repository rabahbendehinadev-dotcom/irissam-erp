import { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import {
  ArrowLeft, Edit, LogOut, ArrowRight, AlertTriangle,
  Stethoscope, Bed, MapPin, Calendar, Clock, User,
  FileText, StickyNote, ClipboardList, CheckCircle2,
  PlusCircle, Printer,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PatientAvatar } from '@/components/shared/PatientAvatar';
import { AdmissionStatusBadge } from '@/components/admissions/AdmissionStatusBadge';
import { AdmissionTypeBadge } from '@/components/admissions/AdmissionTypeBadge';
import { PriorityBadge } from '@/components/admissions/PriorityBadge';
import { AdmissionTimeline } from '@/components/admissions/AdmissionTimeline';
import { AdmissionForm } from '@/components/admissions/AdmissionForm';
import { useAdmissions } from '@/store/AdmissionsContext';
import { MOCK_ADMISSION_TIMELINES } from '@/mock';
import { useLanguage } from '@/i18n';
import { usePermission } from '@/hooks/usePermission';
import { useAuditLog } from '@/hooks/useAuditLog';
import { formatDate } from '@/utils/format';
import type { Admission } from '@/types/admission';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
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

// ─── Discharge modal (inline copy from Admissions.tsx to keep page self-contained) ──

function DischargeModal({ admission, onConfirm, onCancel }: {
  admission: Admission;
  onConfirm: (type: string, date: string, time: string, notes: string) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const today = new Date().toISOString().slice(0, 10);
  const now   = new Date().toTimeString().slice(0, 5);
  const [type, setType]   = useState('domicile');
  const [date, setDate]   = useState(today);
  const [time, setTime]   = useState(now);
  const [notes, setNotes] = useState('');
  const cls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6 max-h-[95dvh] overflow-y-auto">
        <h3 className="font-bold text-gray-900 text-lg mb-4">{t('adm.discharge.title')}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('adm.discharge.type')}</label>
            <select value={type} onChange={e => setType(e.target.value)} className={cls}>
              {['domicile','transfert_interne','transfert_externe','deces','fugue','contre_avis'].map(v =>
                <option key={v} value={v}>{t(`adm.discharge.type.${v}` as any)}</option>
              )}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('adm.discharge.date')}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={cls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('adm.discharge.time')}</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className={cls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('adm.discharge.notes')}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className={`${cls} resize-none`} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">{t('adm.form.cancel')}</button>
          <button onClick={() => onConfirm(type, date, time, notes)}
            className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
            {t('adm.discharge.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

function TransferModal({ admission, onConfirm, onCancel }: {
  admission: Admission;
  onConfirm: (to: string, date: string, notes: string) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const today = new Date().toISOString().slice(0, 10);
  const [to, setTo]       = useState('');
  const [date, setDate]   = useState(today);
  const [notes, setNotes] = useState('');
  const cls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6 max-h-[95dvh] overflow-y-auto">
        <h3 className="font-bold text-gray-900 text-lg mb-4">{t('adm.transfer.title')}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('adm.transfer.to')} *</label>
            <input value={to} onChange={e => setTo(e.target.value)} className={cls}
              placeholder="Ex: CHU Mustapha — Cardiologie" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('adm.transfer.date')}</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={cls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('adm.transfer.notes')}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${cls} resize-none`} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">{t('adm.form.cancel')}</button>
          <button onClick={() => onConfirm(to, date, notes)} disabled={!to.trim()}
            className="flex-1 px-3 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium disabled:opacity-40">
            {t('adm.transfer.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab components ────────────────────────────────────────────────────────────

function OverviewTab({ admission }: { admission: Admission }) {
  const { t } = useLanguage();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Medical info */}
      <Section title="Informations médicales" icon={<Stethoscope size={16} />}>
        <InfoRow label="Service" value={admission.serviceName} />
        <InfoRow label="Médecin responsable" value={admission.doctorName} />
        <InfoRow label="Motif d'admission" value={admission.motif} />
        {admission.diagnosis && <InfoRow label="Diagnostic" value={admission.diagnosis} />}
        {admission.notes && <InfoRow label="Notes cliniques" value={admission.notes} />}
      </Section>

      {/* Stay info */}
      <Section title="Séjour hospitalier" icon={<Bed size={16} />}>
        <InfoRow label="Date d'admission" value={`${formatDate(admission.admissionDate)} à ${admission.admissionTime}`} />
        {admission.expectedDischargeDate && (
          <InfoRow label="Sortie prévisionnelle" value={formatDate(admission.expectedDischargeDate)} />
        )}
        {admission.actualDischargeDate && (
          <InfoRow
            label="Date de sortie effective"
            value={`${formatDate(admission.actualDischargeDate)}${admission.actualDischargeTime ? ` à ${admission.actualDischargeTime}` : ''}`}
          />
        )}
        {admission.dischargeType && (
          <InfoRow label="Type de sortie" value={t(`adm.discharge.type.${admission.dischargeType}` as any)} />
        )}
        {admission.preadmissionDate && (
          <InfoRow label="Date d'admission prévue" value={formatDate(admission.preadmissionDate)} />
        )}
        {admission.transferTo && <InfoRow label="Transféré vers" value={admission.transferTo} />}
        {admission.transferDate && <InfoRow label="Date de transfert" value={formatDate(admission.transferDate)} />}
      </Section>

      {/* Bed location */}
      {admission.bedNumber && (
        <Section title="Localisation" icon={<MapPin size={16} />}>
          <InfoRow label="Lit" value={admission.bedNumber} />
          {admission.roomNumber && <InfoRow label="Chambre" value={admission.roomNumber} />}
          {admission.floorLabel && <InfoRow label="Étage" value={admission.floorLabel} />}
          {admission.buildingName && <InfoRow label="Bâtiment" value={admission.buildingName} />}
        </Section>
      )}

      {/* Administrative info */}
      <Section title="Informations administratives" icon={<ClipboardList size={16} />}>
        <InfoRow label="N° Admission" value={admission.admissionNumber} mono />
        <InfoRow label="N° MPI Patient" value={admission.patientMpiId} mono />
        <InfoRow label="Type" value={t(`adm.type.${admission.type}` as any)} />
        <InfoRow label="Priorité" value={t(`adm.priority.${admission.priority}` as any)} />
        <InfoRow label="Statut" value={t(`adm.status.${admission.status}` as any)} />
        <InfoRow
          label="Créé le"
          value={formatDate(admission.createdAt)}
        />
        {admission.updatedAt !== admission.createdAt && (
          <InfoRow label="Mis à jour le" value={formatDate(admission.updatedAt)} />
        )}
      </Section>
    </div>
  );
}

// Notes tab — simple note board backed by local state
interface Note { id: string; text: string; author: string; date: string }
const MOCK_NOTES: Note[] = [
  { id: 'n-1', text: 'Patient stable, paramètres vitaux dans les normes. Surveillance rapprochée maintenue.', author: 'Dr. Hamidou Karim', date: '2026-08-01T09:30:00Z' },
  { id: 'n-2', text: 'Famille informée du plan de soins. Consentement signé.', author: 'Infirmière Réception', date: '2026-08-01T10:00:00Z' },
];

function NotesTab({ admission }: { admission: Admission }) {
  const [notes, setNotes] = useState<Note[]>(() =>
    admission.id === 'adm-1' ? MOCK_NOTES : [],
  );
  const [draft, setDraft] = useState('');

  const addNote = () => {
    if (!draft.trim()) return;
    setNotes(prev => [...prev, {
      id: `n-${Date.now()}`,
      text: draft.trim(),
      author: 'Utilisateur courant',
      date: new Date().toISOString(),
    }]);
    setDraft('');
  };

  return (
    <div className="space-y-4">
      {/* New note */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-500 mb-2">Nouvelle note clinique</p>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={3}
          placeholder="Saisissez une note…"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={addNote}
            disabled={!draft.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            <PlusCircle size={13} /> Ajouter la note
          </button>
        </div>
      </div>

      {/* Note list */}
      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <StickyNote size={36} className="opacity-30 mb-2" />
          <p className="text-sm">Aucune note pour cette admission</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...notes].reverse().map(n => (
            <div key={n.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-800 leading-relaxed">{n.text}</p>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                <span className="font-medium text-gray-600">{n.author}</span>
                <span>{formatDate(n.date)} à {new Date(n.date).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Documents tab — placeholder with mock doc list
const MOCK_DOCS = [
  { id: 'd-1', name: 'Consentement signé', type: 'PDF', date: '2026-08-01', size: '124 Ko' },
  { id: 'd-2', name: 'Résultats ECG', type: 'PDF', date: '2026-08-01', size: '312 Ko' },
  { id: 'd-3', name: 'Compte rendu anesthésiste', type: 'DOCX', date: '2026-08-01', size: '88 Ko' },
];

function DocumentsTab({ admission }: { admission: Admission }) {
  const hasDocs = admission.id === 'adm-1';
  const docs = hasDocs ? MOCK_DOCS : [];

  return (
    <div className="space-y-3">
      {/* Upload button */}
      <div className="flex justify-end">
        <button className="flex items-center gap-1.5 px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
          <PlusCircle size={14} /> Ajouter un document
        </button>
      </div>

      {docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <FileText size={36} className="opacity-30 mb-2" />
          <p className="text-sm">Aucun document joint à cette admission</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Nom du document</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Date</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Taille</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docs.map(d => (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800 flex items-center gap-2">
                    <FileText size={14} className="text-blue-500 flex-shrink-0" />
                    {d.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{d.type}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(d.date)}</td>
                  <td className="px-4 py-3 text-gray-500">{d.size}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-xs text-blue-600 hover:underline">Télécharger</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>{/* end overflow-x-auto */}
        </div>
      )}
    </div>
  );
}

// Discharge summary tab
function DischargeSummaryTab({ admission }: { admission: Admission }) {
  const isDischargedOrTransferred = ['discharged', 'transferred', 'cancelled'].includes(admission.status);

  if (!isDischargedOrTransferred) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-2">
        <ClipboardList size={40} className="opacity-30" />
        <p className="font-semibold text-gray-500">Compte rendu de sortie</p>
        <p className="text-sm text-center max-w-sm">
          Le compte rendu de sortie sera disponible une fois le patient sorti ou transféré.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Compte rendu de sortie</h3>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
            <Printer size={14} /> Imprimer
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <InfoRow label="Type de sortie" value={admission.dischargeType ? { domicile: 'Retour à domicile', transfert_interne: 'Transfert interne', transfert_externe: 'Transfert externe', deces: 'Décès', fugue: 'Fugue', contre_avis: 'Contre avis médical' }[admission.dischargeType] : undefined} />
          {admission.actualDischargeDate && (
            <InfoRow label="Date de sortie" value={`${formatDate(admission.actualDischargeDate)}${admission.actualDischargeTime ? ` à ${admission.actualDischargeTime}` : ''}`} />
          )}
          {admission.transferTo && <InfoRow label="Établissement de transfert" value={admission.transferTo} />}
        </div>
        {admission.dischargeNotes || admission.notes ? (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes de sortie</p>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 leading-relaxed">
              {admission.dischargeNotes ?? admission.notes}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Aucune note de sortie renseignée.</p>
        )}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'timeline' | 'notes' | 'documents' | 'sortie';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',   label: 'Vue générale',  icon: <ClipboardList size={14} /> },
  { id: 'timeline',   label: 'Timeline',      icon: <Clock size={14} /> },
  { id: 'notes',      label: 'Notes',         icon: <StickyNote size={14} /> },
  { id: 'documents',  label: 'Documents',     icon: <FileText size={14} /> },
  { id: 'sortie',     label: 'Sortie',        icon: <CheckCircle2 size={14} /> },
];

export default function AdmissionDetailPage() {
  const { t } = useLanguage();
  const { can } = usePermission();
  const { log } = useAuditLog();
  const [, navigate] = useLocation();
  const [, params]   = useRoute('/admissions/:id');

  const { admissions, discharge, transfer } = useAdmissions();
  const admission = admissions.find(a => a.id === params?.id);

  const [activeTab,    setActiveTab]    = useState<Tab>('overview');
  const [showForm,     setShowForm]     = useState(false);
  const [discharging,  setDischarging]  = useState(false);
  const [transferring, setTransferring] = useState(false);

  // Not found
  if (!admission) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertTriangle size={40} className="text-amber-400 opacity-60" />
          <p className="text-gray-500 font-medium">Admission introuvable</p>
          <button onClick={() => navigate('/admissions')}
            className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
            <ArrowLeft size={14} /> Retour à la liste des admissions
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const timeline = MOCK_ADMISSION_TIMELINES[admission.id] ?? [];
  const isActive = ['active', 'preadmission', 'ambulatoire'].includes(admission.status);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 max-w-6xl mx-auto">

        {/* Breadcrumb */}
        <button
          onClick={() => navigate('/admissions')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={14} />
          {t('adm.back_to_list')}
        </button>

        {/* ── Header card ── */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            {/* Avatar + patient info */}
            <button
              onClick={() => navigate(`/patients/${admission.patientId}`)}
              className="flex items-center gap-3 group min-w-0"
              title="Voir le dossier patient"
            >
              <PatientAvatar name={admission.patientName} size="lg" />
              <div className="min-w-0">
                <p className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                  {admission.patientName}
                </p>
                <p className="text-xs font-mono text-gray-400">{admission.patientMpiId}</p>
                <p className="text-xs text-blue-500 group-hover:underline mt-0.5">Voir le dossier patient →</p>
              </div>
            </button>

            {/* Middle: badges + admission number */}
            <div className="flex-1 min-w-0 sm:pl-2">
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <AdmissionStatusBadge status={admission.status} />
                <AdmissionTypeBadge type={admission.type} />
                <PriorityBadge priority={admission.priority} />
              </div>
              <p className="text-xs text-gray-400">
                <span className="font-mono font-semibold text-gray-700">{admission.admissionNumber}</span>
                {' · '}
                {admission.serviceName}
                {' · '}
                {admission.doctorName}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Admis le {formatDate(admission.admissionDate)} à {admission.admissionTime}
                {admission.bedNumber && (
                  <> · Lit <span className="font-medium text-gray-600">{admission.bedNumber}</span></>
                )}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              {can('admissions.edit') && isActive && (
                <button
                  onClick={() => { log('view', 'admission', admission.id); setShowForm(true); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Edit size={13} /> Modifier
                </button>
              )}
              {can('admissions.transfer') && isActive && (
                <button
                  onClick={() => setTransferring(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                >
                  <ArrowRight size={13} /> Transfert
                </button>
              )}
              {can('admissions.discharge') && isActive && (
                <button
                  onClick={() => setDischarging(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <LogOut size={13} /> Sortie
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-5 py-3 text-sm border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-700 font-semibold bg-blue-50/40'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">
            {activeTab === 'overview'  && <OverviewTab  admission={admission} />}
            {activeTab === 'timeline'  && <AdmissionTimeline events={timeline} />}
            {activeTab === 'notes'     && <NotesTab     admission={admission} />}
            {activeTab === 'documents' && <DocumentsTab admission={admission} />}
            {activeTab === 'sortie'    && <DischargeSummaryTab admission={admission} />}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}

      {showForm && (
        <AdmissionForm
          admission={admission}
          onSave={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {discharging && (
        <DischargeModal
          admission={admission}
          onConfirm={(type, date, time, notes) => {
            discharge(admission.id, type, date, time, notes);
            log('archive', 'admission', admission.id, `Sortie ${type}`);
            setDischarging(false);
            setActiveTab('sortie');
          }}
          onCancel={() => setDischarging(false)}
        />
      )}

      {transferring && (
        <TransferModal
          admission={admission}
          onConfirm={(to, date, notes) => {
            transfer(admission.id, to, date, notes);
            log('update', 'admission', admission.id, `Transfert → ${to}`);
            setTransferring(false);
          }}
          onCancel={() => setTransferring(false)}
        />
      )}
    </DashboardLayout>
  );
}
