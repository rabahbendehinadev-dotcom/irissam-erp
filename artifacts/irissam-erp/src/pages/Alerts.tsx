import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PatientDrawer } from "@/components/shared/PatientDrawer";
import { useLanguage } from "@/i18n";
import { MOCK_ALERTS } from "@/mock";
import { formatRelativeTime } from "@/utils/format";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, Bell, CheckCheck, Check,
  FlaskConical, Package, Pill, Bed, Wrench, CalendarClock, RefreshCw
} from "lucide-react";
import type { MedicalAlert, AlertSeverity, AlertCategory } from "@/types";
import {
  useGetAlerts,
  useMarkAlertRead,
  useMarkAllAlertsRead,
} from "@workspace/api-client-react";

const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; key: string; dot: string; bg: string; border: string; text: string }> = {
  critical: { label: "Critique",  key: "alerts.severity.critical", dot: "bg-red-500",    bg: "bg-red-50",     border: "border-red-200",    text: "text-red-700" },
  high:     { label: "Élevée",   key: "alerts.severity.high",     dot: "bg-orange-500", bg: "bg-orange-50",  border: "border-orange-200", text: "text-orange-700" },
  medium:   { label: "Moyenne",  key: "alerts.severity.medium",   dot: "bg-yellow-500", bg: "bg-yellow-50",  border: "border-yellow-200", text: "text-yellow-700" },
  low:      { label: "Faible",   key: "alerts.severity.low",      dot: "bg-blue-400",   bg: "bg-blue-50",    border: "border-blue-200",   text: "text-blue-700" },
};

const CATEGORY_CONFIG: Record<AlertCategory, { key: string; icon: React.ReactNode }> = {
  lab:       { key: "alerts.category.lab",       icon: <FlaskConical className="w-4 h-4" /> },
  stock:     { key: "alerts.category.stock",     icon: <Package className="w-4 h-4" /> },
  medication:{ key: "alerts.category.medication",icon: <Pill className="w-4 h-4" /> },
  capacity:  { key: "alerts.category.capacity",  icon: <Bed className="w-4 h-4" /> },
  equipment: { key: "alerts.category.equipment", icon: <Wrench className="w-4 h-4" /> },
  schedule:  { key: "alerts.category.schedule",  icon: <CalendarClock className="w-4 h-4" /> },
};

const SEVERITY_ORDER: AlertSeverity[] = ["critical", "high", "medium", "low"];

