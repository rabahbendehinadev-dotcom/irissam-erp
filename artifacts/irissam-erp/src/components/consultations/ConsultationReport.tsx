/**
 * ConsultationReport — A4-formatted medical report (Compte Rendu de consultation)
 * Renders a clean printable layout; also used inside the print modal preview.
 */
import { useState, useEffect } from 'react';
import type {
  Consultation, VitalSigns, Diagnosis, PrescriptionItem,
  LabOrder, ImagingOrder, ClinicalExam, FollowUpPlan,
} from '@/types/consultation';
import { apiClient } from '@/services/api/client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcAge(dob?: string): string {
  if (!dob) return '—';
  const y = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${y} ans`;
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function fmtDateTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-bold text-[11px] uppercase tracking-widest text-blue-800">{title}</span>
        <div className="flex-1 border-t border-blue-200" />
      </div>
      <div className="text-[12px] text-gray-800 leading-relaxed">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 w-40 shrink-0">{label} :</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// ─── Vitals table ─────────────────────────────────────────────────────────────

const VITAL_FIELDS: { key: keyof VitalSigns; label: string; unit: string; low: number; high: number }[] = [
  { key: 'weight',           label: 'Poids',              unit: 'kg',     low: 30,  high: 300 },
  { key: 'height',           label: 'Taille',             unit: 'cm',     low: 50,  high: 250 },
  { key: 'bmi',              label: 'IMC',                unit: 'kg/m²',  low: 18.5,high: 24.9 },
  { key: 'temperature',      label: 'Température',        unit: '°C',     low: 36,  high: 38.5 },
  { key: 'systolicBP',       label: 'TA systolique',      unit: 'mmHg',   low: 90,  high: 140 },
  { key: 'diastolicBP',      label: 'TA diastolique',     unit: 'mmHg',   low: 60,  high: 90  },
  { key: 'heartRate',        label: 'Fréq. cardiaque',    unit: 'bpm',    low: 60,  high: 100 },
  { key: 'respiratoryRate',  label: 'Fréq. respiratoire', unit: '/min',   low: 12,  high: 20  },
  { key: 'oxygenSaturation', label: 'SpO₂',               unit: '%',      low: 95,  high: 100 },
  { key: 'bloodGlucose',     label: 'Glycémie',           unit: 'mmol/L', low: 3.9, high: 7.8 },
  { key: 'painLevel',        label: 'Douleur',            unit: '/10',    low: 0,   high: 10  },
];

function VitalsTable({ v }: { v: VitalSigns }) {
  const rows = VITAL_FIELDS.filter(f => v[f.key] !== undefined && v[f.key] !== null);
  if (!rows.length) return <p className="text-gray-400 italic text-[11px]">Non renseignés</p>;
  return (
    <table className="w-full text-[11px] border-collapse">
      <thead>
        <tr className="bg-blue-50">
          <th className="text-left px-2 py-1 font-semibold text-gray-600 border border-gray-200">Paramètre</th>
          <th className="text-right px-2 py-1 font-semibold text-gray-600 border border-gray-200">Valeur</th>
          <th className="text-center px-2 py-1 font-semibold text-gray-600 border border-gray-200">Statut</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(f => {
          const val = v[f.key] as number;
          const anomaly = val < f.low || val > f.high;
          return (
            <tr key={f.key} className={anomaly ? 'bg-red-50' : ''}>
              <td className="px-2 py-1 border border-gray-200">{f.label}</td>
              <td className="px-2 py-1 border border-gray-200 text-right font-mono font-semibold">
                {val} {f.unit}
              </td>
              <td className={`px-2 py-1 border border-gray-200 text-center font-semibold ${anomaly ? 'text-red-600' : 'text-green-600'}`}>
                {anomaly ? '⚠ Anormal' : '✓ Normal'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Diagnosis list ───────────────────────────────────────────────────────────

const GRAVITY_LABELS: Record<string, string> = {
  leger: 'Léger', modere: 'Modéré', grave: 'Grave', critique: 'Critique',
};

function DiagnosisList({ diagnoses }: { diagnoses: Diagnosis[] }) {
  if (!diagnoses.length) return <p className="text-gray-400 italic text-[11px]">Aucun diagnostic renseigné</p>;
  return (
    <table className="w-full text-[11px] border-collapse">
      <thead>
        <tr className="bg-blue-50">
          <th className="text-left px-2 py-1 font-semibold text-gray-600 border border-gray-200">Type</th>
          <th className="text-left px-2 py-1 font-semibold text-gray-600 border border-gray-200">Diagnostic</th>
          <th className="text-left px-2 py-1 font-semibold text-gray-600 border border-gray-200">CIM-10</th>
          <th className="text-left px-2 py-1 font-semibold text-gray-600 border border-gray-200">Statut</th>
          <th className="text-left px-2 py-1 font-semibold text-gray-600 border border-gray-200">Gravité</th>
        </tr>
      </thead>
      <tbody>
        {diagnoses.map(d => (
          <tr key={d.id}>
            <td className="px-2 py-1 border border-gray-200 font-medium capitalize">{d.kind === 'principal' ? 'Principal' : 'Secondaire'}</td>
            <td className="px-2 py-1 border border-gray-200">{d.label}</td>
            <td className="px-2 py-1 border border-gray-200 font-mono">{d.icd10Code ?? '—'}</td>
            <td className="px-2 py-1 border border-gray-200 capitalize">{d.status === 'confirme' ? 'Confirmé' : 'Provisoire'}</td>
            <td className="px-2 py-1 border border-gray-200">{d.gravity ? GRAVITY_LABELS[d.gravity] : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Prescription table ───────────────────────────────────────────────────────

function PrescriptionTable({ items }: { items: PrescriptionItem[] }) {
  if (!items.length) return <p className="text-gray-400 italic text-[11px]">Aucune prescription</p>;
  return (
    <div className="space-y-2">
      {items.map((rx, i) => (
        <div key={rx.id} className="border border-gray-200 rounded p-2 bg-gray-50">
          <div className="font-bold text-[12px]">{i + 1}. {rx.medication} — {rx.form}</div>
          <div className="text-[11px] text-gray-700 mt-0.5">
            <span className="font-medium">{rx.dosage}</span>
            {' · '}{rx.route}
            {' · '}{rx.frequency}
            {' · '}{rx.duration}
            {' · '}Qté : {rx.quantity}
            {rx.renewable && ' · ♻ Renouvelable'}
          </div>
          {rx.timing && <div className="text-[11px] text-gray-500">Timing : {rx.timing}</div>}
          {rx.instructions && <div className="text-[11px] text-gray-600 italic">{rx.instructions}</div>}
          {rx.allergyWarning && (
            <div className="text-[11px] text-red-600 font-semibold mt-0.5">⚠ {rx.allergyWarning}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Lab / Imaging tables ─────────────────────────────────────────────────────

function LabTable({ orders }: { orders: LabOrder[] }) {
  if (!orders.length) return <p className="text-gray-400 italic text-[11px]">Aucune analyse demandée</p>;
  return (
    <table className="w-full text-[11px] border-collapse">
      <thead>
        <tr className="bg-blue-50">
          <th className="text-left px-2 py-1 font-semibold text-gray-600 border border-gray-200">Analyse</th>
          <th className="text-left px-2 py-1 font-semibold text-gray-600 border border-gray-200">Laboratoire</th>
          <th className="text-left px-2 py-1 font-semibold text-gray-600 border border-gray-200">Priorité</th>
          <th className="text-left px-2 py-1 font-semibold text-gray-600 border border-gray-200">À jeun</th>
        </tr>
      </thead>
      <tbody>
        {orders.map(o => (
          <tr key={o.id}>
            <td className="px-2 py-1 border border-gray-200 font-medium">{o.analysisType}</td>
            <td className="px-2 py-1 border border-gray-200">{o.laboratory}</td>
            <td className="px-2 py-1 border border-gray-200 capitalize">{o.priority === 'tres_urgente' ? 'Très urgente' : o.priority === 'urgente' ? 'Urgente' : 'Normale'}</td>
            <td className="px-2 py-1 border border-gray-200">{o.fastingRequired ? 'Oui' : 'Non'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ImagingTable({ orders }: { orders: ImagingOrder[] }) {
  if (!orders.length) return <p className="text-gray-400 italic text-[11px]">Aucun examen d'imagerie demandé</p>;
  return (
    <table className="w-full text-[11px] border-collapse">
      <thead>
        <tr className="bg-blue-50">
          <th className="text-left px-2 py-1 font-semibold text-gray-600 border border-gray-200">Examen</th>
          <th className="text-left px-2 py-1 font-semibold text-gray-600 border border-gray-200">Zone</th>
          <th className="text-left px-2 py-1 font-semibold text-gray-600 border border-gray-200">Service</th>
          <th className="text-left px-2 py-1 font-semibold text-gray-200">Priorité</th>
        </tr>
      </thead>
      <tbody>
        {orders.map(o => (
          <tr key={o.id}>
            <td className="px-2 py-1 border border-gray-200 font-medium">{o.examType}</td>
            <td className="px-2 py-1 border border-gray-200">{o.anatomicZone}</td>
            <td className="px-2 py-1 border border-gray-200">{o.imagingService}</td>
            <td className="px-2 py-1 border border-gray-200 capitalize">{o.priority === 'tres_urgente' ? 'Très urgente' : o.priority === 'urgente' ? 'Urgente' : 'Normale'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Clinical exam ────────────────────────────────────────────────────────────

const EXAM_FIELDS: { key: keyof ClinicalExam; label: string }[] = [
  { key: 'generalState',    label: 'État général' },
  { key: 'consciousness',   label: 'Conscience' },
  { key: 'hydration',       label: 'Hydratation' },
  { key: 'cardiovascular',  label: 'Cardiovasculaire' },
  { key: 'respiratory',     label: 'Respiratoire' },
  { key: 'abdominal',       label: 'Abdominal' },
  { key: 'neurological',    label: 'Neurologique' },
  { key: 'skin',            label: 'Téguments' },
  { key: 'other',           label: 'Autres' },
];

function ClinicalExamSection({ exam }: { exam: ClinicalExam }) {
  const filled = EXAM_FIELDS.filter(f => exam[f.key]);
  if (!filled.length) return <p className="text-gray-400 italic text-[11px]">Examen clinique non documenté</p>;
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
      {filled.map(f => (
        <div key={f.key} className="flex gap-1.5 text-[11px]">
          <span className="text-gray-500 shrink-0">{f.label} :</span>
          <span className="font-medium">{exam[f.key] as string}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Follow-up ────────────────────────────────────────────────────────────────

function FollowUpSection({ fu }: { fu: FollowUpPlan }) {
  return (
    <div className="space-y-1 text-[11px]">
      {fu.recommendedTreatment && <Row label="Traitement recommandé" value={fu.recommendedTreatment} />}
      {fu.medicalAdvice        && <Row label="Conseils médicaux"     value={fu.medicalAdvice} />}
      {fu.diet                 && <Row label="Régime"                value={fu.diet} />}
      {fu.rest                 && <Row label="Repos"                 value={fu.rest} />}
      {fu.monitoring           && <Row label="Surveillance"          value={fu.monitoring} />}
      {fu.controlDate          && <Row label="Rendez-vous de contrôle" value={fmtDate(fu.controlDate)} />}
      {fu.specialistReferral   && <Row label="Orientation spécialiste" value={fu.specialistReferral} />}
      {fu.newAppointment       && <div className="text-blue-700 font-semibold">✓ Nouveau RDV planifié</div>}
      {fu.admissionRecommended && <div className="text-amber-700 font-semibold">⚠ Admission recommandée</div>}
      {fu.hospitalizationRecommended && <div className="text-red-700 font-semibold">⚠ Hospitalisation recommandée</div>}
      {fu.returnToEmergencyIfWorse   && <div className="text-red-600 font-semibold">⚠ Retourner aux urgences si aggravation</div>}
    </div>
  );
}

// ─── Main Report ──────────────────────────────────────────────────────────────

interface Props {
  consultation: Consultation;
}

export function ConsultationReport({ consultation: c }: Props) {
  const [apiPatient, setApiPatient] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (!c.patientId) return;
    apiClient.get<Record<string, unknown>>(`/patients/${c.patientId}`)
      .then(r => setApiPatient(r))
      .catch((err) => console.warn('[ConsultationReport] Patient enrichment fetch failed — non-critical:', err));
  }, [c.patientId]);

  const dob        = apiPatient?.dateOfBirth as string | undefined;
  const gender     = apiPatient?.gender as string | undefined;
  const bloodType  = (apiPatient?.medical as any)?.bloodType ?? (apiPatient?.bloodType as string | undefined);
  const allergies  = (apiPatient?.medical as any)?.allergies ?? [];
  const diseases   = (apiPatient?.medical as any)?.chronicDiseases ?? [];
  const age        = calcAge(dob);

  const printDate = new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div
      id="cr-print-root"
      className="bg-white font-sans text-gray-900"
      style={{ width: '210mm', minHeight: '297mm', padding: '16mm 18mm', boxSizing: 'border-box', fontSize: '12px' }}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-blue-700">
        {/* Hospital identity */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <img src="/logo.png" alt="IRISSAM Hospital" className="w-10 h-10 object-contain rounded" />
            <div>
              <div className="font-black text-[18px] text-blue-800 leading-none">IRISSAM HOSPITAL</div>
              <div className="text-[10px] text-gray-500 tracking-widest uppercase">Centre Hospitalier Multidisciplinaire</div>
            </div>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">
            Tél : +213 XX XX XX XX · www.irissam-hospital.dz
          </div>
        </div>

        {/* Document title */}
        <div className="text-right">
          <div className="font-black text-[15px] text-blue-800 uppercase tracking-wide">
            Compte Rendu de Consultation
          </div>
          <div className="font-mono text-[12px] text-blue-600 font-semibold mt-0.5">{c.number}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            Imprimé le {printDate}
          </div>
        </div>
      </div>

      {/* ── Patient + Consultation identity ── */}
      <div className="grid grid-cols-2 gap-6 mb-5">
        {/* Patient */}
        <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/40">
          <div className="font-bold text-[10px] text-blue-700 uppercase tracking-widest mb-2">Identité du patient</div>
          <div className="space-y-0.5 text-[11px]">
            <div className="font-bold text-[14px] text-gray-900">{c.patientName}</div>
            <div className="font-mono text-blue-600">MPI : {c.patientMpi}</div>
            <Row label="Âge" value={age} />
            <Row label="Sexe" value={gender === 'M' ? 'Masculin' : gender === 'F' ? 'Féminin' : undefined} />
            <Row label="Groupe sanguin" value={bloodType} />
            <Row label="Date de naissance" value={dob ? fmtDate(dob) : undefined} />
            {allergies.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {(allergies as string[]).map((a: string) => (
                  <span key={a} className="bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                    ⚠ {a}
                  </span>
                ))}
              </div>
            )}
            {diseases.length > 0 && (
              <div className="text-[10px] text-orange-600 mt-1">
                ATCD : {diseases.join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Consultation meta */}
        <div className="border border-gray-200 rounded-lg p-3">
          <div className="font-bold text-[10px] text-blue-700 uppercase tracking-widest mb-2">Informations de consultation</div>
          <div className="space-y-0.5 text-[11px]">
            <Row label="Médecin" value={c.doctorName} />
            <Row label="Spécialité" value={c.specialty} />
            <Row label="Service" value={c.serviceName} />
            <Row label="Établissement" value={c.siteName} />
            <Row label="Date" value={fmtDateTime(c.scheduledAt)} />
            {c.startedAt  && <Row label="Début"      value={fmtDateTime(c.startedAt)} />}
            {c.endedAt    && <Row label="Fin"         value={fmtDateTime(c.endedAt)} />}
            {c.duration   && <Row label="Durée"       value={`${c.duration} min`} />}
            <Row label="Type" value={{
              programmee: 'Programmée', sans_rdv: 'Sans RDV', controle: 'Contrôle',
              specialisee: 'Spécialisée', ambulatoire: 'Ambulatoire',
              teleconsultation: 'Téléconsultation', urgences: 'Urgences', hospitalisation: 'Hospitalisation',
            }[c.type] ?? c.type} />
            {c.admissionId && <Row label="N° Admission" value={c.admissionId} />}
          </div>
        </div>
      </div>

      {/* ── Motif ── */}
      <Section title="Motif de consultation">
        <p className="font-medium">{c.reason || <span className="italic text-gray-400">Non renseigné</span>}</p>
        {c.chiefComplaint && <p className="mt-1 text-gray-700">{c.chiefComplaint}</p>}
        {c.historyOfPresentIllness && (
          <div className="mt-2">
            <span className="font-semibold text-[11px]">Histoire de la maladie :</span>
            <p className="text-gray-700 mt-0.5">{c.historyOfPresentIllness}</p>
          </div>
        )}
        {(c.onsetDate || c.onsetDuration) && (
          <div className="flex gap-4 mt-1 text-[11px]">
            {c.onsetDate     && <Row label="Apparition"      value={fmtDate(c.onsetDate)} />}
            {c.onsetDuration && <Row label="Durée/Évolution" value={c.onsetDuration} />}
          </div>
        )}
        {c.aggravatingFactors && <Row label="Facteurs aggravants"  value={c.aggravatingFactors} />}
        {c.relievingFactors   && <Row label="Facteurs soulageants" value={c.relievingFactors} />}
        {c.freeNotes          && (
          <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200 italic text-[11px]">{c.freeNotes}</div>
        )}
      </Section>

      {/* ── Signes vitaux ── */}
      {c.vitalSigns && (
        <Section title="Signes vitaux">
          <VitalsTable v={c.vitalSigns} />
          {c.vitalSigns.consciousnessState && (
            <div className="mt-2 text-[11px]">État de conscience : <strong className="capitalize">{c.vitalSigns.consciousnessState}</strong></div>
          )}
          {c.vitalSigns.oxygenAdministered && (
            <div className="text-[11px] mt-1">
              Oxygène administré{c.vitalSigns.oxygenFlowRate ? ` — ${c.vitalSigns.oxygenFlowRate} L/min` : ''}
            </div>
          )}
          {c.vitalSigns.pregnancy && <div className="text-[11px] mt-1 text-pink-700">🤰 Grossesse en cours</div>}
          {c.vitalSigns.clinicalComment && (
            <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-100 text-[11px]">
              <strong>Commentaire clinique :</strong> {c.vitalSigns.clinicalComment}
            </div>
          )}
          {c.vitalSigns.nursingNotes && (
            <div className="mt-1 p-2 bg-blue-50 rounded border border-blue-100 text-[11px]">
              <strong>Notes infirmières :</strong> {c.vitalSigns.nursingNotes}
            </div>
          )}
        </Section>
      )}

      {/* ── Examen clinique ── */}
      {c.clinicalExam && (
        <Section title="Examen clinique">
          <ClinicalExamSection exam={c.clinicalExam} />
        </Section>
      )}

      {/* ── Diagnostic (colonne PostgreSQL consultations.diagnosis) ── */}
      <Section title="Diagnostic">
        {c.diagnosis?.trim()
          ? <p className="font-medium whitespace-pre-wrap">{c.diagnosis}</p>
          : <span className="italic text-gray-400">Non renseigné</span>}
      </Section>

      {/* ── Notes du dossier (colonne PostgreSQL consultations.notes) ── */}
      {c.notes?.trim() && (
        <Section title="Notes du dossier">
          <p className="whitespace-pre-wrap">{c.notes}</p>
        </Section>
      )}

      {/* ── Prescription ── */}
      {(c.prescriptions?.length ?? 0) > 0 && (
        <Section title="Ordonnance">
          <PrescriptionTable items={c.prescriptions!} />
        </Section>
      )}

      {/* ── Analyses ── */}
      {(c.labOrders?.length ?? 0) > 0 && (
        <Section title="Examens biologiques demandés">
          <LabTable orders={c.labOrders!} />
        </Section>
      )}

      {/* ── Imagerie ── */}
      {(c.imagingOrders?.length ?? 0) > 0 && (
        <Section title="Examens d'imagerie demandés">
          <ImagingTable orders={c.imagingOrders!} />
        </Section>
      )}

      {/* ── Suivi ── */}
      {c.followUp && (
        <Section title="Plan de suivi">
          <FollowUpSection fu={c.followUp} />
        </Section>
      )}

      {/* ── Signature ── */}
      <div className="mt-8 pt-4 border-t border-gray-300">
        <div className="flex justify-between items-end">
          <div className="text-[11px] text-gray-500">
            <div>Document généré par le système IRISSAM ERP</div>
            <div className="font-mono">{c.number} · {printDate}</div>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-400 w-48 pt-1 text-[11px] text-gray-600">
              <div className="font-semibold">{c.doctorName}</div>
              <div className="text-gray-500">{c.specialty}</div>
              <div className="mt-6 text-gray-400 italic text-[10px]">Signature et cachet</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
