import { useEffect, useState } from 'react';
import { execApi, ExecFilters } from '@/services/api/executive-dashboard';
import { DrillTarget } from '@/pages/ExecutiveDashboard';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, UserCheck, UserX, Clock, FileWarning, AlertTriangle } from 'lucide-react';

export default function ExecHR({ filters, onDrill }: { filters: ExecFilters; onDrill: (t: DrillTarget) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setErr(false);
    execApi.hr(filters)
      .then((r: any) => setData(r))
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  }, [filters, retryKey]);

  if (loading && !data) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (err) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
      <AlertTriangle className="w-10 h-10 text-red-300" />
      <p className="text-sm">Erreur de chargement — Ressources humaines</p>
      <button onClick={() => setRetryKey(k => k + 1)} className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded hover:bg-slate-700 transition-colors">Réessayer</button>
    </div>
  );
  if (!data) return null;

  const wf = data.workforce ?? {};
  const byDay = (data.attendanceByDay ?? []).map((r: any) => ({
    day: String(r.day).slice(5),
    present: Number(r.present), absent: Number(r.absent), late: Number(r.late),
  }));
  const byCat = (data.byCategory ?? []).map((r: any) => ({ name: r.category ?? 'N/A', val: Number(r.active) }));

  return (
    <div className="p-4 space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <HRCard label="Effectif total"      value={wf.total    ?? 0} icon={<UserCheck className="w-5 h-5 text-blue-600"   />} color="bg-blue-50" />
        <HRCard label="Actifs"              value={wf.active   ?? 0} icon={<UserCheck className="w-5 h-5 text-green-600"  />} color="bg-green-50" />
        <HRCard label="Absents aujourd'hui" value={wf.onLeave  ?? 0} icon={<UserX     className="w-5 h-5 text-amber-600"  />} color="bg-amber-50"
          onClick={() => onDrill({ metric:'personnel_absent', label:'Personnel absent' })} />
        <HRCard label="Contrats expirant"   value={(data.contractsExpiring ?? []).length} icon={<FileWarning className="w-5 h-5 text-red-600" />} color="bg-red-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Présence/Absence par jour */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Présence / Absence par jour</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byDay}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="present" stackId="a" fill="#10b981" name="Présents" />
              <Bar dataKey="absent"  stackId="a" fill="#ef4444" name="Absents"  radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Retards par jour */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Retards par jour</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={byDay}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2} dot={false} name="Retards" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Par catégorie */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Effectif actif par catégorie</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byCat} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
              <Tooltip />
              <Bar dataKey="val" fill="#3b82f6" name="Actifs" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Services sous-effectif */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Services sous-effectif <span className="text-red-500">({(data.underStaffedDepts ?? []).length})</span>
          </h3>
          {(data.underStaffedDepts ?? []).length === 0
            ? <p className="text-sm text-gray-400">Aucun service sous-effectif ✓</p>
            : <div className="space-y-2 overflow-auto max-h-44">
                {(data.underStaffedDepts ?? []).map((r: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="text-xs text-gray-600 w-24 truncate">{r.department ?? 'N/A'}</div>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${r.rate ?? 0}%` }} />
                    </div>
                    <div className="text-xs font-bold text-red-600 w-10 text-right">{r.rate}%</div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      {/* Contrats expirant */}
      {(data.contractsExpiring ?? []).length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-orange-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <FileWarning className="w-4 h-4 text-orange-500" /> Contrats expirant dans 60 jours
          </h3>
          <div className="overflow-auto max-h-48">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50">
                <th className="text-left px-2 py-1.5 text-gray-500">Employé</th>
                <th className="text-left px-2 py-1.5 text-gray-500">Type</th>
                <th className="text-right px-2 py-1.5 text-gray-500">Échéance</th>
                <th className="text-right px-2 py-1.5 text-gray-500">Jours restants</th>
              </tr></thead>
              <tbody>{(data.contractsExpiring ?? []).map((r: any, i: number) => (
                <tr key={i} className="border-t border-gray-50">
                  <td className="px-2 py-1.5 font-medium">{r.employee}</td>
                  <td className="px-2 py-1.5 text-gray-500">{r.type}</td>
                  <td className="px-2 py-1.5 text-right">{r.end_date ? new Date(r.end_date).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className={`px-2 py-1.5 text-right font-bold ${(r.days_left ?? 99) <= 14 ? 'text-red-600' : 'text-orange-500'}`}>{r.days_left}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function HRCard({ label, value, icon, color, onClick }: { label: string; value: number; icon: React.ReactNode; color: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-left w-full hover:shadow-md transition-all ${onClick ? 'cursor-pointer' : 'cursor-default'}`}>
      <div className={`inline-flex p-2 rounded-lg mb-2 ${color}`}>{icon}</div>
      <div className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </button>
  );
}