export default function Alerts() {
  const { t, lang } = useLanguage();
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<AlertCategory | "all">("all");
  const [readFilter, setReadFilter] = useState<"all" | "unread">("all");
  const [drawerPatientId, setDrawerPatientId] = useState<string | null>(null);

  // ── API hooks ──────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: apiAlerts, isLoading, isError, refetch } = useGetAlerts({} as any);
  const markReadMutation = useMarkAlertRead();
  const markAllReadMutation = useMarkAllAlertsRead();

  // Local optimistic state for isRead (synced with API on refetch)
  const [localReadIds, setLocalReadIds] = useState<Set<string>>(new Set());
  const [allRead, setAllRead] = useState(false);

  // Map API data to MedicalAlert type, fall back to mocks
  const rawAlerts = useMemo((): MedicalAlert[] => {
    if (isLoading) return [];
    if (isError) return MOCK_ALERTS;
    return (apiAlerts ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      severity: (a.severity as AlertSeverity) ?? "medium",
      category: (a.category as AlertCategory) ?? "lab",
      isRead: allRead || localReadIds.has(a.id) || a.isRead,
      createdAt: a.createdAt,
      patientId: a.patientId ?? undefined,
      isActive: true,
      siteId: "site-1",
      departmentId: undefined,
    })) as MedicalAlert[];
  }, [apiAlerts, isLoading, isError, localReadIds, allRead]);

  const filtered = useMemo(() => {
    return rawAlerts
      .filter((a) => {
        const matchSev = severityFilter === "all" || a.severity === severityFilter;
        const matchCat = categoryFilter === "all" || a.category === categoryFilter;
        const matchRead = readFilter === "all" || !a.isRead;
        return matchSev && matchCat && matchRead;
      })
      .sort((a, b) => {
        const si = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
        if (si !== 0) return si;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [rawAlerts, severityFilter, categoryFilter, readFilter]);

  const unreadCount = rawAlerts.filter((a) => !a.isRead).length;
  const criticalCount = filtered.filter((a) => a.severity === "critical").length;
  const highCount     = filtered.filter((a) => a.severity === "high").length;

  const markRead = async (id: string) => {
    // Optimistic update
    setLocalReadIds((prev) => new Set([...prev, id]));
    try {
      await markReadMutation.mutateAsync({ id });
      refetch();
    } catch {
      // Rollback on error
      setLocalReadIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const markAllRead = async () => {
    // Optimistic update
    setAllRead(true);
    try {
      await markAllReadMutation.mutateAsync();
      refetch();
    } catch {
      setAllRead(false);
    }
  };

  return (
    <DashboardLayout>
      <PageWrapper>
        <PageHeader
          title={t("alerts.page.title" as any)}
          subtitle={t("alerts.page.subtitle" as any)}
          breadcrumbs={[{ label: t("alerts.page.title" as any) }]}
          actions={
            <div className="flex items-center gap-2">
              {isLoading && (
                <span className="flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-full">
                  <RefreshCw size={11} className="animate-spin" /> Chargement…
                </span>
              )}
              {isError && !isLoading && (
                <button
                  onClick={() => refetch()}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full hover:bg-amber-200 transition-colors"
                >
                  <AlertTriangle size={11} /> Données hors ligne — Réessayer
                </button>
              )}
              {unreadCount > 0 && !isLoading && (
                <button
                  onClick={markAllRead}
                  disabled={markAllReadMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-60"
                >
                  <CheckCheck className="w-4 h-4" />
                  {t("alerts.mark_all_read" as any)}
                </button>
              )}
            </div>
          }
        />

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard count={unreadCount} label="Non lues" color="bg-gray-900 text-white" icon={<Bell className="w-5 h-5" />} />
          <SummaryCard count={criticalCount} label="Critiques" color="bg-red-600 text-white" icon={<AlertTriangle className="w-5 h-5" />} />
          <SummaryCard count={highCount} label="Élevées" color="bg-orange-500 text-white" icon={<AlertTriangle className="w-5 h-5" />} />
          <SummaryCard count={rawAlerts.filter((a) => a.isRead).length} label="Traitées" color="bg-green-600 text-white" icon={<Check className="w-5 h-5" />} />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm shrink-0">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setReadFilter(f)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors",
                  readFilter === f ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
                )}
              >
                {f === "all" ? t("alerts.filter.all" as any) : t("alerts.filter.unread" as any)}
              </button>
            ))}
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[160px]"
          >
            <option value="all">{t("alerts.filter.all_severity" as any)}</option>
            {SEVERITY_ORDER.map((s) => (
              <option key={s} value={s}>{t(SEVERITY_CONFIG[s].key as any)}</option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[160px]"
          >
            <option value="all">{t("alerts.filter.all_category" as any)}</option>
            {(Object.keys(CATEGORY_CONFIG) as AlertCategory[]).map((c) => (
              <option key={c} value={c}>{t(CATEGORY_CONFIG[c].key as any)}</option>
            ))}
          </select>

          <p className="flex items-center text-sm text-gray-500 ml-auto">
            <span className="font-semibold text-gray-800">{filtered.length}</span>&nbsp;{t("alerts.total" as any)}
            {unreadCount > 0 && <span className="ml-2 text-red-600">({unreadCount} {t("alerts.unread_count" as any)})</span>}
          </p>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Alerts list */}
        {!isLoading && (
          <div className="space-y-2">
            {filtered.map((alert) => {
              const sev = SEVERITY_CONFIG[alert.severity];
              const cat = CATEGORY_CONFIG[alert.category];
              return (
                <div
                  key={alert.id}
                  className={cn(
                    "flex items-start gap-4 p-4 rounded-xl border transition-all",
                    alert.isRead
                      ? "bg-white border-gray-200 opacity-70"
                      : cn("border-l-4", sev.bg, sev.border)
                  )}
                >
                  {/* Severity dot */}
                  <div className="shrink-0 mt-0.5">
                    <span className={cn("w-2.5 h-2.5 rounded-full inline-block", sev.dot)} />
                  </div>

                  {/* Category icon */}
                  <div className={cn("shrink-0 p-2 rounded-lg border", sev.bg, sev.border, sev.text)}>
                    {cat.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={cn("text-sm font-semibold", alert.isRead ? "text-gray-600" : "text-gray-900")}>
                            {alert.title}
                          </p>
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide border", sev.bg, sev.border, sev.text)}>
                            {t(sev.key as any)}
                          </span>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide bg-gray-100 text-gray-500 border border-gray-200">
                            {t(cat.key as any)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 flex-wrap">
                          <span>{alert.description}</span>
                          {alert.patientId && (
                            <button
                              onClick={() => setDrawerPatientId(alert.patientId!)}
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
                            >
                              Voir dossier
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {formatRelativeTime(alert.createdAt, lang)}
                        </span>
                        {!alert.isRead && (
                          <button
                            onClick={() => markRead(alert.id)}
                            disabled={markReadMutation.isPending}
                            title={t("alerts.mark_read" as any)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        {alert.isRead && (
                          <span className="flex items-center gap-1 text-[10px] text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
                            <Check className="w-3 h-3" />
                            {t("alerts.read_badge" as any)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Bell className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Aucune alerte correspondante.</p>
              </div>
            )}
          </div>
        )}
      </PageWrapper>

      {/* Patient drawer */}
      <PatientDrawer patientId={drawerPatientId} onClose={() => setDrawerPatientId(null)} />
    </DashboardLayout>
  );
}

function SummaryCard({ count, label, color, icon }: { count: number; label: string; color: string; icon: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl p-4 flex items-center gap-3 shadow-sm", color)}>
      <div className="opacity-80">{icon}</div>
      <div>
        <p className="text-2xl font-bold">{count}</p>
        <p className="text-xs opacity-80">{label}</p>
      </div>
    </div>
  );
}
