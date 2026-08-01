import { useState } from 'react';
import { Shield, CheckCircle, XCircle, Clock, FileText, History, AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import type { Patient } from '@/types';
import { formatDate } from '@/utils/format';

interface InsuranceHistoryEntry {
  id: string;
  type: string;
  organization: string;
  startDate: string;
  endDate: string;
  memberNumber?: string;
  status: 'active' | 'expired' | 'cancelled';
}

const MOCK_HISTORY: InsuranceHistoryEntry[] = [
  { id:'ih-1', type:'CNAS', organization:'CNAS Alger Centre', memberNumber:'CN-1979-0044', startDate:'2023-01-01', endDate:'2023-12-31', status:'expired' },
  { id:'ih-2', type:'CNAS', organization:'CNAS Alger Centre', memberNumber:'CN-1979-0045', startDate:'2024-01-01', endDate:'2024-12-31', status:'expired' },
  { id:'ih-3', type:'CNAS', organization:'CNAS Alger Centre', memberNumber:'CN-1979-0046', startDate:'2025-01-01', endDate:'2025-12-31', status:'active'  },
];

const MOCK_DOCS = [
  { id:'id-1', name:'Attestation_CNAS_2025.pdf', date:'2025-01-10' },
  { id:'id-2', name:'Carte_assurance_recto.jpg', date:'2024-01-12' },
];

const STATUS_BADGE = {
  active:    { icon: CheckCircle, cls: 'bg-green-100 text-green-700',  label: 'Actif' },
  expired:   { icon: XCircle,     cls: 'bg-red-100 text-red-700',      label: 'Expiré' },
  cancelled: { icon: XCircle,     cls: 'bg-gray-100 text-gray-600',    label: 'Annulé' },
};

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value}</span>
    </div>
  );
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

interface Props { patient: Patient; }

export function PatientInsuranceDetail({ patient }: Props) {
  const ins = patient.insurance;
  const days = daysUntil(ins?.validUntil);
  const isExpired  = days !== null && days < 0;
  const isExpiring = days !== null && days >= 0 && days <= 30;

  const [showRenewForm, setShowRenewForm] = useState(false);

  const coverageRates: Record<string, number> = {
    cnas: 80, casnos: 70, mutuelle: 90, militaire: 100, gratuite: 100, payant: 0,
  };
  const plafonds: Record<string, string> = {
    cnas: '500 000 DA / an', casnos: '300 000 DA / an', mutuelle: '800 000 DA / an',
    militaire: 'Illimité', gratuite: 'Illimité', payant: 'N/A',
  };

  const coverageRate = ins?.type ? (coverageRates[ins.type] ?? 0) : 0;
  const plafond      = ins?.type ? (plafonds[ins.type] ?? '—') : '—';

  return (
    <div className="max-w-2xl space-y-4">
      {/* Expiry alerts */}
      {isExpired && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-300 rounded-xl">
          <XCircle size={16} className="text-red-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-red-700">Assurance expirée — renouvellement requis</p>
          <button onClick={() => setShowRenewForm(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap">
            <RefreshCw size={11} /> Renouveler
          </button>
        </div>
      )}
      {isExpiring && !isExpired && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-300 rounded-xl">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-amber-700">Assurance expire dans {days} jour{days > 1 ? 's' : ''}</p>
          <button onClick={() => setShowRenewForm(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap">
            <RefreshCw size={11} /> Anticiper
          </button>
        </div>
      )}

      {/* Renew form (simplified) */}
      {showRenewForm && (
        <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-blue-800">Renouvellement d'assurance</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Date de début</label>
              <input type="date" defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Date d'expiration</label>
              <input type="date"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nouveau numéro adhérent</label>
              <input type="text" placeholder="CN-XXXX-XXXX"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { alert('Renouvellement enregistré (mock)'); setShowRenewForm(false); }}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Enregistrer le renouvellement
            </button>
            <button onClick={() => setShowRenewForm(false)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Current insurance */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <Shield size={15} className="text-blue-600" />
            <h3 className="font-semibold text-gray-800 text-sm">Couverture actuelle</h3>
          </div>
          <button onClick={() => alert('Ajout d\'une nouvelle assurance — disponible avec le backend')}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
            <Plus size={11} /> Ajouter
          </button>
        </div>
        <div className="p-5">
          {!ins ? (
            <p className="text-sm text-gray-400">Aucune assurance enregistrée</p>
          ) : (
            <div className="space-y-4">
              {/* Status banner */}
              {isExpired ? (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <XCircle size={14} className="text-red-600" />
                  <p className="text-sm font-medium text-red-700">Expirée le {formatDate(ins.validUntil ?? '')}</p>
                </div>
              ) : isExpiring ? (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle size={14} className="text-amber-600" />
                  <p className="text-sm font-medium text-amber-700">Expire le {formatDate(ins.validUntil ?? '')} ({days} j)</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle size={14} className="text-green-600" />
                  <p className="text-sm font-medium text-green-700">Valide{ins.validUntil ? ` jusqu'au ${formatDate(ins.validUntil)}` : ''}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Organisme"       value={ins.organizationName} />
                <InfoRow label="Type"            value={ins.type?.toUpperCase()} />
                <InfoRow label="Numéro"          value={ins.memberNumber} />
                <InfoRow label="Date expiration" value={ins.validUntil ? formatDate(ins.validUntil) : undefined} />
                <InfoRow label="Plafond"         value={plafond} />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-gray-400 uppercase tracking-wide">Taux de couverture</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${coverageRate}%` }} />
                    </div>
                    <span className="text-sm font-bold text-gray-800">{coverageRate}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50">
          <History size={15} className="text-gray-500" />
          <h3 className="font-semibold text-gray-800 text-sm">Historique des assurances</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {MOCK_HISTORY.map(h => {
            const badge = STATUS_BADGE[h.status];
            const Icon = badge.icon;
            return (
              <div key={h.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-800">{h.type} — {h.organization}</p>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                      <Icon size={11} /> {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(h.startDate)} → {formatDate(h.endDate)}
                    {h.memberNumber && <span className="ml-2 font-mono">{h.memberNumber}</span>}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Documents */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-gray-500" />
            <h3 className="font-semibold text-gray-800 text-sm">Documents d'assurance</h3>
          </div>
          <button onClick={() => alert('Upload disponible avec le backend')}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium">
            + Ajouter
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {MOCK_DOCS.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 px-5 py-3 group">
              <FileText size={15} className="text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{doc.name}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <Clock size={10} /> {formatDate(doc.date)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
