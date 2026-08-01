import { useLanguage } from "@/i18n";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const patients = [
  { id: 1, name: "Mohamed Ali", age: 45, dossier: "2024-1258", time: "10:10", service: "Médecine", avatarColor: "bg-blue-100 text-blue-600" },
  { id: 2, name: "Fatima Zahra", age: 32, dossier: "2024-1257", time: "10:05", service: "Gynécologie", avatarColor: "bg-purple-100 text-purple-600" },
  { id: 3, name: "Ahmed Benali", age: 60, dossier: "2024-1256", time: "09:58", service: "Cardiologie", avatarColor: "bg-orange-100 text-orange-600" },
  { id: 4, name: "Amina Kherfi", age: 27, dossier: "2024-1255", time: "09:50", service: "Pédiatrie", avatarColor: "bg-green-100 text-green-600" },
  { id: 5, name: "Yacine Hamdi", age: 36, dossier: "2024-1254", time: "09:45", service: "Chirurgie", avatarColor: "bg-teal-100 text-teal-600" }
];

export function RecentPatients() {
  const { t } = useLanguage();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
        <h3 className="font-bold text-sm text-gray-900">{t("patients.recent.title")}</h3>
        <Link href="/patients" className="text-xs text-blue-500 hover:underline">
          {t("patients.recent.view_all")}
        </Link>
      </div>
      
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <tbody>
            {patients.map((patient, index) => (
              <tr key={patient.id} className={cn("hover:bg-gray-50 transition-colors", index !== patients.length - 1 && "border-b border-gray-50")}>
                <td className="p-3 pl-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0", patient.avatarColor)}>
                      {patient.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900">{patient.name}</div>
                      <div className="text-[10px] text-gray-500">
                        {patient.age} {t("patients.recent.age")} • {t("patients.recent.file")}: {patient.dossier}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-[11px] text-gray-500 text-center w-16">
                  {patient.time}
                </td>
                <td className="p-3 pr-4 text-[11px] text-gray-600 w-32 truncate">
                  <span className="text-gray-400 mr-1">{t("patients.recent.service")}:</span>
                  {patient.service}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}