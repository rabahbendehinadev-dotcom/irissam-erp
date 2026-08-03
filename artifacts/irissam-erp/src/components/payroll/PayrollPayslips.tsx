import { useState, useEffect } from 'react';
import { payrollApi, MONTH_NAMES_FR, formatAmount, type Payslip } from '@/services/api/payroll';
import { FileText, Download, RefreshCw } from 'lucide-react';

export default function PayrollPayslips() {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ search: '' });

  const load = () => {
    setLoading(true);
    payrollApi.getPayslips({ limit: 100 })
      .then(r => setPayslips(Array.isArray(r?.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = payslips.filter(p =>
    !filter.search || `${p.last_name} ${p.first_name} ${p.matricule} ${p.payslip_number}`.toLowerCase().includes(filter.search.toLowerCase()),
  );

  const openPdf = (id: string) => {
    window.open(`/api/payroll/payslips/${id}/pdf`, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-gray-900">Bulletins de paie</h2>
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Rechercher employé, matricule..."
            value={filter.search}
            onChange={e => setFilter({...filter, search: e.target.value})}
            className="border rounded-lg px-3 py-2 text-sm w-60"
          />
          <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Aucun bulletin trouvé</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 text-xs text-gray-500 font-medium">N° Bulletin</th>
                <th className="text-left py-3 px-4 text-xs text-gray-500 font-medium">Employé</th>
                <th className="text-left py-3 px-4 text-xs text-gray-500 font-medium hidden sm:table-cell">Période</th>
                <th className="text-right py-3 px-4 text-xs text-gray-500 font-medium">Brut</th>
                <th className="text-right py-3 px-4 text-xs text-gray-500 font-medium">Net</th>
                <th className="text-center py-3 px-4 text-xs text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(slip => (
                <tr key={slip.id} className="hover:bg-gray-50">
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="font-mono text-xs text-gray-700">{slip.payslip_number}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-gray-900">{slip.last_name} {slip.first_name}</div>
                    <div className="text-xs text-gray-400">{slip.matricule}</div>
                  </td>
                  <td className="py-2.5 px-4 hidden sm:table-cell text-gray-600">
                    {slip.month ? `${MONTH_NAMES_FR[slip.month-1]} ${slip.year}` : slip.period_label}
                  </td>
                  <td className="py-2.5 px-4 text-right text-gray-700">{formatAmount(slip.brut)}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-green-700">{formatAmount(slip.net)}</td>
                  <td className="py-2.5 px-4 text-center">
                    <button onClick={() => openPdf(slip.id)} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                      <Download className="w-3 h-3" /> PDF
                    </button>
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
