import { useLanguage } from "@/i18n";
import { Bed, Scissors, Droplets, Truck } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  useGetBloodBankSummary,
  useGetVehiclesStatus,
  useGetMedicationsLowStock,
} from "@workspace/api-client-react";
import { useMockRepository } from "@/store/MockRepository";

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

function SkeletonRow() {
  return (
    <div className="flex justify-between items-center py-0.5">
      <div className="h-2.5 bg-gray-100 rounded w-16 animate-pulse" />
      <div className="h-2.5 bg-gray-100 rounded w-6 animate-pulse" />
    </div>
  );
}

export function MiniWidgets() {
  const { t } = useLanguage();
  const repo = useMockRepository();

  // ── Ward bed stats derived from MockRepository (reflects live discharge/transfer) ──
  const wardBeds = repo.beds;
  const bedOccupied    = wardBeds.filter(b => b.status === 'occupe').length;
  const bedFree        = wardBeds.filter(b => b.status === 'disponible').length;
  const bedCleaning    = wardBeds.filter(b => b.status === 'nettoyage').length;
  const bedOOS         = wardBeds.filter(b => b.status === 'hors_service' || b.status === 'maintenance').length;
  const bedTotal       = wardBeds.length;
  const bedOccupancy   = bedTotal > 0 ? Math.round((bedOccupied / bedTotal) * 100) : 0;

  // ── Reanimation stats from ICU beds (unitName includes "Réanimation") ──
  const reaBeds    = repo.icuBeds.filter(b => b.unitName.includes('Réanimation'));
  const reaTotal   = reaBeds.length;
  const reaOccuped = reaBeds.filter(b => b.status === 'occupe').length;
  const reaFree    = reaBeds.filter(b => b.status === 'disponible').length;
  const reaPercent = reaTotal > 0 ? Math.round((reaOccuped / reaTotal) * 100) : 0;

  // ── OR stats from MockRepository ──
  const rooms         = repo.operatingRooms;
  const orTotal       = rooms.length;
  const orAvailable   = rooms.filter(r => r.status === 'libre').length;
  const orOccupied    = rooms.filter(r => r.status === 'en_intervention').length;
  const orPrep        = rooms.filter(r => r.status === 'en_preparation' || r.status === 'reserve').length;

  // ── API hooks for non-admission-related widgets ──
  const { data: blood }    = useGetBloodBankSummary({ query: { refetchInterval: 60_000 } });
  const { data: vehicles } = useGetVehiclesStatus({ query: { refetchInterval: 60_000 } });
  const { data: lowStock } = useGetMedicationsLowStock({ limit: 3 }, { query: { refetchInterval: 60_000 } });

  const bedsData = [
    { name: 'Occupés',      value: bedOccupied, color: '#3b82f6' },
    { name: 'Libres',       value: bedFree,      color: '#10b981' },
    { name: 'Nettoyage',    value: bedCleaning,  color: '#f97316' },
    { name: 'Hors service', value: bedOOS,        color: '#ef4444' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {/* Widget 1: Beds — live from MockRepository */}
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
              <span className="text-[10px] font-bold text-gray-900 leading-none">{bedOccupancy}%</span>
            </div>
          </div>
          <div className="w-[55%] flex flex-col justify-center">
            <StatRow label={t("widget.beds.occupied")}  value={bedOccupied}  colorClass="bg-blue-500" />
            <StatRow label={t("widget.beds.free")}      value={bedFree}       colorClass="bg-green-500" />
            <StatRow label={t("widget.beds.cleaning")}  value={bedCleaning}  colorClass="bg-orange-500" />
            <StatRow label={t("widget.beds.oos")}       value={bedOOS}        colorClass="bg-red-500" />
            <div className="mt-1 pt-1 border-t border-gray-100 text-[9px] text-center text-gray-500">
              {t("widget.beds.total")} {bedTotal}
            </div>
          </div>
        </div>
      </WidgetCard>

      {/* Widget 2: Resuscitation — live from MockRepository ICU beds */}
      <WidgetCard title={t("widget.resuscitation.title")}>
        <div className="flex items-start gap-3 h-full">
          <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center shrink-0 mt-1">
            <Bed className="w-4 h-4" />
          </div>
          <div className="flex-1 flex flex-col justify-center gap-0.5">
            <StatRow label={t("widget.resuscitation.total_beds")}     value={reaTotal} />
            <StatRow label={t("widget.beds.occupied")}                value={reaOccuped} />
            <StatRow label={t("widget.beds.free")}                    value={reaFree} />
            <StatRow label={t("widget.resuscitation.occupancy_rate")} value={`${reaPercent}%`} />
          </div>
        </div>
      </WidgetCard>

      {/* Widget 3: OR — live from MockRepository operating rooms */}
      <WidgetCard title={t("widget.or.title")}>
        <div className="flex items-start gap-3 h-full">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center shrink-0 mt-1">
            <Scissors className="w-4 h-4" />
          </div>
          <div className="flex-1 flex flex-col justify-center gap-0.5">
            <StatRow label={t("widget.or.total_rooms")} value={orTotal} />
            <StatRow label={t("widget.or.available")}   value={orAvailable} />
            <StatRow label={t("widget.or.occupied")}    value={orOccupied} />
            <StatRow label={t("widget.or.prep")}        value={orPrep} />
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
            {blood ? (
              <>
                <StatRow label={t("widget.blood.total_bags")}      value={blood.totalBags} />
                <StatRow label={t("widget.blood.available")}       value={blood.available} />
                <StatRow label={t("widget.blood.urgent_requests")} value={blood.urgentRequests} />
                <StatRow label={t("widget.blood.expiring")}        value={blood.expiringSoon} />
              </>
            ) : (
              <><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
            )}
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
            {vehicles ? (
              <>
                <StatRow label={t("widget.ambulances.total")}       value={vehicles.total} />
                <StatRow label={t("widget.ambulances.in_service")}  value={vehicles.inService} />
                <StatRow label={t("widget.ambulances.available")}   value={vehicles.available} />
                <StatRow label={t("widget.ambulances.maintenance")} value={vehicles.maintenance} />
              </>
            ) : (
              <><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
            )}
          </div>
        </div>
      </WidgetCard>

      {/* Widget 6: Stock — live low-stock data */}
      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 flex flex-col h-[130px]">
        <div className="flex justify-between items-center mb-2 shrink-0">
          <h4 className="text-[11px] font-bold text-gray-900 truncate pr-2">{t("widget.stock.title")}</h4>
          <Link href="/stock" className="text-[9px] text-blue-500 hover:underline shrink-0">
            {t("widget.stock.view_all")}
          </Link>
        </div>
        <div className="flex-1 flex flex-col justify-center gap-1.5 overflow-hidden">
          {lowStock ? (
            !Array.isArray(lowStock.items) || lowStock.items.length === 0 ? (
              <p className="text-[10px] text-gray-400 text-center">{t("widget.stock.all_ok")}</p>
            ) : (
              lowStock.items.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-[10px]">
                  <span className={cn(
                    "truncate mr-2",
                    item.status === "critical" ? "text-red-600 font-medium" :
                    item.status === "expired"  ? "text-orange-600 font-medium" :
                    "text-gray-600"
                  )}>{item.name}</span>
                  <span className="font-medium whitespace-nowrap text-gray-900">
                    {item.quantity} <span className="text-gray-400 font-normal">{item.unit}</span>
                  </span>
                </div>
              ))
            )
          ) : (
            <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
          )}
        </div>
      </div>
    </div>
  );
}
