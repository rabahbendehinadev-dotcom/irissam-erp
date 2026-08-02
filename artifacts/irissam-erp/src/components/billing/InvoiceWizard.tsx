/**
 * InvoiceWizard — 6-step invoice creation wizard.
 *
 * Step 1: Patient + Encounter selection
 * Step 2: Auto-fetch billable services (manual add supported)
 * Step 3: Review / edit items
 * Step 4: Coverage type
 * Step 5: Computed shares summary
 * Step 6: Final review + save/issue
 */
import { useState, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, Plus, Trash2, User, FileText, Settings, Shield, Calculator, CheckCircle } from "lucide-react";
import { apiClient } from "@/services/api/client";
import type { InvoiceItem, CreateInvoiceInput } from "@/hooks/useBillingApi";

interface Patient { id: string; firstName: string; lastName: string; mrn?: string; }
interface Encounter { id: string; encounterNumber?: string; status?: string; createdAt?: string; }

interface WizardProps {
  onClose:   () => void;
  onCreate:  (input: CreateInvoiceInput, issue: boolean) => Promise<void>;
  loading:   boolean;
}

const COVERAGE_TYPES = [
  { value: "",            label: "Paiement direct",       pct: 0 },
  { value: "cnas",        label: "CNAS",                  pct: 80 },
  { value: "casnos",      label: "CASNOS",                pct: 80 },
  { value: "mutuelle",    label: "Mutuelle",              pct: 70 },
  { value: "militaire",   label: "Militaire",             pct: 100 },
  { value: "gratuite",    label: "Gratuité autorisée",    pct: 100 },
  { value: "payant",      label: "Convention / Tiers",    pct: 50 },
];

const SERVICE_CATEGORIES = [
  { value: "acte",         label: "Acte médical" },
  { value: "consultation", label: "Consultation" },
  { value: "laboratoire",  label: "Analyse" },
  { value: "imagerie",     label: "Imagerie" },
  { value: "medicament",   label: "Médicament" },
  { value: "chambre",      label: "Chambre / Séjour" },
  { value: "bloc",         label: "Bloc opératoire" },
  { value: "icu",          label: "Réanimation" },
  { value: "consommable",  label: "Consommable" },
  { value: "autre",        label: "Autre" },
];

