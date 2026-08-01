import { useLanguage } from "@/i18n";
import { Bed, HeartPulse, Scissors, Droplets, Truck, Package } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Link } from "wouter";
import { cn } from "@/lib/utils";

function WidgetCard({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 flex flex-col h-[130px]">
      <h4 className="text-[11px] font-bold text-gray-900 mb-2 shrink-0">{title}</h4>
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}

function StatRow({ label, value, colorClass }: { label: string, value: string | number, colorClass?: string }) {
  return (
    <div className="flex justify-between items-center text-[10px] py-0.5">
      <span className="text-gray-500 flex items-center gap-1.5">
        {colorClass && <span className={cn("w-1.5 h-1.5 rounded-full", colorClass)} />}
        {label}
      </span>
      <span className="font-bold text-gray-900">{value}</span>
    </div>
  );
}

export function MiniWidgets() {
  const { t } = useLanguage();

  const bedsData = [
    { name: 'Occupés', value: 312, color: '#3b82f6' },
    { name: 'Libres', value: 88, color: '#10b981' },
    { name: 'Nettoyage', value: 15, color: '#f97316' },
    { name: 'Hors service', value: 5, color: '#ef4444' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {/* Widget 1: Beds */}
      <WidgetCard title={t("widget.beds.title")}>
        <div className="flex h-full items-center">
          <div className="w-[45%] h-[70px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={bedsData} cx="50%" cy="50%" innerRadius={22} outerRadius={32} dataKey="value" stroke="none">
                  {bedsData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-[10px] font-bold text-gray-900 leading-none">78%</span>
            </div>
          </div>
          <div className="w-[55%] flex flex-col justify-center">
            <StatRow label={t("widget.beds.occupied")} value="312" colorClass="bg-blue-500" />
            <StatRow label={t("widget.beds.free")} value="88" colorClass="bg-green-500" />
            <StatRow label={t("widget.beds.cleaning")} value="15" colorClass="bg-orange-500" />
            <StatRow label={t("widget.beds.oos")} value="5" colorClass="bg-red-500" />
            <div className="mt-1 pt-1 border-t border-gray-100 text-[9px] text-center text-gray-500">
              {t("widget.beds.total")} 420
            </div>
          </div>
        </div>
      </WidgetCard>

      {/* Widget 2: Resuscitation */}
      <WidgetCard title={t("widget.resuscitation.title")}>
        <div className="flex items-start gap-3 h-full">
          <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center shrink-0 mt-1">
            <Bed className="w-4 h-4" />
          </div>
          <div className="flex-1 flex flex-col justify-center gap-0.5">
            <StatRow label={t("widget.resuscitation.total_beds")} value="24" />
            <StatRow label={t("widget.beds.occupied")} value="20" />
            <StatRow label={t("widget.beds.free")} value="3" />
            <StatRow label={t("widget.resuscitation.occupancy_rate")} value="83%" />
          </div>
        </div>
      </WidgetCard>

      {/* Widget 3: OR */}
      <WidgetCard title={t("widget.or.title")}>
        <div className="flex items-start gap-3 h-full">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center shrink-0 mt-1">
            <Scissors className="w-4 h-4" />
          </div>
          <div className="flex-1 flex flex-col justify-center gap-0.5">
            <StatRow label={t("widget.or.total_rooms")} value="8" />
            <StatRow label={t("widget.or.available")} value="5" />
            <StatRow label={t("widget.or.occupied")} value="2" />
            <StatRow label={t("widget.or.prep")} value="1" />
          </div>
        </div>
      </WidgetCard>

      {/* Widget 4: Blood Bank */}
      <WidgetCard title={t("widget.blood.title")}>
        <div className="flex items-start gap-3 h-full">
          <div className="w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center shrink-0 mt-1">
            <Droplets className="w-4 h-4" />
          </div>
          <div className="flex-1 flex flex-col justify-center gap-0.5">
            <StatRow label={t("widget.blood.total_bags")} value="156" />
            <StatRow label={t("widget.blood.available")} value="100" />
            <StatRow label={t("widget.blood.urgent_requests")} value="8" />
            <StatRow label={t("widget.blood.expiring")} value="12" />
          </div>
        </div>
      </WidgetCard>

      {/* Widget 5: Ambulances */}
      <WidgetCard title={t("widget.ambulances.title")}>
        <div className="flex items-start gap-3 h-full">
          <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center shrink-0 mt-1">
            <Truck className="w-4 h-4" />
          </div>
          <div className="flex-1 flex flex-col justify-center gap-0.5">
            <StatRow label={t("widget.ambulances.total")} value="12" />
            <StatRow label={t("widget.ambulances.in_service")} value="6" />
            <StatRow label={t("widget.ambulances.available")} value="4" />
            <StatRow label={t("widget.ambulances.maintenance")} value="2" />
          </div>
        </div>
      </WidgetCard>

      {/* Widget 6: Stock */}
      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 flex flex-col h-[130px]">
        <div className="flex justify-between items-center mb-2 shrink-0">
          <h4 className="text-[11px] font-bold text-gray-900 truncate pr-2">{t("widget.stock.title")}</h4>
          <Link href="/stock" className="text-[9px] text-blue-500 hover:underline shrink-0">
            {t("widget.stock.view_all")}
          </Link>
        </div>
        <div className="flex-1 flex flex-col justify-center gap-1.5 overflow-hidden">
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-gray-600 truncate mr-2">Paracétamol 1G</span>
            <span className="text-gray-900 font-medium whitespace-nowrap">15 <span className="text-gray-400 font-normal">{t("widget.stock.units")}</span></span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-gray-600 truncate mr-2">Amoxicilline 500mg</span>
            <span className="text-gray-900 font-medium whitespace-nowrap">20 <span className="text-gray-400 font-normal">{t("widget.stock.units")}</span></span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-gray-600 truncate mr-2">Sérum physiologique 250ml</span>
            <span className="text-gray-900 font-medium whitespace-nowrap">18 <span className="text-gray-400 font-normal">{t("widget.stock.units")}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}