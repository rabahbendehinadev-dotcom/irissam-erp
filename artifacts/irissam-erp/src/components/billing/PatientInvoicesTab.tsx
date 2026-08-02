/**
 * PatientInvoicesTab — full invoice list + stats for a patient.
 * Slide-over detail + PDF + PaymentModal + Cancel/CreditNote.
 */
import { useState, useEffect, useCallback } from "react";
import {
  FileText, CreditCard, CheckCircle, XCircle, Download, Printer,
  Search, Filter, X, AlertTriangle, RefreshCw, Plus,
} from "lucide-react";
import { useBillingApi, type Invoice, type InvoiceItem, type Payment } from "@/hooks/useBillingApi";
import { PaymentModal } from "./PaymentModal";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return (n ?? 0).toLocaleString("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(s?: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft:           { label: "Brouillon",   color: "bg-gray-100 text-gray-600" },
  pending:         { label: "En attente",  color: "bg-yellow-100 text-yellow-700" },
  issued:          { label: "Émise",       color: "bg-blue-100 text-blue-700" },
  partially_paid:  { label: "Part. payée", color: "bg-orange-100 text-orange-700" },
  partial:         { label: "Part. payée", color: "bg-orange-100 text-orange-700" },
  paid:            { label: "Payée",       color: "bg-green-100 text-green-700" },
  overdue:         { label: "En retard",   color: "bg-red-100 text-red-700" },
  cancelled:       { label: "Annulée",     color: "bg-red-100 text-red-500" },
  refunded:        { label: "Remboursée",  color: "bg-purple-100 text-purple-600" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, color: "bg-gray-100 text-gray-500" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
}

function MiniCard({ label, value, sub, color = "blue" }: { label: string; value: string; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700", green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-600", purple: "bg-purple-50 text-purple-700",
    orange: "bg-orange-50 text-orange-700", gray: "bg-gray-50 text-gray-600",
  };
  return (
    <div className={`rounded-xl p-3.5 border border-white/60 ${colors[color] ?? colors.blue}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="text-lg font-bold mt-0.5 truncate">{value}</div>
      {sub && <div className="text-xs opacity-70 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props { patientId: string }

export function PatientInvoicesTab({ patientId }: Props) {
  const billing = useBillingApi();

  const [invoices, setInvoices]   = useState<Invoice[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [search,   setSearch]     = useState("");
  const [status,   setStatus]     = useState("all");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo,   setDateTo]     = useState("");

  const [selected,     setSelected]     = useState<Invoice | null>(null);
  const [payingFor,    setPayingFor]    = useState<Invoice | null>(null);
  const [cancelId,     setCancelId]     = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [creditNote,   setCreditNote]   = useState(false);
  const [cnAmount,     setCnAmount]     = useState("");
  const [cnReason,     setCnReason]     = useState("");
  const [toast,        setToast]        = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await billing.listInvoices({
        patientId,
        search: search || undefined,
        status: status !== "all" ? status : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setInvoices(data);
    } catch { /* keep stale */ }
    finally { setLoading(false); }
  }, [patientId, search, status, dateFrom, dateTo]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  // ── derived stats ──────────────────────────────────────────────────────────
  const totalFacture   = invoices.reduce((s, i) => s + (i.totalAmount    ?? 0), 0);
  const totalPaye      = invoices.reduce((s, i) => s + (i.paidAmount     ?? 0), 0);
  const totalReste     = invoices.reduce((s, i) => s + (i.remainingAmount ?? 0), 0);
  const totalAssurance = invoices.reduce((s, i) => s + (i.insurerShare   ?? 0), 0);
  const totalPatient   = invoices.reduce((s, i) => s + (i.patientShare   ?? 0), 0);

  // ── actions ───────────────────────────────────────────────────────────────
  const openDetail = useCallback(async (inv: Invoice) => {
    try { setSelected(await billing.getInvoice(inv.id)); }
    catch { setSelected(inv); }
  }, [billing]);

  const handleIssue = useCallback(async (id: string) => {
    try {
      await billing.issueInvoice(id);
      setToast({ type: "ok", msg: "Facture émise." });
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status: "issued" } : prev);
      await load();
    } catch (e) { setToast({ type: "err", msg: e instanceof Error ? e.message : "Erreur" }); }
  }, [billing, selected, load]);

  const handleCancel = useCallback(async () => {
    if (!cancelId) return;
    try {
      await billing.cancelInvoice(cancelId, cancelReason);
      setCancelId(null); setCancelReason("");
      setToast({ type: "ok", msg: "Facture annulée." });
      if (selected?.id === cancelId) setSelected(null);
      await load();
    } catch (e: unknown) {
      if (e instanceof Error && (e as { code?: string }).code === "PAID_INVOICE_REQUIRES_CREDIT_NOTE") {
        setCreditNote(true);
      } else { setToast({ type: "err", msg: e instanceof Error ? e.message : "Erreur" }); }
    }
  }, [cancelId, cancelReason, billing, selected, load]);

  const handleCreditNote = useCallback(async () => {
    if (!cancelId) return;
    const amount = parseFloat(cnAmount);
    if (!amount || !cnReason) { setToast({ type: "err", msg: "Montant et raison requis" }); return; }
    try {
      await billing.createCreditNote(cancelId, amount, cnReason);
      setCancelId(null); setCreditNote(false); setCnAmount(""); setCnReason("");
      setToast({ type: "ok", msg: "Note de crédit créée." });
      await load();
    } catch (e) { setToast({ type: "err", msg: e instanceof Error ? e.message : "Erreur" }); }
  }, [cancelId, cnAmount, cnReason, billing, load]);

  const handlePayment = useCallback(async (amount: number, method: string, reference?: string, notes?: string) => {
    if (!payingFor) return;
    const result = await billing.createPayment({ invoiceId: payingFor.id, amount, method, reference, notes });
    setPayingFor(null);
    setToast({ type: "ok", msg: `Paiement enregistré. Statut: ${result.invoiceStatus}` });
    if (selected?.id === payingFor.id) {
      try { setSelected(await billing.getInvoice(payingFor.id)); } catch { /* ignore */ }
    }
    await load();
  }, [payingFor, billing, selected, load]);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm ${
          toast.type === "ok" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {toast.type === "ok" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MiniCard label="Total facturé"   value={`${fmt(totalFacture)} DZD`}   color="blue" />
        <MiniCard label="Total payé"      value={`${fmt(totalPaye)} DZD`}      color="green" />
        <MiniCard label="Reste à payer"   value={`${fmt(totalReste)} DZD`}     color="red" />
        <MiniCard label="Part assurance"  value={`${fmt(totalAssurance)} DZD`} color="purple" />
        <MiniCard label="Part patient"    value={`${fmt(totalPatient)} DZD`}   color="orange" />
        <MiniCard label="Nb factures"     value={String(invoices.length)}      color="gray" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border shadow-sm p-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[160px] relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white min-w-[130px]">
            <option value="all">Tous statuts</option>
            {Object.entries(STATUS_MAP).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" title="Du" />
          <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   className="border rounded-lg px-3 py-2 text-sm" title="Au" />
          <button onClick={load} className="p-2 border rounded-lg hover:bg-gray-50 text-gray-500" title="Rafraîchir">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {(search || status !== "all" || dateFrom || dateTo) && (
            <button onClick={() => { setSearch(""); setStatus("all"); setDateFrom(""); setDateTo(""); }}
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
                {["N° Facture","Date","Encounter","Total","Assurance","Patient","Payé","Reste","Statut","Actions"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && invoices.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Chargement…</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-400 text-sm">Aucune facture trouvée</p>
                </td></tr>
              ) : invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs font-semibold text-blue-700 whitespace-nowrap">{inv.invoiceNumber ?? "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs">{fmtDate(inv.invoiceDate)}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs font-mono whitespace-nowrap">{inv.encounterNumber ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap">{fmt(inv.totalAmount)}</td>
                  <td className="px-3 py-2.5 text-right text-blue-600 text-xs whitespace-nowrap">{fmt(inv.insurerShare)}</td>
                  <td className="px-3 py-2.5 text-right text-red-600 text-xs whitespace-nowrap">{fmt(inv.patientShare)}</td>
                  <td className="px-3 py-2.5 text-right text-green-600 text-xs whitespace-nowrap">{fmt(inv.paidAmount)}</td>
                  <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap text-xs">
                    <span className={inv.remainingAmount > 0 ? "text-red-600" : "text-gray-400"}>{fmt(inv.remainingAmount)}</span>
                  </td>
                  <td className="px-3 py-2.5"><StatusBadge status={inv.status} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => openDetail(inv)} title="Voir" className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><FileText className="w-3.5 h-3.5" /></button>
                      {["issued","partially_paid","pending"].includes(inv.status) && (
                        <button onClick={() => setPayingFor(inv)} title="Paiement" className="p-1.5 rounded hover:bg-green-50 text-green-600"><CreditCard className="w-3.5 h-3.5" /></button>
                      )}
                      {["draft","pending"].includes(inv.status) && (
                        <button onClick={() => handleIssue(inv.id)} title="Émettre" className="p-1.5 rounded hover:bg-blue-50 text-blue-600"><CheckCircle className="w-3.5 h-3.5" /></button>
                      )}
                      {["issued","partially_paid","paid"].includes(inv.status) && (
                        <button onClick={() => billing.openInvoicePdf(inv.id)} title="PDF" className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Download className="w-3.5 h-3.5" /></button>
                      )}
                      {!["cancelled","refunded","paid"].includes(inv.status) && (
                        <button onClick={() => { setCancelId(inv.id); setCreditNote(false); setCancelReason(""); }} title="Annuler" className="p-1.5 rounded hover:bg-red-50 text-red-500"><XCircle className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Slide-over detail ───────────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelected(null)} />
          <div className="relative bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50 shrink-0">
              <div>
                <div className="font-semibold text-gray-800">{selected.invoiceNumber ?? "—"}</div>
                <div className="text-xs text-gray-500">{selected.patientName} · {fmtDate(selected.invoiceDate)}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={selected.status} />
                <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"><X className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Informations générales */}
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Informations générales</h4>
                <div className="grid grid-cols-3 gap-3 text-center text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-400">Total</div>
                    <div className="font-bold text-gray-800">{fmt(selected.totalAmount)} DZD</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs text-gray-400">Payé</div>
                    <div className="font-bold text-green-600">{fmt(selected.paidAmount)} DZD</div>
                  </div>
                  <div className={`rounded-lg p-3 ${selected.remainingAmount > 0 ? "bg-red-50" : "bg-gray-50"}`}>
                    <div className="text-xs text-gray-400">Reste</div>
                    <div className={`font-bold ${selected.remainingAmount > 0 ? "text-red-600" : "text-gray-400"}`}>
                      {fmt(selected.remainingAmount)} DZD
                    </div>
                  </div>
                </div>
                {selected.insuranceType && (
                  <div className="mt-2 bg-blue-50 rounded-lg p-3 text-sm grid grid-cols-2 gap-2">
                    <div><span className="text-gray-400 text-xs">Organisme</span><div className="font-medium">{selected.insuranceType.toUpperCase()}</div></div>
                    <div><span className="text-gray-400 text-xs">Couverture</span><div className="font-medium">{selected.insuranceCoveragePercent}%</div></div>
                    <div><span className="text-gray-400 text-xs">Part patient</span><div className="font-medium text-red-600">{fmt(selected.patientShare)} DZD</div></div>
                    <div><span className="text-gray-400 text-xs">Part assur.</span><div className="font-medium text-blue-600">{fmt(selected.insurerShare)} DZD</div></div>
                  </div>
                )}
              </section>

              {/* Invoice Items */}
              {selected.items && selected.items.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Lignes de facturation</h4>
                  <div className="space-y-1.5">
                    {selected.items.map((it: InvoiceItem) => (
                      <div key={it.id} className="flex justify-between text-sm border-b pb-1.5 gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-800 truncate">{it.description}</div>
                          <div className="text-xs text-gray-400">{it.category} · {it.quantity} × {fmt(it.unitPrice)} DZD</div>
                        </div>
                        <div className="text-right font-medium whitespace-nowrap shrink-0">{fmt(it.totalPrice)} DZD</div>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold text-sm pt-1">
                      <span>Total</span><span>{fmt(selected.totalAmount)} DZD</span>
                    </div>
                  </div>
                </section>
              )}

              {/* Paiements */}
              {selected.payments && selected.payments.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Paiements</h4>
                  <div className="space-y-1.5">
                    {selected.payments.map((pay: Payment) => (
                      <div key={pay.id} className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{pay.paymentNumber}</div>
                          <div className="text-xs text-gray-500">{pay.method} · {fmtDate(pay.paidAt)}</div>
                        </div>
                        <div className="font-semibold text-green-700 whitespace-nowrap text-sm">{fmt(pay.amount)} DZD</div>
                        <button onClick={() => billing.openReceiptPdf(pay.id)} title="Reçu PDF"
                          className="p-1.5 rounded hover:bg-green-200 text-green-700 shrink-0">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Assurance */}
              {selected.claims && selected.claims.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Assurance</h4>
                  <div className="space-y-1.5">
                    {selected.claims.map(cl => (
                      <div key={cl.id} className="flex justify-between text-sm bg-purple-50 rounded-lg px-3 py-2">
                        <div>
                          <div className="font-medium">{cl.claimNumber}</div>
                          <div className="text-xs text-gray-500">{cl.insurerName} · {cl.status}</div>
                        </div>
                        <div className="text-right text-xs">
                          <div className="font-medium">{fmt(cl.amountRequested)} DZD demandé</div>
                          {cl.amountApproved != null && <div className="text-green-600">{fmt(cl.amountApproved)} DZD approuvé</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Notes */}
              {selected.notes && (
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selected.notes}</p>
                </section>
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
                    <Download className="w-4 h-4" /> PDF
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

      {/* Cancel modal */}
      {cancelId && !creditNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" /> Annuler la facture
            </h3>
            <p className="text-sm text-gray-500">Cette action est irréversible.</p>
            <textarea rows={2} value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              placeholder="Motif d'annulation…" className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
            <div className="flex gap-3">
              <button onClick={() => { setCancelId(null); setCancelReason(""); }} className="flex-1 border rounded-lg py-2 text-sm">Retour</button>
              <button onClick={handleCancel} disabled={!cancelReason.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-medium">
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit note modal */}
      {cancelId && creditNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Note de crédit requise
            </h3>
            <p className="text-sm text-gray-500">Cette facture a des paiements. Une note de crédit est requise.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant (DZD)</label>
              <input type="number" min="0.01" value={cnAmount} onChange={e => setCnAmount(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <textarea rows={2} value={cnReason} onChange={e => setCnReason(e.target.value)}
              placeholder="Motif…" className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
            <div className="flex gap-3">
              <button onClick={() => { setCancelId(null); setCreditNote(false); }} className="flex-1 border rounded-lg py-2 text-sm">Annuler</button>
              <button onClick={handleCreditNote} disabled={!cnAmount || !cnReason.trim()}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-medium">
                Émettre la note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {payingFor && (
        <PaymentModal invoice={payingFor} onClose={() => setPayingFor(null)} onSuccess={() => {}} onSubmit={handlePayment} />
      )}
    </div>
  );
}
