import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from "@/i18n";
import { ChevronDown } from 'lucide-react';

const data = [
  { name: '08 Mai', consultations: 340, rendezVous: 180 },
  { name: '09 Mai', consultations: 380, rendezVous: 200 },
  { name: '10 Mai', consultations: 420, rendezVous: 230 },
  { name: '11 Mai', consultations: 350, rendezVous: 190 },
  { name: '12 Mai', consultations: 430, rendezVous: 250 },
  { name: '13 Mai', consultations: 460, rendezVous: 280 },
  { name: '14 Mai', consultations: 312, rendezVous: 266 },
];

export function ChartConsultations() {
  const { t } = useLanguage();

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-sm text-gray-900">{t("chart.consultations.title")}</h3>
        <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900">
          {t("chart.filter.7days")} <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      <div className="flex items-center gap-4 mb-4 text-xs font-medium text-gray-600">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          {t("chart.consultations.legend1")}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          {t("chart.consultations.legend2")}
        </div>
      </div>

      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 500]} ticks={[0, 100, 200, 300, 400, 500]} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              itemStyle={{ fontSize: '12px' }}
              labelStyle={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}
            />
            <Line type="monotone" dataKey="consultations" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="rendezVous" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}