import { useLanguage } from "@/i18n";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";

const appointments = [
  { id: 1, time: "10:30", patient: "Fatima Zahra", service: "Gynécologie", doctor: "Dr. Dubois", status: "confirmed" },
  { id: 2, time: "11:00", patient: "Mohamed Ali", service: "Cardiologie", doctor: "Dr. Martin", status: "confirmed" },
  { id: 3, time: "11:30", patient: "Amina Kherfi", service: "Pédiatrie", doctor: "Dr. Leroy", status: "pending" },
  { id: 4, time: "14:00", patient: "Yacine Hamdi", service: "Chirurgie", doctor: "Dr. Moreau", status: "confirmed" },
  { id: 5, time: "15:30", patient: "Rachid Tlemcani", service: "Médecine interne", doctor: "Dr. Bernard", status: "pending" }
];

export function UpcomingAppointments() {
  const { t } = useLanguage();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
        <h3 className="font-bold text-sm text-gray-900">{t("appointments.upcoming.title")}</h3>
        <Link href="/appointments" className="text-xs text-blue-500 hover:underline">
          {t("appointments.upcoming.view_all")}
        </Link>
      </div>
      
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <tbody>
            {appointments.map((apt, index) => (
              <tr key={apt.id} className={cn("hover:bg-gray-50 transition-colors", index !== appointments.length - 1 && "border-b border-gray-50")}>
                <td className="p-3 pl-4 text-xs font-medium text-blue-600 w-16">
                  {apt.time}
                </td>
                <td className="p-3">
                  <div className="text-xs font-bold text-gray-900">{apt.patient}</div>
                  <div className="text-[10px] text-gray-500">{apt.service}</div>
                </td>
                <td className="p-3 text-[11px] text-gray-600 w-24 truncate">
                  {apt.doctor}
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
      </div>
    </div>
  );
}