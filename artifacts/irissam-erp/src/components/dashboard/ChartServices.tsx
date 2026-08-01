import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useLanguage } from "@/i18n";
import { ChevronDown } from 'lucide-react';
import { useGetServicesChart } from "@workspace/api-client-react";

const SERVICE_COLORS: Record<string, string> = {
  "Médecine interne": "#3b82f6",
  "Chirurgie": "#06b6d4",
  "Pédiatrie": "#10b981",
  "Gynécologie": "#8b5cf6",
  "Cardiologie": "#f97316",
  "Urgences": "#ef4444",
  "Réanimation": "#f59e0b",
  "Neurologie": "#6366f1",
  "Orthopédie": "#14b8a6",
  "Pneumologie": "#84cc16",
};
const FALLBACK_COLORS = ["#3b82f6", "#06b6d4", "#10b981", "#8b5cf6", "#f97316", "#ef4444", "#94a3b8"];

export function ChartServices() {
  const { t } = useLanguage();
  const { data: rawData, isLoading } = useGetServicesChart();

  const total = rawData?.reduce((sum, d) => sum + d.value, 0) ?? 1;
  const data = (rawData ?? []).map((d, i) => ({
    ...d,
    color: SERVICE_COLORS[d.name] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    percent: Math.round((d.value / total) * 100),
  }));

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm text-gray-900">{t("chart.services.title")}</h3>
        <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900">
          {t("chart.filter.this_month")} <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1 flex items-center min-h-[200px]">
        {isLoading ? (
          <div className="w-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="w-[50%] h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                    itemStyle={{ color: '#1e293b' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="w-[50%] pl-2">
              <ul className="space-y-1.5">
                {data.map((item, index) => (
                  <li key={index} className="flex items-center justify-between text-[10px] xl:text-[11px]">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }}></div>
                      <span className="text-gray-700 truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <span className="font-medium text-gray-900">{item.percent}%</span>
                      <span className="text-gray-400">({item.value})</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
