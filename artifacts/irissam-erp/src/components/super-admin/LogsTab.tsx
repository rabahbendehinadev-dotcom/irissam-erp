import { useState, useCallback, useEffect } from "react";
import { RefreshCw, Download, ChevronDown, ChevronUp } from "lucide-react";
import { getSystemLogs, exportSystemLogs } from "@/services/api/system";

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

function levelClass(level: string) {
  const l = level?.toLowerCase();
  if (l === "error" || l === "fatal") return "bg-red-100 text-red-800";
  if (l === "warn" || l === "warning") return "bg-yellow-100 text-yellow-800";
  if (l === "info") return "bg-blue-100 text-blue-800";
  if (l === "debug") return "bg-gray-100 text-gray-600";
  return "bg-gray-100 text-gray-600";
}

interface LogEntry {
  id?: string | number;
  level: string;
  module?: string;
  message?: string;
  timestamp?: string;
  userId?: string;
  requestId?: string;
  context?: Record<string, unknown>;
  redacted?: boolean;
  [key: string]: unknown;
}

interface LogsData {
  logs?: LogEntry[];
  total?: number;
  page?: number;
  hasMore?: boolean;
  [key: string]: unknown;
}

const PAGE_SIZE = 50;

export function LogsTab() {
  const [data, setData] = useState<LogsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);

  // Filters
  const [filterLevel, setFilterLevel] = useState("");
  const [filterModule, setFilterModule] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [filterRequestId, setFilterRequestId] = useState("");

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(
    (pg = 1, append = false) => {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = { page: String(pg), limit: String(PAGE_SIZE) };
      if (filterLevel) params.level = filterLevel;
      if (filterModule) params.module = filterModule;
      if (filterDateFrom) params.from = filterDateFrom;
      if (filterDateTo) params.to = filterDateTo;
      if (filterUserId) params.userId = filterUserId;
      if (filterRequestId) params.requestId = filterRequestId;
      getSystemLogs(params)
        .then((d) => {
          setData(d);
          const newLogs: LogEntry[] = d?.logs ?? [];
          if (append) {
            setAllLogs((prev) => [...prev, ...newLogs]);
          } else {
            setAllLogs(newLogs);
          }
        })
        .catch((e: unknown) => {
          const err = e as { response?: { data?: { message?: string } }; message?: string };
          setError(err?.response?.data?.message ?? err?.message ?? "Erreur serveur");
        })
        .finally(() => setLoading(false));
    },
    [filterLevel, filterModule, filterDateFrom, filterDateTo, filterUserId, filterRequestId]
  );

  useEffect(() => {
    setPage(1);
    load(1, false);
  }, [load]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    load(nextPage, true);
  };

  const handleExport = async () => {
    try {
      const blob = await exportSystemLogs();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(err?.message ?? "Erreur export");
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const logId = (log: LogEntry, idx: number): string =>
    log.id !== undefined ? String(log.id) : `log-${idx}`;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Niveau</label>
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Tous</option>
            <option value="debug">DEBUG</option>
            <option value="info">INFO</option>
            <option value="warn">WARN</option>
            <option value="error">ERROR</option>
            <option value="fatal">FATAL</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Module</label>
          <input
            type="text"
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            placeholder="ex: auth"
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
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">User ID</label>
          <input
            type="text"
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            placeholder="ID utilisateur"
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Request ID</label>
          <input
            type="text"
            value={filterRequestId}
            onChange={(e) => setFilterRequestId(e.target.value)}
            placeholder="Request ID"
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {data?.total !== undefined ? `${data.total} entrées` : ""}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(1, false)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exporter CSV
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && allLogs.length === 0 ? (
        <Spinner />
      ) : error ? (
        <ErrorMsg msg={error} />
      ) : allLogs.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">Aucun log trouvé</div>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Horodatage", "Niveau", "Module", "Message", "User ID", "Request ID", ""].map(
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
              {allLogs.map((log, idx) => {
                const id = logId(log, idx);
                const isExpanded = expandedId === id;
                return (
                  <>
                    <tr
                      key={id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => log.context && toggleExpand(id)}
                    >
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                        {log.timestamp
                          ? new Date(log.timestamp).toLocaleString("fr-FR")
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${levelClass(log.level)}`}
                        >
                          {log.level}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-700">{log.module ?? "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-800 max-w-xs">
                        {log.redacted ? (
                          <span className="italic text-gray-400">[redacted]</span>
                        ) : (
                          <span className="truncate block">{log.message ?? "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{log.userId ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs font-mono text-gray-500">
                        {log.requestId ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400">
                        {log.context &&
                          (isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          ))}
                      </td>
                    </tr>
                    {isExpanded && log.context && (
                      <tr key={`${id}-detail`} className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-3">
                          <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap overflow-auto max-h-48">
                            {JSON.stringify(log.context, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Load more */}
      {data?.hasMore && (
        <div className="text-center">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="px-6 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
          >
            {loading ? "Chargement…" : "Charger plus"}
          </button>
        </div>
      )}
    </div>
  );
}
