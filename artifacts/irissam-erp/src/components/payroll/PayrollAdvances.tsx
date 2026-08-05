import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from 'react';
import { payrollApi, PAYROLL_STATUS_COLORS, formatAmount, type PayrollAdvance } from '@/services/api/payroll';
import { Plus, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

export default function PayrollAdvances() {
  const [advances, setAdvances] = useState<PayrollAdvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ employeeId: '', amount: '', reason: '' });
  const [employees, setEmployees] = useState<any[]>([]);
  const [actioning, setActioning] = useState('');

  const load = () => {
    setLoading(true);
    payrollApi.getAdvances({ limit: 100 })
      .then(r => setAdvances(Array.isArray(r?.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    fetch('/api/employees?limit=500', { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } })
      .then(r => r.json()).then(d => setEmployees(Array.isArray(d?.data) ? d.data : [])).catch(() => {});
  }, []);

  const act = async (fn: () => Promise<any>) => {
    try { await fn(); load(); } catch (e: any) { toast({ variant: 'destructive', title: 'Erreur', description: e?.message ?? 'Opération impossible' }); }
    finally { setActioning(''); }
  };

  const STATUS_LABELS: Record<string, string> = {
    pending: 'En attente', approved: 'Approuvé', rejected: 'Refusé',
    fully_deducted: 'Déduit', partially_deducted: 'Part. déduit', cancelled: 'Annulé',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-900">Avances sur salaire</h2>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">
            <Plus className="w-4 h-4" /> Nouvelle avance
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border p-4 space-y-3 shadow-sm">
          <h3 className="font-medium">Demande d'avance</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Employé</label>
              <select value={form.employeeId} onChange={e => setForm({...form, employeeId: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">— Sélectionner —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.last_name} {e.first_name} ({e.matricule})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Montant (DZD)</label>
              <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" min={1} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Motif</label>
              <input type="text" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border rounded-lg">Annuler</button>
            <button onClick={async () => {
              if (!form.employeeId || !form.amount) return (() => { toast({ variant: 'destructive', title: 'Champs requis', description: 'Veuillez remplir tous les champs obligatoires' }); return; })();
              await act(() => payrollApi.createAdvance({ employeeId: form.employeeId, amount: parseFloat(form.amount), reason: form.reason }));
              setShowCreate(false); setForm({ employeeId: '', amount: '', reason: '' });
            }} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Enregistrer</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
      ) : advances.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Aucune avance enregistrée</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 text-xs text-gray-500">Employé</th>
                <th className="text-right py-3 px-4 text-xs text-gray-500">Montant</th>
                <th className="text-left py-3 px-4 text-xs text-gray-500 hidden sm:table-cell">Motif</th>
                <th className="text-left py-3 px-4 text-xs text-gray-500">Date</th>
                <th className="text-center py-3 px-4 text-xs text-gray-500">Statut</th>
                <th className="text-center py-3 px-4 text-xs text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {advances.map(adv => (
                <tr key={adv.id} className="hover:bg-gray-50">
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-gray-900">{adv.last_name} {adv.first_name}</div>
                    <div className="text-xs text-gray-400">{adv.matricule}</div>
                  </td>
                  <td className="py-2.5 px-4 text-right font-semibold">{formatAmount(adv.amount)}</td>
                  <td className="py-2.5 px-4 hidden sm:table-cell text-gray-500 text-xs">{adv.reason || '—'}</td>
                  <td className="py-2.5 px-4 text-xs text-gray-500">{new Date(adv.request_date).toLocaleDateString('fr-DZ')}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PAYROLL_STATUS_COLORS[adv.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[adv.status] || adv.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {adv.status === 'pending' && (
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => act(() => payrollApi.approveAdvance(adv.id))} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Approuver">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => {
                          const r = window.prompt('Motif du refus:');
                          if (r) act(() => payrollApi.rejectAdvance(adv.id, r));
                        }} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Refuser">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
