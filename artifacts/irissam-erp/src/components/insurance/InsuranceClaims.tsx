import { useState } from 'react';
import {
  useInsuranceClaims, useInsuranceOrgs, useSubmitClaim,
  useApproveClaim, useRejectClaim, useMarkClaimPaid,
} from '@/hooks/useInsuranceApi';
import type { InsuranceClaim, ClaimFilters } from '@/types/insurance';
import { useLanguage } from '@/i18n';
import {
  Search, Plus, Eye, CheckCircle, XCircle, Clock, Send, Banknote,
  FileText, X, Loader2, RefreshCw, Filter, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ClaimDetail from './ClaimDetail';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number | string | undefined) {
  if (n == null) return '—';
  return Number(n).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft:               { label: 'Brouillon',      color: 'bg-gray-100 text-gray-600' },
  submitted:           { label: 'Soumis',          color: 'bg-blue-100 text-blue-700' },
  under_review:        { label: 'En révision',     color: 'bg-yellow-100 text-yellow-700' },
  approved:            { label: 'Approuvé',        color: 'bg-green-100 text-green-700' },
  partially_approved:  { label: 'Part. approuvé',  color: 'bg-orange-100 text-orange-700' },
  rejected:            { label: 'Rejeté',          color: 'bg-red-100 text-red-700' },
  paid:                { label: 'Payé',            color: 'bg-purple-100 text-purple-700' },
  transferred:         { label: 'Transféré',       color: 'bg-teal-100 text-teal-700' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
}

// ─── Action Modals ────────────────────────────────────────────────────────────
interface ActionModalProps { onClose: () => void }

function SubmitModal({ claim, onClose }: ActionModalProps & { claim: InsuranceClaim }) {
  const submit = useSubmitClaim();
  async function go() {
    await submit.mutateAsync(claim.id);
    onClose();
  }
  return (
    <ModalShell title="Soumettre le sinistre" onClose={onClose}>
      <p className="text-sm text-gray-600 mb-4">
        Soumettre le sinistre <strong>{claim.claim_number}</strong> ({fmt(claim.amount_requested)} DZD) à l&apos;organisme ?
      </p>
      <div className="flex gap-2">
        <button onClick={go} disabled={submit.isPending}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-60">
          {submit.isPending ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>} Soumettre
        </button>
        <button onClick={onClose} className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Annuler</button>
      </div>
    </ModalShell>
  );
}

function ApproveModal({ claim, onClose }: ActionModalProps & { claim: InsuranceClaim }) {
  const approve = useApproveClaim();
  const [amount, setAmount] = useState(String(claim.amount_requested));
  const [notes, setNotes] = useState('');
  async function go() {
    await approve.mutateAsync({ id: claim.id, data: { amountApproved: Number(amount), notes } });
    onClose();
  }
  return (
    <ModalShell title="Approuver le sinistre" onClose={onClose}>
      <div className="space-y-3 mb-4">
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Montant approuvé (DZD)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Notes</label>
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={go} disabled={approve.isPending || !amount}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 disabled:opacity-60">
          {approve.isPending && <Loader2 size={14} className="animate-spin"/>} <CheckCircle size={14}/> Approuver
        </button>
        <button onClick={onClose} className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Annuler</button>
      </div>
    </ModalShell>
  );
}

function RejectModal({ claim, onClose }: ActionModalProps & { claim: InsuranceClaim }) {
  const reject = useRejectClaim();
  const [reason, setReason] = useState('');
  async function go() {
    await reject.mutateAsync({ id: claim.id, data: { reason } });
    onClose();
  }
  return (
    <ModalShell title="Rejeter le sinistre" onClose={onClose}>
      <div className="mb-4">
        <label className="text-xs text-gray-500 font-medium block mb-1">Motif de rejet *</label>
        <textarea rows={3} required value={reason} onChange={e => setReason(e.target.value)} placeholder="Précisez la raison..."
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none" />
      </div>
      <div className="flex gap-2">
        <button onClick={go} disabled={reject.isPending || !reason.trim()}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 disabled:opacity-60">
          {reject.isPending && <Loader2 size={14} className="animate-spin"/>} <XCircle size={14}/> Rejeter
        </button>
        <button onClick={onClose} className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Annuler</button>
      </div>
    </ModalShell>
  );
}

function MarkPaidModal({ claim, onClose }: ActionModalProps & { claim: InsuranceClaim }) {
  const markPaid = useMarkClaimPaid();
  const [amount, setAmount] = useState(String(claim.amount_approved ?? claim.amount_requested));
  async function go() {
    await markPaid.mutateAsync({ id: claim.id, amountPaid: Number(amount) });
    onClose();
  }
  return (
    <ModalShell title="Marquer comme payé" onClose={onClose}>
      <div className="mb-4">
        <label className="text-xs text-gray-500 font-medium block mb-1">Montant payé (DZD)</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div className="flex gap-2">
        <button onClick={go} disabled={markPaid.isPending || !amount}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 disabled:opacity-60">
          {markPaid.isPending && <Loader2 size={14} className="animate-spin"/>} <Banknote size={14}/> Enregistrer
        </button>
        <button onClick={onClose} className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Annuler</button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[95dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={18}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
type ActionType = 'submit' | 'approve' | 'reject' | 'markpaid';

export default function InsuranceClaims() {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ClaimFilters>({});
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [action, setAction] = useState<{ type: ActionType; claim: InsuranceClaim } | null>(null);

  const { data: orgs = [] } = useInsuranceOrgs();
  const { data: claims = [], isLoading, refetch } = useInsuranceClaims(filters);

  const filtered = search
    ? claims.filter(c =>
        c.claim_number.toLowerCase().includes(search.toLowerCase()) ||
        (c.patient_name ?? '').toLowerCase().includes(search.toLowerCase()))
    : claims;

  const statuses = [
    { value: '', label: 'Tous les statuts' },
    { value: 'draft', label: 'Brouillon' },
    { value: 'submitted', label: 'Soumis' },
    { value: 'under_review', label: 'En révision' },
    { value: 'approved', label: 'Approuvé' },
    { value: 'partially_approved', label: 'Part. approuvé' },
    { value: 'rejected', label: 'Rejeté' },
    { value: 'paid', label: 'Payé' },
  ];

  function clearFilters() {
    setFilters({});
    setSearch('');
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="N° sinistre, patient..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"/>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(v => !v)}
            className={cn('flex items-center gap-2 px-3 py-2 text-sm border rounded-xl transition-colors',
              showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50 bg-white')}>
            <Filter size={14}/> Filtres
          </button>
          <button onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50">
            <RefreshCw size={14}/>
          </button>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Statut</label>
              <select value={filters.status ?? ''} onChange={e => setFilters(f => ({ ...f, status: e.target.value || undefined }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Organisme</label>
              <select value={filters.organizationId ?? ''} onChange={e => setFilters(f => ({ ...f, organizationId: e.target.value || undefined }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                <option value="">Tous les organismes</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Date du</label>
              <input type="date" value={filters.dateFrom ?? ''} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value || undefined }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Date au</label>
              <input type="date" value={filters.dateTo ?? ''} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value || undefined }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
            </div>
          </div>
          <button onClick={clearFilters} className="mt-3 text-xs text-gray-400 hover:text-gray-600">Effacer les filtres</button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 bg-white rounded-xl border border-gray-100"/>)}
        </div>
      )}

      {/* Desktop table */}
      {!isLoading && (
        <>
          <div className="hidden sm:block bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[750px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase">
                    <th className="px-4 py-3 text-left">N° sinistre</th>
                    <th className="px-4 py-3 text-left">Patient</th>
                    <th className="px-4 py-3 text-left">Organisme</th>
                    <th className="px-4 py-3 text-right">Demandé</th>
                    <th className="px-4 py-3 text-right">Approuvé</th>
                    <th className="px-4 py-3 text-left">Statut</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">
                        <FileText size={32} className="mx-auto mb-2 text-gray-200"/>
                        Aucun sinistre trouvé
                      </td>
                    </tr>
                  ) : filtered.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <button onClick={() => setSelectedClaimId(c.id)}
                          className="font-mono text-xs text-blue-600 hover:text-blue-700 font-medium">
                          {c.claim_number}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{c.patient_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{c.organization_name ?? c.insurer_name ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-700 font-medium">{fmt(c.amount_requested)} DZD</td>
                      <td className="px-4 py-3 text-right text-green-700 font-medium">
                        {c.amount_approved ? `${fmt(c.amount_approved)} DZD` : '—'}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={c.status}/></td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(c.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setSelectedClaimId(c.id)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600" title="Voir détail">
                            <Eye size={14}/>
                          </button>
                          {c.status === 'draft' && (
                            <button onClick={() => setAction({ type: 'submit', claim: c })}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600" title="Soumettre">
                              <Send size={14}/>
                            </button>
                          )}
                          {(c.status === 'submitted' || c.status === 'under_review') && (
                            <>
                              <button onClick={() => setAction({ type: 'approve', claim: c })}
                                className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600" title="Approuver">
                                <CheckCircle size={14}/>
                              </button>
                              <button onClick={() => setAction({ type: 'reject', claim: c })}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600" title="Rejeter">
                                <XCircle size={14}/>
                              </button>
                            </>
                          )}
                          {(c.status === 'approved' || c.status === 'partially_approved') && (
                            <button onClick={() => setAction({ type: 'markpaid', claim: c })}
                              className="p-1.5 rounded-lg hover:bg-purple-50 text-gray-400 hover:text-purple-600" title="Marquer payé">
                              <Banknote size={14}/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">Aucun sinistre trouvé</div>
            ) : filtered.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button onClick={() => setSelectedClaimId(c.id)}
                      className="font-mono text-xs text-blue-600 font-semibold">{c.claim_number}</button>
                    <p className="text-sm text-gray-800 font-medium mt-0.5">{c.patient_name ?? '—'}</p>
                    <p className="text-xs text-gray-400">{c.organization_name ?? c.insurer_name ?? '—'}</p>
                  </div>
                  <StatusBadge status={c.status}/>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <p className="text-xs text-gray-400">Demandé</p>
                    <p className="text-sm font-semibold text-gray-800">{fmt(c.amount_requested)} DZD</p>
                  </div>
                  {c.amount_approved && (
                    <div>
                      <p className="text-xs text-gray-400">Approuvé</p>
                      <p className="text-sm font-semibold text-green-700">{fmt(c.amount_approved)} DZD</p>
                    </div>
                  )}
                  <div className="flex gap-1">
                    <button onClick={() => setSelectedClaimId(c.id)}
                      className="p-2 rounded-lg bg-blue-50 text-blue-600"><Eye size={14}/></button>
                    {c.status === 'draft' && (
                      <button onClick={() => setAction({ type: 'submit', claim: c })}
                        className="p-2 rounded-lg bg-blue-50 text-blue-600"><Send size={14}/></button>
                    )}
                    {(c.status === 'submitted' || c.status === 'under_review') && (
                      <>
                        <button onClick={() => setAction({ type: 'approve', claim: c })}
                          className="p-2 rounded-lg bg-green-50 text-green-600"><CheckCircle size={14}/></button>
                        <button onClick={() => setAction({ type: 'reject', claim: c })}
                          className="p-2 rounded-lg bg-red-50 text-red-600"><XCircle size={14}/></button>
                      </>
                    )}
                    {(c.status === 'approved' || c.status === 'partially_approved') && (
                      <button onClick={() => setAction({ type: 'markpaid', claim: c })}
                        className="p-2 rounded-lg bg-purple-50 text-purple-600"><Banknote size={14}/></button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Action modals */}
      {action?.type === 'submit'   && <SubmitModal   claim={action.claim} onClose={() => setAction(null)}/>}
      {action?.type === 'approve'  && <ApproveModal  claim={action.claim} onClose={() => setAction(null)}/>}
      {action?.type === 'reject'   && <RejectModal   claim={action.claim} onClose={() => setAction(null)}/>}
      {action?.type === 'markpaid' && <MarkPaidModal claim={action.claim} onClose={() => setAction(null)}/>}

      {/* Claim detail slide-over */}
      {selectedClaimId && (
        <ClaimDetail claimId={selectedClaimId} onClose={() => setSelectedClaimId(null)}/>
      )}
    </div>
  );
}
