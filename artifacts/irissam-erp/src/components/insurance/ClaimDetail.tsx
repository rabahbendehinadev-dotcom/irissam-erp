import { useState } from 'react';
import {
  useInsuranceClaim, useSubmitClaim, useApproveClaim, useRejectClaim,
  useMarkClaimPaid, usePartialApproveClaim, useTransferRejectedToPatient,
} from '@/hooks/useInsuranceApi';
import { useLanguage } from '@/i18n';
import {
  X, User, Shield, FileText, CheckCircle, XCircle, Clock, Banknote,
  AlertTriangle, Send, Package, History, MessageSquare, Settings, Loader2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number | string | undefined | null) {
  if (n == null) return '—';
  return `${Number(n).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD`;
}
function fmtDate(s?: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft:              { label: 'Brouillon',     color: 'bg-gray-100 text-gray-600' },
  submitted:          { label: 'Soumis',        color: 'bg-blue-100 text-blue-700' },
  under_review:       { label: 'En révision',   color: 'bg-yellow-100 text-yellow-700' },
  approved:           { label: 'Approuvé',      color: 'bg-green-100 text-green-700' },
  partially_approved: { label: 'Part. approuvé',color: 'bg-orange-100 text-orange-700' },
  rejected:           { label: 'Rejeté',        color: 'bg-red-100 text-red-700' },
  paid:               { label: 'Payé',          color: 'bg-purple-100 text-purple-700' },
  transferred:        { label: 'Transféré',     color: 'bg-teal-100 text-teal-700' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' };
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{value}</p>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type ClaimTab = 'patient' | 'police' | 'facture' | 'couverture' | 'items' | 'documents' | 'chronologie' | 'audit' | 'messages' | 'actions';

const TABS: { id: ClaimTab; label: string; icon: React.ElementType }[] = [
  { id: 'patient',     label: 'Patient',      icon: User        },
  { id: 'police',      label: 'Police',       icon: Shield      },
  { id: 'facture',     label: 'Facture',      icon: FileText    },
  { id: 'couverture',  label: 'Couverture',   icon: ChevronRight },
  { id: 'items',       label: 'Éléments',     icon: Package     },
  { id: 'chronologie', label: 'Chronologie',  icon: History     },
  { id: 'documents',   label: 'Documents',    icon: FileText    },
  { id: 'audit',       label: 'Audit',        icon: Settings    },
  { id: 'messages',    label: 'Messages',     icon: MessageSquare },
  { id: 'actions',     label: 'Actions',      icon: Settings    },
];

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props { claimId: string; onClose: () => void }

export default function ClaimDetail({ claimId, onClose }: Props) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<ClaimTab>('patient');
  const [actionError, setActionError] = useState('');
  const [approveAmount, setApproveAmount] = useState('');
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [confirmTransfer, setConfirmTransfer] = useState(false);

  const { data: claim, isLoading, isError } = useInsuranceClaim(claimId);
  const submitClaim    = useSubmitClaim();
  const approveClaim   = useApproveClaim();
  const rejectClaim    = useRejectClaim();
  const markPaid       = useMarkClaimPaid();
  const transferToPatient = useTransferRejectedToPatient();

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/40" onClick={onClose}/>
        <div className="w-full sm:w-[600px] bg-white animate-pulse flex flex-col">
          <div className="h-20 bg-gray-100 border-b border-gray-200"/>
          <div className="p-6 space-y-4">
            {Array.from({length:5}).map((_,i)=><div key={i} className="h-12 bg-gray-100 rounded-xl"/>)}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !claim) {
    return (
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/40" onClick={onClose}/>
        <div className="w-full sm:w-[600px] bg-white flex items-center justify-center">
          <div className="text-center text-gray-400 p-8">
            <AlertTriangle size={32} className="mx-auto mb-2 text-red-300"/>
            <p className="text-sm text-red-600">Sinistre introuvable</p>
            <button onClick={onClose} className="mt-4 text-sm text-blue-600 hover:underline">Fermer</button>
          </div>
        </div>
      </div>
    );
  }

  async function doAction(fn: () => Promise<unknown>) {
    setActionError('');
    try { await fn(); }
    catch (err: unknown) { setActionError((err as Error).message ?? 'Erreur'); }
  }

  const coveragePercent = claim.amount_requested > 0 && claim.amount_approved
    ? Math.round((Number(claim.amount_approved) / Number(claim.amount_requested)) * 100)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose}/>

      {/* Panel */}
      <div className="w-full sm:w-[600px] bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-bold text-gray-900">{claim.claim_number}</span>
              <StatusBadge status={claim.status}/>
            </div>
            <p className="text-xs text-gray-400">{claim.organization_name ?? claim.insurer_name ?? '—'}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 mt-0.5"><X size={18}/></button>
        </div>

        {/* Amounts summary */}
        <div className="grid grid-cols-3 gap-px bg-gray-100 flex-shrink-0">
          <div className="bg-white px-4 py-3 text-center">
            <p className="text-xs text-gray-400">Demandé</p>
            <p className="text-sm font-bold text-gray-800">{fmt(claim.amount_requested)}</p>
          </div>
          <div className="bg-white px-4 py-3 text-center">
            <p className="text-xs text-gray-400">Approuvé</p>
            <p className="text-sm font-bold text-green-700">{fmt(claim.amount_approved)}</p>
          </div>
          <div className="bg-white px-4 py-3 text-center">
            <p className="text-xs text-gray-400">Payé</p>
            <p className="text-sm font-bold text-purple-700">{fmt(claim.amount_paid)}</p>
          </div>
        </div>

        {/* Tabs — scrollable */}
        <div className="flex overflow-x-auto border-b border-gray-100 flex-shrink-0 px-2 scrollbar-hide">
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-1 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px flex-shrink-0 transition-colors',
                activeTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              )}>
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'patient' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <User size={18} className="text-blue-600"/>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{claim.patient_name ?? '—'}</p>
                  <p className="text-xs text-gray-400 font-mono">{claim.mrn ?? '—'}</p>
                </div>
              </div>
              <InfoRow label="Facture liée" value={claim.invoice_number}/>
              <InfoRow label="N° dossier" value={claim.mrn}/>
            </div>
          )}

          {activeTab === 'police' && (
            <div className="space-y-3">
              <InfoRow label="N° police" value={claim.policy_number}/>
              <InfoRow label="Organisme" value={claim.organization_name ?? claim.insurer_name}/>
              <InfoRow label="Bordereau" value={claim.bordereau_id ? `Inclus dans bordereau` : 'Non inclus'}/>
            </div>
          )}

          {activeTab === 'facture' && (
            <div className="space-y-3">
              <InfoRow label="N° facture" value={claim.invoice_number}/>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Montant demandé</p>
                <p className="text-lg font-bold text-gray-900">{fmt(claim.amount_requested)}</p>
              </div>
            </div>
          )}

          {activeTab === 'couverture' && (
            <div className="space-y-4">
              {coveragePercent !== null && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600">Taux de couverture effectif</p>
                    <p className="text-sm font-bold text-gray-900">{coveragePercent}%</p>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${coveragePercent}%` }}/>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400">Demandé</p>
                  <p className="text-sm font-bold text-gray-800">{fmt(claim.amount_requested)}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400">Approuvé</p>
                  <p className="text-sm font-bold text-green-700">{fmt(claim.amount_approved)}</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400">Rejeté</p>
                  <p className="text-sm font-bold text-red-600">{fmt(claim.amount_rejected)}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400">Part patient</p>
                  <p className="text-sm font-bold text-blue-700">{fmt(claim.patient_share)}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'items' && (
            <div className="space-y-3">
              {(!claim.items || claim.items.length === 0) ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  <Package size={28} className="mx-auto mb-2 text-gray-200"/>
                  Éléments non disponibles
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[450px]">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                        <th className="pb-2 text-left">Service</th>
                        <th className="pb-2 text-right">Demandé</th>
                        <th className="pb-2 text-right">Approuvé</th>
                        <th className="pb-2 text-right">Rejeté</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {claim.items.map(item => (
                        <tr key={item.id}>
                          <td className="py-3">
                            <p className="text-gray-800 font-medium">{item.description ?? item.service_code ?? '—'}</p>
                            {item.service_code && item.description && (
                              <p className="text-xs text-gray-400 font-mono">{item.service_code}</p>
                            )}
                          </td>
                          <td className="py-3 text-right text-gray-700">{fmt(item.amount_requested)}</td>
                          <td className="py-3 text-right text-green-700">{item.amount_approved ? fmt(item.amount_approved) : '—'}</td>
                          <td className="py-3 text-right text-red-600">{item.amount_rejected ? fmt(item.amount_rejected) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'chronologie' && (
            <div className="space-y-2">
              {[
                { label: 'Créé', date: claim.created_at, color: 'bg-gray-400' },
                { label: 'Soumis', date: claim.submitted_at, color: 'bg-blue-500' },
                { label: 'Décision', date: claim.decision_date, color: 'bg-green-500' },
                { label: 'Payé', date: claim.paid_at, color: 'bg-purple-500' },
              ].filter(e => e.date).map((entry, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="relative flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${entry.color}`}/>
                    {i < 3 && <div className="w-0.5 h-8 bg-gray-100 mt-1"/>}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-gray-800">{entry.label}</p>
                    <p className="text-xs text-gray-400">{fmtDate(entry.date)}</p>
                  </div>
                </div>
              ))}
              {claim.rejection_reason && (
                <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                  <p className="text-xs text-red-600 font-medium mb-1">Motif de rejet</p>
                  <p className="text-sm text-red-700">{claim.rejection_reason}</p>
                </div>
              )}
              {claim.notes && (
                <div className="mt-2 p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-400 font-medium mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{claim.notes}</p>
                </div>
              )}
            </div>
          )}

          {(activeTab === 'documents' || activeTab === 'audit' || activeTab === 'messages') && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300">
              <Settings size={32} className="mb-3"/>
              <p className="text-sm text-gray-400">Section disponible bientôt</p>
            </div>
          )}

          {activeTab === 'actions' && (
            <div className="space-y-4">
              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{actionError}</div>
              )}

              {/* Submit */}
              {claim.status === 'draft' && (
                <div className="p-4 bg-blue-50 rounded-xl space-y-3">
                  <h4 className="text-sm font-semibold text-blue-800">Soumettre le sinistre</h4>
                  <p className="text-xs text-blue-600">Montant demandé : {fmt(claim.amount_requested)}</p>
                  <button
                    onClick={() => doAction(() => submitClaim.mutateAsync(claim.id))}
                    disabled={submitClaim.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-60">
                    {submitClaim.isPending && <Loader2 size={14} className="animate-spin"/>}
                    <Send size={14}/> Soumettre
                  </button>
                </div>
              )}

              {/* Approve */}
              {(claim.status === 'submitted' || claim.status === 'under_review') && (
                <div className="p-4 bg-green-50 rounded-xl space-y-3">
                  <h4 className="text-sm font-semibold text-green-800">Approuver le sinistre</h4>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Montant approuvé (DZD) *</label>
                    <input type="number" value={approveAmount}
                      onChange={e => setApproveAmount(e.target.value)}
                      placeholder={String(claim.amount_requested)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500/20"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Notes</label>
                    <textarea rows={2} value={approveNotes} onChange={e => setApproveNotes(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500/20 resize-none"/>
                  </div>
                  <button
                    onClick={() => doAction(() => approveClaim.mutateAsync({ id: claim.id, data: { amountApproved: Number(approveAmount), notes: approveNotes } }))}
                    disabled={approveClaim.isPending || !approveAmount}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 disabled:opacity-60">
                    {approveClaim.isPending && <Loader2 size={14} className="animate-spin"/>}
                    <CheckCircle size={14}/> Approuver
                  </button>
                </div>
              )}

              {/* Reject */}
              {(claim.status === 'submitted' || claim.status === 'under_review') && (
                <div className="p-4 bg-red-50 rounded-xl space-y-3">
                  <h4 className="text-sm font-semibold text-red-800">Rejeter le sinistre</h4>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Motif de rejet *</label>
                    <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                      placeholder="Raison du rejet..."
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none"/>
                  </div>
                  <button
                    onClick={() => doAction(() => rejectClaim.mutateAsync({ id: claim.id, data: { reason: rejectReason } }))}
                    disabled={rejectClaim.isPending || !rejectReason.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 disabled:opacity-60">
                    {rejectClaim.isPending && <Loader2 size={14} className="animate-spin"/>}
                    <XCircle size={14}/> Rejeter
                  </button>
                </div>
              )}

              {/* Mark Paid */}
              {(claim.status === 'approved' || claim.status === 'partially_approved') && (
                <div className="p-4 bg-purple-50 rounded-xl space-y-3">
                  <h4 className="text-sm font-semibold text-purple-800">Marquer comme payé</h4>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Montant payé (DZD) *</label>
                    <input type="number" value={paidAmount}
                      onChange={e => setPaidAmount(e.target.value)}
                      placeholder={String(claim.amount_approved ?? claim.amount_requested)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/20"/>
                  </div>
                  <button
                    onClick={() => doAction(() => markPaid.mutateAsync({ id: claim.id, amountPaid: Number(paidAmount) }))}
                    disabled={markPaid.isPending || !paidAmount}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 disabled:opacity-60">
                    {markPaid.isPending && <Loader2 size={14} className="animate-spin"/>}
                    <Banknote size={14}/> Enregistrer
                  </button>
                </div>
              )}

              {/* Transfer to patient */}
              {claim.status === 'rejected' && (
                <div className="p-4 bg-amber-50 rounded-xl space-y-3">
                  <h4 className="text-sm font-semibold text-amber-800">Transférer vers part patient</h4>
                  <p className="text-xs text-amber-600">Montant rejeté : {fmt(claim.amount_rejected)}</p>
                  {!confirmTransfer ? (
                    <button onClick={() => setConfirmTransfer(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-xl hover:bg-amber-700">
                      <AlertTriangle size={14}/> {t('insurance.invoice.transfer_confirm')}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-amber-700 font-medium">Confirmer le transfert ?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => doAction(() => transferToPatient.mutateAsync(claim.id))}
                          disabled={transferToPatient.isPending}
                          className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white text-sm font-medium rounded-xl hover:bg-amber-700 disabled:opacity-60">
                          {transferToPatient.isPending && <Loader2 size={12} className="animate-spin"/>} Confirmer
                        </button>
                        <button onClick={() => setConfirmTransfer(false)}
                          className="px-3 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Annuler</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* No actions available */}
              {!['draft','submitted','under_review','approved','partially_approved','rejected'].includes(claim.status) && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  <CheckCircle size={28} className="mx-auto mb-2 text-green-200"/>
                  Aucune action disponible pour ce statut
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
