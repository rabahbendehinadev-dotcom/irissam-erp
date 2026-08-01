import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PatientAvatar } from "@/components/shared/PatientAvatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useLanguage } from "@/i18n";
import { MOCK_APPOINTMENTS } from "@/mock";
import { formatDate, formatTime } from "@/utils/format";
import { cn } from "@/lib/utils";
import {
  CalendarDays, List, Search, Plus, ChevronLeft, ChevronRight,
  Clock, Stethoscope, X, FileText
} from "lucide-react";
import type { Appointment, AppointmentStatus } from "@/types";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

const STATUS_VARIANT: Record<AppointmentStatus, BadgeVariant> = {
  confirmed: "success",
  pending: "warning",
  cancelled: "danger",
  completed: "info",
  no_show: "neutral",
};

const STATUS_LABEL_KEY: Record<AppointmentStatus, string> = {
  confirmed: "appointments.status.confirmed",
  pending: "appointments.status.pending",
  cancelled: "appointments.status.cancelled",
  completed: "appointments.status.completed",
  no_show: "appointments.status.no_show",
};

// Build a simple weekly calendar grid from appointments
function buildWeekDays(date: Date): Date[] {
  const monday = new Date(date);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const WEEK_DAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function Appointments() {
  const { t } = useLanguage();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "all">("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [calendarDate, setCalendarDate] = useState(new Date("2026-08-01"));
  const [editApt, setEditApt] = useState<Appointment | null>(null);
  const [showForm, setShowForm] = useState(false);

  const departments = useMemo(() => {
    const map = new Map<string, string>();
    MOCK_APPOINTMENTS.forEach((a) => map.set(a.departmentId, a.departmentName));
    return Array.from(map.entries());
  }, []);

  const filtered = useMemo(() => {
    return MOCK_APPOINTMENTS.filter((a) => {
      const name = `${a.patient.firstName} ${a.patient.lastName} ${a.doctorName}`.toLowerCase();
      const matchSearch = !search || name.includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || a.status === statusFilter;
      const matchDept = deptFilter === "all" || a.departmentId === deptFilter;
      return matchSearch && matchStatus && matchDept;
    });
  }, [search, statusFilter, deptFilter]);

  const weekDays = buildWeekDays(calendarDate);

  const aptsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    filtered.forEach((a) => {
      const key = a.scheduledAt.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return map;
  }, [filtered]);

  const prevWeek = () => {
    const d = new Date(calendarDate);
    d.setDate(d.getDate() - 7);
    setCalendarDate(d);
  };
  const nextWeek = () => {
    const d = new Date(calendarDate);
    d.setDate(d.getDate() + 7);
    setCalendarDate(d);
  };
  const goToday = () => setCalendarDate(new Date("2026-08-01"));

  const weekLabel = `${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${weekDays[6].toLocaleString("fr-FR", { month: "long", year: "numeric" })}`;

  return (
    <DashboardLayout>
      <PageWrapper>
        <PageHeader
          title={t("appointments.title" as any)}
          subtitle={t("appointments.subtitle" as any)}
          breadcrumbs={[{ label: t("appointments.title" as any) }]}
          actions={
            <button
              onClick={() => { setEditApt(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              {t("appointments.new" as any)}
            </button>
          }
        />

        {/* View Toggle + Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Toggle */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm shrink-0">
            <button
              onClick={() => setView("list")}
              className={cn("flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors", view === "list" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50")}
            >
              <List className="w-4 h-4" />
              {t("appointments.view.list" as any)}
            </button>
            <button
              onClick={() => setView("calendar")}
              className={cn("flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors", view === "calendar" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50")}
            >
              <CalendarDays className="w-4 h-4" />
              {t("appointments.view.calendar" as any)}
            </button>
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("appointments.search" as any)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[160px]"
          >
            <option value="all">{t("appointments.filter.all_status" as any)}</option>
            {(["confirmed", "pending", "cancelled", "completed", "no_show"] as AppointmentStatus[]).map((s) => (
              <option key={s} value={s}>{t(STATUS_LABEL_KEY[s] as any)}</option>
            ))}
          </select>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[160px]"
          >
            <option value="all">{t("appointments.filter.all_depts" as any)}</option>
            {departments.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>

        {/* Count */}
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-800">{filtered.length}</span>{" "}
          {t("appointments.total" as any)}
        </p>

        {/* LIST VIEW */}
        {view === "list" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("appointments.table.date" as any)}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("appointments.table.patient" as any)}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("appointments.table.doctor" as any)}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("appointments.table.department" as any)}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("appointments.table.duration" as any)}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("appointments.table.status" as any)}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("appointments.table.notes" as any)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((apt) => (
                    <tr key={apt.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{formatDate(apt.scheduledAt)}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {formatTime(apt.scheduledAt)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <PatientAvatar firstName={apt.patient.firstName} lastName={apt.patient.lastName} size="xs" />
                          <span className="font-medium text-gray-900">{apt.patient.firstName} {apt.patient.lastName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-gray-700">
                          <Stethoscope className="w-3.5 h-3.5 text-gray-400" />
                          {apt.doctorName}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{apt.departmentName}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {apt.duration} {t("appointments.min" as any)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          label={t(STATUS_LABEL_KEY[apt.status] as any)}
                          variant={STATUS_VARIANT[apt.status]}
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[180px] truncate">
                        {apt.notes ? (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3 shrink-0" />
                            {apt.notes}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                        Aucun rendez-vous trouvé.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CALENDAR VIEW */}
        {view === "calendar" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Calendar nav */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <button
                  onClick={prevWeek}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-white hover:text-gray-700 transition-colors border border-gray-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextWeek}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-white hover:text-gray-700 transition-colors border border-gray-200"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={goToday}
                  className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                >
                  {t("appointments.calendar.today" as any)}
                </button>
              </div>
              <p className="text-sm font-semibold text-gray-700 capitalize">{weekLabel}</p>
            </div>

            {/* Week grid */}
            <div className="grid grid-cols-7 divide-x divide-gray-200">
              {weekDays.map((day, i) => {
                const key = day.toISOString().slice(0, 10);
                const dayApts = aptsByDay.get(key) ?? [];
                const isToday = key === "2026-08-01";
                return (
                  <div key={key} className="min-h-[200px]">
                    {/* Day header */}
                    <div className={cn(
                      "text-center py-2 border-b border-gray-200",
                      isToday ? "bg-blue-50" : "bg-gray-50"
                    )}>
                      <p className="text-xs font-medium text-gray-400">{WEEK_DAYS_SHORT[i]}</p>
                      <p className={cn(
                        "text-lg font-bold mt-0.5",
                        isToday ? "text-blue-600" : "text-gray-700"
                      )}>
                        {day.getDate()}
                      </p>
                    </div>
                    {/* Appointments */}
                    <div className="p-1.5 space-y-1">
                      {dayApts.slice(0, 4).map((a) => (
                        <div
                          key={a.id}
                          className={cn(
                            "text-xs px-1.5 py-1 rounded-md border truncate",
                            a.status === "confirmed" ? "bg-green-50 border-green-200 text-green-800" :
                            a.status === "pending" ? "bg-yellow-50 border-yellow-200 text-yellow-800" :
                            a.status === "cancelled" ? "bg-red-50 border-red-200 text-red-700 line-through" :
                            a.status === "completed" ? "bg-blue-50 border-blue-200 text-blue-800" :
                            "bg-gray-50 border-gray-200 text-gray-600"
                          )}
                        >
                          <span className="font-medium">{formatTime(a.scheduledAt)}</span>{" "}
                          {a.patient.firstName} {a.patient.lastName}
                        </div>
                      ))}
                      {dayApts.length > 4 && (
                        <p className="text-[10px] text-gray-400 text-center">+{dayApts.length - 4} autres</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </PageWrapper>

      {/* New/Edit Appointment Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editApt ? t("appointments.form.title.edit" as any) : t("appointments.form.title.new" as any)}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <FormField label={t("appointments.form.patient" as any)}>
                <input type="text" defaultValue={editApt ? `${editApt.patient.firstName} ${editApt.patient.lastName}` : ""} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nom du patient" />
              </FormField>
              <FormField label={t("appointments.form.doctor" as any)}>
                <input type="text" defaultValue={editApt?.doctorName ?? ""} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nom du médecin" />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label={t("appointments.form.date" as any)}>
                  <input type="date" defaultValue={editApt?.scheduledAt.slice(0, 10) ?? "2026-08-01"} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </FormField>
                <FormField label={t("appointments.form.time" as any)}>
                  <input type="time" defaultValue={editApt?.scheduledAt.slice(11, 16) ?? "09:00"} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </FormField>
              </div>
              <FormField label={t("appointments.form.duration" as any)}>
                <input type="number" defaultValue={editApt?.duration ?? 30} min={5} step={5} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </FormField>
              <FormField label={t("appointments.form.notes" as any)}>
                <textarea defaultValue={editApt?.notes ?? ""} rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Notes optionnelles..." />
              </FormField>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                {t("appointments.form.cancel" as any)}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                {t("appointments.form.save" as any)}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
