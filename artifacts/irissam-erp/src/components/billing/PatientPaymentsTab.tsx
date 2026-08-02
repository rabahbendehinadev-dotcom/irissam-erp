/**
 * PatientPaymentsTab — all payments for a patient with receipt PDF.
 */
import { useState, useEffect, useCallback } from "react";
import { CreditCard, Download, Search, RefreshCw, Filter, X, Banknote, Smartphone, Building2, FileCheck } from "lucide-react";
import { useBillingApi, type Payment } from "@/hooks/useBillingApi";

function fmt(n: number) {
  return (n ?? 0).toLocaleString("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(s?: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const METHOD_ICONS: Record<string, React.ElementType> = {
  cash: Banknote, card: CreditCard, virement: Building2, cheque: FileCheck,
  mobile: Smartphone, insurance: Building2, tiers_payant: Building2, convention: Building2, gratuite: FileCheck,
};
const METHOD_LABELS: Record<string, string> = {
  cash: "Espèces", card: "Carte", virement: "Virement", cheque: "Chèque",
  mobile: "Mobile", insurance: "Assurance", tiers_payant: "Tiers payant", convention: "Convention", gratuite: "Gratuit",
};

interface Props { patientId: string }

export function PatientPaymentsTab({ patientId }: Props) {
  const billing = useBillingApi();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [method,   setMethod]   = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await billing.listPayments({ patientId });
      setPayments(Array.isArray(data) ? data : []);
    } catch { /* keep stale */ }
    finally { setLoading(false); }
  }, [patientId]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  // Client-side filter
  const filtered = payments.filter(p => {
    if (method !== "all" && p.method !== method) return false;
    if (dateFrom && new Date(p.paidAt) < new Date(dateFrom)) return false;
    if (dateTo   && new Date(p.paidAt) > new Date(dateTo + "T23:59:59")) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.paymentNumber?.toLowerCase().includes(q) &&
          !p.invoiceNumber?.toLowerCase().includes(q) &&
          !METHOD_LABELS[p.method]?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalPaye = filtered.reduce((s, p) => s + (p.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-green-50 rounded-xl p-3.5 border border-white/60">
          <div className="text-xs font-medium text-green-700">Total encaissé</div>
          <div className="text-lg font-bold text-green-700 mt-0.5">{fmt(totalPaye)} DZD</div>
          <div className="text-xs text-green-600 opacity-70">{filtered.length} paiement{filtered.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-3.5 border border-white/60">
          <div className="text-xs font-medium text-blue-700">Méthode principale</div>
          <div className="text-lg font-bold text-blue-700 mt-0.5">
            {(() => {
              const counts: Record<string, number> = {};
              filtered.forEach(p => { counts[p.method] = (counts[p.method] ?? 0) + p.amount; });
              const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
              return top ? METHOD_LABELS[top[0]] ?? top[0] : "—";
            })()}
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3.5 border border-white/60">
          <div className="text-xs font-medium text-gray-600">Dernier paiement</div>
          <div className="text-sm font-bold text-gray-700 mt-0.5">
            {filtered.length ? fmtDate(filtered.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())[0]?.paidAt) : "—"}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border shadow-sm p-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex-1 min-w-[160px] relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={method} onChange={e => setMethod(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white min-w-[120px]">
            <option value="all">Toutes méthodes</option>
            {Object.entries(METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" title="Du" />
          <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   className="border rounded-lg px-3 py-2 text-sm" title="Au" />
          <button onClick={load} className="p-2 border rounded-lg hover:bg-gray-50 text-gray-500">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {(search || method !== "all" || dateFrom || dateTo) && (
            <button onClick={() => { setSearch(""); setMethod("all"); setDateFrom(""); setDateTo(""); }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <Filter className="w-3.5 h-3.5" /> Réinit.
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["Numéro","Date","Facture","Méthode","Montant","Reçu","Statut","Actions"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Chargement…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center">
                  <CreditCard className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-400 text-sm">Aucun paiement trouvé</p>
                </td></tr>
              ) : filtered.map(pay => {
                const MethodIcon = METHOD_ICONS[pay.method] ?? CreditCard;
                return (
                  <tr key={pay.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold text-blue-700 whitespace-nowrap">{pay.paymentNumber ?? "—"}</td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs whitespace-nowrap">{fmtDate(pay.paidAt)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">{(pay as unknown as Record<string,string>).invoiceNumber ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1 text-xs text-gray-700">
                        <MethodIcon className="w-3.5 h-3.5 text-gray-400" />
                        {METHOD_LABELS[pay.method] ?? pay.method}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-green-700 whitespace-nowrap">{fmt(pay.amount)} DZD</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-gray-400">{pay.receiptNumber ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        pay.status === "completed" ? "bg-green-100 text-green-700" :
                        pay.status === "refunded"  ? "bg-purple-100 text-purple-700" :
                        "bg-gray-100 text-gray-600"}`}>{pay.status}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-0.5">
                        {pay.receiptNumber && (
                          <button onClick={() => billing.openReceiptPdf(pay.id)} title="Reçu PDF"
                            className="p-1.5 rounded hover:bg-green-50 text-green-600">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
