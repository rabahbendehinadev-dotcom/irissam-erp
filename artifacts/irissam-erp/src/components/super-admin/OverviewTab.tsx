import { useState, useEffect, useCallback, useRef } from "react";
import {
  Database,
  HardDrive,
  Mail,
  Briefcase,
  Users,
  UserCheck,
  Clock,
  AlertTriangle,
  Archive,
  GitMerge,
  Tag,
  Activity,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getSystemOverview } from "@/services/api/system";

const REFRESH_INTERVAL = 30;

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
      {msg}
    </div>
  );
}

function statusColor(status?: string) {
  const s = status?.toLowerCase();
  if (s === "healthy" || s === "active" || s === "ok") return "border-green-400 bg-green-50";
  if (s === "degraded" || s === "warning") return "border-yellow-400 bg-yellow-50";
  if (s === "down" || s === "error" || s === "failed") return "border-red-400 bg-red-50";
  return "border-gray-300 bg-white";
}

function statusDot(status?: string) {
  const s = status?.toLowerCase();
  if (s === "healthy" || s === "active" || s === "ok") return "bg-green-500";
  if (s === "degraded" || s === "warning") return "bg-yellow-500";
  if (s === "down" || s === "error" || s === "failed") return "bg-red-500";
  return "bg-gray-400";
}

interface OverviewCard {
  id: string;
  icon: React.ElementType;
  title: string;
  getValue: (data: Record<string, unknown>) => string | number;
  getStatus: (data: Record<string, unknown>) => string;
  getDetail: (data: Record<string, unknown>) => Record<string, unknown> | null;
  getTimestamp: (data: Record<string, unknown>) => string | null;
}

const CARDS: OverviewCard[] = [
  {
    id: "database",
    icon: Database,
    title: "Base de données",
    getValue: (d) => (d.database as Record<string, unknown>)?.status as string ?? "—",
    getStatus: (d) => (d.database as Record<string, unknown>)?.status as string ?? "unknown",
    getDetail: (d) => d.database as Record<string, unknown>,
    getTimestamp: (d) => (d.database as Record<string, unknown>)?.checkedAt as string ?? null,
  },
  {
    id: "storage",
    icon: HardDrive,
    title: "Stockage",
    getValue: (d) => (d.storage as Record<string, unknown>)?.status as string ?? "—",
    getStatus: (d) => (d.storage as Record<string, unknown>)?.status as string ?? "unknown",
    getDetail: (d) => d.storage as Record<string, unknown>,
    getTimestamp: (d) => (d.storage as Record<string, unknown>)?.checkedAt as string ?? null,
  },
  {
    id: "email",
    icon: Mail,
    title: "Email / SMTP",
    getValue: (d) => (d.email as Record<string, unknown>)?.status as string ?? "—",
    getStatus: (d) => (d.email as Record<string, unknown>)?.status as string ?? "unknown",
    getDetail: (d) => d.email as Record<string, unknown>,
    getTimestamp: (d) => (d.email as Record<string, unknown>)?.checkedAt as string ?? null,
  },
  {
    id: "jobs",
    icon: Briefcase,
    title: "Background Jobs",
    getValue: (d) => (d.jobs as Record<string, unknown>)?.status as string ?? "—",
    getStatus: (d) => (d.jobs as Record<string, unknown>)?.status as string ?? "unknown",
    getDetail: (d) => d.jobs as Record<string, unknown>,
    getTimestamp: (d) => (d.jobs as Record<string, unknown>)?.checkedAt as string ?? null,
  },
  {
    id: "activeSessions",
    icon: UserCheck,
    title: "Sessions actives",
    getValue: (d) => (d.sessions as Record<string, unknown>)?.active as number ?? 0,
    getStatus: () => "active",
    getDetail: (d) => d.sessions as Record<string, unknown>,
    getTimestamp: () => null,
  },
  {
    id: "activeUsers",
    icon: Users,
    title: "Utilisateurs actifs",
    getValue: (d) => (d.users as Record<string, unknown>)?.active as number ?? 0,
    getStatus: () => "active",
    getDetail: (d) => d.users as Record<string, unknown>,
    getTimestamp: () => null,
  },
  {
    id: "pendingJobs",
    icon: Clock,
    title: "Jobs en attente",
    getValue: (d) => (d.jobs as Record<string, unknown>)?.pending as number ?? 0,
    getStatus: (d) =>
      ((d.jobs as Record<string, unknown>)?.pending as number) > 50
        ? "degraded"
        : "healthy",
    getDetail: (d) => d.jobs as Record<string, unknown>,
    getTimestamp: () => null,
  },
  {
    id: "failedJobs",
    icon: AlertTriangle,
    title: "Jobs échoués (24h)",
    getValue: (d) => (d.jobs as Record<string, unknown>)?.failedLast24h as number ?? 0,
    getStatus: (d) =>
      ((d.jobs as Record<string, unknown>)?.failedLast24h as number) > 0
        ? "degraded"
        : "healthy",
    getDetail: (d) => d.jobs as Record<string, unknown>,
    getTimestamp: () => null,
  },
  {
    id: "lastBackup",
    icon: Archive,
    title: "Dernière sauvegarde",
    getValue: (d) =>
      (d.backups as Record<string, unknown>)?.lastBackupAt
        ? new Date((d.backups as Record<string, unknown>).lastBackupAt as string).toLocaleString("fr-FR")
        : "Aucune",
    getStatus: (d) =>
      (d.backups as Record<string, unknown>)?.lastStatus as string ?? "unknown",
    getDetail: (d) => d.backups as Record<string, unknown>,
    getTimestamp: (d) => (d.backups as Record<string, unknown>)?.lastBackupAt as string ?? null,
  },
  {
    id: "lastMigration",
    icon: GitMerge,
    title: "Dernière migration",
    getValue: (d) =>
      (d.migrations as Record<string, unknown>)?.lastAppliedAt
        ? new Date((d.migrations as Record<string, unknown>).lastAppliedAt as string).toLocaleString("fr-FR")
        : "Aucune",
    getStatus: (d) =>
      ((d.migrations as Record<string, unknown>)?.pending as number) > 0
        ? "degraded"
        : "healthy",
    getDetail: (d) => d.migrations as Record<string, unknown>,
    getTimestamp: (d) =>
      (d.migrations as Record<string, unknown>)?.lastAppliedAt as string ?? null,
  },
  {
    id: "version",
    icon: Tag,
    title: "Version App",
    getValue: (d) => (d.version as Record<string, unknown>)?.app as string ?? "—",
    getStatus: () => "healthy",
    getDetail: (d) => d.version as Record<string, unknown>,
    getTimestamp: () => null,
  },
  {
    id: "uptime",
    icon: Activity,
    title: "Uptime",
    getValue: (d) => {
      const secs = (d.uptime as number) ?? 0;
      const d2 = Math.floor(secs / 86400);
      const h = Math.floor((secs % 86400) / 3600);
      const m = Math.floor((secs % 3600) / 60);
      return `${d2}j ${h}h ${m}m`;
    },
    getStatus: () => "healthy",
    getDetail: () => null,
    getTimestamp: () => null,
  },
];

