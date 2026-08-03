import { useState, useCallback, useEffect } from "react";
import {
  Database,
  HardDrive,
  Bell,
  Mail,
  Briefcase,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
} from "lucide-react";
import {
  getHealthDatabase,
  getHealthStorage,
  getHealthNotifications,
  getHealthEmail,
  getHealthJobs,
} from "@/services/api/system";

interface ServiceHealth {
  status: string;
  responseTimeMs?: number;
  message?: string;
  lastSuccess?: string;
  lastFailure?: string;
  [key: string]: unknown;
}

interface HealthResults {
  database: ServiceHealth | null;
  storage: ServiceHealth | null;
  notifications: ServiceHealth | null;
  email: ServiceHealth | null;
  jobs: ServiceHealth | null;
}

type ServiceKey = keyof HealthResults;

const SERVICES: {
  key: ServiceKey;
  label: string;
  icon: React.ElementType;
  fetcher: () => Promise<ServiceHealth>;
}[] = [
  { key: "database", label: "Base de données", icon: Database, fetcher: getHealthDatabase },
  { key: "storage", label: "Stockage", icon: HardDrive, fetcher: getHealthStorage },
  { key: "notifications", label: "Notifications", icon: Bell, fetcher: getHealthNotifications },
  { key: "email", label: "Email / SMTP", icon: Mail, fetcher: getHealthEmail },
  { key: "jobs", label: "Background Jobs", icon: Briefcase, fetcher: getHealthJobs },
];

function StatusIcon({ status }: { status: string }) {
  const s = status?.toLowerCase();
  if (s === "healthy" || s === "ok" || s === "active")
    return <CheckCircle className="w-8 h-8 text-green-500" />;
  if (s === "degraded" || s === "warning")
    return <AlertTriangle className="w-8 h-8 text-yellow-500" />;
  if (s === "down" || s === "error" || s === "failed")
    return <XCircle className="w-8 h-8 text-red-500" />;
  return <HelpCircle className="w-8 h-8 text-gray-400" />;
}

function statusBadgeClass(status: string) {
  const s = status?.toLowerCase();
  if (s === "healthy" || s === "ok" || s === "active")
    return "bg-green-100 text-green-800";
  if (s === "degraded" || s === "warning") return "bg-yellow-100 text-yellow-800";
  if (s === "down" || s === "error" || s === "failed")
    return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-600";
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 animate-pulse">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-8 h-8 bg-gray-200 rounded-full" />
        <div className="h-5 bg-gray-200 rounded w-32" />
      </div>
      <div className="h-8 bg-gray-200 rounded w-24 mb-3" />
      <div className="space-y-2">
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-3/4" />
      </div>
    </div>
  );
}

export function HealthTab() {
  const [results, setResults] = useState<HealthResults>({
    database: null,
    storage: null,
    notifications: null,
    email: null,
    jobs: null,
  });
  const [errors, setErrors] = useState<Partial<Record<ServiceKey, string>>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setErrors({});
    Promise.allSettled(SERVICES.map((s) => s.fetcher())).then((settled) => {
      const newResults: HealthResults = { ...results };
      const newErrors: Partial<Record<ServiceKey, string>> = {};
      settled.forEach((result, idx) => {
        const key = SERVICES[idx].key;
        if (result.status === "fulfilled") {
          newResults[key] = result.value;
        } else {
          const err = result.reason as {
            response?: { data?: { message?: string } };
            message?: string;
          };
          newErrors[key] =
            err?.response?.data?.message ?? err?.message ?? "Erreur";
          newResults[key] = { status: "error", message: newErrors[key] ?? "Erreur" };
        }
      });
      setResults(newResults);
      setErrors(newErrors);
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-700">
          État des services système
        </h2>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && !Object.values(results).some(Boolean)
          ? SERVICES.map((s) => <SkeletonCard key={s.key} />)
          : SERVICES.map((s) => {
              const health = results[s.key];
              const Icon = s.icon;
              const status = health?.status ?? "unknown";

              return (
                <div
                  key={s.key}
                  className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-gray-500" />
                      <span className="font-semibold text-gray-800 text-sm">
                        {s.label}
                      </span>
                    </div>
                    <StatusIcon status={status} />
                  </div>

                  <div>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${statusBadgeClass(status)}`}
                    >
                      {status}
                    </span>
                  </div>

                  {errors[s.key] && (
                    <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                      {errors[s.key]}
                    </p>
                  )}

                  {health?.responseTimeMs !== undefined && (
                    <p className="text-xs text-gray-500">
                      Temps de réponse :{" "}
                      <span className="font-medium text-gray-700">
                        {health.responseTimeMs} ms
                      </span>
                    </p>
                  )}

                  {health?.message && (
                    <p className="text-xs text-gray-600">{health.message}</p>
                  )}

                  <div className="space-y-1 pt-1 border-t border-gray-100">
                    {health?.lastSuccess && (
                      <p className="text-xs text-gray-400">
                        Dernier succès :{" "}
                        {new Date(health.lastSuccess).toLocaleString("fr-FR")}
                      </p>
                    )}
                    {health?.lastFailure && (
                      <p className="text-xs text-red-400">
                        Dernier échec :{" "}
                        {new Date(health.lastFailure).toLocaleString("fr-FR")}
                      </p>
                    )}
                    {!health?.lastSuccess && !health?.lastFailure && (
                      <p className="text-xs text-gray-300">
                        Aucun historique disponible
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}
