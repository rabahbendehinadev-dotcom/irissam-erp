import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from 'react';
import { payrollApi, PAYROLL_STATUS_COLORS, formatAmount, type PaymentOrder } from '@/services/api/payroll';
import { Plus, RefreshCw, CheckCircle, Download } from 'lucide-react';

const METHOD_LABELS: Record<string, string> = { bank_transfer: 'Virement', cash: 'Espèces', cheque: 'Chèque', mobile: 'Mobile' };
const STATUS_LABELS: Record<string, string> = { draft: 'Brouillon', approved: 'Approuvé', sent_to_bank: 'Envoyé', partially_paid: 'Part. payé', paid: 'Payé', rejected: 'Refusé' };

export default function PayrollOrders() {
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ runId: '', method: 'bank_transfer', bank: '' });

  const load = () => {
    setLoading(true);
    Promise.all([
      payrollApi.getPaymentOrders({ limit: 50 }),
      payrollApi.getRuns({ status: 'locked', limit: 20 }),
    ]).then(([o, r]) => {
      setOrders(Array.isArray(o?.data) ? o.data : []);
      setRuns(Array.isArray(r?.data) ? r.data : []);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const act = async (fn: () => Promise<any>) => {
    try { await fn(); load(); } catch (e: any) { toast({ variant: 'destructive', title: 'Erreur', description: e?.message ?? 'Opération impossible' }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-900">Ordres de paiement</h2>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">
            <Plus className="w-4 h-4" /> Nouvel ordre
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border p-4 space-y-3 shadow-sm">
          <h3 className="font-medium">Créer un ordre de paiement</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Run de paie (verrouillé)</label>
              <select value={form.runId} onChange={e => setForm({...form, runId: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">— Sélectionner —</option>
                {runs.map(r => <option key={r.id} value={r.id}>{r.month ? `${r.month}/${r.year}` : r.id.slice(0,8)} — {r.total_employees} emp.</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Mode de paiement</label>
              <select value={form.method} onChange={e => setForm({...form, method: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Banque (optionnel)</label>
              <input type="text" value={form.bank} onChange={e => setForm({...form, bank: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border rounded-lg">Annuler</button>
            <button onClick={async () => {
              if (!form.runId) return (() => { toast({ variant: 'destructive', title: 'Champ requis', description: 'Veuillez sélectionner un run de paie' }); return; })();
              await act(() => payrollApi.createPaymentOrder({ runId: form.runId, method: form.method, bank: form.bank }));
              setShowCreate(false);
            }} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Créer</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Aucun ordre de paiement</div>
      ) : (
        <div className="space-y-2">
          {orders.map(order => (
            <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between flex-wrap gap-3 shadow-sm">
              <div>
                <div className="font-medium text-gray-900">{order.order_number}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {METHOD_LABELS[order.method]} · {order.employee_count} employés · {formatAmount(order.total_amount)}
                  {order.bank && ` · ${order.bank}`}
                </div>
                {order.approved_at && <div className="text-xs text-gray-400 mt-0.5">Approuvé: {new Date(order.approved_at).toLocaleDateString('fr-DZ')}</div>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PAYROLL_STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABELS[order.status] || order.status}
                </span>
                {order.status === 'draft' && (
                  <button onClick={() => act(() => payrollApi.approvePaymentOrder(order.id))} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg">
                    <CheckCircle className="w-3 h-3" /> Approuver
                  </button>
                )}
                {['approved','sent_to_bank'].includes(order.status) && (
                  <button onClick={() => act(() => payrollApi.markPaymentOrderPaid(order.id))} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg">
                    Marquer payé
                  </button>
                )}
                <a href={payrollApi.getBankExportUrl({ orderId: order.id, format: 'csv' })} download className="flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-lg hover:bg-gray-50">
                  <Download className="w-3 h-3" /> Export CSV
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
