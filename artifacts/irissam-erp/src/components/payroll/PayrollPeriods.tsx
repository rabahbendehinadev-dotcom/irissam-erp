import { useState, useEffect } from 'react';
import { payrollApi, PAYROLL_STATUS_LABELS, PAYROLL_STATUS_COLORS, MONTH_NAMES_FR, type PayrollPeriod } from '@/services/api/payroll';
import { toast } from '@/hooks/use-toast';
import { Plus, RefreshCw, ChevronRight } from 'lucide-react';

export default function PayrollPeriods() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), startDate: '', endDate: '', paymentDate: '', notes: '' });

  const load = () => {
    setLoading(true);
    payrollApi.getPeriods({ limit: 24 })
      .then(r => setPeriods(Array.isArray(r?.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async () => {
    if (!form.startDate || !form.endDate) {
      toast({ variant: 'destructive', title: 'Champs requis', description: 'Les dates de début et de fin sont obligatoires' });
      return;
    }
    setCreating(true);
    try {
      await payrollApi.createPeriod({ month: form.month, year: form.year, startDate: form.startDate, endDate: form.endDate, paymentDate: form.paymentDate || undefined, notes: form.notes });
      setShowCreate(false);
      load();
    } catch (e: any) { toast({ variant: 'destructive', title: 'Erreur', description: e?.message ?? 'Impossible de créer la période' }); }
    finally { setCreating(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-900">Périodes de paie</h2>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Nouvelle période
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 shadow-sm">
          <h3 className="font-medium text-gray-800">Créer une période</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Mois</label>
              <select value={form.month} onChange={e => setForm({...form, month: parseInt(e.target.value)})} className="w-full border rounded-lg px-3 py-2 text-sm">
                {MONTH_NAMES_FR.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Année</label>
              <input type="number" value={form.year} onChange={e => setForm({...form, year: parseInt(e.target.value)})} className="w-full border rounded-lg px-3 py-2 text-sm" min={2020} max={2100} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Date début</label>
              <input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Date fin</label>
              <input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Date paiement</label>
              <input type="date" value={form.paymentDate} onChange={e => setForm({...form, paymentDate: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Annuler</button>
            <button onClick={handleCreate} disabled={creating} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {creating ? 'Création...' : 'Créer'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
      ) : periods.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Aucune période trouvée</div>
      ) : (
        <div className="space-y-2">
          {periods.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex flex-col items-center justify-center">
                  <div className="text-xs font-bold text-blue-700">{String(p.month).padStart(2,'0')}</div>
                  <div className="text-xs text-blue-500">{p.year}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{MONTH_NAMES_FR[p.month - 1]} {p.year}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(p.start_date).toLocaleDateString('fr-DZ')} — {new Date(p.end_date).toLocaleDateString('fr-DZ')}
                    {p.payment_date && <> · Paiement: {new Date(p.payment_date).toLocaleDateString('fr-DZ')}</>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {typeof p.run_count === 'number' && <span className="text-xs text-gray-500">{p.run_count} run(s)</span>}
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PAYROLL_STATUS_COLORS[p.status]}`}>
                  {PAYROLL_STATUS_LABELS[p.status]}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
