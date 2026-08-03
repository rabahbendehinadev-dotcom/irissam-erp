import { useEffect, useState } from 'react';
import { execApi, ExecFilters } from '@/services/api/executive-dashboard';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Loader2 } from 'lucide-react';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

export default function ExecMedical({ filters }: { filters: ExecFilters }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    execApi.medical(filters)
      .then((r: any) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters]);

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!data) return null;

  const admByDay = (data.admissionsByDay ?? []).map((r: any) => ({ day: String(r.day).slice(5), val: Number(r.count) }));
  const consultSvc = (data.consultationsByService ?? []).slice(0,8).map((r: any) => ({ name: r.service ?? 'N/A', val: Number(r.count) }));
  const urgPriority = (data.urgencesByPriority ?? []).map((r: any) => ({ name: `P${r.priority}`, val: Number(r.count) }));
  const topDiag = (data.topDiagnoses ?? []).slice(0,8).map((r: any) => ({ name: (r.diagnosis_label ?? r.diagnosis_code ?? 'N/A').slice(0,20), val: Number(r.count) }));

  return (
    <div className="p-4 space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="DMS (jours)" value={data.avgLengthOfStay ?? 0} />
        <StatCard label="Services actifs" value={(data.topServices ?? []).length} />
        <StatCard label="Admissions période" value={(data.admissionsByDay ?? []).reduce((s: number, r: any) => s + Number(r.count), 0)} />
        <StatCard label="Consultations" value={(data.consultationsByService ?? []).reduce((s: number, r: any) => s + Number(r.count), 0)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Admissions par jour */}
        <ChartCard title="Admissions par jour">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={admByDay}>
              <XAxis dataKey="day" tick={{ fontSize:10 }} />
              <YAxis tick={{ fontSize:10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="val" stroke="#3b82f6" strokeWidth={2} dot={false} name="Admissions" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Consultations par service */}
        <ChartCard title="Consultations par service">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={consultSvc} layout="vertical">
              <XAxis type="number" tick={{ fontSize:10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize:10 }} width={80} />
              <Tooltip />
              <Bar dataKey="val" fill="#10b981" name="Consultations" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Urgences par priorité */}
        <ChartCard title="Urgences par priorité">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={urgPriority} dataKey="val" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, val }) => `${name}: ${val}`}>
                {urgPriority.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top diagnostics */}
        <ChartCard title="Top diagnostics">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topDiag} layout="vertical">
              <XAxis type="number" tick={{ fontSize:10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize:10 }} width={110} />
              <Tooltip />
              <Bar dataKey="val" fill="#8b5cf6" name="Cas" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="text-2xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {children}
    </div>
  );
}
