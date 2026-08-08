/**
 * InvoiceWizard — 6-step invoice creation wizard.
 *
 * Step 1: Patient + Encounter selection
 * Step 2: Auto-fetch billable events from backend + manual add
 * Step 3: Review items (read-only summary, edit link)
 * Step 4: Coverage type
 * Step 5: Computed shares (backend-calculated)
 * Step 6: Final review + save/issue
 */
import { useState, useCallback, useEffect } from "react";
import {
  X, ChevronRight, ChevronLeft, Plus, Trash2, User, FileText,
  Settings, Shield, Calculator, CheckCircle, AlertTriangle, RefreshCw,
} from "lucide-react";
import { apiClient } from "@/services/api/client";
import type { InvoiceItem, CreateInvoiceInput } from "@/hooks/useBillingApi";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Patient   { id: string; firstName: string; lastName: string; mrn?: string; }
interface Encounter { id: string; encounterNumber?: string; status?: string; createdAt?: string; }

interface BillableEvent {
  sourceEntityId:      string;
  sourceModule:        string;
  serviceCode:         string;
  description:         string;
  category:            string;
  quantity:            number;
  unitPrice:           number;
  total:               number;
  performedAt?:        string;
  performedBy?:        string;
  billingStatus:       "unbilled" | "reserved" | "billed" | "cancelled";
  billedInvoiceId?:    string;
  billedInvoiceNumber?: string;
}

interface WizardProps {
  onClose:   () => void;
  onCreate:  (input: CreateInvoiceInput, issue: boolean) => Promise<void>;
  loading:   boolean;
  /** Pré-sélectionne le patient (Actions rapides du dossier patient) */
  initialPatientId?: string;
}

// ── Coverage types ────────────────────────────────────────────────────────────

