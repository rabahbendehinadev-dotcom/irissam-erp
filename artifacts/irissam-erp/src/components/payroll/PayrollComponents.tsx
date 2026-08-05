import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from 'react';
import { payrollApi, formatAmount, type SalaryComponent } from '@/services/api/payroll';
import { Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react';

const CALC_LABELS: Record<string, string> = {
  fixed: 'Fixe', percentage_of_base: '% Base', percentage_of_brut: '% Brut',
  daily_rate: 'Taux journalier', hourly_rate: 'Taux horaire', formula: 'Formule',
};

export default function PayrollComponents() {
  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [editing, setEditing] = useState<SalaryComponent | null>(null);

  const load = () => {
    setLoading(true);
    payrollApi.getComponents()
      .then(r => setComponents(Array.isArray(r?.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = components.filter(c => typeFilter === 'all' || c.type === typeFilter);
  const earnings = filtered.filter(c => c.type === 'earning');
  const deductions = filtered.filter(c => c.type === 'deduction');

  const toggleActive = async (c: SalaryComponent) => {
    try { await payrollApi.updateComponent(c.id, { active: !c.active }); load(); } catch (e: any) { toast({ variant: 'destructive', title: 'Erreur', description: e?.message ?? 'Opération impossible' }); }
  };

  const ComponentRow = ({ c }: { c: SalaryComponent }) => (
    <tr className="hover:bg-gray-50">
      <td className="py-2 px-3">
        <div className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded inline-block">{c.code}</div>
      </td>
      <td className="py-2 px-3">
        <div className="text-sm font-medium text-gray-900">{c.name}</div>
        {c.name_ar && <div className="text-xs text-gray-400 text-right" dir="rtl">{c.name_ar}</div>}
      </td>
      <td className="py-2 px-3 text-xs text-gray-600">{CALC_LABELS[c.calculation_method] || c.calculation_method}</td>
      <td className="py-2 px-3 text-right text-sm">
        {c.calculation_method === 'fixed' ? formatAmount(c.fixed_amount) : c.percentage > 0 ? `${(parseFloat(String(c.percentage)) * 100).toFixed(0)}%` : '—'}
      </td>
      <td className="py-2 px-3 text-center text-xs">
        <span className={`px-1.5 py-0.5 rounded-full ${c.taxable ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>{c.taxable ? 'Imposable' : 'Non imp.'}</span>
      </td>
      <td className="py-2 px-3 text-center">
        <button onClick={() => toggleActive(c)} className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
          {c.active ? 'Actif' : 'Inactif'}
        </button>
      </td>
      <td className="py-2 px-3 text-center">
        <button onClick={() => setEditing(c)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-3.5 h-3.5" /></button>
      </td>
    </tr>
  );

  const EditForm = ({ comp }: { comp: SalaryComponent }) => {
    const [form, setForm] = useState({ fixedAmount: comp.fixed_amount, percentage: parseFloat(String(comp.percentage)) * 100, taxable: comp.taxable, socialSecurityApplicable: comp.social_security_applicable, active: comp.active, priority: comp.priority });
    const save = async () => {
      try {
        await payrollApi.updateComponent(comp.id, { fixed_amount: form.fixedAmount, percentage: form.percentage / 100, taxable: form.taxable, social_security_applicable: form.socialSecurityApplicable, active: form.active, priority: form.priority });
        setEditing(null); load();
      } catch (e: any) { toast({ variant: 'destructive', title: 'Erreur', description: e?.message ?? 'Opération impossible' }); }
    };
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-5 w-full max-w-md space-y-3 shadow-xl">
          <h3 className="font-semibold text-gray-900">Modifier: {comp.name}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Montant fixe (DZD)</label>
              <input type="number" value={form.fixedAmount} onChange={e => setForm({...form, fixedAmount: parseFloat(e.target.value)})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Pourcentage (%)</label>
              <input type="number" value={form.percentage} onChange={e => setForm({...form, percentage: parseFloat(e.target.value)})} className="w-full border rounded-lg px-3 py-2 text-sm" step={0.01} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Priorité</label>
              <input type="number" value={form.priority} onChange={e => setForm({...form, priority: parseInt(e.target.value)})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.taxable} onChange={e => setForm({...form, taxable: e.target.checked})} /> Imposable
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.socialSecurityApplicable} onChange={e => setForm({...form, socialSecurityApplicable: e.target.checked})} /> CNAS
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={e => setForm({...form, active: e.target.checked})} /> Actif
            </label>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm border rounded-lg">Annuler</button>
            <button onClick={save} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Enregistrer</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {editing && <EditForm comp={editing} />}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-gray-900">Composants salariaux</h2>
        <div className="flex gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {['all','earning','deduction'].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${typeFilter === t ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                {t === 'all' ? 'Tous' : t === 'earning' ? 'Gains' : 'Retenues'}
              </button>
            ))}
          </div>
          <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
      ) : (
        <>
          {(typeFilter === 'all' || typeFilter === 'earning') && earnings.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
              <div className="bg-green-50 px-4 py-2 border-b"><h3 className="text-sm font-semibold text-green-800">Gains ({earnings.length})</h3></div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="text-left py-2 px-3 text-xs text-gray-500">Code</th>
                  <th className="text-left py-2 px-3 text-xs text-gray-500">Nom</th>
                  <th className="text-left py-2 px-3 text-xs text-gray-500 hidden sm:table-cell">Calcul</th>
                  <th className="text-right py-2 px-3 text-xs text-gray-500">Valeur</th>
                  <th className="text-center py-2 px-3 text-xs text-gray-500 hidden sm:table-cell">Fiscal</th>
                  <th className="text-center py-2 px-3 text-xs text-gray-500">Statut</th>
                  <th className="w-8"/>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">{earnings.map(c => <ComponentRow key={c.id} c={c}/>)}</tbody>
              </table>
            </div>
          )}
          {(typeFilter === 'all' || typeFilter === 'deduction') && deductions.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
              <div className="bg-red-50 px-4 py-2 border-b"><h3 className="text-sm font-semibold text-red-800">Retenues ({deductions.length})</h3></div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="text-left py-2 px-3 text-xs text-gray-500">Code</th>
                  <th className="text-left py-2 px-3 text-xs text-gray-500">Nom</th>
                  <th className="text-left py-2 px-3 text-xs text-gray-500 hidden sm:table-cell">Calcul</th>
                  <th className="text-right py-2 px-3 text-xs text-gray-500">Valeur</th>
                  <th className="text-center py-2 px-3 text-xs text-gray-500 hidden sm:table-cell">Fiscal</th>
                  <th className="text-center py-2 px-3 text-xs text-gray-500">Statut</th>
                  <th className="w-8"/>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">{deductions.map(c => <ComponentRow key={c.id} c={c}/>)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