export function OverviewTab() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getSystemOverview()
      .then((d) => {
        setData(d);
        setLastRefreshed(new Date());
        setCountdown(REFRESH_INTERVAL);
      })
      .catch((e: unknown) => {
        const err = e as { response?: { data?: { message?: string } }; message?: string };
        setError(err?.response?.data?.message ?? err?.message ?? "Erreur serveur");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          load();
          return REFRESH_INTERVAL;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {lastRefreshed
            ? `Mis à jour : ${lastRefreshed.toLocaleTimeString("fr-FR")}`
            : "Chargement…"}
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
            Actualisation dans {countdown}s
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((card) => {
          const Icon = card.icon;
          const value = card.getValue(data);
          const status = card.getStatus(data);
          const timestamp = card.getTimestamp(data);
          const detail = card.getDetail(data);
          const isExpanded = expandedCard === card.id;

          return (
            <div key={card.id} className="space-y-0">
              <div
                className={`border-l-4 rounded-lg p-4 cursor-pointer transition-shadow hover:shadow-md ${statusColor(status)}`}
                onClick={() =>
                  detail
                    ? setExpandedCard(isExpanded ? null : card.id)
                    : undefined
                }
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {card.title}
                    </span>
                  </div>
                  {detail && (
                    <span className="text-gray-400">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDot(status)}`}
                  />
                  <span className="text-lg font-semibold text-gray-900 truncate">
                    {String(value)}
                  </span>
                </div>
                {timestamp && (
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(timestamp).toLocaleString("fr-FR")}
                  </p>
                )}
              </div>

              {/* Expanded detail */}
              {isExpanded && detail && (
                <div className="border border-t-0 border-gray-200 rounded-b-lg bg-gray-50 p-3">
                  <dl className="space-y-1">
                    {Object.entries(detail).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <dt className="text-gray-500 font-medium">{k}</dt>
                        <dd className="text-gray-700 max-w-[60%] truncate text-right">
                          {v === null || v === undefined
                            ? "—"
                            : typeof v === "object"
                            ? JSON.stringify(v)
                            : String(v)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