const COVERAGE_TYPES = [
  { value: "",           label: "Paiement direct",     pct: 0 },
  { value: "cnas",       label: "CNAS",                pct: 80 },
  { value: "casnos",     label: "CASNOS",              pct: 80 },
  { value: "mutuelle",   label: "Mutuelle",            pct: 70 },
  { value: "militaire",  label: "Militaire",           pct: 100 },
  { value: "gratuite",   label: "Gratuité autorisée",  pct: 100 },
  { value: "payant",     label: "Convention / Tiers",  pct: 50 },
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

type LineItem = Partial<InvoiceItem> & {
  _key:            number;
  _fromEvent?:     boolean;  // auto-imported from billable event
  sourceEntityId?: string;
  sourceModule?:   string;
  serviceCode?:    string;
};

function computeTotals(items: LineItem[], coverPct: number) {
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
  { label: "Patient",    icon: User },
  { label: "Services",   icon: FileText },
  { label: "Révision",   icon: Settings },
  { label: "Couverture", icon: Shield },
  { label: "Calcul",     icon: Calculator },
  { label: "Résumé",     icon: CheckCircle },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function InvoiceWizard({ onClose, onCreate, loading, initialPatientId }: WizardProps) {
  const [step, setStep] = useState(0);

  // Step 1
  const [patientSearch,   setPatientSearch]   = useState("");
  const [patients,        setPatients]        = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [encounters,      setEncounters]      = useState<Encounter[]>([]);
  const [selectedEnc,     setSelectedEnc]     = useState<Encounter | null>(null);
  const [searching,       setSearching]       = useState(false);

  // Step 2 — billable events
  const [events,          setEvents]          = useState<BillableEvent[]>([]);
  const [eventsLoading,   setEventsLoading]   = useState(false);
  const [eventsError,     setEventsError]     = useState<string | null>(null);
  const [selectedEvents,  setSelectedEvents]  = useState<Set<string>>(new Set());

  // Manual items (added on top of auto-imported events)
  const [manualItems, setManualItems]  = useState<LineItem[]>([]);
  const [nextKey,     setNextKey]      = useState(1);

  // Step 4
  const [coverageType, setCoverageType] = useState("");
  const [coveragePct,  setCoveragePct]  = useState(0);

  // Step 6
  const [notes,   setNotes]   = useState("");
  const [dueDate, setDueDate] = useState("");
  const [err,     setErr]     = useState<string | null>(null);

  // ── All items = selected events + manual items ────────────────────────────

  const eventItems: LineItem[] = events
    .filter(e => selectedEvents.has(e.sourceEntityId) && e.billingStatus === "unbilled")
    .map((e, i) => ({
      _key:          -(i + 1),
      _fromEvent:    true,
      description:   e.description,
      category:      e.category,
      quantity:      e.quantity,
      unitPrice:     e.unitPrice,
      discount:      0,
      tax:           0,
      sourceEntityId: e.sourceEntityId,
      sourceModule:  e.sourceModule,
      serviceCode:   e.serviceCode,
      performedAt:   e.performedAt,
      performedBy:   e.performedBy,
    }));

  const allItems = [...eventItems, ...manualItems];
  const totals   = computeTotals(allItems, coveragePct);

  // ── Fetch billable events when encounter is selected ──────────────────────

  const fetchBillableEvents = useCallback(async (encounterId: string) => {
    setEventsLoading(true); setEventsError(null);
    try {
      const data = await apiClient.get<BillableEvent[]>(`/encounters/${encounterId}/billable-events`);
      const arr  = Array.isArray(data) ? data : [];
      setEvents(arr);
      // Auto-select all unbilled events
      const unbilledIds = new Set(
        arr.filter(e => e.billingStatus === "unbilled").map(e => e.sourceEntityId),
      );
      setSelectedEvents(unbilledIds);
    } catch {
      setEventsError("Impossible de charger les événements cliniques");
    } finally { setEventsLoading(false); }
  }, []);

  useEffect(() => {
    if (selectedEnc?.id) fetchBillableEvents(selectedEnc.id);
    else { setEvents([]); setSelectedEvents(new Set()); }
  }, [selectedEnc, fetchBillableEvents]);

  // ── Patient search ────────────────────────────────────────────────────────

  const searchPatients = useCallback(async (q: string) => {
    if (q.length < 2) { setPatients([]); return; }
    setSearching(true);
    try {
      const data = await apiClient.get<Patient[]>(`/patients?search=${encodeURIComponent(q)}&limit=10`);
      if (Array.isArray(data)) setPatients(data);
    } catch { /* ignore */ }
    finally { setSearching(false); }
  }, []);

  const selectPatient = useCallback(async (p: Patient) => {
    setSelectedPatient(p); setPatients([]);
    try {
      const data = await apiClient.get<Encounter[]>(`/encounters?patientId=${p.id}&limit=10`);
      if (Array.isArray(data)) setEncounters(data);
    } catch { /* no encounters */ }
  }, []);

  // Pré-sélection du patient (arrivée via « Actions rapides » du dossier patient)
  useEffect(() => {
    if (!initialPatientId) return;
    apiClient.get<Record<string, unknown>>(`/patients/${initialPatientId}`)
      .then((r) => {
        const obj = r as { id?: string; firstName?: string; lastName?: string; mpiId?: string; mrn?: string } | null;
        if (!obj?.id) return;
        selectPatient({
          id:        obj.id,
          firstName: obj.firstName ?? "",
          lastName:  obj.lastName ?? "",
          mrn:       obj.mpiId ?? obj.mrn,
        });
      })
      .catch(() => { /* patient introuvable — sélection manuelle possible */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPatientId]);

  // ── Toggle event selection ────────────────────────────────────────────────

  const toggleEvent = (entityId: string, billingStatus: string) => {
    if (billingStatus !== "unbilled") return;
    setSelectedEvents(prev => {
      const next = new Set(prev);
      next.has(entityId) ? next.delete(entityId) : next.add(entityId);
      return next;
    });
  };

  const selectAllUnbilled = () => {
    const ids = new Set(
      events.filter(e => e.billingStatus === "unbilled").map(e => e.sourceEntityId),
    );
    setSelectedEvents(ids);
  };

  const deselectAll = () => setSelectedEvents(new Set());

  // ── Manual items ──────────────────────────────────────────────────────────

  const addItem = () => {
    setManualItems(prev => [...prev, {
      _key: nextKey, description: "", category: "acte",
      quantity: 1, unitPrice: 0, discount: 0, tax: 0,
    }]);
    setNextKey(k => k + 1);
  };

  const updateItem = (key: number, field: string, value: string | number) =>
    setManualItems(prev => prev.map(it => it._key === key ? { ...it, [field]: value } : it));

  const removeItem = (key: number) =>
    setManualItems(prev => prev.filter(it => it._key !== key));

  // ── Coverage ──────────────────────────────────────────────────────────────

  const selectCoverage = (value: string, pct: number) => {
    setCoverageType(value); setCoveragePct(pct);
  };

  // ── Validation ────────────────────────────────────────────────────────────

  const canNext = (): boolean => {
    if (step === 0) return !!selectedPatient;
    if (step === 2) {
      if (allItems.length === 0) return false;
      return allItems.every(it =>
        (it.description?.trim() ?? "") !== "" && (it.unitPrice ?? 0) > 0,
      );
    }
    return true;
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSave = async (issue: boolean) => {
    if (!selectedPatient) return;
    setErr(null);
    try {
      const input: CreateInvoiceInput = {
        patientId:                selectedPatient.id,
        encounterId:              selectedEnc?.id,
        insuranceType:            coverageType || undefined,
        insuranceCoveragePercent: coveragePct,
        dueDate:                  dueDate   || undefined,
        notes:                    notes     || undefined,
        items: allItems.map(it => ({
          description:    it.description   ?? "",
          category:       it.category      ?? "acte",
          quantity:       it.quantity      ?? 1,
          unitPrice:      it.unitPrice     ?? 0,
          discount:       it.discount      ?? 0,
          tax:            it.tax           ?? 0,
          sourceModule:   it.sourceModule,
          sourceEntityId: it.sourceEntityId,
          serviceCode:    it.serviceCode,
          performedAt:    it.performedAt as string | undefined,
          performedBy:    it.performedBy as string | undefined,
        })),
      };
      await onCreate(input, issue);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur lors de la création");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const unbilledCount  = events.filter(e => e.billingStatus === "unbilled").length;
  const selectedCount  = [...selectedEvents].filter(id =>
    events.find(e => e.sourceEntityId === id && e.billingStatus === "unbilled"),
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4">
      <div className="bg-white sm:rounded-xl shadow-2xl w-full sm:max-w-3xl h-full sm:h-auto sm:max-h-[90vh] max-h-[100dvh] flex flex-col rounded-t-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b shrink-0">
          <h2 className="font-semibold text-gray-900 text-lg">Nouvelle facture</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
        </div>

        {/* Step indicator */}
        <div className="flex px-6 py-3 border-b bg-gray-50 shrink-0 overflow-x-auto gap-1">
          {STEPS.map((s, i) => {
            const Icon   = s.icon;
            const active = i === step;
            const done   = i < step;
            return (
              <button key={i} onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  active ? "bg-blue-600 text-white shadow" :
                  done   ? "bg-blue-100 text-blue-700 cursor-pointer hover:bg-blue-200" :
                           "bg-gray-100 text-gray-400 cursor-default"
                }`}>
                <Icon className="w-3.5 h-3.5" />{s.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Step 0: Patient ──────────────────────────────────────────── */}
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

          {/* ── Step 1: Billable events + manual ─────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-800">Services à facturer</h3>
                <button onClick={addItem}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  <Plus className="w-4 h-4" /> Ajouter manuellement
                </button>
              </div>

              {/* Auto-imported billable events */}
              {selectedEnc && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Services cliniques ({unbilledCount} disponibles)
                    </span>
                    <div className="flex gap-2">
                      {eventsLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                      {unbilledCount > 0 && (
                        <>
                          <button onClick={selectAllUnbilled}
                            className="text-xs text-blue-600 hover:underline">Tout sélectionner</button>
                          <span className="text-gray-300">|</span>
                          <button onClick={deselectAll}
                            className="text-xs text-gray-500 hover:underline">Désélectionner</button>
                        </>
                      )}
                    </div>
                  </div>

                  {eventsError && (
                    <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{eventsError}
                    </div>
                  )}

                  {events.length === 0 && !eventsLoading && (
                    <p className="text-xs text-gray-400 italic">Aucun service clinique facturable pour cet encounter.</p>
                  )}

                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {events.map(e => {
                      const isBilled    = e.billingStatus === "billed" || e.billingStatus === "reserved";
                      const isSelected  = selectedEvents.has(e.sourceEntityId);
                      const noPrice     = e.unitPrice === 0;
                      return (
                        <div key={e.sourceEntityId}
                          className={`flex items-start gap-3 px-3 py-2 rounded-lg border text-sm transition-all ${
                            isBilled    ? "bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed" :
                            isSelected  ? "bg-blue-50 border-blue-300" :
                                          "border-gray-200 hover:border-gray-300 cursor-pointer"
                          }`}
                          onClick={() => toggleEvent(e.sourceEntityId, e.billingStatus)}>
                          <input type="checkbox" readOnly checked={isSelected && !isBilled}
                            disabled={isBilled}
                            className="mt-0.5 accent-blue-600 cursor-pointer shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{e.description}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {e.category} · {e.quantity} × {fmt(e.unitPrice)} DZD
                              {e.performedAt && ` · ${new Date(e.performedAt).toLocaleDateString("fr-DZ")}`}
                            </div>
                            {isBilled && e.billedInvoiceNumber && (
                              <div className="text-xs text-orange-600 mt-0.5 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Déjà facturé — {e.billedInvoiceNumber}
                              </div>
                            )}
                            {noPrice && !isBilled && (
                              <div className="text-xs text-red-500 mt-0.5">⚠ Tarif non configuré</div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold text-gray-800">{fmt(e.total)} DZD</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Manual items */}
              {manualItems.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Lignes manuelles</div>
                  <div className="space-y-2">
                    {manualItems.map(it => (
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
                            <input type="number" min="1" value={it.quantity ?? 1}
                              onChange={e => updateItem(it._key, "quantity", parseFloat(e.target.value) || 1)}
                              className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" />
                          </div>
                          <div className="col-span-1 flex items-end justify-end">
                            <button onClick={() => removeItem(it._key)}
                              className="mb-1 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
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
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {allItems.length === 0 && (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                  <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Sélectionnez des services ou ajoutez une ligne manuelle.</p>
                </div>
              )}

              {/* Summary bar */}
              {allItems.length > 0 && (
                <div className="bg-gray-50 rounded-lg px-4 py-2 flex items-center justify-between text-sm">
                  <span className="text-gray-500">{allItems.length} ligne(s) · {selectedCount} auto-importée(s)</span>
                  <span className="font-semibold text-gray-800">Total: {fmt(totals.totalAmount)} DZD</span>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Revision ─────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-3">
              <h3 className="font-medium text-gray-800">Révision des lignes</h3>
              {allItems.length === 0 && (
                <div className="text-sm text-gray-400 italic">Aucune ligne.</div>
              )}
              {allItems.map((it, i) => (
                <div key={i} className="flex items-center justify-between border-b py-2 text-sm">
                  <div>
                    <span className="font-medium">{it.description}</span>
                    {it._fromEvent && <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">Auto</span>}
                    <span className="text-gray-400 ml-2 text-xs">{it.category}</span>
                    {(it.unitPrice ?? 0) === 0 && (
                      <span className="ml-2 text-xs text-red-500">⚠ Tarif non configuré</span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">{it.quantity} × {fmt(it.unitPrice ?? 0)}</div>
                    <div className="font-medium">
                      {fmt((it.quantity ?? 1) * (it.unitPrice ?? 0) - (it.discount ?? 0) + (it.tax ?? 0))} DZD
                    </div>
                  </div>
                </div>
              ))}
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Sous-total</span><span>{fmt(totals.subtotal)} DZD</span></div>
                {totals.discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Remises</span><span>- {fmt(totals.discountAmount)} DZD</span></div>}
                {totals.taxAmount > 0 && <div className="flex justify-between"><span className="text-gray-500">TVA</span><span>+ {fmt(totals.taxAmount)} DZD</span></div>}
                <div className="flex justify-between font-semibold border-t pt-1"><span>Total</span><span>{fmt(totals.totalAmount)} DZD</span></div>
              </div>
              <button onClick={() => setStep(1)} className="text-xs text-blue-600 hover:underline">← Modifier les lignes</button>
            </div>
          )}

          {/* ── Step 3: Coverage ─────────────────────────────────────────── */}
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
                    <div className="text-xs text-gray-500 mb-1">Part {coverageType ? coverageType.toUpperCase() : "organisme"}</div>
                    <div className="text-xl font-bold text-green-600">{fmt(totals.insurerShare)} DZD</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center shadow-sm border border-red-100">
                    <div className="text-xs text-gray-500 mb-1">Part patient</div>
                    <div className="text-xl font-bold text-red-600">{fmt(totals.patientShare)} DZD</div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Note: Les totaux définitifs sont recalculés avec précision NUMERIC dans le serveur au moment de l'enregistrement.
              </p>
            </div>
          )}

          {/* ── Step 5: Final summary ─────────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-800">Résumé final</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Patient</span><span className="font-medium">{selectedPatient?.firstName} {selectedPatient?.lastName}</span></div>
                {selectedEnc && <div className="flex justify-between"><span className="text-gray-500">Encounter</span><span>{selectedEnc.encounterNumber ?? selectedEnc.id.slice(0,8)}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">Lignes</span><span>{allItems.length} ({selectedCount} auto-importées)</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-semibold">{fmt(totals.totalAmount)} DZD</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Part patient</span><span className="font-semibold text-red-600">{fmt(totals.patientShare)} DZD</span></div>
                {totals.insurerShare > 0 && (
                  <div className="flex justify-between"><span className="text-gray-500">Part {coverageType.toUpperCase()}</span><span className="font-semibold text-green-600">{fmt(totals.insurerShare)} DZD</span></div>
                )}
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
                <button onClick={() => handleSave(false)} disabled={loading || allItems.length === 0}
                  className="border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40">
                  {loading ? "…" : "Enregistrer brouillon"}
                </button>
                <button onClick={() => handleSave(true)} disabled={loading || allItems.length === 0}
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
