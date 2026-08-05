import { useState } from 'react';
import {
  useInsuranceBordereaux, useInsuranceBordereau, useCreateBordereau,
  useAddClaimsToBordereau, useRemoveClaimFromBordereau,
  useSubmitBordereau, useMarkBordereauReceived,
  useInsuranceOrgs, useInsuranceClaims,
} from '@/hooks/useInsuranceApi';
import type { InsuranceBordereau, CreateBordereauInput } from '@/types/insurance';
import { useLanguage } from '@/i18n';
import {
  Plus, Search, Eye, Send, FileText, Package, X, Loader2,
  CheckCircle, Trash2, Building2, AlertTriangle, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number | string | undefined | null) {
  if (n == null || n === '') return '—';
  return Number(n).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(s?: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  en_preparation:        { label: 'En préparation',    color: 'bg-gray-100 text-gray-600' },
  soumis:                { label: 'Soumis',            color: 'bg-blue-100 text-blue-700' },
  en_cours_traitement:   { label: 'En traitement',     color: 'bg-yellow-100 text-yellow-700' },
  recu:                  { label: 'Reçu',              color: 'bg-purple-100 text-purple-700' },
  regle_partiellement:   { label: 'Réglé partiellement',color: 'bg-orange-100 text-orange-700' },
  regle:                 { label: 'Réglé',             color: 'bg-green-100 text-green-700' },
  conteste:              { label: 'Contesté',          color: 'bg-red-100 text-red-700' },
  archive:               { label: 'Archivé',           color: 'bg-gray-100 text-gray-400' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
}

// ─── Create Bordereau Form ────────────────────────────────────────────────────
function CreateBordereauForm({ onClose }: { onClose: () => void }) {
  const { data: orgs = [] } = useInsuranceOrgs();
  const create = useCreateBordereau();
  const [form, setForm] = useState<Partial<CreateBordereauInput>>({});
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await create.mutateAsync(form as CreateBordereauInput);
      onClose();
    } catch (err: unknown) { setError((err as Error).message ?? 'Erreur'); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[95dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Nouveau bordereau</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={18}/></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Organisme *</label>
            <select required value={form.organizationId ?? ''}
              onChange={e => setForm(f => ({ ...f, organizationId: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Sélectionner...</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Période du</label>
              <input type="date" value={form.periodFrom ?? ''}
                onChange={e => setForm(f => ({ ...f, periodFrom: e.target.value || undefined }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Période au</label>
              <input type="date" value={form.periodTo ?? ''}
                onChange={e => setForm(f => ({ ...f, periodTo: e.target.value || undefined }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Notes</label>
            <textarea rows={2} value={form.notes ?? ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value || undefined }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"/>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={create.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-60">
              {create.isPending && <Loader2 size={14} className="animate-spin"/>} Créer
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Claims Modal ─────────────────────────────────────────────────────────
function AddClaimsModal({ bordereauId, onClose }: { bordereauId: string; onClose: () => void }) {
  const { data: claims = [], isLoading } = useInsuranceClaims({ status: 'approved' });
  const addClaims = useAddClaimsToBordereau();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function confirm() {
    if (selected.size === 0) return;
    setError('');
    try {
      await addClaims.mutateAsync({ id: bordereauId, claimIds: Array.from(selected) });
      onClose();
    } catch (err: unknown) { setError((err as Error).message ?? 'Erreur'); }
  }

  // Filter out claims already in a bordereau
  const available = claims.filter(c => !c.bordereau_id);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-900">Ajouter des sinistres ({selected.size} sélectionné(s))</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={18}/></button>
        </div>
        {error && <div className="px-5 pt-3 text-sm text-red-700 bg-red-50 border-b border-red-100">{error}</div>}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({length:4}).map((_,i) => <div key={i} className="h-12 bg-gray-100 rounded-xl"/>)}
            </div>
          ) : available.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <FileText size={28} className="mx-auto mb-2 text-gray-200"/>
              Aucun sinistre approuvé disponible
            </div>
          ) : (
            <div className="space-y-2">
              {available.map(claim => (
                <label key={claim.id}
                  className={cn('flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                    selected.has(claim.id) ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:border-gray-200')}>
                  <input type="checkbox" checked={selected.has(claim.id)} onChange={() => toggle(claim.id)}
                    className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{claim.patient_name ?? '—'}</p>
                    <p className="text-xs text-gray-400 font-mono">{claim.claim_number}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">{fmt(claim.amount_approved ?? claim.amount_requested)} DZD</p>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 p-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={confirm} disabled={addClaims.isPending || selected.size === 0}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-60">
            {addClaims.isPending && <Loader2 size={14} className="animate-spin"/>}
            Ajouter {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Annuler</button>
        </div>
      </div>
    </div>
  );
}

// ─── Bordereau Detail ─────────────────────────────────────────────────────────
function BordereauDetail({ bordereau, onClose }: { bordereau: InsuranceBordereau; onClose: () => void }) {
  const { data: detail } = useInsuranceBordereau(bordereau.id);
  const removeClaimFromBordereau = useRemoveClaimFromBordereau();
  const submitBordereau = useSubmitBordereau();
  const markReceived = useMarkBordereauReceived();
  const [showAddClaims, setShowAddClaims] = useState(false);
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');

  const claims = detail?.claims ?? [];
  const isEditable = bordereau.status === 'en_preparation';

  async function doSubmit() {
    setError('');
    try {
      await submitBordereau.mutateAsync({ id: bordereau.id, referenceExterne: reference || undefined });
    } catch (err: unknown) { setError((err as Error).message ?? 'Erreur'); }
  }

  async function doMarkReceived() {
    setError('');
    try { await markReceived.mutateAsync(bordereau.id); }
    catch (err: unknown) { setError((err as Error).message ?? 'Erreur'); }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-gray-900">{bordereau.bordereau_number}</span>
            <StatusBadge status={bordereau.status}/>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{bordereau.organization_name ?? '—'}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 sm:hidden"><X size={18}/></button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100 flex-shrink-0">
        {[
          { label: 'Sinistres', value: String(bordereau.claim_count) },
          { label: 'Demandé', value: `${fmt(bordereau.total_requested)} DZD` },
          { label: 'Approuvé', value: bordereau.total_approved ? `${fmt(bordereau.total_approved)} DZD` : '—' },
          { label: 'Payé', value: bordereau.total_paid ? `${fmt(bordereau.total_paid)} DZD` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white px-3 py-3 text-center">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-sm font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {error && <div className="px-5 py-2 bg-red-50 text-sm text-red-700 border-b border-red-100">{error}</div>}

      {/* Actions */}
      {(isEditable || bordereau.status === 'soumis') && (
        <div className="px-5 py-3 flex gap-2 flex-wrap border-b border-gray-50 flex-shrink-0">
          {isEditable && (
            <>
              <button onClick={() => setShowAddClaims(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 font-medium">
                <Plus size={14}/> Ajouter sinistres
              </button>
              <div className="flex items-center gap-2 flex-1">
                <input value={reference} onChange={e => setReference(e.target.value)}
                  placeholder="Référence externe (optionnel)"
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                <button onClick={doSubmit} disabled={submitBordereau.isPending || claims.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-60 font-medium whitespace-nowrap">
                  {submitBordereau.isPending ? <Loader2 size={13} className="animate-spin"/> : <Send size={13}/>}
                  Soumettre
                </button>
              </div>
            </>
          )}
          {bordereau.status === 'soumis' && (
            <button onClick={doMarkReceived} disabled={markReceived.isPending}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-60 font-medium">
              {markReceived.isPending && <Loader2 size={13} className="animate-spin"/>}
              <CheckCircle size={13}/> Marquer reçu
            </button>
          )}
          <span className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-100 rounded-xl text-gray-400 cursor-not-allowed" title="Export PDF en développement">
            <FileText size={13}/> Export PDF
          </span>
        </div>
      )}

      {/* Claims list */}
      <div className="flex-1 overflow-y-auto">
        {claims.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-300">
            <Package size={32} className="mb-2"/>
            <p className="text-sm text-gray-400">Aucun sinistre dans ce bordereau</p>
            {isEditable && (
              <button onClick={() => setShowAddClaims(true)}
                className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                <Plus size={13}/> Ajouter des sinistres
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase">
                <th className="px-4 py-2.5 text-left">N° sinistre</th>
                <th className="px-4 py-2.5 text-left">Patient</th>
                <th className="px-4 py-2.5 text-right">Demandé</th>
                <th className="px-4 py-2.5 text-right">Approuvé</th>
                {isEditable && <th className="px-4 py-2.5"/>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {claims.map(claim => (
                <tr key={claim.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 font-mono text-xs text-blue-600">{claim.claim_number}</td>
                  <td className="px-4 py-2.5 text-gray-700">{claim.patient_name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700">{fmt(claim.amount_requested)} DZD</td>
                  <td className="px-4 py-2.5 text-right text-green-700">{claim.amount_approved ? `${fmt(claim.amount_approved)} DZD` : '—'}</td>
                  {isEditable && (
                    <td className="px-4 py-2.5">
                      <button onClick={() => removeClaimFromBordereau.mutate({ bordereauId: bordereau.id, claimId: claim.id })}
                        disabled={removeClaimFromBordereau.isPending}
                        className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={13}/>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddClaims && <AddClaimsModal bordereauId={bordereau.id} onClose={() => setShowAddClaims(false)}/>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function InsuranceBordereaux() {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedBordereau, setSelectedBordereau] = useState<InsuranceBordereau | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: bordereaux = [], isLoading } = useInsuranceBordereaux();

  const filtered = bordereaux.filter(b => {
    const matchSearch = !search || b.bordereau_number.toLowerCase().includes(search.toLowerCase()) ||
      (b.organization_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusFilters = [
    { value: '', label: 'Tous' },
    { value: 'en_preparation', label: 'En préparation' },
    { value: 'soumis', label: 'Soumis' },
    { value: 'recu', label: 'Reçu' },
    { value: 'regle', label: 'Réglé' },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-auto lg:min-h-[calc(100vh-200px)]">
      {/* Left: list */}
      <div className={cn('flex flex-col space-y-3', selectedBordereau ? 'lg:w-[340px] lg:flex-shrink-0' : 'w-full')}>
        {/* Header */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"/>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 whitespace-nowrap">
            <Plus size={14}/> {t('insurance.action.new_bordereau')}
          </button>
        </div>

        {/* Status filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {statusFilters.map(sf => (
            <button key={sf.value} onClick={() => setStatusFilter(sf.value)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors',
                statusFilter === sf.value ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300')}>
              {sf.label}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {Array.from({length:5}).map((_,i) => <div key={i} className="h-20 bg-white rounded-xl border border-gray-100"/>)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-300">
            <Package size={32} className="mb-2"/>
            <p className="text-sm text-gray-400">Aucun bordereau</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(b => (
              <button key={b.id}
                onClick={() => setSelectedBordereau(prev => prev?.id === b.id ? null : b)}
                className={cn('w-full text-left p-4 rounded-xl border transition-colors',
                  selectedBordereau?.id === b.id
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white border-gray-100 hover:border-gray-200')}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs text-blue-600 font-semibold">{b.bordereau_number}</span>
                  <StatusBadge status={b.status}/>
                </div>
                <p className="text-sm font-medium text-gray-800 truncate">{b.organization_name ?? '—'}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-xs text-gray-400">{b.claim_count} sinistre(s)</p>
                  <p className="text-xs font-medium text-gray-600">{fmt(b.total_requested)} DZD</p>
                </div>
                {(b.period_from || b.period_to) && (
                  <p className="text-xs text-gray-300 mt-1">{fmtDate(b.period_from)} → {fmtDate(b.period_to)}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: detail */}
      {selectedBordereau && (
        <div className="flex-1 bg-white rounded-xl border border-gray-100 min-h-[500px] flex flex-col overflow-hidden">
          <BordereauDetail
            bordereau={selectedBordereau}
            onClose={() => setSelectedBordereau(null)}
          />
        </div>
      )}

      {showCreate && <CreateBordereauForm onClose={() => setShowCreate(false)}/>}
    </div>
  );
}