function fmt(n: number) {
  return n.toLocaleString("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcItem(item: Partial<InvoiceItem>): number {
  const qty  = item.quantity  ?? 1;
  const disc = item.discount  ?? 0;
  const tax  = item.tax       ?? 0;
  return Math.max(0, qty * (item.unitPrice ?? 0) - disc + tax);
}

function computeTotals(items: Partial<InvoiceItem>[], coverPct: number) {
  let subtotal = 0; let discountAmount = 0; let taxAmount = 0;
  for (const it of items) {
    subtotal       += (it.quantity ?? 1) * (it.unitPrice ?? 0);
    discountAmount += it.discount ?? 0;
    taxAmount      += it.tax      ?? 0;
  }
  const totalAmount  = subtotal - discountAmount + taxAmount;
  const insurerShare = Math.round(totalAmount * (coverPct / 100) * 100) / 100;
  const patientShare = Math.round((totalAmount - insurerShare) * 100) / 100;
  return { subtotal, discountAmount, taxAmount, totalAmount, insurerShare, patientShare };
}

const STEPS = [
  { label: "Patient",   icon: User },
  { label: "Services",  icon: FileText },
  { label: "Détails",   icon: Settings },
  { label: "Couverture",icon: Shield },
  { label: "Calcul",    icon: Calculator },
  { label: "Résumé",    icon: CheckCircle },
];

export function InvoiceWizard({ onClose, onCreate, loading }: WizardProps) {
  const [step, setStep] = useState(0);

  // Step 1
  const [patientSearch, setPatientSearch] = useState("");
  const [patients,      setPatients]      = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [encounters,    setEncounters]    = useState<Encounter[]>([]);
  const [selectedEnc,   setSelectedEnc]   = useState<Encounter | null>(null);
  const [searching,     setSearching]     = useState(false);

  // Step 2 items
  const [items, setItems] = useState<Array<Partial<InvoiceItem> & { _key: number }>>([]);
  const [nextKey, setNextKey] = useState(1);

  // Step 4
  const [coverageType, setCoverageType]   = useState("");
  const [coveragePct,  setCoveragePct]    = useState(0);

  // Step 6
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // ── Patient search ──────────────────────────────────────────────────────────
  const searchPatients = useCallback(async (q: string) => {
    if (q.length < 2) { setPatients([]); return; }
    setSearching(true);
    try {
      const data = await apiClient.get<Patient[]>(`/patients?search=${encodeURIComponent(q)}&limit=10`);
      if (Array.isArray(data)) setPatients(data);
    } catch { /* ignore search errors */ }
    finally { setSearching(false); }
  }, []);

  const selectPatient = useCallback(async (p: Patient) => {
    setSelectedPatient(p); setPatients([]);
    try {
      const data = await apiClient.get<Encounter[]>(`/encounters?patientId=${p.id}&limit=10`);
      if (Array.isArray(data)) setEncounters(data);
    } catch { /* no encounters → empty list */ }
  }, []);

  // ── Item management ─────────────────────────────────────────────────────────
  const addItem = () => {
    setItems(prev => [...prev, { _key: nextKey, description: "", category: "acte", quantity: 1, unitPrice: 0, discount: 0, tax: 0 }]);
    setNextKey(k => k + 1);
  };

  const updateItem = (key: number, field: string, value: string | number) => {
    setItems(prev => prev.map(it => it._key === key ? { ...it, [field]: value } : it));
  };

  const removeItem = (key: number) => setItems(prev => prev.filter(it => it._key !== key));

  // ── Coverage selection ──────────────────────────────────────────────────────
  const selectCoverage = (value: string, pct: number) => {
    setCoverageType(value); setCoveragePct(pct);
  };

  const totals = computeTotals(items, coveragePct);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const canNext = () => {
    if (step === 0) return !!selectedPatient;
    if (step === 2) return items.length > 0 && items.every(it => (it.description?.trim() ?? "") !== "" && (it.unitPrice ?? 0) > 0);
    return true;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSave = async (issue: boolean) => {
    if (!selectedPatient) return;
    setErr(null);
    try {
      const input: CreateInvoiceInput = {
        patientId:               selectedPatient.id,
        encounterId:             selectedEnc?.id,
        insuranceType:           coverageType || undefined,
        insuranceCoveragePercent: coveragePct,
        dueDate:                 dueDate || undefined,
        notes:                   notes   || undefined,
        items: items.map(it => ({
          description:     it.description ?? "",
          category:        it.category    ?? "acte",
          quantity:        it.quantity    ?? 1,
          unitPrice:       it.unitPrice   ?? 0,
          discount:        it.discount    ?? 0,
          tax:             it.tax         ?? 0,
          sourceModule:    it.sourceModule,
          sourceEntityId:  it.sourceEntityId,
          serviceCode:     it.serviceCode,
          performedAt:     it.performedAt,
          performedBy:     it.performedBy,
        })),
      };
      await onCreate(input, issue);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur lors de la création");
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header + stepper */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b shrink-0">
          <h2 className="font-semibold text-gray-900 text-lg">Nouvelle facture</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
        </div>

        {/* Step indicator */}
        <div className="flex px-6 py-3 border-b bg-gray-50 shrink-0 overflow-x-auto gap-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done   = i < step;
            return (
              <button key={i} onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  active ? "bg-blue-600 text-white shadow" :
                  done   ? "bg-blue-100 text-blue-700 cursor-pointer hover:bg-blue-200" :
                           "bg-gray-100 text-gray-400 cursor-default"
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Step 0: Patient ───────────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-800">Sélectionner le patient</h3>
              {selectedPatient ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-blue-800">{selectedPatient.firstName} {selectedPatient.lastName}</div>
                    <div className="text-xs text-blue-600 mt-0.5">MRN: {selectedPatient.mrn ?? "—"}</div>
                  </div>
                  <button onClick={() => { setSelectedPatient(null); setEncounters([]); setSelectedEnc(null); }}
                    className="text-xs text-red-600 hover:underline">Changer</button>
                </div>
              ) : (
                <div className="relative">
                  <input type="text" placeholder="Rechercher par nom ou MRN…"
                    value={patientSearch}
                    onChange={e => { setPatientSearch(e.target.value); searchPatients(e.target.value); }}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  {searching && <div className="absolute right-3 top-3 text-xs text-gray-400">Recherche…</div>}
                  {patients.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg z-10 mt-1 max-h-48 overflow-y-auto">
                      {patients.map(p => (
                        <button key={p.id} onClick={() => selectPatient(p)}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm border-b last:border-0">
                          <span className="font-medium">{p.firstName} {p.lastName}</span>
                          <span className="text-gray-400 ml-2 text-xs">{p.mrn}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedPatient && encounters.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Encounter (optionnel)</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    <button onClick={() => setSelectedEnc(null)}
                      className={`w-full text-left text-sm px-3 py-2.5 rounded-lg border ${!selectedEnc ? "border-blue-400 bg-blue-50" : "hover:bg-gray-50"}`}>
                      Aucun encounter
                    </button>
                    {encounters.map(enc => (
                      <button key={enc.id} onClick={() => setSelectedEnc(enc)}
                        className={`w-full text-left text-sm px-3 py-2.5 rounded-lg border ${selectedEnc?.id === enc.id ? "border-blue-400 bg-blue-50" : "hover:bg-gray-50"}`}>
                        <span className="font-medium">{enc.encounterNumber ?? enc.id.slice(0,8)}</span>
                        <span className="text-gray-400 ml-2 text-xs">{enc.status}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 1: Suggested services ────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-800">Services à facturer</h3>
                <button onClick={addItem}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  <Plus className="w-4 h-4" /> Ajouter une ligne
                </button>
              </div>
              <p className="text-xs text-gray-500">Ajoutez manuellement les prestations, analyses, médicaments, etc.</p>

              {items.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                  <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Aucune ligne. Cliquez sur « Ajouter une ligne ».</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map(it => (
                    <div key={it._key} className="border rounded-lg p-3 bg-gray-50">
                      <div className="grid grid-cols-12 gap-2 items-start">
                        <div className="col-span-5">
                          <label className="text-xs text-gray-500">Description *</label>
                          <input type="text" value={it.description ?? ""} placeholder="Acte, analyse…"
                            onChange={e => updateItem(it._key, "description", e.target.value)}
                            className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" />
                        </div>
                        <div className="col-span-3">
                          <label className="text-xs text-gray-500">Catégorie</label>
                          <select value={it.category ?? "acte"} onChange={e => updateItem(it._key, "category", e.target.value)}
                            className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 bg-white">
                            {SERVICE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-gray-500">Qté</label>
                          <input type="number" min="1" step="1" value={it.quantity ?? 1}
                            onChange={e => updateItem(it._key, "quantity", parseFloat(e.target.value) || 1)}
                            className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" />
                        </div>
                        <div className="col-span-1">
                          <label className="text-xs text-gray-500">&nbsp;</label>
                          <button onClick={() => removeItem(it._key)}
                            className="mt-1.5 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="col-span-4">
                          <label className="text-xs text-gray-500">Prix unitaire (DZD) *</label>
                          <input type="number" min="0" step="0.01" value={it.unitPrice ?? 0}
                            onChange={e => updateItem(it._key, "unitPrice", parseFloat(e.target.value) || 0)}
                            className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" />
                        </div>
                        <div className="col-span-3">
                          <label className="text-xs text-gray-500">Remise (DZD)</label>
                          <input type="number" min="0" step="0.01" value={it.discount ?? 0}
                            onChange={e => updateItem(it._key, "discount", parseFloat(e.target.value) || 0)}
                            className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" />
                        </div>
                        <div className="col-span-3">
                          <label className="text-xs text-gray-500">TVA (DZD)</label>
                          <input type="number" min="0" step="0.01" value={it.tax ?? 0}
                            onChange={e => updateItem(it._key, "tax", parseFloat(e.target.value) || 0)}
                            className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" />
                        </div>
                        <div className="col-span-2 text-right">
                          <label className="text-xs text-gray-500">Total</label>
                          <div className="text-sm font-medium text-gray-800 mt-1.5">{fmt(calcItem(it))}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Review items (same as step 1 but read-only summary) ── */}
          {step === 2 && (
            <div className="space-y-3">
              <h3 className="font-medium text-gray-800">Révision des lignes</h3>
              {items.map(it => (
                <div key={it._key} className="flex items-center justify-between border-b py-2 text-sm">
                  <div>
                    <span className="font-medium">{it.description}</span>
                    <span className="text-gray-400 ml-2 text-xs">{it.category}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">{it.quantity} × {fmt(it.unitPrice ?? 0)}</div>
                    <div className="font-medium">{fmt(calcItem(it))} DZD</div>
                  </div>
                </div>
              ))}
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Sous-total</span><span>{fmt(totals.subtotal)} DZD</span></div>
                {totals.discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Remises</span><span>- {fmt(totals.discountAmount)} DZD</span></div>}
                {totals.taxAmount > 0 && <div className="flex justify-between"><span className="text-gray-500">TVA</span><span>+ {fmt(totals.taxAmount)} DZD</span></div>}
                <div className="flex justify-between font-semibold border-t pt-1 text-base"><span>Total</span><span>{fmt(totals.totalAmount)} DZD</span></div>
              </div>
              <button onClick={() => setStep(1)}
                className="text-xs text-blue-600 hover:underline">← Modifier les lignes</button>
            </div>
          )}

          {/* ── Step 3: Coverage ──────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-800">Type de couverture</h3>
              <div className="grid grid-cols-2 gap-3">
                {COVERAGE_TYPES.map(ct => (
                  <button key={ct.value} onClick={() => selectCoverage(ct.value, ct.pct)}
                    className={`flex items-center justify-between p-3 rounded-lg border text-sm transition-all ${
                      coverageType === ct.value && coveragePct === ct.pct
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}>
                    <span className="font-medium">{ct.label}</span>
                    <span className="text-xs text-gray-500">{ct.pct}%</span>
                  </button>
                ))}
              </div>
              {coverageType && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 whitespace-nowrap">Taux de couverture (%)</label>
                  <input type="number" min="0" max="100" value={coveragePct}
                    onChange={e => setCoveragePct(parseFloat(e.target.value) || 0)}
                    className="w-24 border rounded-lg px-2 py-1.5 text-sm" />
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Computed shares ───────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-800">Calcul des parts</h3>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                    <div className="text-xs text-gray-500 mb-1">Total facture</div>
                    <div className="text-lg font-bold text-gray-800">{fmt(totals.totalAmount)} DZD</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                    <div className="text-xs text-gray-500 mb-1">Couverture organisme</div>
                    <div className="text-lg font-bold text-blue-600">{coveragePct}%</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                    <div className="text-xs text-gray-500 mb-1">Part organisme ({coverageType || "—"})</div>
                    <div className="text-xl font-bold text-green-600">{fmt(totals.insurerShare)} DZD</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center shadow-sm border border-red-100">
                    <div className="text-xs text-gray-500 mb-1">Part patient</div>
                    <div className="text-xl font-bold text-red-600">{fmt(totals.patientShare)} DZD</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 5: Final summary ─────────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-800">Résumé final</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Patient</span><span className="font-medium">{selectedPatient?.firstName} {selectedPatient?.lastName}</span></div>
                {selectedEnc && <div className="flex justify-between"><span className="text-gray-500">Encounter</span><span>{selectedEnc.encounterNumber ?? selectedEnc.id.slice(0,8)}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">Lignes</span><span>{items.length} prestation(s)</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-semibold">{fmt(totals.totalAmount)} DZD</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Part patient</span><span className="font-semibold text-red-600">{fmt(totals.patientShare)} DZD</span></div>
                {totals.insurerShare > 0 && <div className="flex justify-between"><span className="text-gray-500">Part {coverageType.toUpperCase()}</span><span className="font-semibold text-green-600">{fmt(totals.insurerShare)} DZD</span></div>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date d'échéance</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observations…"
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
              </div>

              {err && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 shrink-0">
          <button onClick={step === 0 ? onClose : () => setStep(s => s - 1)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 font-medium">
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? "Annuler" : "Précédent"}
          </button>

          <div className="flex gap-2">
            {step < 5 ? (
              <button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg px-4 py-2 text-sm font-medium">
                Suivant <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button onClick={() => handleSave(false)} disabled={loading || items.length === 0}
                  className="border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40">
                  {loading ? "…" : "Enregistrer brouillon"}
                </button>
                <button onClick={() => handleSave(true)} disabled={loading || items.length === 0}
                  className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40">
                  {loading ? "…" : "Émettre la facture"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
