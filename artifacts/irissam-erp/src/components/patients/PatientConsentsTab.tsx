import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, XCircle, AlertCircle, FilePen, AlertTriangle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/services/api/client';

// ─── Types (real API data only — /patients/:id/consents) ─────────────────────
// Source de vérité : consentements du portail patient (patient_portal_consents).

type ConsentStatus = 'pending' | 'signed' | 'refused' | 'expired';

interface ConsentRecord {
  id: string;
  title: string;
  description?: string | null;
  status: ConsentStatus;
  signedAt?: string | null;
  refusedAt?: string | null;
  refusalReason?: string | null;
  hasPdf: boolean;
  expiresAt?: string | null;
  createdAt: string;
}

const STATUS_CFG: Record<ConsentStatus, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  signed:  { label: 'Signé',      cls: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  pending: { label: 'En attente', cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  refused: { label: 'Refusé',     cls: 'bg-red-100 text-red-700 border-red-200',       icon: XCircle },
  expired: { label: 'Expiré',     cls: 'bg-gray-100 text-gray-500 border-gray-200',    icon: AlertCircle },
};

function fmtFull(d?: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDay(d?: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PatientConsentsTab({ patientId }: { patientId: string }) {
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let aborted = false;
    setLoading(true); setError(false);
    apiClient.get<ConsentRecord[]>(`/patients/${encodeURIComponent(patientId)}/consents`)
      .then(rows => { if (!aborted) setConsents(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!aborted) setError(true); })
      .finally(() => { if (!aborted) setLoading(false); });
    return () => { aborted = true; };
  }, [patientId, tick]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[240px]">
        <div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[240px] text-red-500 space-y-2">
        <AlertTriangle size={32} className="opacity-50" />
        <p className="text-sm font-medium">Impossible de charger les consentements de ce patient.</p>
        <button onClick={() => setTick(t => t + 1)} className="text-xs text-blue-600 hover:underline">Réessayer</button>
      </div>
    );
  }

  if (consents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 space-y-2 bg-white border border-gray-200 rounded-xl">
        <FilePen size={36} className="opacity-20" />
        <p className="font-semibold text-sm">Aucun consentement enregistré pour ce patient</p>
        <p className="text-xs">Les consentements envoyés via le portail patient apparaîtront ici.</p>
      </div>
    );
  }

  const stats = {
    total:   consents.length,
    signed:  consents.filter(c => c.status === 'signed').length,
    pending: consents.filter(c => c.status === 'pending').length,
    refused: consents.filter(c => c.status === 'refused' || c.status === 'expired').length,
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-xl">
        {[
          { label: 'Total',            value: stats.total,   cls: 'text-gray-800' },
          { label: 'Signés',           value: stats.signed,  cls: 'text-green-600' },
          { label: 'En attente',       value: stats.pending, cls: 'text-amber-600' },
          { label: 'Refusés / expirés', value: stats.refused, cls: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-3 py-2">
            <p className={cn('text-lg font-bold leading-tight', s.cls)}>{s.value}</p>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {consents.map(c => {
          const cfg = STATUS_CFG[c.status] ?? STATUS_CFG.pending;
          const Icon = cfg.icon;
          return (
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm text-gray-800">{c.title}</h3>
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium', cfg.cls)}>
                      <Icon size={11} /> {cfg.label}
                    </span>
                    {c.hasPdf && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-500 text-xs">
                        <FileText size={11} /> PDF signé (portail)
                      </span>
                    )}
                  </div>
                  {c.description && <p className="text-xs text-gray-500 mt-1">{c.description}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                <div>
                  <p className="text-gray-400 uppercase tracking-wide text-[10px]">Créé le</p>
                  <p className="text-gray-600 mt-0.5">{fmtDay(c.createdAt)}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-wide text-[10px]">Signé le</p>
                  <p className="text-gray-600 mt-0.5">{c.signedAt ? fmtFull(c.signedAt) : '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-wide text-[10px]">Refusé le</p>
                  <p className="text-gray-600 mt-0.5">{c.refusedAt ? fmtFull(c.refusedAt) : '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-wide text-[10px]">Validité</p>
                  <p className="text-gray-600 mt-0.5">{c.expiresAt ? `Jusqu'au ${fmtDay(c.expiresAt)}` : 'Indéfinie'}</p>
                </div>
              </div>

              {c.status === 'refused' && c.refusalReason && (
                <div className="mt-3 flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span><span className="font-medium">Motif du refus :</span> {c.refusalReason}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
