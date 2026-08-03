import { useEffect, useState } from 'react';
import { execApi, ExecFilters } from '@/services/api/executive-dashboard';
import { DrillTarget } from '@/pages/ExecutiveDashboard';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Loader2 } from 'lucide-react';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n/1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

export default function ExecFinance({ filters, onDrill }: { filters: ExecFilters; onDrill: (t: DrillTarget) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    execApi.finance(filters)
      .then((r: any) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters]);

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!data) return null;

  const revByMonth = (data.revenueByMonth ?? []).map((r: any) => ({
    month: String(r.month).slice(0, 7),
    revenue: Number(r.revenue), paid: Number(r.paid), unpaid: Number(r.unpaid),
  }));
  const payMethods = (data.paymentsByMethod ?? []).map((r: any) => ({ name: r.method ?? 'N/A', value: Number(r.total) }));
  const unpaidAge  = (data.unpaidByAge   ?? []).map((r: any) => ({ name: r.bucket, count: Number(r.count), amount: Number(r.amount) }));
  const ins = data.insuranceSplit ?? {};

  return (
    <div className="p-4 space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l:'Revenus période', v: fmt(revByMonth.reduce((s: number, r: any) => s + r.revenue, 0)) + ' DZD' },
          { l:'Part patient',   v: fmt(ins.patientShare ?? 0) + ' DZD' },
          { l:'Part assurance', v: fmt(ins.insurerShare ?? 0) + ' DZD' },
          { l:'CNAS',           v: fmt(ins.cnas         ?? 0) + ' DZD' },
        ].map((k,i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-xl font-bold text-gray-900">{k.v}</div>
            <div className="text-xs text-gray-500 mt-1">{k.l}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue trend */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Évolution mensuelle du CA</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revByMonth}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmt(v)} />
              <Tooltip formatter={(v: any) => `${fmt(Number(v))} DZD`} />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#bfdbfe" strokeWidth={2} name="CA" />
              <Area type="monotone" dataKey="paid"    stroke="#10b981" fill="#d1fae5" strokeWidth={2} name="Encaissé" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Payment methods pie */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Répartition par mode de paiement</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={payMethods} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {payMethods.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Unpaid by age */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer"
          onClick={() => onDrill({ metric:'reste_a_recouvrer', label:'Factures impayées' })}>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Impayés par ancienneté <span className="text-xs text-gray-400">(cliquer pour détails)</span></h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={unpaidAge}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmt(v)} />
              <Tooltip formatter={(v: any) => `${fmt(Number(v))} DZD`} />
              <Bar dataKey="amount" fill="#ef4444" name="Montant" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Insurance split */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Répartition assurance</h3>
          <div className="space-y-2 mt-2">
            {[
              { label: 'Part patient',  value: ins.patientShare ?? 0, color: 'bg-blue-500' },
              { label: 'CNAS',          value: ins.cnas         ?? 0, color: 'bg-green-500' },
              { label: 'CASNOS',        value: ins.casnos       ?? 0, color: 'bg-teal-500' },
              { label: 'Autre assurance',value:ins.otherInsurer  ?? 0, color: 'bg-purple-500' },
            ].map((row, i) => {
              const pct = (ins.total ?? 0) > 0 ? (row.value / ins.total * 100).toFixed(1) : '0';
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{row.label}</span>
                    <span className="font-medium">{fmt(row.value)} DZD ({pct}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full">
                    <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
