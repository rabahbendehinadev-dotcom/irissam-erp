import { useState, useCallback, useEffect } from "react";
import {
  RefreshCw,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  XCircle,
  FileText,
  X,
} from "lucide-react";
import { getJobs, retryJob, cancelJob, pauseQueue, resumeQueue } from "@/services/api/system";

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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: "bg-green-100 text-green-800",
    active: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    scheduled: "bg-yellow-100 text-yellow-800",
    running: "bg-blue-100 text-blue-800",
    retrying: "bg-blue-100 text-blue-800",
    failed: "bg-red-100 text-red-800",
    cancelled: "bg-gray-100 text-gray-600",
  };
  const cls = colors[status?.toLowerCase()] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={"inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium " + cls}>
      {status}
    </span>
  );
}

interface Job {
  id: string;
  type?: string;
  status: string;
  createdAt?: string;
  startedAt?: string;
  finishedAt?: string;
  logs?: string;
  error?: string;
  [key: string]: unknown;
}

interface JobsData {
  jobs?: Job[];
  queueStatus?: string;
  total?: number;
  [key: string]: unknown;
}

export function JobsTab() {
  const [data, setData] = useState<JobsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Logs drawer
  const [logsJob, setLogsJob] = useState<Job | null>(null);

  // Queue action feedback
  const [queueMsg, setQueueMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {};
    if (filterStatus) params.status = filterStatus;
    if (filterType) params.type = filterType;
    if (filterDateFrom) params.from = filterDateFrom;
    if (filterDateTo) params.to = filterDateTo;
    getJobs(params)
      .then(setData)
      .catch((e: unknown) => {
        const err = e as { response?: { data?: { message?: string } }; message?: string };
        setError(err?.response?.data?.message ?? err?.message ?? "Erreur serveur");
      })
      .finally(() => setLoading(false));
  }, [filterStatus, filterType, filterDateFrom, filterDateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRetry = async (id: string) => {
    try {
      await retryJob(id);
      load();
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(err?.message ?? "Erreur");
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelJob(id);
      load();
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(err?.message ?? "Erreur");
    }
  };

  const handlePause = async () => {
    try {
      await pauseQueue();
      setQueueMsg("File mise en pause.");
      load();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setQueueMsg(err?.message ?? "Erreur");
    }
  };

  const handleResume = async () => {
    try {
      await resumeQueue();
      setQueueMsg("File reprise.");
      load();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setQueueMsg(err?.message ?? "Erreur");
    }
  };

  const jobs = data?.jobs ?? [];

  return (
    <div className="space-y-6">
      {/* Logs drawer */}
      {logsJob && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="bg-white w-full max-w-lg h-full flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">
                  Logs — Job {logsJob.id}
                </h3>
                <p className="text-xs text-gray-500">{logsJob.type}</p>
              </div>
              <button
                onClick={() => setLogsJob(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              {logsJob.error && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {logsJob.error}
                </div>
              )}
              <pre className="text-xs font-mono text-gray-700 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap overflow-auto">
                {logsJob.logs ?? "Aucun log disponible"}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Tous</option>
            <option value="pending">En attente</option>
            <option value="running">En cours</option>
            <option value="completed">Terminé</option>
            <option value="failed">Échoué</option>
            <option value="cancelled">Annulé</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <input
            type="text"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            placeholder="Type de job…"
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Du</label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Au</label>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Queue controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">File :</span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${data?.queueStatus === "paused" ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"}`}
          >
            {data?.queueStatus ?? "active"}
          </span>
        </div>
        <button
          onClick={handlePause}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors"
        >
          <PauseCircle className="w-4 h-4" />
          Pause
        </button>
        <button
          onClick={handleResume}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
        >
          <PlayCircle className="w-4 h-4" />
          Reprendre
        </button>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
        {queueMsg && (
          <span className="text-sm text-gray-600">{queueMsg}</span>
        )}
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorMsg msg={error} />
      ) : jobs.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">Aucun job trouvé</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["ID", "Type", "Statut", "Créé le", "Démarré", "Terminé", "Actions"].map(
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
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm font-mono text-gray-700 max-w-[80px] truncate">
                      {job.id}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-700">{job.type ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {job.createdAt ? new Date(job.createdAt).toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {job.startedAt ? new Date(job.startedAt).toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {job.finishedAt ? new Date(job.finishedAt).toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        {(job.status === "failed" || job.status === "cancelled") && (
                          <button
                            onClick={() => handleRetry(job.id)}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-50 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Relancer
                          </button>
                        )}
                        {(job.status === "pending" || job.status === "running") && (
                          <button
                            onClick={() => handleCancel(job.id)}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Annuler
                          </button>
                        )}
                        <button
                          onClick={() => setLogsJob(job)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Logs
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-white border border-gray-200 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-500 truncate">{job.id}</span>
                  <StatusBadge status={job.status} />
                </div>
                <p className="text-sm font-medium text-gray-900">{job.type ?? "—"}</p>
                <div className="text-xs text-gray-500 space-y-0.5">
                  {job.createdAt && (
                    <p>Créé : {new Date(job.createdAt).toLocaleString("fr-FR")}</p>
                  )}
                  {job.finishedAt && (
                    <p>Terminé : {new Date(job.finishedAt).toLocaleString("fr-FR")}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(job.status === "failed" || job.status === "cancelled") && (
                    <button
                      onClick={() => handleRetry(job.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Relancer
                    </button>
                  )}
                  {(job.status === "pending" || job.status === "running") && (
                    <button
                      onClick={() => handleCancel(job.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 border border-red-200 rounded"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Annuler
                    </button>
                  )}
                  <button
                    onClick={() => setLogsJob(job)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Logs
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
