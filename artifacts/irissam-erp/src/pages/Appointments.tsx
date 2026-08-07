import { useState, useMemo, useRef, useEffect } from "react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PatientAvatar } from "@/components/shared/PatientAvatar";
import { PatientDrawer } from "@/components/shared/PatientDrawer";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useLanguage } from "@/i18n";
import { formatDate, formatTime } from "@/utils/format";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  CalendarDays, List, Search, Plus, ChevronLeft, ChevronRight,
  Clock, Stethoscope, X, FileText, RefreshCw, AlertTriangle, UserCheck
} from "lucide-react";
import type { Appointment, AppointmentStatus } from "@/types";
import { useGetAppointmentsList, useGetPatientsList } from "@workspace/api-client-react";
import { useAppointmentStore } from "@/store/AppointmentStore";
import { usePermission } from "@/hooks/usePermission";
import { apiClient } from "@/services/api/client";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

const STATUS_VARIANT: Record<AppointmentStatus, BadgeVariant> = {
  confirmed:   "success",
  pending:     "warning",
  cancelled:   "danger",
  completed:   "info",
  no_show:     "neutral",
  in_progress: "info",
};

const STATUS_LABEL_KEY: Record<AppointmentStatus, string> = {
  confirmed:   "appointments.status.confirmed",
  pending:     "appointments.status.pending",
  cancelled:   "appointments.status.cancelled",
  completed:   "appointments.status.completed",
  no_show:     "appointments.status.no_show",
  in_progress: "appointments.status.in_progress",
};

/** Types de RDV — alignés sur l'enum PostgreSQL consultation_type */
const APPOINTMENT_TYPES: { value: string; label: string }[] = [
  { value: "consultation_externe", label: "Consultation externe" },
  { value: "urgence",              label: "Urgence" },
  { value: "hospitalier",          label: "Hospitalier" },
  { value: "teleconsultation",     label: "Téléconsultation" },
];

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

type AppointmentFormValues = {
  patientId: string;
  patientName: string;
  doctorId: string;
  departmentId: string;
  type: string;
  date: string;
  time: string;
  duration: number;
  notes: string;
};

