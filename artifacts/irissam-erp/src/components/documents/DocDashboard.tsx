import { useEffect, useState } from "react";
import { FileText, Upload, Clock, PenSquare, AlertTriangle, Archive, Eye, HardDrive } from "lucide-react";
import { docsApi, type DocDashboardKpis, type DocDashboardCharts, type DocRecord } from "@/services/api/documents";
import { formatFileSize } from "./DocStatusBadge";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"];

const KPI_CONFIG = [
  { key: "total", label: "Total documents", icon: FileText, color: "blue" },
  { key: "uploadedToday", label: "Ajoutés aujourd'hui", icon: Upload, color: "green" },
  { key: "pendingApproval", label: "En attente d'approbation", icon: Clock, color: "yellow" },
  { key: "toSign", label: "À signer", icon: PenSquare, color: "purple" },
  { key: "expiringIn30Days", label: "Expirant dans 30j", icon: AlertTriangle, color: "orange" },
  { key: "archived", label: "Archivés", icon: Archive, color: "gray" },
  { key: "sensitiveViewedToday", label: "Sensibles consultés auj.", icon: Eye, color: "red" },
];

const COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-100",
  green: "bg-green-50 text-green-700 border-green-100",
  yellow: "bg-yellow-50 text-yellow-700 border-yellow-100",
  purple: "bg-purple-50 text-purple-700 border-purple-100",
  orange: "bg-orange-50 text-orange-700 border-orange-100",
  gray: "bg-gray-50 text-gray-600 border-gray-100",
  red: "bg-red-50 text-red-700 border-red-100",
};

export function DocDashboard({ onNavigate }: { onNavigate?: (filters: any) => void }) {
  const [kpis, setKpis] = useState<DocDashboardKpis | null>(null);
  const [charts, setCharts] = useState<DocDashboardCharts | null>(null);
  const [recent, setRecent] = useState<DocRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      docsApi.getDashboardKpis(),
      docsApi.getDashboardCharts(),
      docsApi.getRecent(),
    ]).then(([k, c, r]) => {
      if (k.status === "fulfilled") setKpis(k.value);
      if (c.status === "fulfilled") setCharts(c.value);
      if (r.status === "fulfilled") setRecent(r.value.documents ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  const storageTotal = charts?.storageByCategory?.reduce((s, c) => s + Number(c.total_bytes), 0) ?? 0;

  return (
    <div className="p-4 space-y-6 overflow-y-auto">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {KPI_CONFIG.map(({ key, label, icon: Icon, color }) => (
          <div key={key}
            onClick={() => onNavigate?.({ status: key === "pendingApproval" ? "under_review" : key === "archived" ? "archived" : undefined })}
            className={`border rounded-xl p-3 cursor-pointer hover:shadow-md transition-all ${COLOR_MAP[color]}`}>
            <Icon size={18} className="mb-1.5 opacity-70" />
            <p className="text-2xl font-bold">{(kpis as any)?.[key] ?? 0}</p>
            <p className="text-xs opacity-80 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Uploads monthly */}
        <div className="bg-white border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">📊 Téléversements mensuels</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={charts?.uploadsMonthly ?? []}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: any) => [v, "Documents"]} />
              <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By category */}
        <div className="bg-white border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">📂 Par catégorie</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={(charts?.byCategory ?? []).slice(0, 8)} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={80} />
              <Tooltip />
              <Bar dataKey="count" fill="#10b981" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By status */}
        <div className="bg-white border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">🔄 Par statut</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={charts?.byStatus ?? []} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={70} label={({ status, count }) => `${status}: ${count}`} labelLine={false}>
                {(charts?.byStatus ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Storage by category */}
        <div className="bg-white border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">💾 Stockage par catégorie</h3>
          <div className="flex items-center gap-2 mb-3">
            <HardDrive size={16} className="text-blue-500" />
            <span className="text-sm font-bold text-gray-700">Total: {formatFileSize(storageTotal)}</span>
          </div>
          <div className="space-y-2 max-h-36 overflow-y-auto">
            {(charts?.storageByCategory ?? []).slice(0, 8).map((c, i) => {
              const pct = storageTotal > 0 ? (Number(c.total_bytes) / storageTotal) * 100 : 0;
              return (
                <div key={c.category}>
                  <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                    <span>{c.category.replace("_"," ")} ({c.count})</span>
                    <span>{formatFileSize(Number(c.total_bytes))}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct.toFixed(1)}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent documents */}
      <div className="bg-white border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">🕐 Documents récents</h3>
        <div className="divide-y">
          {recent.slice(0, 8).map(doc => (
            <div key={doc.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="text-base flex-shrink-0">📄</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-700 truncate">{doc.title}</p>
                <p className="text-xs text-gray-400">{doc.documentNumber} · {doc.createdByName}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full
                  ${doc.status === "approved" ? "bg-green-100 text-green-700" :
                    doc.status === "under_review" ? "bg-yellow-100 text-yellow-700" :
                    "bg-blue-100 text-blue-700"}`}>
                  {doc.status}
                </span>
                <span className="text-xs text-gray-400 hidden sm:block">{new Date(doc.createdAt).toLocaleDateString("fr-FR")}</span>
              </div>
            </div>
          ))}
          {!recent.length && <p className="text-sm text-gray-400 text-center py-4">Aucun document récent</p>}
        </div>
      </div>
    </div>
  );
}
