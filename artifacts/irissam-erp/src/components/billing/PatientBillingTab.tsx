/**
 * PatientBillingTab — Financial Summary with KPIs + charts + module breakdown.
 */
import { useState, useEffect, useCallback } from "react";
import { TrendingUp, Banknote, AlertCircle, Building2, RefreshCw } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import { apiClient } from "@/services/api/client";

// ── types ─────────────────────────────────────────────────────────────────────

interface ModuleAmount { module: string; amount: number; count: number }

interface FinancialSummary {
  totalFacture:        number;
  totalPaye:           number;
  totalReste:          number;
  totalCreances:       number;
  totalCnas:           number;
  totalCasnos:         number;
  totalAutreAssurance: number;
  lastInvoiceDate:     string | null;
  lastPaymentDate:     string | null;
  invoiceCount:        number;
  paymentCount:        number;
  monthlyInvoices:     Array<{ month: string; amount: number; count: number }>;
  monthlyPayments:     Array<{ month: string; amount: number; count: number }>;
  byModule:            ModuleAmount[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return (n ?? 0).toLocaleString("fr-DZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtDate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-DZ", { day: "2-digit", month: "short", year: "numeric" });
}

function KpiCard({ label, value, sub, Icon, colorClass }: {
  label: string; value: string; sub?: string; Icon: React.ElementType; colorClass: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
      <div className={`p-2.5 rounded-lg ${colorClass}`}><Icon className="w-5 h-5" /></div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500 font-medium">{label}</div>
        <div className="text-xl font-bold text-gray-800 mt-0.5 truncate">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

const MODULE_LABELS: Record<string, string> = {
  consultations: "Consultation", laboratoire: "Laboratoire", imagerie: "Imagerie",
  pharmacie: "Pharmacie", hospitalisation: "Hospitalisation", bloc: "Bloc",
  reanimation: "Réanimation", system: "Divers", admissions: "Admissions",
  urgences: "Urgences",
};

const PIE_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#84cc16","#ec4899"];

// ── component ─────────────────────────────────────────────────────────────────

interface Props { patientId: string }

export function PatientBillingTab({ patientId }: Props) {
  const [data,    setData]    = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await apiClient.get<FinancialSummary>(`/patients/${patientId}/financial-summary`);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur chargement");
    } finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px] text-gray-400">
      <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Chargement du résumé financier…
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-400 gap-3">
      <AlertCircle className="w-8 h-8 text-red-400" />
      <p className="text-sm text-red-500">{error}</p>
      <button onClick={load} className="text-sm text-blue-600 hover:underline">Réessayer</button>
    </div>
  );

  if (!data) return null;

  const pieData = data.byModule
    .filter(m => m.amount > 0)
    .map(m => ({ name: MODULE_LABELS[m.module] ?? m.module, value: m.amount }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Résumé financier du patient</h3>
        <button onClick={load} className="p-1.5 border rounded-lg hover:bg-gray-50 text-gray-500">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* KPI cards row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total facturé"     value={`${fmt(data.totalFacture)} DZD`}  sub={`${data.invoiceCount} facture${data.invoiceCount !== 1 ? "s" : ""}`}        Icon={TrendingUp} colorClass="bg-blue-100 text-blue-600" />
        <KpiCard label="Total payé"        value={`${fmt(data.totalPaye)} DZD`}     sub={`${data.paymentCount} paiement${data.paymentCount !== 1 ? "s" : ""}`}       Icon={Banknote}   colorClass="bg-green-100 text-green-600" />
        <KpiCard label="Reste à payer"     value={`${fmt(data.totalReste)} DZD`}    sub={data.totalReste > 0 ? "Montant dû" : "Tout réglé"}                            Icon={AlertCircle} colorClass={data.totalReste > 0 ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"} />
        <KpiCard label="Créances assurance" value={`${fmt(data.totalCreances)} DZD`} sub="Part non encore réglée par assureur"                                         Icon={Building2}  colorClass="bg-purple-100 text-purple-600" />
      </div>

      {/* KPI cards row 2 — insurance breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-500 font-medium mb-2 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> CNAS
          </div>
          <div className="text-xl font-bold text-gray-800">{fmt(data.totalCnas)} DZD</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-500 font-medium mb-2 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" /> CASNOS
          </div>
          <div className="text-xl font-bold text-gray-800">{fmt(data.totalCasnos)} DZD</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-500 font-medium mb-1">Dernières dates</div>
          <div className="text-xs text-gray-600 space-y-0.5">
            <div>Facture : <span className="font-medium">{fmtDate(data.lastInvoiceDate)}</span></div>
            <div>Paiement : <span className="font-medium">{fmtDate(data.lastPaymentDate)}</span></div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly invoices chart */}
        {data.monthlyInvoices.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Facturation mensuelle (DZD)</h4>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.monthlyInvoices} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [`${fmt(v)} DZD`, "Montant"]} />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Monthly payments chart */}
        {data.monthlyPayments.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Paiements mensuels (DZD)</h4>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.monthlyPayments} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [`${fmt(v)} DZD`, "Encaissé"]} />
                <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Module breakdown */}
      {data.byModule.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Répartition par module</h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
            {/* Pie chart */}
            {pieData.length > 0 && (
              <div className="flex justify-center">
                <ResponsiveContainer width={220} height={200}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} labelLine={false}>
                      {pieData.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${fmt(v)} DZD`]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Table */}
            <div className="space-y-1.5">
              {data.byModule.filter(m => m.amount > 0).map((m, idx) => (
                <div key={m.module} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                  <span className="text-sm text-gray-700 flex-1">{MODULE_LABELS[m.module] ?? m.module}</span>
                  <span className="text-xs text-gray-400">{m.count} act.</span>
                  <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">{fmt(m.amount)} DZD</span>
                </div>
              ))}
              {data.byModule.every(m => m.amount === 0) && (
                <p className="text-sm text-gray-400 text-center py-4">Aucune donnée de module disponible</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
