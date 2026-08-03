import { useState } from 'react';
import { useInsurancePayments, useRegisterPayment, useInsuranceOrgs } from '@/hooks/useInsuranceApi';
import type { RegisterPaymentInput, InsuranceOrgPayment } from '@/types/insurance';
import { useLanguage } from '@/i18n';
import {
  Plus, Search, Banknote, Building2, X, Loader2, Filter, Receipt,
  CreditCard, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number | string | undefined | null) {
  if (n == null) return '—';
  return Number(n).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(s?: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const PAYMENT_METHODS: Record<string, string> = {
  virement: 'Virement', cheque: 'Chèque', especes: 'Espèces', autre: 'Autre',
};

// ─── Register Payment Form ────────────────────────────────────────────────────
function RegisterPaymentForm({ onClose }: { onClose: () => void }) {
  const { data: orgs = [] } = useInsuranceOrgs();
  const register = useRegisterPayment();
  const [form, setForm] = useState<Partial<RegisterPaymentInput>>({ paymentMethod: 'virement' });
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await register.mutateAsync(form as RegisterPaymentInput);
      onClose();
    } catch (err: unknown) { setError((err as Error).message ?? 'Erreur'); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[95dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Enregistrer un paiement</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={18}/></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Organisme *</label>
            <select required value={form.organizationId ?? ''} onChange={e => setForm(f => ({ ...f, organizationId: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Sélectionner...</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Montant (DZD) *</label>
              <input required type="number" min={0.01} step={0.01}
                value={form.amount ?? ''} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Date *</label>
              <input required type="date" value={form.paymentDate ?? ''}
                onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Mode de paiement</label>
              <select value={form.paymentMethod ?? 'virement'} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                {Object.entries(PAYMENT_METHODS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Référence</label>
              <input value={form.reference ?? ''} onChange={e => setForm(f => ({ ...f, reference: e.target.value || undefined }))}
                placeholder="N° virement, chèque..."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Notes</label>
            <textarea rows={2} value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value || undefined }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"/>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={register.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-60">
              {register.isPending && <Loader2 size={14} className="animate-spin"/>}
              <Banknote size={14}/> Enregistrer
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Payment Detail ───────────────────────────────────────────────────────────
function PaymentDetail({ payment, onClose }: { payment: InsuranceOrgPayment; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose}/>
      <div className="w-full sm:w-[400px] bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <Receipt size={18} className="text-green-600"/>
            </div>
            <div>
              <p className="font-mono text-sm font-bold text-gray-900">{payment.payment_number}</p>
              <p className="text-xs text-gray-400">{payment.organization_name ?? '—'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={18}/></button>
        </div>

        {/* Amount hero */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 px-6 py-8 text-white flex-shrink-0">
          <p className="text-xs text-green-100 font-medium mb-1">Montant reçu</p>
          <p className="text-3xl font-bold">{fmt(payment.amount)} DZD</p>
          <p className="text-xs text-green-100 mt-2">{fmtDate(payment.payment_date)}</p>
        </div>

        {/* Details */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {([
            { label: 'Organisme', value: payment.organization_name },
            { label: 'Mode de paiement', value: PAYMENT_METHODS[payment.payment_method ?? ''] ?? payment.payment_method },
            { label: 'Référence', value: payment.reference },
            { label: 'Bordereau', value: payment.bordereau_number },
            { label: 'Notes', value: payment.notes },
          ] as { label: string; value: string | undefined }[]).filter(item => item.value).map(item => (
            <div key={item.label}>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{item.label}</p>
              <p className="text-sm text-gray-800 font-medium">{item.value}</p>
            </div>
          ))}

          {/* Distribution placeholder */}
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Distribution</p>
            <div className="flex items-center justify-center py-6 text-gray-300">
              <div className="text-center">
                <CreditCard size={24} className="mx-auto mb-2"/>
                <p className="text-xs text-gray-400">Distribution sur sinistres disponible bientôt</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function InsurancePayments() {
  const { t } = useLanguage();
  const [search, setSearch]           = useState('');
  const [filterOrgId, setFilterOrgId] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<InsuranceOrgPayment | null>(null);

  const { data: orgs = [] }     = useInsuranceOrgs();
  const { data: payments = [], isLoading } = useInsurancePayments(filterOrgId || undefined);

  const filtered = search
    ? payments.filter(p =>
        p.payment_number.toLowerCase().includes(search.toLowerCase()) ||
        (p.organization_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (p.reference ?? '').toLowerCase().includes(search.toLowerCase()))
    : payments;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="N° paiement, organisme, référence..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"/>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(v => !v)}
            className={cn('flex items-center gap-2 px-3 py-2 text-sm border rounded-xl transition-colors',
              showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50 bg-white')}>
            <Filter size={14}/> Filtres
          </button>
          <button onClick={() => setShowRegister(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 whitespace-nowrap">
            <Plus size={16}/> {t('insurance.action.new_payment')}
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Organisme</label>
            <select value={filterOrgId} onChange={e => setFilterOrgId(e.target.value)}
              className="w-full sm:w-64 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Tous les organismes</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2 animate-pulse">
          {Array.from({length:5}).map((_,i) => <div key={i} className="h-16 bg-white rounded-xl border border-gray-100"/>)}
        </div>
      )}

      {/* Desktop table */}
      {!isLoading && (
        <>
          <div className="hidden sm:block bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3 text-left">N° paiement</th>
                  <th className="px-4 py-3 text-left">Organisme</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Mode</th>
                  <th className="px-4 py-3 text-left">Référence</th>
                  <th className="px-4 py-3 text-right"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                    <Banknote size={32} className="mx-auto mb-2 text-gray-200"/>
                    Aucun paiement enregistré
                  </td></tr>
                ) : filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">{p.payment_number}</td>
                    <td className="px-4 py-3 text-gray-700">{p.organization_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(p.amount)} DZD</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(p.payment_date)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{PAYMENT_METHODS[p.payment_method ?? ''] ?? p.payment_method ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{p.reference ?? '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelectedPayment(p)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600">
                        <ChevronRight size={14}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">Aucun paiement enregistré</div>
            ) : filtered.map(p => (
              <button key={p.id} onClick={() => setSelectedPayment(p)}
                className="w-full text-left bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-xs text-blue-600 font-semibold">{p.payment_number}</p>
                    <p className="text-sm text-gray-800 font-medium mt-0.5">{p.organization_name ?? '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">{fmt(p.amount)}</p>
                    <p className="text-xs text-gray-400">DZD · {fmtDate(p.payment_date)}</p>
                  </div>
                </div>
                {p.reference && (
                  <p className="text-xs text-gray-400 mt-2 font-mono">Réf: {p.reference}</p>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {showRegister && <RegisterPaymentForm onClose={() => setShowRegister(false)}/>}
      {selectedPayment && <PaymentDetail payment={selectedPayment} onClose={() => setSelectedPayment(null)}/>}
    </div>
  );
}
