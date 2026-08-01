import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from "@/i18n";
import { ChevronDown } from 'lucide-react';

const data = [
  { name: '08 Mai', admissions: 18, sorties: 15 },
  { name: '09 Mai', admissions: 25, sorties: 20 },
  { name: '10 Mai', admissions: 22, sorties: 18 },
  { name: '11 Mai', admissions: 30, sorties: 25 },
  { name: '12 Mai', admissions: 28, sorties: 22 },
  { name: '13 Mai', admissions: 24, sorties: 19 },
  { name: '14 Mai', admissions: 20, sorties: 17 },
];

export function ChartAdmissions() {
  const { t } = useLanguage();

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-sm text-gray-900">{t("chart.admissions.title")}</h3>
        <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900">
          {t("chart.filter.7days")} <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      <div className="flex items-center gap-4 mb-4 text-xs font-medium text-gray-600">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          {t("chart.admissions.legend1")}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          {t("chart.admissions.legend2")}
        </div>
      </div>

      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barGap={2} barSize={8}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 80]} ticks={[0, 20, 40, 60, 80]} />
            <Tooltip 
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              itemStyle={{ fontSize: '12px' }}
              labelStyle={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}
            />
            <Bar dataKey="admissions" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            <Bar dataKey="sorties" fill="#10b981" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}