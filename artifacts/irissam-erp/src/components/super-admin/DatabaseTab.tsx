import { toast } from "@/hooks/use-toast";
import { useState, useCallback, useEffect } from "react";
import {
  RefreshCw,
  Download,
  PlayCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import {
  getDatabaseStats,
  getSlowQueries,
  getDatabaseLocks,
  cancelDatabaseQuery,
  runDatabaseAnalyze,
} from "@/services/api/system";
import { StepUpDialog } from "./StepUpDialog";

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

interface DBStats {
  name?: string;
  version?: string;
  size?: string;
  activeConnections?: number;
  maxConnections?: number;
  tableSizes?: Array<{ relname: string; size: string; rows: number }>;
  [key: string]: unknown;
}

interface SlowQuery {
  pid: number;
  usename?: string;
  state?: string;
  duration?: string | number;
  query?: string;
  [key: string]: unknown;
}

interface DBLock {
  pid: number;
  locktype?: string;
  mode?: string;
  granted?: boolean;
  [key: string]: unknown;
}

function useData<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fn()
      .then(setData)
      .catch((e: unknown) => {
        const err = e as { response?: { data?: { message?: string } }; message?: string };
        setError(err?.response?.data?.message ?? err?.message ?? "Erreur serveur");
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, [load]);
  return { data, loading, error, reload: load };
}

export function DatabaseTab() {
  const stats = useData<DBStats>(getDatabaseStats);
  const slowQueries = useData<SlowQuery[]>(getSlowQueries);
  const locks = useData<DBLock[]>(getDatabaseLocks);

  const [cancelPid, setCancelPid] = useState<number | null>(null);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState<string | null>(null);

  const handleRefreshAll = () => {
    stats.reload();
    slowQueries.reload();
    locks.reload();
  };

  const handleCancelClick = (pid: number) => {
    setCancelPid(pid);
    setStepUpOpen(true);
  };

  const handleStepUpSuccess = async (token: string) => {
    setStepUpOpen(false);
    if (cancelPid == null) return;
    try {
      await cancelDatabaseQuery(cancelPid, token);
      slowQueries.reload();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      toast({ variant: "destructive", title: "Erreur", description: err?.response?.data?.message ?? err?.message ?? "Opération impossible" });
    } finally {
      setCancelPid(null);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzeLoading(true);
    setAnalyzeMsg(null);
    try {
      await runDatabaseAnalyze();
      setAnalyzeMsg("ANALYZE exécuté avec succès.");
      stats.reload();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setAnalyzeMsg(err?.response?.data?.message ?? err?.message ?? "Erreur");
    } finally {
      setAnalyzeLoading(false);
    }
  };

  const loading = stats.loading && slowQueries.loading && locks.loading;

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <StepUpDialog
        open={stepUpOpen}
        onClose={() => {
          setStepUpOpen(false);
          setCancelPid(null);
        }}
        onSuccess={handleStepUpSuccess}
        title="Annuler une requête"
        description={`Confirmez votre mot de passe pour annuler la requête PID ${cancelPid}.`}
      />

      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleRefreshAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
        <button
          onClick={handleAnalyze}
          disabled={analyzeLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          <PlayCircle className="w-4 h-4" />
          {analyzeLoading ? "Analyse en cours…" : "Lancer ANALYZE"}
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <Download className="w-4 h-4" />
          Exporter
        </button>
        {analyzeMsg && (
          <span className="text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
            {analyzeMsg}
          </span>
        )}
      </div>

      {/* Info bar */}
      {stats.error ? (
        <ErrorMsg msg={stats.error} />
      ) : stats.data ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Base", value: stats.data.name ?? "—" },
            { label: "Version", value: stats.data.version ?? "—" },
            { label: "Taille", value: stats.data.size ?? "—" },
            {
              label: "Connexions",
              value: `${stats.data.activeConnections ?? 0} / ${stats.data.maxConnections ?? "?"}`,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-white border border-gray-200 rounded-lg p-4"
            >
              <p className="text-xs text-gray-500 mb-1">{item.label}</p>
              <p className="text-sm font-semibold text-gray-900 truncate">
                {String(item.value)}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Slow Queries */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-orange-500" />
          Requêtes longues en cours
        </h3>
        {slowQueries.loading ? (
          <div className="h-8 bg-gray-100 animate-pulse rounded" />
        ) : slowQueries.error ? (
          <ErrorMsg msg={slowQueries.error} />
        ) : !slowQueries.data?.length ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            Aucune requête longue détectée
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["PID", "Utilisateur", "État", "Durée", "Requête", "Action"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {slowQueries.data.map((q) => (
                  <tr key={q.pid} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm font-mono text-gray-700">
                      {q.pid}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-700">
                      {q.usename ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-700">
                      {q.state ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-700">
                      {q.duration ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 font-mono max-w-xs">
                      <span title={q.query}>
                        {q.query ? q.query.slice(0, 100) + (q.query.length > 100 ? "…" : "") : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleCancelClick(q.pid)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Annuler
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Locks */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Verrous (Locks)</h3>
        {locks.loading ? (
          <div className="h-8 bg-gray-100 animate-pulse rounded" />
        ) : locks.error ? (
          <ErrorMsg msg={locks.error} />
        ) : !locks.data?.length ? (
          <p className="text-sm text-gray-400 py-4 text-center">Aucun verrou actif</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["PID", "Type de verrou", "Mode", "Accordé"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {locks.data.map((lock, i) => (
                  <tr key={`${lock.pid}-${i}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm font-mono text-gray-700">
                      {lock.pid}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-700">
                      {lock.locktype ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-700">
                      {lock.mode ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-sm">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${lock.granted ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                      >
                        {lock.granted ? "Oui" : "Non"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Table Sizes */}
      {stats.data?.tableSizes && Array.isArray(stats.data.tableSizes) && stats.data.tableSizes.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Tailles des tables (Top 10)
          </h3>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {stats.data.tableSizes.slice(0, 10).map((t) => (
                <li key={t.relname} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50">
                  <span className="text-sm font-mono text-gray-700">{t.relname}</span>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{t.size}</span>
                    <span>{(t.rows ?? 0).toLocaleString("fr-FR")} lignes</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
