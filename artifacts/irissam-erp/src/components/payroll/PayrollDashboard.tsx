import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { payrollApi, PAYROLL_STATUS_LABELS, PAYROLL_STATUS_COLORS, MONTH_NAMES_FR, formatAmount, type PayrollDashboard } from '@/services/api/payroll';
import { TrendingUp, TrendingDown, Users, AlertTriangle, Banknote, CreditCard, ArrowUpCircle, Minus } from 'lucide-react';

const DEPT_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16'];

export default function PayrollDashboardTab() {
  const [data, setData] = useState<PayrollDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    payrollApi.getDashboard(year)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-32 bg-gray-100 rounded-xl"/><div className="h-64 bg-gray-100 rounded-xl"/></div>;
  if (error)   return <div className="p-6 bg-red-50 text-red-700 rounded-xl">{error}</div>;
  if (!data)   return null;

  const { kpis, charts, latestRun, anomalies, activeAdvances, activeLoans } = data;
  const variationNum = parseFloat(kpis.variation_vs_previous || '0');
  const VariationIcon = variationNum > 0 ? TrendingUp : variationNum < 0 ? TrendingDown : Minus;
  const variationColor = variationNum > 0 ? 'text-green-600' : variationNum < 0 ? 'text-red-600' : 'text-gray-500';

  const kpiCards = [
    { label: 'Masse salariale nette', value: formatAmount(kpis.total_net), icon: Banknote, color: 'text-blue-600', bg: 'bg-blue-50', sub: kpis.variation_vs_previous ? `${variationNum > 0 ? '+' : ''}${kpis.variation_vs_previous}% vs mois préc.` : '' },
    { label: 'Salaire brut total', value: formatAmount(kpis.total_brut), icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50', sub: '' },
    { label: 'Employés payés', value: kpis.total_employees?.toString() || '0', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: '' },
    { label: 'Anomalies critiques', value: String(kpis.total_critical_anomalies || anomalies?.critical || 0), icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', sub: `${anomalies?.warning || 0} avertissements` },
    { label: 'Avances en cours', value: formatAmount(activeAdvances?.balance), icon: ArrowUpCircle, color: 'text-orange-600', bg: 'bg-orange-50', sub: `${activeAdvances?.count || 0} dossiers` },
    { label: 'Prêts actifs', value: formatAmount(activeLoans?.balance), icon: CreditCard, color: 'text-teal-600', bg: 'bg-teal-50', sub: `${activeLoans?.count || 0} dossiers` },
  ];

  return (
    <div className="space-y-6">
      {/* Period selector + status */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          {latestRun && (
            <span className="text-sm text-gray-600">
              Dernière paie : <strong>{MONTH_NAMES_FR[(latestRun.month || 1) - 1]} {latestRun.year}</strong>
              {' '}<span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PAYROLL_STATUS_COLORS[latestRun.status]}`}>
                {PAYROLL_STATUS_LABELS[latestRun.status]}
              </span>
            </span>
          )}
        </div>
        <select
          value={year}
          onChange={e => setYear(parseInt(e.target.value))}
          className="border rounded-lg px-3 py-1.5 text-sm"
        >
          {[0,1,2].map(i => <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>)}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center mb-2`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div className="text-xl font-bold text-gray-900 truncate">{card.value}</div>
            <div className="text-xs text-gray-500 mt-0.5 leading-tight">{card.label}</div>
            {card.sub && <div className={`text-xs mt-1 font-medium ${card.label.includes('variation') ? variationColor : 'text-gray-400'}`}>{card.sub}</div>}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly salary */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4 text-sm">Masse salariale mensuelle {year}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={charts.monthlySalary.map(d => ({ ...d, mois: MONTH_NAMES_FR[d.month - 1]?.slice(0,3) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (v/1000).toFixed(0)+'k'} />
              <Tooltip formatter={(v: any) => formatAmount(v)} />
              <Bar dataKey="total_brut" name="Brut" fill="#8b5cf6" radius={[3,3,0,0]} />
              <Bar dataKey="total_net"  name="Net"  fill="#3b82f6" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By department */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4 text-sm">Répartition par département</h3>
          {charts.byDepartment.length === 0
            ? <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Aucune donnée</div>
            : <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={charts.byDepartment} dataKey="total_net" nameKey="department" cx="50%" cy="50%" outerRadius={80} label={({ department, percent }) => `${department?.slice(0,8)} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {charts.byDepartment.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatAmount(v)} />
                </PieChart>
              </ResponsiveContainer>
          }
        </div>
      </div>

      {/* Latest run detail */}
      {latestRun && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3 text-sm">Dernière paie — détail financier</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {[
              { label: 'Total gains', value: formatAmount(kpis.total_earnings) },
              { label: 'Total retenues', value: formatAmount(kpis.total_deductions) },
              { label: 'Cotisations CNAS', value: formatAmount(kpis.total_social_sec) },
              { label: 'IRG (impôt)', value: formatAmount(kpis.total_tax) },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500">{item.label}</div>
                <div className="font-semibold text-gray-900 mt-0.5">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
