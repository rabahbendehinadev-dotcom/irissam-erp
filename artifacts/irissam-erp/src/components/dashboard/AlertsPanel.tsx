import { AlertTriangle, Package, Clock, ArrowRight } from "lucide-react";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const alerts = [
  {
    id: 1,
    type: 'critical',
    title: "Résultat d'analyse critique",
    detail: "Patient : Fatima Zahra – Potassium élevé",
    time: "10:15",
    icon: AlertTriangle,
    bg: "bg-red-100",
    color: "text-red-500"
  },
  {
    id: 2,
    type: 'warning',
    title: "Stock faible",
    detail: "Paracétamol 1G – 15 unités restantes",
    time: "09:45",
    icon: Package,
    bg: "bg-orange-100",
    color: "text-orange-500"
  },
  {
    id: 3,
    type: 'warning',
    title: "Médicament proche péremption",
    detail: "Amoxicilline 500mg – Expire le 20/05/2024",
    time: "09:30",
    icon: AlertTriangle,
    bg: "bg-orange-100",
    color: "text-orange-500"
  },
  {
    id: 4,
    type: 'critical',
    title: "Service de réanimation indisponible",
    detail: "Service Réanimation – Capacité 100%",
    time: "09:20",
    icon: AlertTriangle,
    bg: "bg-red-100",
    color: "text-red-500"
  },
  {
    id: 5,
    type: 'info',
    title: "Intervention en retard",
    detail: "Bloc 2 – Début prévu à 09:00",
    time: "09:10",
    icon: Clock,
    bg: "bg-red-50",
    color: "text-red-400"
  }
];

export function AlertsPanel() {
  const { t } = useLanguage();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-bold text-sm text-gray-900">{t("alerts.title")}</h3>
        <Link href="/alerts" className="text-xs text-blue-500 hover:underline">
          {t("alerts.view_all")}
        </Link>
      </div>
      
      <div className="flex-1 p-2 flex flex-col gap-1">
        {alerts.map(alert => (
          <div key={alert.id} className="flex gap-3 p-2 hover:bg-gray-50 rounded-md transition-colors">
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5", alert.bg, alert.color)}>
              <alert.icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-gray-900 truncate">{alert.title}</h4>
              <p className="text-[11px] text-gray-500 truncate">{alert.detail}</p>
            </div>
            <div className="text-[10px] text-gray-400 whitespace-nowrap pt-0.5">
              {alert.time}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-gray-100 text-center">
        <Link href="/alerts" className="text-xs font-medium text-blue-500 hover:underline inline-flex items-center gap-1">
          {t("alerts.view_all_arrow")}
        </Link>
      </div>
    </div>
  );
}