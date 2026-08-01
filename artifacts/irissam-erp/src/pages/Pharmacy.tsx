import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { cn } from "@/lib/utils";
import {
  Pill,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  Package,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Check,
  X,
} from "lucide-react";
import {
  useGetMedications,
  useUpdateMedicationStock,
} from "@workspace/api-client-react";
import type { MedicationItem } from "@workspace/api-client-react";

// ─── Status config ────────────────────────────────────────────────────────────

type MedStatus = "ok" | "low" | "critical" | "expired";

const STATUS_CONFIG: Record<
  MedStatus,
  { label: string; icon: React.ReactNode; badge: string; row: string }
> = {
  ok: {
    label: "OK",
    icon: <CheckCircle className="w-4 h-4" />,
    badge: "bg-green-100 text-green-700 border-green-200",
    row: "",
  },
  low: {
    label: "Faible",
    icon: <AlertTriangle className="w-4 h-4" />,
    badge: "bg-yellow-100 text-yellow-700 border-yellow-200",
    row: "bg-yellow-50/50",
  },
  critical: {
    label: "Critique",
    icon: <XCircle className="w-4 h-4" />,
    badge: "bg-red-100 text-red-700 border-red-200",
    row: "bg-red-50/60",
  },
  expired: {
    label: "Périmé",
    icon: <Clock className="w-4 h-4" />,
    badge: "bg-gray-100 text-gray-600 border-gray-200",
    row: "bg-gray-50/60 opacity-80",
  },
};

const STATUS_ORDER: MedStatus[] = ["critical", "low", "expired", "ok"];

const ALL_STATUSES: Array<MedStatus | "all"> = [
  "all",
  "critical",
  "low",
  "expired",
  "ok",
];

const PAGE_SIZE = 20;

// ─── Inline stock editor ──────────────────────────────────────────────────────

