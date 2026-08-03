import { useState, useEffect } from 'react';
import { payrollApi, MONTH_NAMES_FR, formatAmount } from '@/services/api/payroll';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download } from 'lucide-react';

export default function PayrollReports() {
  const [type, setType] = useState('summary');
  const [year, setYear] = useState(new Date().getFullYear());
  const [runs, setRuns] = useState<any[]>([]);
  const [runId, setRunId] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    payrollApi.getRuns({ limit: 50 }).then(r => {
      const d = Array.isArray(r?.data) ? r.data : [];
      setRuns(d);
      if (d.length > 0) setRunId(d[0].id);
    }).catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    payrollApi.getReports({ type, year, runId })
      .then(r => setData(Array.isArray(r?.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [type, year, runId]);

  const REPORT_TYPES = [
    { id: 'summary',       label: 'Résumé annuel' },
    { id: 'by_dept',       label: 'Par département' },
    { id: 'overtime',      label: 'Heures supplémentaires' },
    { id: 'advances_loans', label: 'Avances & Prêts' },
  ];

  const exportCsv = () => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + headers + '\n' + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `rapport-paie-${type}-${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-gray-900">Rapports paie</h2>
        <button onClick={exportCsv} className="flex items-center gap-1 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
          <Download className="w-4 h-4" /> Exporter CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {REPORT_TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${type === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="border rounded-lg px-3 py-1.5 text-sm">
          {[0,1,2].map(i => <option key={i} value={new Date().getFullYear()-i}>{new Date().getFullYear()-i}</option>)}
        </select>
        {['by_dept','overtime','advances_loans'].includes(type) && (
          <select value={runId} onChange={e => setRunId(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
            {runs.map(r => <option key={r.id} value={r.id}>{r.month ? `${MONTH_NAMES_FR[(r.month||1)-1]} ${r.year}` : r.id.slice(0,8)}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse"/>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Aucune donnée disponible</div>
      ) : type === 'summary' ? (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Masse salariale {year}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.map(d => ({ ...d, mois: MONTH_NAMES_FR[(d.month||1)-1]?.slice(0,3) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (v/1000).toFixed(0)+'k'} />
                <Tooltip formatter={(v: any) => formatAmount(v)} />
                <Bar dataKey="total_brut" name="Brut" fill="#8b5cf6" radius={[3,3,0,0]} />
                <Bar dataKey="total_net"  name="Net"  fill="#3b82f6" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Mois','Employés','Brut','Net','Cotisations','IRG','Avances','Prêts','Statut'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-xs text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium">{MONTH_NAMES_FR[(row.month||1)-1]}</td>
                    <td className="py-2 px-3 text-gray-600">{row.total_employees}</td>
                    <td className="py-2 px-3">{formatAmount(row.total_brut)}</td>
                    <td className="py-2 px-3 font-semibold text-green-700">{formatAmount(row.total_net)}</td>
                    <td className="py-2 px-3 text-gray-500">{formatAmount(row.total_social_sec)}</td>
                    <td className="py-2 px-3 text-gray-500">{formatAmount(row.total_tax)}</td>
                    <td className="py-2 px-3 text-orange-600">{formatAmount(row.total_advances)}</td>
                    <td className="py-2 px-3 text-teal-600">{formatAmount(row.total_loans)}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${row.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {Object.keys(data[0]).map(k => (
                  <th key={k} className="text-left py-2 px-3 text-xs text-gray-500 font-medium capitalize">{k.replace(/_/g,' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {Object.values(row).map((v: any, j) => (
                    <td key={j} className="py-2 px-3 text-gray-700 text-xs">{typeof v === 'number' && v > 1000 ? formatAmount(v) : String(v ?? '—')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
