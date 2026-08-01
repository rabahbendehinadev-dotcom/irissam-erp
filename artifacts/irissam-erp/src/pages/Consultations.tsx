import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PatientAvatar } from "@/components/shared/PatientAvatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useLanguage } from "@/i18n";
import { formatTime } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Search, Clock, Stethoscope, Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { BadgeVariant } from "@/types";

type ConsultationStatus = "waiting" | "in_progress" | "completed" | "cancelled";
type ConsultationType = "consultation" | "followup" | "emergency";

interface Consultation {
  id: string;
  patientFirstName: string;
  patientLastName: string;
  doctorName: string;
  departmentId: string;
  departmentName: string;
  scheduledAt: string;
  duration?: number;
  status: ConsultationStatus;
  type: ConsultationType;
}

const MOCK_CONSULTATIONS: Consultation[] = [
  { id: "c-1",  patientFirstName: "Mohamed",    patientLastName: "Ali",       doctorName: "Dr. Bernard",  departmentId: "dept-1", departmentName: "Médecine interne", scheduledAt: "2026-08-01T08:00:00", duration: 20,  status: "completed",  type: "consultation" },
  { id: "c-2",  patientFirstName: "Fatima",     patientLastName: "Zahra",     doctorName: "Dr. Dubois",   departmentId: "dept-4", departmentName: "Gynécologie",       scheduledAt: "2026-08-01T08:15:00", duration: 30,  status: "completed",  type: "followup" },
  { id: "c-3",  patientFirstName: "Ahmed",      patientLastName: "Benali",    doctorName: "Dr. Martin",   departmentId: "dept-5", departmentName: "Cardiologie",       scheduledAt: "2026-08-01T08:30:00", duration: 45,  status: "completed",  type: "followup" },
  { id: "c-4",  patientFirstName: "Amina",      patientLastName: "Kherfi",    doctorName: "Dr. Leroy",    departmentId: "dept-3", departmentName: "Pédiatrie",         scheduledAt: "2026-08-01T09:00:00", duration: 25,  status: "completed",  type: "consultation" },
  { id: "c-5",  patientFirstName: "Yacine",     patientLastName: "Hamdi",     doctorName: "Dr. Moreau",   departmentId: "dept-2", departmentName: "Chirurgie",         scheduledAt: "2026-08-01T09:15:00", duration: 35,  status: "in_progress",type: "consultation" },
  { id: "c-6",  patientFirstName: "Rachid",     patientLastName: "Tlemcani",  doctorName: "Dr. Bernard",  departmentId: "dept-1", departmentName: "Médecine interne", scheduledAt: "2026-08-01T09:30:00",               status: "in_progress",type: "consultation" },
  { id: "c-7",  patientFirstName: "Nadia",      patientLastName: "Bouzid",    doctorName: "Dr. Leroy",    departmentId: "dept-3", departmentName: "Pédiatrie",         scheduledAt: "2026-08-01T10:00:00",               status: "waiting",    type: "consultation" },
  { id: "c-8",  patientFirstName: "Karim",      patientLastName: "Mekki",     doctorName: "Dr. Martin",   departmentId: "dept-5", departmentName: "Cardiologie",       scheduledAt: "2026-08-01T10:15:00",               status: "waiting",    type: "followup" },
  { id: "c-9",  patientFirstName: "Soumia",     patientLastName: "Brahimi",   doctorName: "Dr. Dubois",   departmentId: "dept-4", departmentName: "Gynécologie",       scheduledAt: "2026-08-01T10:30:00",               status: "waiting",    type: "followup" },
  { id: "c-10", patientFirstName: "Omar",       patientLastName: "Saidani",   doctorName: "Dr. Moreau",   departmentId: "dept-2", departmentName: "Chirurgie",         scheduledAt: "2026-08-01T10:45:00",               status: "waiting",    type: "consultation" },
  { id: "c-11", patientFirstName: "Hakima",     patientLastName: "Chérif",    doctorName: "Dr. Hamoud",   departmentId: "dept-4", departmentName: "Gynécologie",       scheduledAt: "2026-08-01T11:00:00",               status: "waiting",    type: "consultation" },
  { id: "c-12", patientFirstName: "Mourad",     patientLastName: "Ghezali",   doctorName: "Dr. Bernard",  departmentId: "dept-1", departmentName: "Médecine interne", scheduledAt: "2026-08-01T11:15:00",               status: "waiting",    type: "followup" },
  { id: "c-13", patientFirstName: "Abdelkader", patientLastName: "Meziane",   doctorName: "Dr. Martin",   departmentId: "dept-5", departmentName: "Cardiologie",       scheduledAt: "2026-08-01T08:45:00", duration: 40,  status: "completed",  type: "emergency" },
  { id: "c-14", patientFirstName: "Samira",     patientLastName: "Ouali",     doctorName: "Dr. Leroy",    departmentId: "dept-3", departmentName: "Pédiatrie",         scheduledAt: "2026-08-01T09:45:00",               status: "cancelled",  type: "consultation" },
];