function StockEditor({
  med,
  onSaved,
}: {
  med: MedicationItem;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(med.quantity));
  const [error, setError] = useState<string | null>(null);

  const mutation = useUpdateMedicationStock();

  const handleSave = () => {
    const qty = parseInt(value, 10);
    if (isNaN(qty) || qty < 0) {
      setError("Entier ≥ 0 requis");
      return;
    }
    mutation.mutate(
      { id: med.id, data: { quantity: qty } },
      {
        onSuccess: () => {
          setEditing(false);
          setError(null);
          onSaved();
        },
        onError: () => {
          setError("Erreur de mise à jour");
        },
      },
    );
  };

  const handleCancel = () => {
    setValue(String(med.quantity));
    setEditing(false);
    setError(null);
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-2 justify-end">
        <span className="font-mono font-semibold tabular-nums">
          {med.quantity}
        </span>
        <span className="text-xs text-gray-400">{med.unit}</span>
        <button
          onClick={() => setEditing(true)}
          title="Modifier le stock"
          className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      <div className="flex flex-col items-end">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
            autoFocus
            className="w-20 px-2 py-0.5 text-sm font-mono border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="p-1 rounded text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCancel}
            className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {error && <p className="text-[10px] text-red-500 mt-0.5">{error}</p>}
      </div>
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  count,
  label,
  icon,
  color,
}: {
  count: number;
  label: string;
  icon: React.ReactNode;
  color: string;
}) {
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PharmacyPage() {
  const [statusFilter, setStatusFilter] = useState<MedStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  // Debounce search input
  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((handleSearchChange as any)._t);
    (handleSearchChange as any)._t = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
  };

  // Poll every 30 s so stock changes made elsewhere appear automatically
  const POLL_INTERVAL = 30_000;

  const { data, isLoading, isError, refetch } = useGetMedications(
    {
      status: statusFilter === "all" ? undefined : statusFilter,
      search: debouncedSearch || undefined,
      page,
      pageSize: PAGE_SIZE,
    },
    {
      query: {
        queryKey: ["medications", statusFilter, debouncedSearch, page, refreshKey],
        refetchInterval: POLL_INTERVAL,
      },
    },
  );

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    refetch();
  };

  const handleStockSaved = () => {
    setRefreshKey((k) => k + 1);
  };

  // Summary counts (all data, no filter) — also polled
  const { data: allData } = useGetMedications(
    { pageSize: 1000 },
    {
      query: {
        queryKey: ["medications-all", refreshKey],
        refetchInterval: POLL_INTERVAL,
      },
    },
  );

  const summary = useMemo(() => {
    const items = allData?.data ?? [];
    return {
      total: allData?.total ?? 0,
      critical: items.filter((m) => m.status === "critical").length,
      low: items.filter((m) => m.status === "low").length,
      expired: items.filter((m) => m.status === "expired").length,
    };
  }, [allData]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <DashboardLayout>
      <PageWrapper>
        <PageHeader
          title="Pharmacie & Stock"
          subtitle="Gestion de l'inventaire médicamenteux"
          breadcrumbs={[{ label: "Pharmacie" }]}
          actions={
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Actualiser
            </button>
          }
        />

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            count={summary.total}
            label="Médicaments"
            color="bg-blue-600 text-white"
            icon={<Package className="w-5 h-5" />}
          />
          <SummaryCard
            count={summary.critical}
            label="Critiques"
            color="bg-red-600 text-white"
            icon={<XCircle className="w-5 h-5" />}
          />
          <SummaryCard
            count={summary.low}
            label="Stock faible"
            color="bg-yellow-500 text-white"
            icon={<AlertTriangle className="w-5 h-5" />}
          />
          <SummaryCard
            count={summary.expired}
            label="Périmés"
            color="bg-gray-700 text-white"
            icon={<Clock className="w-5 h-5" />}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Status filter tabs */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm shrink-0">
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                  statusFilter === s
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-50",
                )}
              >
                {s === "all"
                  ? "Tous"
                  : STATUS_CONFIG[s as MedStatus].label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un médicament…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <p className="flex items-center text-sm text-gray-500 ml-auto shrink-0">
            <span className="font-semibold text-gray-800">{data?.total ?? "–"}</span>
            &nbsp;résultat{(data?.total ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {isLoading && (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              <span className="text-sm">Chargement…</span>
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center justify-center py-16 text-red-500">
              <AlertTriangle className="w-8 h-8 mb-2 opacity-60" />
              <p className="text-sm">Erreur lors du chargement des médicaments.</p>
              <button
                onClick={handleRefresh}
                className="mt-3 text-sm text-blue-600 hover:underline"
              >
                Réessayer
              </button>
            </div>
          )}

          {!isLoading && !isError && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">
                        Médicament
                      </th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">
                        Stock actuel
                      </th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">
                        Seuil d'alerte
                      </th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">
                        Péremption
                      </th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(data?.data ?? []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-gray-400">
                          <Pill className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p>Aucun médicament trouvé.</p>
                        </td>
                      </tr>
                    )}
                    {(data?.data ?? [])
                      .slice()
                      .sort(
                        (a, b) =>
                          STATUS_ORDER.indexOf(a.status as MedStatus) -
                          STATUS_ORDER.indexOf(b.status as MedStatus),
                      )
                      .map((med) => {
                        const cfg = STATUS_CONFIG[med.status as MedStatus];
                        const expiry = med.expiryDate
                          ? new Date(med.expiryDate)
                          : null;

                        return (
                          <tr
                            key={med.id}
                            className={cn(
                              "transition-colors hover:bg-gray-50/80",
                              cfg.row,
                            )}
                          >
                            {/* Name */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Pill className="w-4 h-4 text-blue-400 shrink-0" />
                                <span className="font-medium text-gray-900 truncate max-w-[200px]">
                                  {med.name}
                                </span>
                              </div>
                            </td>

                            {/* Stock editor */}
                            <td className="px-4 py-3">
                              <StockEditor
                                key={`${med.id}-${med.quantity}`}
                                med={med}
                                onSaved={handleStockSaved}
                              />
                            </td>

                            {/* Threshold */}
                            <td className="px-4 py-3 text-right hidden sm:table-cell text-gray-500 font-mono tabular-nums">
                              {med.lowStockThreshold}{" "}
                              <span className="text-xs">{med.unit}</span>
                            </td>

                            {/* Expiry */}
                            <td className="px-4 py-3 text-center hidden md:table-cell">
                              {expiry ? (
                                <span
                                  className={cn(
                                    "text-xs font-medium",
                                    med.status === "expired"
                                      ? "text-gray-500 line-through"
                                      : med.expiringSoon
                                        ? "text-orange-600 font-semibold"
                                        : "text-gray-600",
                                  )}
                                >
                                  {expiry.toLocaleDateString("fr-FR", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                  {med.expiringSoon && (
                                    <span className="ml-1 text-[10px] bg-orange-100 text-orange-600 border border-orange-200 px-1 rounded">
                                      bientôt
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-300 text-xs">—</span>
                              )}
                            </td>

                            {/* Status badge */}
                            <td className="px-4 py-3">
                              <div className="flex justify-center">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                                    cfg.badge,
                                  )}
                                >
                                  {cfg.icon}
                                  {cfg.label}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/60">
                  <p className="text-xs text-gray-500">
                    Page {page} sur {totalPages} — {data?.total} médicament
                    {(data?.total ?? 0) !== 1 ? "s" : ""}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const p = Math.min(
                        Math.max(1, page - 2) + i,
                        totalPages,
                      );
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={cn(
                            "w-7 h-7 rounded text-xs font-medium transition-colors",
                            p === page
                              ? "bg-blue-600 text-white"
                              : "text-gray-500 hover:bg-gray-100",
                          )}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </PageWrapper>
    </DashboardLayout>
  );
}
