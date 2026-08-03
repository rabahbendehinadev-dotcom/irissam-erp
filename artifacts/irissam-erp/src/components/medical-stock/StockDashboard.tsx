import { useQuery } from "@/hooks/useQuery";
import { AlertTriangle, Package, TrendingDown, TrendingUp, DollarSign, Clock, ShoppingCart, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  rupture: "bg-red-100 text-red-700",
  critique: "bg-orange-100 text-orange-700",
  faible: "bg-yellow-100 text-yellow-700",
  normal: "bg-green-100 text-green-700",
  surstock: "bg-blue-100 text-blue-700",
};

function KpiCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function StockDashboard() {
  const { data, loading, error, refetch } = useQuery<any>("/medical-stock/dashboard");

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-64 bg-gray-200 rounded-xl" />)}
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <AlertTriangle className="w-10 h-10 text-red-500" />
      <p className="text-red-600 font-medium">Erreur de chargement du tableau de bord</p>
      <button onClick={refetch} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
        <RefreshCw className="w-4 h-4" /> Réessayer
      </button>
    </div>
  );

  const { kpis, byCategory, topItems, topDepartments, movementsTrend, expirations } = data;
  const fmt = (n: number) => new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(n);
  const fmtCur = (n: number) => new Intl.NumberFormat("fr-DZ", { style: "decimal", maximumFractionDigits: 0 }).format(n) + " DZD";

  const alertCount = (kpis.ruptureCount || 0) + (kpis.criticalCount || 0) +
    (expirations?.expired || 0) + (expirations?.critical_7d || 0);

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Articles actifs"  value={fmt(kpis.totalItems)}     icon={Package}       color="bg-blue-50 text-blue-600" />
        <KpiCard label="Valeur du stock"  value={fmtCur(kpis.totalValue)}  icon={DollarSign}    color="bg-emerald-50 text-emerald-600" />
        <KpiCard label="Ruptures"         value={fmt(kpis.ruptureCount)}   icon={AlertTriangle} color="bg-red-50 text-red-600" />
        <KpiCard label="Critiques"        value={fmt(kpis.criticalCount)}  icon={TrendingDown}  color="bg-orange-50 text-orange-600" />
        <KpiCard label="Produits expirés" value={fmt(expirations?.expired ?? 0)} icon={Clock}   color="bg-red-50 text-red-600" />
        <KpiCard label="Surstock"         value={fmt(kpis.overstockCount)} icon={TrendingUp}    color="bg-blue-50 text-blue-600" />
      </div>

      {/* Alert banner */}
      {alertCount > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">
            <span className="font-semibold">{alertCount} alertes actives</span> — {kpis.ruptureCount} ruptures,{" "}
            {kpis.criticalCount} critiques, {(expirations?.expired ?? 0) + (expirations?.critical_7d ?? 0)} lots expirés/critiques
          </p>
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stock by category */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Valeur par catégorie</h3>
          {byCategory?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}>
                  {byCategory.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.color || `hsl(${i * 60}, 60%, 50%)`} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [fmtCur(Number(v)), "Valeur"]} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">Aucune donnée</div>}
        </div>

        {/* Movements trend */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Mouvements — 7 derniers jours</h3>
          {movementsTrend?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={movementsTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => new Date(v).toLocaleDateString("fr-FR", { weekday: "short" })} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="entries" name="Entrées" fill="#10B981" radius={[3,3,0,0]} />
                <Bar dataKey="exits"   name="Sorties"  fill="#EF4444" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">Aucun mouvement</div>}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top items by value */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Top 10 articles (valeur)</h3>
          {topItems?.length ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {topItems.map((it: any, i: number) => (
                <div key={it.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{it.name}</p>
                    <p className="text-xs text-gray-400">{it.code} · {Number(it.quantity_on_hand).toFixed(0)} {it.unit_symbol}</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-700 shrink-0">{fmtCur(Number(it.value))}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400 text-center py-8">Aucun article</p>}
        </div>

        {/* Expirations summary */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Péremptions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Expirés",      value: expirations?.expired ?? 0,    color: "bg-red-100 text-red-700" },
              { label: "≤ 7 jours",   value: expirations?.critical_7d ?? 0, color: "bg-red-100 text-red-700" },
              { label: "≤ 30 jours",  value: expirations?.urgent_30d ?? 0,  color: "bg-orange-100 text-orange-700" },
              { label: "≤ 90 jours",  value: expirations?.warn_90d ?? 0,    color: "bg-yellow-100 text-yellow-700" },
            ].map((e) => (
              <div key={e.label} className={`rounded-lg p-3 ${e.color}`}>
                <p className="text-2xl font-bold">{e.value}</p>
                <p className="text-xs mt-0.5">{e.label}</p>
              </div>
            ))}
          </div>
          {topDepartments?.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">Top services consommateurs (30j)</h3>
              <div className="space-y-1.5">
                {topDepartments.slice(0, 5).map((d: any) => (
                  <div key={d.department} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 truncate flex-1">{d.department}</span>
                    <span className="text-gray-900 font-medium ml-2">{fmtCur(Number(d.total_value))}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
