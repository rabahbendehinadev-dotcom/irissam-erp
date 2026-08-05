import { toast } from "@/hooks/use-toast";
import { useState, useCallback, useEffect } from "react";
import { RefreshCw, Download, X } from "lucide-react";
import { getAuditLogs, exportAuditLogs } from "@/services/api/system";

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

function actionBadgeClass(action: string) {
  const a = action?.toLowerCase();
  if (a?.includes("delete") || a?.includes("block") || a?.includes("revoke"))
    return "bg-red-100 text-red-800";
  if (a?.includes("create") || a?.includes("add") || a?.includes("grant"))
    return "bg-green-100 text-green-800";
  if (a?.includes("update") || a?.includes("edit") || a?.includes("change"))
    return "bg-blue-100 text-blue-800";
  if (a?.includes("login") || a?.includes("auth"))
    return "bg-indigo-100 text-indigo-800";
  return "bg-gray-100 text-gray-600";
}

interface AuditEntry {
  id?: string | number;
  timestamp?: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  action?: string;
  module?: string;
  description?: string;
  ipAddress?: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

interface AuditData {
  logs?: AuditEntry[];
  total?: number;
  hasMore?: boolean;
  [key: string]: unknown;
}

const PAGE_SIZE = 50;

export function AuditTab() {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [allLogs, setAllLogs] = useState<AuditEntry[]>([]);

  // Filters
  const [filterUser, setFilterUser] = useState("");
  const [filterModule, setFilterModule] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Detail slide-in
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const load = useCallback(
    (pg = 1, append = false) => {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = { page: String(pg), limit: String(PAGE_SIZE) };
      if (filterUser) params.user = filterUser;
      if (filterModule) params.module = filterModule;
      if (filterAction) params.action = filterAction;
      if (filterDateFrom) params.from = filterDateFrom;
      if (filterDateTo) params.to = filterDateTo;
      getAuditLogs(params)
        .then((d: any) => {
          setData(d);
          const newLogs: AuditEntry[] = d?.logs ?? [];
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
    [filterUser, filterModule, filterAction, filterDateFrom, filterDateTo]
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

  const handleExport = async (format: "csv" | "pdf") => {
    try {
      const blob = await exportAuditLogs({ format });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({ variant: "destructive", title: "Erreur", description: err?.message ?? "Export impossible" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Detail slide-in */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="bg-white w-full max-w-lg h-full flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900 text-sm">
                Détail de l'audit
              </h3>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 space-y-4">
              <dl className="space-y-3">
                {[
                  { label: "Horodatage", value: selectedEntry.timestamp ? new Date(selectedEntry.timestamp).toLocaleString("fr-FR") : "—" },
                  { label: "Utilisateur", value: `${selectedEntry.userName ?? selectedEntry.userId ?? "—"} (${selectedEntry.userRole ?? "—"})` },
                  { label: "Action", value: selectedEntry.action ?? "—" },
                  { label: "Module", value: selectedEntry.module ?? "—" },
                  { label: "Description", value: selectedEntry.description ?? "—" },
                  { label: "IP", value: selectedEntry.ipAddress ?? "—" },
                ].map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {item.label}
                    </dt>
                    <dd className="mt-0.5 text-sm text-gray-800">{item.value}</dd>
                  </div>
                ))}
              </dl>
              {selectedEntry.details && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Détails
                  </p>
                  <pre className="text-xs font-mono text-gray-700 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap overflow-auto">
                    {JSON.stringify(selectedEntry.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Utilisateur</label>
          <input
            type="text"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            placeholder="Nom ou ID"
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Module</label>
          <input
            type="text"
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            placeholder="ex: patients"
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
          <input
            type="text"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            placeholder="ex: create"
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

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
            onClick={() => handleExport("csv")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={() => handleExport("pdf")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && allLogs.length === 0 ? (
        <Spinner />
      ) : error ? (
        <ErrorMsg msg={error} />
      ) : allLogs.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">Aucun log d'audit trouvé</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Horodatage", "Utilisateur / Rôle", "Action", "Module", "Description", "IP"].map(
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
              {allLogs.map((log, idx) => (
                <tr
                  key={log.id ?? idx}
                  className="hover:bg-indigo-50 cursor-pointer"
                  onClick={() => setSelectedEntry(log)}
                >
                  <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                    {log.timestamp
                      ? new Date(log.timestamp).toLocaleString("fr-FR")
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-sm text-gray-800 font-medium">
                      {log.userName ?? log.userId ?? "—"}
                    </div>
                    {log.userRole && (
                      <div className="text-xs text-gray-500">{log.userRole}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${actionBadgeClass(log.action ?? "")}`}
                    >
                      {log.action ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-700">{log.module ?? "—"}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600 max-w-xs truncate">
                    {log.description ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-500">
                    {log.ipAddress ?? "—"}
                  </td>
                </tr>
              ))}
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
export { AuditTab as default };
