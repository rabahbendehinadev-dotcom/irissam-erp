import { AlertTriangle, Package, Clock, ArrowRight } from "lucide-react";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { useGetAlerts } from "@workspace/api-client-react";

function getAlertStyle(type: string) {
  switch (type) {
    case "critical":
      return { Icon: AlertTriangle, bg: "bg-red-100", color: "text-red-500" };
    case "warning":
      return { Icon: Package, bg: "bg-orange-100", color: "text-orange-500" };
    default:
      return { Icon: Clock, bg: "bg-red-50", color: "text-red-400" };
  }
}

function fmtTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function AlertsPanel() {
  const { t } = useLanguage();
  const { data: alerts, isLoading } = useGetAlerts();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-bold text-sm text-gray-900">{t("alerts.title")}</h3>
        <Link href="/alerts" className="text-xs text-blue-500 hover:underline">
          {t("alerts.view_all")}
        </Link>
      </div>
      
      <div className="flex-1 p-2 flex flex-col gap-1">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 p-2 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-gray-100 rounded w-3/4" />
                <div className="h-2.5 bg-gray-100 rounded w-full" />
              </div>
            </div>
          ))
        ) : (alerts ?? []).map(alert => {
          const { Icon, bg, color } = getAlertStyle(alert.type);
          return (
            <div key={alert.id} className="flex gap-3 p-2 hover:bg-gray-50 rounded-md transition-colors">
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5", bg, color)}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-gray-900 truncate">{alert.title}</h4>
                <p className="text-[11px] text-gray-500 truncate">{alert.detail}</p>
              </div>
              <div className="text-[10px] text-gray-400 whitespace-nowrap pt-0.5">
                {fmtTime(alert.createdAt)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-gray-100 text-center">
        <Link href="/alerts" className="text-xs font-medium text-blue-500 hover:underline inline-flex items-center gap-1">
          {t("alerts.view_all_arrow")} <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
