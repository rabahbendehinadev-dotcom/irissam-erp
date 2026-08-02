import { useLanguage } from "@/i18n";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useGetRecentPatients } from "@workspace/api-client-react";

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-600",
  "bg-purple-100 text-purple-600",
  "bg-orange-100 text-orange-600",
  "bg-green-100 text-green-600",
  "bg-teal-100 text-teal-600",
];

function fmtTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

interface RecentPatientsProps {
  onPatientClick?: (patientId: string) => void;
}

export function RecentPatients({ onPatientClick }: RecentPatientsProps) {
  const { t } = useLanguage();
  const { data: patients, isLoading } = useGetRecentPatients({ query: { refetchInterval: 30_000 } });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
        <h3 className="font-bold text-sm text-gray-900">{t("patients.recent.title")}</h3>
        <Link href="/patients" className="text-xs text-blue-500 hover:underline">
          {t("patients.recent.view_all")}
        </Link>
      </div>
      
      <div className="flex-1 overflow-x-auto">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />
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
              {(patients ?? []).map((patient, index) => (
                <tr key={patient.id} className={cn("hover:bg-gray-50 transition-colors", index !== (patients?.length ?? 0) - 1 && "border-b border-gray-50")}>
                  <td className="p-3 pl-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0", AVATAR_COLORS[index % AVATAR_COLORS.length])}>
                        {patient.name.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <div>
                        <button
                          onClick={() => onPatientClick?.(`db-${patient.id}`)}
                          className="text-xs font-bold text-gray-900 hover:text-blue-600 hover:underline text-left transition-colors"
                        >
                          {patient.name}
                        </button>
                        <div className="text-[10px] text-gray-500">
                          {patient.age} {t("patients.recent.age")} • {t("patients.recent.file")}: {patient.fileNumber}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-[11px] text-gray-500 text-center w-16">
                    {fmtTime(patient.registeredAt)}
                  </td>
                  <td className="p-3 pr-4 text-[11px] text-gray-600 w-32 truncate">
                    <span className="text-gray-400 mr-1">{t("patients.recent.service")}:</span>
                    {patient.service}
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