export default function Appointments() {
  const { t } = useLanguage();
  const { can } = usePermission();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "all">("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [drawerPatientId, setDrawerPatientId] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);

  const canCreate = can("appointments.create");
  const canEdit   = can("appointments.edit");
  const canCancel = can("appointments.cancel");

  // Form state
  const formRef = useRef<AppointmentFormValues | null>(null);

  // ── Appointment store (shared state, updated by Consultations page) ────────
  const { appointments: storeAppointments, mergeApiAppointments, updateAppointmentStatus } = useAppointmentStore();

  // ── API hooks ──────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: apiAppointments, isLoading, isError, refetch } = useGetAppointmentsList({} as any);

  // ── Auto-refresh every 30 s ────────────────────────────────────────────────
  const { lastUpdatedLabel } = useAutoRefresh({ refetch, data: apiAppointments });

  // Merge fresh API data into the store whenever it arrives (preserves local overrides)
  useEffect(() => {
    if (!isLoading && !isError && apiAppointments) {
      mergeApiAppointments(apiAppointments as unknown as Appointment[]);
    }
  }, [apiAppointments, isLoading, isError, mergeApiAppointments]);

  // Use store as the single source of truth; fall through to empty while loading
  const rawAppointments = useMemo((): Appointment[] => {
    if (isLoading) return [];
    return Array.isArray(storeAppointments) ? storeAppointments : [];
  }, [isLoading, storeAppointments]);

  // Filtre départements par NOM (les anciennes lignes n'ont pas de departmentId)
  const departments = useMemo(() => {
    const set = new Set<string>();
    rawAppointments.forEach((a) => { if (a.departmentName) set.add(a.departmentName); });
    return Array.from(set.values()).sort();
  }, [rawAppointments]);

  const filtered = useMemo(() => {
    return rawAppointments.filter((a) => {
      const name = `${a.patient.firstName} ${a.patient.lastName} ${a.doctorName}`.toLowerCase();
      const matchSearch = !search || name.includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || a.status === statusFilter;
      const matchDept = deptFilter === "all" || a.departmentName === deptFilter;
      return matchSearch && matchStatus && matchDept;
    });
  }, [rawAppointments, search, statusFilter, deptFilter]);

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

  const todayStr = new Date().toISOString().slice(0, 10);

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
  const goToday = () => setCalendarDate(new Date());

  const weekLabel = `${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${weekDays[6].toLocaleString("fr-FR", { month: "long", year: "numeric" })}`;

  const handleSaveForm = async () => {
    const f = formRef.current;
    if (!f) return;
    if (!f.patientId) { setFormError("Sélectionnez un patient enregistré."); return; }
    if (!f.doctorId)  { setFormError("Sélectionnez un médecin."); return; }
    if (!f.departmentId) { setFormError("Sélectionnez un département."); return; }
    if (!f.date || !f.time) { setFormError("Date et heure sont requises."); return; }

    setFormError(null);
    setSaving(true);
    try {
      // Heure locale → ISO (corrige l'ancien bug de fuseau `T…Z` naïf)
      const scheduledAt = new Date(`${f.date}T${f.time}:00`).toISOString();
      await apiClient.post("/appointments", {
        patientId:    f.patientId,
        doctorId:     f.doctorId,
        departmentId: f.departmentId,
        type:         f.type,
        scheduledAt,
        duration:     f.duration || 30,
        notes:        f.notes || undefined,
        status:       "pending",
      });
      await refetch();
      setShowForm(false);
    } catch (err: any) {
      console.error("Failed to create appointment", err);
      const msg = err?.message ?? "Erreur inconnue";
      setFormError(`Échec de l'enregistrement : ${msg}`);
      toast({
        variant: "destructive",
        title: "Échec de l'enregistrement",
        description: msg,
      });
    } finally {
      setSaving(false);
    }
  };

  /** Changement de statut (check-in « Patient arrivé », confirmation, clôture, annulation). */
  const changeStatus = async (apt: Appointment, status: AppointmentStatus) => {
    setStatusBusy(apt.id);
    try {
      await apiClient.patch(`/appointments/${apt.id}`, { status });
      updateAppointmentStatus(apt.id, status);
      await refetch();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Échec du changement de statut",
        description: err?.message ?? "Erreur inconnue",
      });
    } finally {
      setStatusBusy(null);
    }
  };

  const TERMINAL_STATUSES: AppointmentStatus[] = ["cancelled", "completed", "no_show"];

  return (
    <DashboardLayout>
      <PageWrapper>
        <PageHeader
          title={t("appointments.title" as any)}
          subtitle={t("appointments.subtitle" as any)}
          breadcrumbs={[{ label: t("appointments.title" as any) }]}
          actions={
            <div className="flex items-center gap-2">
              {isLoading && (
                <span className="flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-full">
                  <RefreshCw size={11} className="animate-spin" /> Chargement…
                </span>
              )}
              {isError && !isLoading && (
                <span className="flex items-center gap-1 text-xs px-2.5 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full">
                  <AlertTriangle size={11} /> Données hors ligne
                </span>
              )}
              {!isLoading && !isError && lastUpdatedLabel && (
                <span className="text-xs text-gray-400 px-2 py-1 bg-gray-50 border border-gray-200 rounded-full whitespace-nowrap">
                  {lastUpdatedLabel}
                </span>
              )}
              {canCreate && (
                <button
                  onClick={() => {
                    formRef.current = null;
                    setFormError(null);
                    setShowForm(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  {t("appointments.new" as any)}
                </button>
              )}
            </div>
          }
        />

        {/* View Toggle + Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
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
            {(["confirmed", "in_progress", "pending", "cancelled", "completed", "no_show"] as AppointmentStatus[]).map((s) => (
              <option key={s} value={s}>{t(STATUS_LABEL_KEY[s] as any)}</option>
            ))}
          </select>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[160px]"
          >
            <option value="all">{t("appointments.filter.all_depts" as any)}</option>
            {departments.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {/* Count */}
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-800">{filtered.length}</span>{" "}
          {t("appointments.total" as any)}
        </p>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* LIST VIEW */}
        {!isLoading && view === "list" && (
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
                    {(canEdit || canCancel) && (
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    )}
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
                        {/* Only open drawer when a real patient record exists */}
                        {apt.patientId ? (
                          <button
                            onClick={() => setDrawerPatientId(apt.patientId)}
                            className="flex items-center gap-2 group text-left"
                          >
                            <PatientAvatar firstName={apt.patient.firstName} lastName={apt.patient.lastName} size="xs" />
                            <span className="font-medium text-blue-700 group-hover:underline">{apt.patient.firstName} {apt.patient.lastName}</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <PatientAvatar firstName={apt.patient.firstName} lastName={apt.patient.lastName} size="xs" />
                            <span className="font-medium text-gray-700">{apt.patient.firstName} {apt.patient.lastName}</span>
                          </div>
                        )}
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
                          label={t(STATUS_LABEL_KEY[apt.status as AppointmentStatus] as any)}
                          variant={STATUS_VARIANT[apt.status as AppointmentStatus] ?? "neutral"}
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
                      {(canEdit || canCancel) && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {canEdit && apt.status === "pending" && (
                              <button
                                onClick={() => changeStatus(apt, "confirmed")}
                                disabled={statusBusy === apt.id}
                                className="px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 disabled:opacity-50 transition-colors"
                              >
                                Confirmer
                              </button>
                            )}
                            {canEdit && apt.status === "confirmed" && (
                              <button
                                onClick={() => changeStatus(apt, "in_progress")}
                                disabled={statusBusy === apt.id}
                                className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50 transition-colors"
                              >
                                Patient arrivé
                              </button>
                            )}
                            {canEdit && apt.status === "in_progress" && (
                              <button
                                onClick={() => changeStatus(apt, "completed")}
                                disabled={statusBusy === apt.id}
                                className="px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                              >
                                Terminer
                              </button>
                            )}
                            {canCancel && !TERMINAL_STATUSES.includes(apt.status as AppointmentStatus) && (
                              <button
                                title="Annuler le rendez-vous"
                                onClick={() => changeStatus(apt, "cancelled")}
                                disabled={statusBusy === apt.id}
                                className="p-1 text-red-500 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {TERMINAL_STATUSES.includes(apt.status as AppointmentStatus) && (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={(canEdit || canCancel) ? 8 : 7} className="px-4 py-12 text-center text-gray-400 text-sm">
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
        {!isLoading && view === "calendar" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <button onClick={prevWeek} className="p-1.5 rounded-lg text-gray-500 hover:bg-white hover:text-gray-700 transition-colors border border-gray-200">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={nextWeek} className="p-1.5 rounded-lg text-gray-500 hover:bg-white hover:text-gray-700 transition-colors border border-gray-200">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={goToday} className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200">
                  {t("appointments.calendar.today" as any)}
                </button>
              </div>
              <p className="text-sm font-semibold text-gray-700 capitalize">{weekLabel}</p>
            </div>
            <div className="grid grid-cols-7 divide-x divide-gray-200">
              {weekDays.map((day, i) => {
                const key = day.toISOString().slice(0, 10);
                const dayApts = aptsByDay.get(key) ?? [];
                const isToday = key === todayStr;
                return (
                  <div key={key} className="min-h-[200px]">
                    <div className={cn("text-center py-2 border-b border-gray-200", isToday ? "bg-blue-50" : "bg-gray-50")}>
                      <p className="text-xs font-medium text-gray-400">{WEEK_DAYS_SHORT[i]}</p>
                      <p className={cn("text-lg font-bold mt-0.5", isToday ? "text-blue-600" : "text-gray-700")}>{day.getDate()}</p>
                    </div>
                    <div className="p-1.5 space-y-1">
                      {dayApts.slice(0, 4).map((a) => (
                        <button
                          key={a.id}
                          onClick={() => {
                            if (a.patientId) {
                              setDrawerPatientId(a.patientId);
                            }
                          }}
                          className={cn(
                            "text-xs px-1.5 py-1 rounded-md border truncate w-full text-left hover:opacity-80 transition-opacity",
                            a.status === "confirmed"   ? "bg-green-50 border-green-200 text-green-800" :
                            a.status === "in_progress" ? "bg-blue-100 border-blue-400 text-blue-900 font-semibold" :
                            a.status === "pending"     ? "bg-yellow-50 border-yellow-200 text-yellow-800" :
                            a.status === "cancelled"   ? "bg-red-50 border-red-200 text-red-700 line-through" :
                            a.status === "completed"   ? "bg-blue-50 border-blue-200 text-blue-800" :
                            "bg-gray-50 border-gray-200 text-gray-600"
                          )}
                        >
                          <span className="font-medium">{formatTime(a.scheduledAt)}</span>{" "}
                          {a.patient.firstName} {a.patient.lastName}
                        </button>
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

      {/* New Appointment Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6 space-y-5 max-h-[95dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {t("appointments.form.title.new" as any)}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <AppointmentFormFields
              onChange={(v) => { formRef.current = v; }}
            />

            {formError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{formError}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowForm(false); setFormError(null); }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t("appointments.form.cancel" as any)}
              </button>
              <button
                onClick={handleSaveForm}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {saving
                  ? "Enregistrement…"
                  : formError
                  ? "Réessayer"
                  : t("appointments.form.save" as any)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient drawer */}
      <PatientDrawer patientId={drawerPatientId} onClose={() => setDrawerPatientId(null)} />
    </DashboardLayout>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

interface DirectoryDoctor {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  specialty: string;
}

interface DirectoryDepartment {
  id: string;
  name: string;
}

/**
 * Formulaire RDV — uniquement des entités réelles :
 *  - patient : recherche dans le registre (UUID réel requis)
 *  - médecin / département : listes chargées depuis /directory (PostgreSQL)
 *  - type : enum consultation_type
 */
function AppointmentFormFields({
  onChange,
}: {
  onChange: (v: AppointmentFormValues) => void;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const { t } = useLanguage();

  // Référentiel réel (médecins + départements)
  const [doctors, setDoctors] = useState<DirectoryDoctor[]>([]);
  const [departments, setDepartments] = useState<DirectoryDepartment[]>([]);
  const [dirError, setDirError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiClient.get<DirectoryDoctor[]>("/directory/doctors"),
      apiClient.get<DirectoryDepartment[]>("/directory/departments"),
    ])
      .then(([docs, depts]) => {
        if (cancelled) return;
        setDoctors(Array.isArray(docs) ? docs : []);
        setDepartments(Array.isArray(depts) ? depts : []);
      })
      .catch(() => { if (!cancelled) setDirError(true); });
    return () => { cancelled = true; };
  }, []);

  // Patients réels (recherche locale sur la liste API)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: apiPatients } = useGetPatientsList({} as any);
  const [patientQuery, setPatientQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string; mpiId: string } | null>(null);

  const patientResults = useMemo(() => {
    if (!patientQuery.trim() || selectedPatient) return [];
    const q = patientQuery.toLowerCase();
    const list = Array.isArray(apiPatients) ? (apiPatients as any[]) : [];
    return list
      .filter((p) => `${p.mpiId ?? ""} ${p.firstName ?? ""} ${p.lastName ?? ""} ${p.phone ?? ""}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [patientQuery, apiPatients, selectedPatient]);

  const [doctorId, setDoctorId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [type, setType] = useState("consultation_externe");
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState("");

  const emit = (overrides: Partial<AppointmentFormValues> = {}) =>
    onChange({
      patientId:    selectedPatient?.id ?? "",
      patientName:  selectedPatient?.name ?? "",
      doctorId,
      departmentId,
      type,
      date,
      time,
      duration,
      notes,
      ...overrides,
    });

  const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-4">
      <FormField label={t("appointments.form.patient" as any)}>
        {selectedPatient ? (
          <div className="flex items-center justify-between gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 min-w-0">
              <UserCheck className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-sm font-medium text-green-800 truncate">{selectedPatient.name}</span>
              <span className="text-xs text-green-600 shrink-0">{selectedPatient.mpiId}</span>
            </div>
            <button
              onClick={() => { setSelectedPatient(null); setPatientQuery(""); emit({ patientId: "", patientName: "" }); }}
              className="text-xs text-green-700 underline shrink-0"
            >
              Changer
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={patientQuery}
              onChange={(e) => setPatientQuery(e.target.value)}
              className={inputCls}
              placeholder="Rechercher (nom, MPI, téléphone)…"
            />
            {patientResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                {patientResults.map((p: any) => {
                  const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        const sel = { id: p.id as string, name, mpiId: (p.mpiId as string) ?? "" };
                        setSelectedPatient(sel);
                        emit({ patientId: sel.id, patientName: sel.name });
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center justify-between gap-2"
                    >
                      <span className="font-medium text-gray-800 truncate">{name}</span>
                      <span className="text-xs text-gray-400 shrink-0">{p.mpiId}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {patientQuery.trim() && patientResults.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">Aucun patient trouvé dans le registre.</p>
            )}
          </div>
        )}
      </FormField>

      <FormField label={t("appointments.form.doctor" as any)}>
        <select
          value={doctorId}
          onChange={(e) => { setDoctorId(e.target.value); emit({ doctorId: e.target.value }); }}
          className={inputCls}
        >
          <option value="">— Sélectionner un médecin —</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              Dr {d.fullName}{d.specialty ? ` — ${d.specialty}` : ""}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label={t("appointments.table.department" as any)}>
        <select
          value={departmentId}
          onChange={(e) => { setDepartmentId(e.target.value); emit({ departmentId: e.target.value }); }}
          className={inputCls}
        >
          <option value="">— Sélectionner un département —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </FormField>

      <FormField label="Type de consultation">
        <select
          value={type}
          onChange={(e) => { setType(e.target.value); emit({ type: e.target.value }); }}
          className={inputCls}
        >
          {APPOINTMENT_TYPES.map((tp) => (
            <option key={tp.value} value={tp.value}>{tp.label}</option>
          ))}
        </select>
      </FormField>

      {dirError && (
        <p className="text-xs text-red-500">
          Impossible de charger le référentiel (médecins / départements). Réessayez.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("appointments.form.date" as any)}>
          <input type="date" value={date} onChange={(e) => { setDate(e.target.value); emit({ date: e.target.value }); }}
            className={inputCls} />
        </FormField>
        <FormField label={t("appointments.form.time" as any)}>
          <input type="time" value={time} onChange={(e) => { setTime(e.target.value); emit({ time: e.target.value }); }}
            className={inputCls} />
        </FormField>
      </div>
      <FormField label={t("appointments.form.duration" as any)}>
        <input type="number" value={duration} min={5} step={5} onChange={(e) => { setDuration(+e.target.value); emit({ duration: +e.target.value }); }}
          className={inputCls} />
      </FormField>
      <FormField label={t("appointments.form.notes" as any)}>
        <textarea value={notes} rows={2} onChange={(e) => { setNotes(e.target.value); emit({ notes: e.target.value }); }}
          className={`${inputCls} resize-none`} placeholder="Notes optionnelles…" />
      </FormField>
    </div>
  );
}
