import { useLanguage } from "@/i18n";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Calendar, Lock } from "lucide-react";
import { useGetUpcomingAppointments } from "@workspace/api-client-react";
import { usePermission } from "@/hooks/usePermission";

function fmtTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

interface UpcomingAppointmentsProps {
  onPatientClick?: (patientId: string) => void;
}

export function UpcomingAppointments({ onPatientClick }: UpcomingAppointmentsProps) {
  const { t } = useLanguage();
  const { can } = usePermission();
  const canView = can("appointments.view");
  // Ne lance pas la requête sans permission (évite un 403 inutile en console)
  const { data: appointments, isLoading } = useGetUpcomingAppointments({
    query: { refetchInterval: 30_000, enabled: canView },
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
        <h3 className="font-bold text-sm text-gray-900">{t("appointments.upcoming.title")}</h3>
        {canView && (
          <Link href="/appointments" className="text-xs text-blue-500 hover:underline">
            {t("appointments.upcoming.view_all")}
          </Link>
        )}
      </div>

      <div className="flex-1 overflow-x-auto">
        {!canView ? (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-gray-400">
            <Lock className="w-5 h-5 opacity-40" />
            <p className="text-xs text-center">Accès restreint — votre rôle n'a pas la permission de consulter les rendez-vous.</p>
          </div>
        ) : isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-3 bg-gray-100 rounded w-12" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <tbody>
              {(appointments ?? []).map((apt, index) => (
                <tr key={apt.id} className={cn("hover:bg-gray-50 transition-colors", index !== (appointments?.length ?? 0) - 1 && "border-b border-gray-50")}>
                  <td className="p-3 pl-4 text-xs font-medium text-blue-600 w-16">
                    {fmtTime(apt.scheduledAt)}
                  </td>
                  <td className="p-3">
                    {apt.patientId ? (
                      <button
                        onClick={() => onPatientClick?.(apt.patientId!)}
                        className="text-xs font-bold text-gray-900 hover:text-blue-600 hover:underline text-left transition-colors"
                      >
                        {apt.patientName}
                      </button>
                    ) : (
                      <div className="text-xs font-bold text-gray-900">{apt.patientName}</div>
                    )}
                    <div className="text-[10px] text-gray-500">{apt.service}</div>
                  </td>
                  <td className="p-3 text-[11px] text-gray-600 w-24 truncate">
                    {apt.doctorName}
                  </td>
                  <td className="p-3 pr-4 text-right w-24">
                    <div className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium",
                      apt.status === 'confirmed' 
                        ? "bg-green-50 text-green-600 border border-green-200" 
                        : "bg-orange-50 text-orange-600 border border-orange-200"
                    )}>
                      {apt.status === 'confirmed' ? t("status.confirmed") : t("status.pending")}
                    </div>
                  </td>
                  <td className="pr-4 py-3 w-8 text-right">
                    <button className="text-gray-400 hover:text-blue-500 p-1">
                      <Calendar className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
