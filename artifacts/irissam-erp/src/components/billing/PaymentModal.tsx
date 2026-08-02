/**
 * PaymentModal — record a new payment against an invoice.
 * Supports all payment methods: cash, card, virement, cheque, mobile,
 * tiers_payant, convention, gratuite, insurance.
 */
import { useState } from "react";
import { X, CreditCard, Banknote, Building2, FileCheck, Smartphone } from "lucide-react";
import type { Invoice } from "@/hooks/useBillingApi";

interface Props {
  invoice: Invoice;
  onClose: () => void;
  onSuccess: (invoiceStatus: string) => void;
  onSubmit: (amount: number, method: string, reference?: string, notes?: string) => Promise<void>;
}

const METHODS = [
  { value: "cash",         label: "Espèces",        icon: Banknote },
  { value: "card",         label: "Carte bancaire",  icon: CreditCard },
  { value: "virement",     label: "Virement",        icon: Building2 },
  { value: "cheque",       label: "Chèque",          icon: FileCheck },
  { value: "mobile",       label: "Paiement mobile", icon: Smartphone },
  { value: "tiers_payant", label: "Tiers payant",    icon: Building2 },
  { value: "insurance",    label: "Assurance",       icon: Building2 },
];

function fmt(n: number) { return n.toLocaleString("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export function PaymentModal({ invoice, onClose, onSubmit }: Props) {
  const [amount,    setAmount]    = useState(String(invoice.remainingAmount.toFixed(2)));
  const [method,    setMethod]    = useState("cash");
  const [reference, setReference] = useState("");
  const [notes,     setNotes]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err,       setErr]       = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setErr("Montant invalide"); return; }
    if (amt > invoice.remainingAmount + 0.01) { setErr(`Le montant dépasse le reste à payer (${fmt(invoice.remainingAmount)} DZD)`); return; }
    setSubmitting(true); setErr(null);
    try {
      await onSubmit(amt, method, reference || undefined, notes || undefined);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-md max-h-[95dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">Enregistrer un paiement</h2>
            <p className="text-xs text-gray-500 mt-0.5">{invoice.invoiceNumber} — {invoice.patientName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Amounts summary */}
          <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-3 gap-3 text-center text-sm">
            <div><div className="text-gray-500 text-xs">Total</div><div className="font-medium">{fmt(invoice.totalAmount)} DZD</div></div>
            <div><div className="text-gray-500 text-xs">Déjà payé</div><div className="font-medium text-green-600">{fmt(invoice.paidAmount)} DZD</div></div>
            <div><div className="text-gray-500 text-xs">Reste</div><div className="font-semibold text-red-600">{fmt(invoice.remainingAmount)} DZD</div></div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Montant à payer (DZD) *</label>
            <input
              type="number" min="0.01" step="0.01" max={invoice.remainingAmount}
              value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <div className="flex gap-2 mt-1">
              <button type="button" onClick={() => setAmount(String(invoice.remainingAmount.toFixed(2)))}
                className="text-xs text-blue-600 hover:underline">Paiement total</button>
              <button type="button" onClick={() => setAmount(String((invoice.remainingAmount / 2).toFixed(2)))}
                className="text-xs text-gray-500 hover:underline">50%</button>
            </div>
          </div>

          {/* Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mode de paiement *</label>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map(m => (
                <button key={m.value} type="button" onClick={() => setMethod(m.value)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                    method === m.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>
                  <m.icon className="w-4 h-4" />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Référence</label>
            <input type="text" placeholder="N° chèque, référence virement…"
              value={reference} onChange={e => setReference(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={2} placeholder="Observations…"
              value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
          </div>

          {err && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
              {submitting ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
