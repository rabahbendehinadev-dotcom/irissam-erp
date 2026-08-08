/**
 * Facturation — main billing page.
 *
 * Features:
 *  • Stats cards (6)
 *  • Invoice list with filters + search
 *  • Slide-over invoice detail (items, payments, claims)
 *  • InvoiceWizard for creation
 *  • PaymentModal
 *  • Issue / Cancel with credit-note guard
 *  • Insurance claims list (side panel)
 *  • Print-friendly invoice view
 */
import { useState, useEffect, useCallback } from "react";
import {
  Plus, Search, RefreshCw, Eye, CreditCard, CheckCircle, XCircle,
  Printer, FileText, AlertTriangle, Filter, X, TrendingUp, Banknote,
  ClipboardList, Building2, Download,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { InvoiceWizard } from "@/components/billing/InvoiceWizard";
import { PaymentModal } from "@/components/billing/PaymentModal";
import { useBillingApi, type Invoice, type InvoiceItem, type Payment, type BillingStats } from "@/hooks/useBillingApi";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(s?: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft:           { label: "Brouillon",       color: "bg-gray-100 text-gray-600" },
  pending:         { label: "En attente",       color: "bg-yellow-100 text-yellow-700" },
  issued:          { label: "Émise",            color: "bg-blue-100 text-blue-700" },
  partially_paid:  { label: "Part. payée",      color: "bg-orange-100 text-orange-700" },
  partial:         { label: "Part. payée",      color: "bg-orange-100 text-orange-700" },
  paid:            { label: "Payée",            color: "bg-green-100 text-green-700" },
  overdue:         { label: "En retard",        color: "bg-red-100 text-red-700" },
  cancelled:       { label: "Annulée",          color: "bg-red-100 text-red-500" },
  refunded:        { label: "Remboursée",       color: "bg-purple-100 text-purple-600" },
  disputed:        { label: "Contestée",        color: "bg-yellow-100 text-yellow-600" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, color: "bg-gray-100 text-gray-500" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
}

// ── Stats card ────────────────────────────────────────────────────────────────

function StatCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-start gap-3">
      <div className={`p-2.5 rounded-lg ${color}`}><Icon className="w-5 h-5" /></div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500 font-medium">{title}</div>
        <div className="text-xl font-bold text-gray-800 mt-0.5 truncate">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Facturation() {
  const billing = useBillingApi();

  const [stats,    setStats]    = useState<BillingStats | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [fetching, setFetching] = useState(false);

  // Filters
  const [search,   setSearch]   = useState("");
  const [status,   setStatus]   = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");

  // UI state
  const [showWizard,   setShowWizard]   = useState(false);
  const [prefillPatientId, setPrefillPatientId] = useState<string | null>(null);

  // Ouverture directe depuis « Actions rapides » du dossier patient (?new=1&patientId=…)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") !== "1") return;
    window.history.replaceState({}, "", window.location.pathname);
    const pid = params.get("patientId");
    if (pid) setPrefillPatientId(pid);
    setShowWizard(true);
  }, []);
  const [selected,     setSelected]     = useState<Invoice | null>(null);
  const [payingFor,    setPayingFor]    = useState<Invoice | null>(null);
  const [cancelId,     setCancelId]     = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [creditNote,   setCreditNote]   = useState(false);
  const [cnAmount,     setCnAmount]     = useState("");
  const [cnReason,     setCnReason]     = useState("");
  const [actionErr,    setActionErr]    = useState<string | null>(null);
  const [actionOk,     setActionOk]     = useState<string | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setFetching(true);
    try {
      const [s, inv] = await Promise.all([
        billing.getStats(),
        billing.listInvoices({ search: search || undefined, status: status !== "all" ? status : undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
      ]);
      setStats(s);
      setInvoices(inv);
    } catch {
      // silently keep stale data
    } finally { setFetching(false); }
  }, [search, status, dateFrom, dateTo]); // eslint-disable-line

  useEffect(() => { loadData(); }, [loadData]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleCreate = useCallback(async (input: Parameters<typeof billing.createInvoice>[0], issue: boolean) => {
    const inv = await billing.createInvoice(input);
    if (issue) await billing.issueInvoice(inv.id);
    setShowWizard(false);
    setActionOk("Facture créée avec succès.");
    await loadData();
  }, [billing, loadData]);

  const handleIssue = useCallback(async (id: string) => {
    try {
      await billing.issueInvoice(id);
      setActionOk("Facture émise."); setActionErr(null);
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status: "issued" } : prev);
      await loadData();
    } catch (e) { setActionErr(e instanceof Error ? e.message : "Erreur"); }
  }, [billing, selected, loadData]);

  const handleCancel = useCallback(async () => {
    if (!cancelId) return;
    try {
      await billing.cancelInvoice(cancelId, cancelReason);
      setCancelId(null); setCancelReason(""); setActionOk("Facture annulée.");
      if (selected?.id === cancelId) setSelected(null);
      await loadData();
    } catch (e: unknown) {
      if (e instanceof Error && (e as { code?: string }).code === "PAID_INVOICE_REQUIRES_CREDIT_NOTE") {
        setCreditNote(true);
      } else { setActionErr(e instanceof Error ? e.message : "Erreur"); }
    }
  }, [cancelId, cancelReason, billing, selected, loadData]);

  const handleCreditNote = useCallback(async () => {
    if (!cancelId) return;
    const amount = parseFloat(cnAmount);
    if (!amount || !cnReason) { setActionErr("Montant et raison requis"); return; }
    try {
      await billing.createCreditNote(cancelId, amount, cnReason);
      setCancelId(null); setCreditNote(false); setCnAmount(""); setCnReason(""); setActionOk("Note de crédit créée.");
      await loadData();
    } catch (e) { setActionErr(e instanceof Error ? e.message : "Erreur"); }
  }, [cancelId, cnAmount, cnReason, billing, loadData]);

  const handlePayment = useCallback(async (amount: number, method: string, reference?: string, notes?: string) => {
    if (!payingFor) return;
    const result = await billing.createPayment({ invoiceId: payingFor.id, amount, method, reference, notes });
    setPayingFor(null);
    setActionOk(`Paiement enregistré. Statut: ${result.invoiceStatus}`);
    if (selected?.id === payingFor.id) {
      const refreshed = await billing.getInvoice(payingFor.id);
      setSelected(refreshed);
    }
    await loadData();
  }, [payingFor, billing, selected, loadData]);

  const openDetail = useCallback(async (inv: Invoice) => {
    try {
      const full = await billing.getInvoice(inv.id);
      setSelected(full);
    } catch { setSelected(inv); }
  }, [billing]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-5 pb-8">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Finance & Facturation</h1>
            <p className="text-sm text-gray-500 mt-0.5">Gestion des factures, paiements et assurances</p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadData} disabled={fetching}
              className="p-2 border rounded-lg hover:bg-gray-50 text-gray-500 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${fetching ? "animate-spin" : ""}`} />
            </button>
            <button onClick={() => setShowWizard(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium shadow-sm">
              <Plus className="w-4 h-4" /> Nouvelle facture
            </button>
          </div>
        </div>

        {/* Toasts */}
        {actionOk && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2.5 text-sm">
            <CheckCircle className="w-4 h-4 shrink-0" />
            {actionOk}
            <button onClick={() => setActionOk(null)} className="ml-auto text-green-600"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        {actionErr && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {actionErr}
            <button onClick={() => setActionErr(null)} className="ml-auto text-red-600"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard title="CA aujourd'hui"      value={`${fmt(stats?.ca_today        ?? 0)} DZD`} icon={TrendingUp}   color="bg-blue-100 text-blue-600" />
          <StatCard title="CA ce mois"          value={`${fmt(stats?.ca_month        ?? 0)} DZD`} icon={Banknote}     color="bg-indigo-100 text-indigo-600" />
          <StatCard title="Factures impayées"   value={String(stats?.unpaid_count    ?? 0)}       icon={FileText}     color="bg-yellow-100 text-yellow-600" />
          <StatCard title="Paiements reçus"     value={`${fmt(stats?.payments_month  ?? 0)} DZD`} icon={CreditCard}   color="bg-green-100 text-green-600" />
          <StatCard title="Reste à recouvrer"   value={`${fmt(stats?.total_remaining ?? 0)} DZD`} icon={ClipboardList} color="bg-red-100 text-red-500" />
          <StatCard title="Assurance en attente" value={String(stats?.insurance_pending ?? 0)}    icon={Building2}    color="bg-purple-100 text-purple-600" />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px] relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Rechercher…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm bg-white min-w-[140px]">
              <option value="all">Tous les statuts</option>
              {Object.entries(STATUS_MAP).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm min-w-[130px]" title="Du" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm min-w-[130px]" title="Au" />
            {(search || status !== "all" || dateFrom || dateTo) && (
              <button onClick={() => { setSearch(""); setStatus("all"); setDateFrom(""); setDateTo(""); }}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                <Filter className="w-3.5 h-3.5" /> Réinitialiser
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
                  {["N° Facture","Patient","MRN","Date","Total","Part patient","Part assur.","Payé","Reste","Statut","Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fetching && invoices.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400 text-sm">Chargement…</td></tr>
                ) : invoices.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400 text-sm">Aucune facture trouvée</td></tr>
                ) : invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-blue-700 whitespace-nowrap">
                      {inv.invoiceNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800 whitespace-nowrap">{inv.patientName}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{inv.patientMrn ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(inv.invoiceDate)}</td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{fmt(inv.totalAmount)}</td>
                    <td className="px-4 py-3 text-right text-red-600 whitespace-nowrap">{fmt(inv.patientShare)}</td>
                    <td className="px-4 py-3 text-right text-blue-600 whitespace-nowrap">{fmt(inv.insurerShare)}</td>
                    <td className="px-4 py-3 text-right text-green-600 whitespace-nowrap">{fmt(inv.paidAmount)}</td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                      <span className={inv.remainingAmount > 0 ? "text-red-600" : "text-gray-400"}>
                        {fmt(inv.remainingAmount)}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openDetail(inv)} title="Voir"
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Eye className="w-3.5 h-3.5" /></button>
                        {["issued","partially_paid","pending"].includes(inv.status) && (
                          <button onClick={() => setPayingFor(inv)} title="Paiement"
                            className="p-1.5 rounded hover:bg-green-50 text-green-600"><CreditCard className="w-3.5 h-3.5" /></button>
                        )}
                        {["draft","pending"].includes(inv.status) && (
                          <button onClick={() => handleIssue(inv.id)} title="Émettre"
                            className="p-1.5 rounded hover:bg-blue-50 text-blue-600"><CheckCircle className="w-3.5 h-3.5" /></button>
                        )}
                        {!["cancelled","refunded","paid"].includes(inv.status) && (
                          <button onClick={() => { setCancelId(inv.id); setCreditNote(false); setCancelReason(""); }} title="Annuler"
                            className="p-1.5 rounded hover:bg-red-50 text-red-500"><XCircle className="w-3.5 h-3.5" /></button>
                        )}
                        <button onClick={() => openDetail(inv)} title="Imprimer"
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Printer className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Slide-over: Invoice detail ───────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelected(null)} />
          <div className="relative bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50 shrink-0">
              <div>
                <div className="font-semibold text-gray-800">{selected.invoiceNumber ?? "—"}</div>
                <div className="text-xs text-gray-500 mt-0.5">{selected.patientName}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={selected.status} />
                <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"><X className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Amounts summary */}
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-400">Total</div>
                  <div className="font-bold text-gray-800">{fmt(selected.totalAmount)}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-xs text-gray-400">Payé</div>
                  <div className="font-bold text-green-600">{fmt(selected.paidAmount)}</div>
                </div>
                <div className={`rounded-lg p-3 ${selected.remainingAmount > 0 ? "bg-red-50" : "bg-gray-50"}`}>
                  <div className="text-xs text-gray-400">Reste</div>
                  <div className={`font-bold ${selected.remainingAmount > 0 ? "text-red-600" : "text-gray-400"}`}>{fmt(selected.remainingAmount)}</div>
                </div>
              </div>

              {/* Coverage */}
              {selected.insuranceType && (
                <div className="bg-blue-50 rounded-lg p-3 text-sm grid grid-cols-2 gap-2">
                  <div><span className="text-gray-500">Organisme</span><div className="font-medium">{selected.insuranceType.toUpperCase()}</div></div>
                  <div><span className="text-gray-500">Couverture</span><div className="font-medium">{selected.insuranceCoveragePercent}%</div></div>
                  <div><span className="text-gray-500">Part patient</span><div className="font-medium text-red-600">{fmt(selected.patientShare)} DZD</div></div>
                  <div><span className="text-gray-500">Part {selected.insuranceType.toUpperCase()}</span><div className="font-medium text-blue-600">{fmt(selected.insurerShare)} DZD</div></div>
                </div>
              )}

              {/* Items */}
              {selected.items && selected.items.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Lignes de facturation</h3>
                  <div className="space-y-1.5">
                    {selected.items.map((it: InvoiceItem) => (
                      <div key={it.id} className="flex justify-between text-sm border-b pb-1.5">
                        <div>
                          <div className="font-medium">{it.description}</div>
                          <div className="text-xs text-gray-400">{it.category} · {it.quantity} × {fmt(it.unitPrice)} DZD</div>
                        </div>
                        <div className="text-right font-medium whitespace-nowrap">{fmt(it.totalPrice)} DZD</div>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold text-sm pt-1">
                      <span>Total</span><span>{fmt(selected.totalAmount)} DZD</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Payments */}
              {selected.payments && selected.payments.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Paiements</h3>
                  <div className="space-y-1.5">
                    {selected.payments.map((pay: Payment) => (
                      <div key={pay.id} className="flex items-center justify-between text-sm bg-green-50 rounded-lg px-3 py-2 gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{pay.paymentNumber}</div>
                          <div className="text-xs text-gray-500">{pay.method} · {fmtDate(pay.paidAt)}</div>
                        </div>
                        <div className="font-semibold text-green-700 whitespace-nowrap">{fmt(pay.amount)} DZD</div>
                        <button
                          onClick={() => billing.openReceiptPdf(pay.id)}
                          title="Reçu PDF"
                          className="p-1.5 rounded hover:bg-green-200 text-green-700 shrink-0">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="shrink-0 border-t bg-gray-50 px-5 py-3 flex gap-2 flex-wrap">
              {["issued","partially_paid","pending"].includes(selected.status) && (
                <button onClick={() => setPayingFor(selected)}
                  className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-2 text-sm font-medium">
                  <CreditCard className="w-4 h-4" /> Paiement
                </button>
              )}
              {["draft","pending"].includes(selected.status) && (
                <button onClick={() => handleIssue(selected.id)}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-2 text-sm font-medium">
                  <CheckCircle className="w-4 h-4" /> Émettre
                </button>
              )}
              {!["cancelled","refunded","paid"].includes(selected.status) && (
                <button onClick={() => { setCancelId(selected.id); setCreditNote(false); setCancelReason(""); }}
                  className="flex items-center gap-1.5 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg px-3 py-2 text-sm font-medium">
                  <XCircle className="w-4 h-4" /> Annuler
                </button>
              )}
              <div className="ml-auto flex gap-2">
                {["issued","partially_paid","paid"].includes(selected.status) && (
                  <button onClick={() => billing.openInvoicePdf(selected.id)}
                    className="flex items-center gap-1.5 border border-gray-300 text-gray-600 hover:bg-gray-100 rounded-lg px-3 py-2 text-sm font-medium">
                    <Download className="w-4 h-4" /> PDF facture
                  </button>
                )}
                <button onClick={() => window.print()}
                  className="flex items-center gap-1.5 border border-gray-300 text-gray-600 hover:bg-gray-100 rounded-lg px-3 py-2 text-sm font-medium">
                  <Printer className="w-4 h-4" /> Imprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel modal ──────────────────────────────────────────────────────── */}
      {cancelId && !creditNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" /> Annuler la facture
            </h3>
            <p className="text-sm text-gray-500">Vous allez annuler cette facture. Cette action est irréversible.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Raison *</label>
              <textarea rows={2} value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                placeholder="Motif d'annulation…"
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setCancelId(null); setCancelReason(""); }}
                className="flex-1 border rounded-lg py-2 text-sm text-gray-700">Retour</button>
              <button onClick={handleCancel} disabled={!cancelReason.trim() || billing.loading}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-medium">
                {billing.loading ? "…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Credit note modal ─────────────────────────────────────────────────── */}
      {cancelId && creditNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Note de crédit requise
            </h3>
            <p className="text-sm text-gray-500">Cette facture a des paiements. Une note de crédit est nécessaire pour procéder.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant (DZD) *</label>
              <input type="number" min="0.01" value={cnAmount} onChange={e => setCnAmount(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Raison *</label>
              <textarea rows={2} value={cnReason} onChange={e => setCnReason(e.target.value)}
                placeholder="Motif…" className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
            </div>
            {actionErr && <div className="text-xs text-red-600">{actionErr}</div>}
            <div className="flex gap-3">
              <button onClick={() => { setCancelId(null); setCreditNote(false); }}
                className="flex-1 border rounded-lg py-2 text-sm text-gray-700">Annuler</button>
              <button onClick={handleCreditNote} disabled={!cnAmount || !cnReason.trim() || billing.loading}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-medium">
                {billing.loading ? "…" : "Émettre la note"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Wizard ────────────────────────────────────────────────────────────── */}
      {showWizard && (
        <InvoiceWizard
          onClose={() => setShowWizard(false)}
          onCreate={handleCreate}
          loading={billing.loading}
          initialPatientId={prefillPatientId ?? undefined}
        />
      )}

      {/* ── Payment modal ─────────────────────────────────────────────────────── */}
      {payingFor && (
        <PaymentModal
          invoice={payingFor}
          onClose={() => setPayingFor(null)}
          onSuccess={() => {}}
          onSubmit={handlePayment}
        />
      )}

      {/* ── Print styles ──────────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          body > *:not(#print-invoice) { display: none !important; }
          #print-invoice { display: block !important; }
        }
      `}</style>
    </DashboardLayout>
  );
}
