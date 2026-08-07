/**
 * PatientAdmissionsHistoryTab — Historique des admissions et hospitalisations d'un patient.
 * typeFilter: undefined = all, 'hospitalisation' = hospitalizations only
 */
import { useState, useEffect, useCallback } from 'react';
import { Bed, RefreshCw, AlertTriangle, Lock } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { usePermission } from '@/hooks/usePermission';

interface Admission {
  id: string;
  admissionNumber: string;
  type: string;
  status: string;
  priority: string | null;
  serviceName: string;
  doctorName: string;
  motif: string | null;
  diagnosis: string | null;
  bedNumber: string | null;
  roomNumber: string | null;
  floorLabel: string | null;
  buildingName: string | null;
  admissionDate: string;
  admissionTime: string;
  expectedDischargeDate: string | null;
  actualDischargeDate: string | null;
  dischargeType: string | null;
  dischargeNotes: string | null;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active:      { label: 'Actif',      color: 'bg-green-100 text-green-700' },
  discharged:  { label: 'Sorti',      color: 'bg-blue-100 text-blue-700' },
  transferred: { label: 'Transféré',  color: 'bg-purple-100 text-purple-700' },
  cancelled:   { label: 'Annulé',     color: 'bg-gray-100 text-gray-500' },
};

const TYPE_MAP: Record<string, string> = {
  hospitalisation:    'Hospitalisation',
  preadmission:       'Pré-admission',
  transfert_interne:  'Transfert interne',
  transfert_externe:  'Transfert externe',
};

function fmt(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface Props {
  patientId: string;
  /** If set, only loads this admission type */
  typeFilter?: 'hospitalisation' | 'preadmission' | 'transfert_interne' | 'transfert_externe';
}

export function PatientAdmissionsHistoryTab({ patientId, typeFilter }: Props) {
  const { can } = usePermission();
  const canView = can('admissions.view');
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const label = typeFilter === 'hospitalisation' ? 'hospitalisation' : 'admission';
  const labelPlural = typeFilter === 'hospitalisation' ? 'hospitalisations' : 'admissions';

  const load = useCallback(async () => {
    if (!canView) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ patientId });
      if (typeFilter) qs.set('type', typeFilter);
      const data = await apiClient.get<Admission[]>(`/admissions?${qs}`);
      setAdmissions(Array.isArray(data) ? data : []);
    } catch {
      setError(`Impossible de charger les ${labelPlural}.`);
    } finally {
      setLoading(false);
    }
  }, [patientId, typeFilter, labelPlural, canView]);

  useEffect(() => { load(); }, [load]);

  // Accès restreint — pas de requête inutile ni de 403 en console
  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-2 text-gray-400">
        <Lock size={28} className="opacity-30" />
        <p className="font-semibold text-sm">Accès restreint</p>
        <p className="text-xs">Votre rôle n'a pas la permission de consulter les {labelPlural}.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 text-red-500">
        <AlertTriangle size={32} className="opacity-60" />
        <p className="text-sm">{error}</p>
        <button onClick={load} className="flex items-center gap-1.5 text-xs border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
          <RefreshCw size={12} /> Réessayer
        </button>
      </div>
    );
  }

  if (admissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] text-gray-400 gap-2">
        <Bed size={40} className="opacity-20" />
        <p className="font-semibold text-sm capitalize">Aucune {label} enregistrée</p>
        <p className="text-xs">Les {labelPlural} de ce patient apparaîtront ici.</p>
      </div>
    );
  }

  const active = admissions.filter(a => a.status === 'active').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 capitalize">{labelPlural.charAt(0).toUpperCase() + labelPlural.slice(1)}</h3>
        <div className="flex items-center gap-2">
          {active > 0 && (
            <span className="text-xs text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
              {active} active{active > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs text-gray-400">{admissions.length} au total</span>
          <button onClick={load} className="text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {admissions.map(a => {
          const s = STATUS_MAP[a.status] ?? { label: a.status, color: 'bg-gray-100 text-gray-500' };
          return (
            <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-mono text-xs text-gray-400">{a.admissionNumber}</span>
                    <span className="text-xs text-gray-500">{TYPE_MAP[a.type] ?? a.type}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800">{a.serviceName}</p>
                  <p className="text-sm text-gray-600">Dr. {a.doctorName}</p>
                  {a.motif && <p className="text-xs text-gray-400 mt-1">Motif : {a.motif}</p>}
                  {a.diagnosis && <p className="text-xs text-gray-400">Diagnostic : {a.diagnosis}</p>}
                  {(a.bedNumber || a.roomNumber) && (
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <Bed size={10} />
                      {[a.buildingName, a.floorLabel, a.roomNumber && `Ch. ${a.roomNumber}`, a.bedNumber && `Lit ${a.bedNumber}`].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0 text-xs">
                  <p className="text-gray-500">Entrée : <span className="font-medium text-gray-700">{fmt(a.admissionDate)}</span></p>
                  {a.actualDischargeDate && (
                    <p className="text-gray-500 mt-0.5">Sortie : <span className="font-medium text-gray-700">{fmt(a.actualDischargeDate)}</span></p>
                  )}
                  {!a.actualDischargeDate && a.expectedDischargeDate && (
                    <p className="text-blue-500 mt-0.5">Sortie prévue : {fmt(a.expectedDischargeDate)}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
