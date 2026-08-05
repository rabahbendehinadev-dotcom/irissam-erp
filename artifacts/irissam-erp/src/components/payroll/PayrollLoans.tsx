import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from 'react';
import { payrollApi, PAYROLL_STATUS_COLORS, formatAmount, type PayrollLoan } from '@/services/api/payroll';
import { Plus, RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

export default function PayrollLoans() {
  const [loans, setLoans] = useState<PayrollLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [installments, setInstallments] = useState<Record<string, any[]>>({});
  const [form, setForm] = useState({ employeeId: '', totalAmount: '', installmentAmount: '', numberOfInstallments: '', reason: '' });
  const [employees, setEmployees] = useState<any[]>([]);

  const load = () => {
    setLoading(true);
    payrollApi.getLoans({ limit: 100 })
      .then(r => setLoans(Array.isArray(r?.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetch('/api/employees?limit=500', { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } })
      .then(r => r.json()).then(d => setEmployees(Array.isArray(d?.data) ? d.data : [])).catch(() => {});
  }, []);

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!installments[id]) {
      try {
        const r = await payrollApi.getLoanInstallments(id);
        setInstallments(prev => ({ ...prev, [id]: Array.isArray(r?.data) ? r.data : [] }));
      } catch {}
    }
  };

  const act = async (fn: () => Promise<any>) => {
    try { await fn(); load(); } catch (e: any) { toast({ variant: 'destructive', title: 'Erreur', description: e?.message ?? 'Opération impossible' }); }
  };

  const STATUS_LABELS: Record<string, string> = {
    pending: 'En attente', approved: 'Approuvé', active: 'Actif',
    completed: 'Remboursé', rejected: 'Refusé', cancelled: 'Annulé',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-900">Prêts aux employés</h2>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">
            <Plus className="w-4 h-4" /> Nouveau prêt
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border p-4 space-y-3 shadow-sm">
          <h3 className="font-medium">Demande de prêt</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <label className="text-xs text-gray-500 block mb-1">Employé</label>
              <select value={form.employeeId} onChange={e => setForm({...form, employeeId: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">— Sélectionner —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.last_name} {e.first_name} ({e.matricule})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Montant total (DZD)</label>
              <input type="number" value={form.totalAmount} onChange={e => setForm({...form, totalAmount: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" min={1} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Montant mensualité</label>
              <input type="number" value={form.installmentAmount} onChange={e => setForm({...form, installmentAmount: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" min={1} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nb de mensualités</label>
              <input type="number" value={form.numberOfInstallments} onChange={e => setForm({...form, numberOfInstallments: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" min={1} />
            </div>
            <div className="sm:col-span-3">
              <label className="text-xs text-gray-500 block mb-1">Motif</label>
              <input type="text" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border rounded-lg">Annuler</button>
            <button onClick={async () => {
              if (!form.employeeId || !form.totalAmount || !form.installmentAmount || !form.numberOfInstallments) return (() => { toast({ variant: 'destructive', title: 'Champs requis', description: 'Veuillez remplir tous les champs' }); return; })();
              await act(() => payrollApi.createLoan({ employeeId: form.employeeId, totalAmount: parseFloat(form.totalAmount), installmentAmount: parseFloat(form.installmentAmount), numberOfInstallments: parseInt(form.numberOfInstallments), reason: form.reason }));
              setShowCreate(false); setForm({ employeeId: '', totalAmount: '', installmentAmount: '', numberOfInstallments: '', reason: '' });
            }} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Enregistrer</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
      ) : loans.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Aucun prêt enregistré</div>
      ) : (
        <div className="space-y-2">
          {loans.map(loan => (
            <div key={loan.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-4 flex items-center justify-between flex-wrap gap-2">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{loan.last_name} {loan.first_name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {loan.loan_number} · {formatAmount(loan.total_amount)} · {loan.paid_installments}/{loan.number_of_installments} mensualités · Reste: <strong>{formatAmount(loan.remaining_amount)}</strong>
                  </div>
                  {loan.status === 'active' && (
                    <div className="mt-1.5 w-full max-w-48 bg-gray-200 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(loan.paid_installments / loan.number_of_installments) * 100}%` }} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PAYROLL_STATUS_COLORS[loan.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[loan.status] || loan.status}
                  </span>
                  {loan.status === 'pending' && (
                    <>
                      <button onClick={() => act(() => payrollApi.approveLoan(loan.id))} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Approuver"><CheckCircle className="w-4 h-4" /></button>
                      <button onClick={() => { const r = window.prompt('Motif du refus:'); if (r) act(() => payrollApi.rejectLoan(loan.id, r)); }} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Refuser"><XCircle className="w-4 h-4" /></button>
                    </>
                  )}
                  <button onClick={() => toggleExpand(loan.id)} className="p-1 hover:bg-gray-100 rounded">
                    {expanded === loan.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {expanded === loan.id && (
                <div className="border-t bg-gray-50 p-3">
                  <h4 className="text-xs font-medium text-gray-600 mb-2">Échéancier</h4>
                  {(installments[loan.id] || []).length === 0 ? (
                    <div className="text-xs text-gray-400">Aucune mensualité payée</div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {(installments[loan.id] || []).map(inst => (
                        <div key={inst.id} className={`text-center p-1.5 rounded text-xs ${inst.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                          #{inst.installment_no} {formatAmount(inst.amount)}
                          {inst.paid_at && <div className="text-xs opacity-70">{new Date(inst.paid_at).toLocaleDateString('fr-DZ')}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
