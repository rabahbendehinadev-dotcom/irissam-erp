import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from 'react';
import { payrollApi, type PayrollSettings } from '@/services/api/payroll';
import { Save, RefreshCw } from 'lucide-react';

export default function PayrollSettingsTab() {
  const [data, setData] = useState<{ settings?: PayrollSettings; taxRules?: any[]; socialSecurityRules?: any[] } | null>(null);
  const [form, setForm] = useState<Partial<PayrollSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    payrollApi.getSettings().then(d => {
      setData(d);
      if (d.settings) setForm({ ...d.settings });
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const save = async () => {
    setSaving(true);
    try { await payrollApi.updateSettings(form); toast({ title: 'Succès', description: 'Paramètres enregistrés' }); } catch (e: any) { toast({ variant: 'destructive', title: 'Erreur', description: e?.message ?? 'Opération impossible' }); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-48 bg-gray-100 rounded-xl"/></div>;
  if (!data) return null;

  const Field = ({ label, field, step, unit }: { label: string; field: keyof PayrollSettings; step?: number; unit?: string }) => (
    <div>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      <div className="flex items-center gap-1.5">
        <input type="number" step={step || 1} value={form[field] as number ?? ''} onChange={e => setForm({...form, [field]: parseFloat(e.target.value)})} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
        {unit && <span className="text-xs text-gray-400">{unit}</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-900">Paramètres de paie</h2>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={save} disabled={saving} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
            <Save className="w-4 h-4" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Working time */}
      <div className="bg-white rounded-xl border p-4 shadow-sm">
        <h3 className="font-medium text-gray-800 mb-4">Temps de travail</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Jours ouvrés / mois" field="working_days_per_month" step={0.5} unit="jours" />
          <Field label="Heures / jour" field="working_hours_per_day" step={0.5} unit="h" />
          <div>
            <label className="text-xs text-gray-500 block mb-1">Tolérance retard</label>
            <div className="flex items-center gap-1.5">
              <input type="number" value={form.late_grace_minutes ?? 5} onChange={e => setForm({...form, late_grace_minutes: parseInt(e.target.value)})} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
              <span className="text-xs text-gray-400">min</span>
            </div>
          </div>
        </div>
      </div>

      {/* Overtime rates */}
      <div className="bg-white rounded-xl border p-4 shadow-sm">
        <h3 className="font-medium text-gray-800 mb-4">Taux heures supplémentaires</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Majoration 25%" field="overtime_rate_25" step={0.05} unit="×" />
          <Field label="Majoration 50%" field="overtime_rate_50" step={0.05} unit="×" />
          <Field label="Majoration 100%" field="overtime_rate_100" step={0.05} unit="×" />
          <Field label="Nuit" field="night_shift_rate" step={0.05} unit="×" />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <Field label="Garde 12h" field="guard_12h_rate" step={0.05} unit="×" />
          <Field label="Garde 24h" field="guard_24h_rate" step={0.05} unit="×" />
        </div>
      </div>

      {/* Tax rules */}
      {data.taxRules && data.taxRules.length > 0 && (
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="font-medium text-gray-800 mb-4">Tranches IRG (impôt sur le revenu)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-2 px-3 text-xs text-gray-500">Nom</th>
                  <th className="text-right py-2 px-3 text-xs text-gray-500">Min (DZD)</th>
                  <th className="text-right py-2 px-3 text-xs text-gray-500">Max (DZD)</th>
                  <th className="text-right py-2 px-3 text-xs text-gray-500">Taux (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.taxRules.map(rule => (
                  <tr key={rule.id}>
                    <td className="py-2 px-3 text-gray-700">{rule.name}</td>
                    <td className="py-2 px-3 text-right">{parseFloat(rule.bracket_min).toLocaleString('fr-DZ')}</td>
                    <td className="py-2 px-3 text-right">{rule.bracket_max ? parseFloat(rule.bracket_max).toLocaleString('fr-DZ') : '∞'}</td>
                    <td className="py-2 px-3 text-right font-semibold">{(parseFloat(rule.rate) * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">Pour modifier les tranches IRG, contactez votre administrateur système.</p>
        </div>
      )}

      {/* SS rules */}
      {data.socialSecurityRules && data.socialSecurityRules.length > 0 && (
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="font-medium text-gray-800 mb-4">Cotisations sociales (CNAS)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-2 px-3 text-xs text-gray-500">Régime</th>
                  <th className="text-right py-2 px-3 text-xs text-gray-500">Part employé</th>
                  <th className="text-right py-2 px-3 text-xs text-gray-500">Part employeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.socialSecurityRules.map(rule => (
                  <tr key={rule.id}>
                    <td className="py-2 px-3 text-gray-700">{rule.name}</td>
                    <td className="py-2 px-3 text-right font-semibold">{(parseFloat(rule.employee_rate) * 100).toFixed(0)}%</td>
                    <td className="py-2 px-3 text-right">{(parseFloat(rule.employer_rate) * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Deduction methods */}
      <div className="bg-white rounded-xl border p-4 shadow-sm">
        <h3 className="font-medium text-gray-800 mb-4">Méthodes de calcul</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Retenue retard</label>
            <select value={form.late_deduction_method || 'pro_rata'} onChange={e => setForm({...form, late_deduction_method: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="pro_rata">Pro-rata (min travaillées)</option>
              <option value="none">Aucune retenue</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Retenue absence</label>
            <select value={form.absence_deduction_method || 'daily_rate'} onChange={e => setForm({...form, absence_deduction_method: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="daily_rate">Taux journalier</option>
              <option value="fixed">Montant fixe</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Devise</label>
            <input type="text" maxLength={3} value={form.currency || 'DZD'} onChange={e => setForm({...form, currency: e.target.value.toUpperCase()})} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Décimales d'arrondi</label>
            <input type="number" min={0} max={4} value={form.rounding_decimal ?? 2} onChange={e => setForm({...form, rounding_decimal: parseInt(e.target.value)})} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