const STATUS_CONFIG: Record<ConsultationStatus, { variant: BadgeVariant; key: string; icon: React.ReactNode; rowBg: string }> = {
  waiting:     { variant: "warning", key: "consultations.status.waiting",     icon: <Clock className="w-3.5 h-3.5 text-yellow-500" />,   rowBg: "" },
  in_progress: { variant: "info",    key: "consultations.status.in_progress", icon: <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />, rowBg: "bg-blue-50/40" },
  completed:   { variant: "success", key: "consultations.status.completed",   icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />, rowBg: "" },
  cancelled:   { variant: "danger",  key: "consultations.status.cancelled",   icon: <XCircle className="w-3.5 h-3.5 text-red-400" />,     rowBg: "opacity-60" },
};

const TYPE_LABEL: Record<ConsultationType, string> = {
  consultation: "consultations.type.consultation",
  followup:     "consultations.type.followup",
  emergency:    "consultations.type.emergency",
};

const TYPE_STYLE: Record<ConsultationType, string> = {
  consultation: "bg-blue-50 text-blue-700 border-blue-200",
  followup:     "bg-purple-50 text-purple-700 border-purple-200",
  emergency:    "bg-red-50 text-red-700 border-red-200",
};

const DEPT_NAMES: Record<string, string> = {
  "dept-1": "Médecine interne",
  "dept-2": "Chirurgie",
  "dept-3": "Pédiatrie",
  "dept-4": "Gynécologie",
  "dept-5": "Cardiologie",
};

const STATUS_ORDER: ConsultationStatus[] = ["in_progress", "waiting", "completed", "cancelled"];

export default function Consultations() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ConsultationStatus | "all">("all");

  const filtered = useMemo(() => {
    return MOCK_CONSULTATIONS.filter((c) => {
      const name = `${c.patientFirstName} ${c.patientLastName} ${c.doctorName}`.toLowerCase();
      const matchSearch = !search || name.includes(search.toLowerCase());
      const matchDept = deptFilter === "all" || c.departmentId === deptFilter;
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      return matchSearch && matchDept && matchStatus;
    }).sort((a, b) => {
      const si = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      if (si !== 0) return si;
      return a.scheduledAt.localeCompare(b.scheduledAt);
    });
  }, [search, deptFilter, statusFilter]);

  const stats = useMemo(() => ({
    waiting:     MOCK_CONSULTATIONS.filter((c) => c.status === "waiting").length,
    in_progress: MOCK_CONSULTATIONS.filter((c) => c.status === "in_progress").length,
    completed:   MOCK_CONSULTATIONS.filter((c) => c.status === "completed").length,
  }), []);

  const departments = Object.entries(DEPT_NAMES);

  return (
    <DashboardLayout>
      <PageWrapper>
        <PageHeader
          title={t("consultations.title" as any)}
          subtitle={t("consultations.subtitle" as any)}
          breadcrumbs={[{ label: t("consultations.title" as any) }]}
        />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatPill
            icon={<Clock className="w-4 h-4 text-yellow-500" />}
            count={stats.waiting}
            label={t("consultations.stats.waiting" as any)}
            bg="bg-yellow-50 border-yellow-200"
            textColor="text-yellow-700"
          />
          <StatPill
            icon={<Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
            count={stats.in_progress}
            label={t("consultations.stats.in_progress" as any)}
            bg="bg-blue-50 border-blue-200"
            textColor="text-blue-700"
          />
          <StatPill
            icon={<CheckCircle2 className="w-4 h-4 text-green-500" />}
            count={stats.completed}
            label={t("consultations.stats.completed" as any)}
            bg="bg-green-50 border-green-200"
            textColor="text-green-700"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("consultations.search" as any)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[160px]"
          >
            <option value="all">{t("consultations.filter.all_depts" as any)}</option>
            {departments.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[160px]"
          >
            <option value="all">{t("consultations.filter.all_status" as any)}</option>
            {(["waiting", "in_progress", "completed", "cancelled"] as ConsultationStatus[]).map((s) => (
              <option key={s} value={s}>{t(STATUS_CONFIG[s].key as any)}</option>
            ))}
          </select>
        </div>

        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-800">{filtered.length}</span>{" "}
          {t("consultations.total" as any)}
        </p>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("consultations.table.time" as any)}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("consultations.table.patient" as any)}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("consultations.table.doctor" as any)}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("consultations.table.department" as any)}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("consultations.table.type" as any)}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("consultations.table.status" as any)}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("consultations.table.duration" as any)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => {
                  const sc = STATUS_CONFIG[c.status];
                  return (
                    <tr key={c.id} className={cn("transition-colors hover:bg-gray-50/70", sc.rowBg)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {sc.icon}
                          <span className="font-medium text-gray-900">{formatTime(c.scheduledAt)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <PatientAvatar firstName={c.patientFirstName} lastName={c.patientLastName} size="xs" />
                          <span className="font-medium text-gray-900">{c.patientFirstName} {c.patientLastName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-gray-700">
                          <Stethoscope className="w-3.5 h-3.5 text-gray-400" />
                          {c.doctorName}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{c.departmentName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", TYPE_STYLE[c.type])}>
                          {t(TYPE_LABEL[c.type] as any)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          label={t(sc.key as any)}
                          variant={sc.variant}
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {c.duration ? `${c.duration} ${t("consultations.min" as any)}` : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                      Aucune consultation trouvée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageWrapper>
    </DashboardLayout>
  );
}

function StatPill({ icon, count, label, bg, textColor }: {
  icon: React.ReactNode; count: number; label: string; bg: string; textColor: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border", bg)}>
      <div>{icon}</div>
      <div>
        <p className={cn("text-xl font-bold", textColor)}>{count}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}
