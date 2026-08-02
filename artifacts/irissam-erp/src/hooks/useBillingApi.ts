/**
 * useBillingApi — real PostgreSQL-backed billing hooks.
 * apiClient throws on HTTP error (no ok/data wrapper).
 */
import { useState, useCallback } from "react";
import { apiClient } from "@/services/api/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InvoiceItem {
  id?:             string;
  invoiceId?:      string;
  sourceModule?:   string;
  sourceEntityId?: string;
  serviceCode?:    string;
  description:     string;
  category?:       string;
  quantity:        number;
  unitPrice:       number;
  discount:        number;
  tax:             number;
  totalPrice:      number;
  performedAt?:    string;
  performedBy?:    string;
}

export interface Payment {
  id:             string;
  paymentNumber:  string;
  invoiceId:      string;
  invoiceNumber?: string;
  patientId:      string;
  patientName?:   string;
  amount:         number;
  method:         string;
  reference?:     string;
  notes?:         string;
  status:         string;
  collectorName?: string;
  paidAt:         string;
  createdAt:      string;
}

export interface InsuranceClaim {
  id:               string;
  claimNumber:      string;
  invoiceId:        string;
  invoiceNumber?:   string;
  patientId:        string;
  patientName?:     string;
  insurerName:      string;
  amountRequested:  number;
  amountApproved?:  number;
  amountPaid?:      number;
  status:           string;
  submittedAt?:     string;
  createdAt:        string;
}

export interface Invoice {
  id:                       string;
  invoiceNumber:            string;
  patientId:                string;
  patientName:              string;
  patientMrn?:              string;
  encounterId?:             string;
  encounterNumber?:         string;
  admissionId?:             string;
  consultationId?:          string;
  siteId?:                  string;
  invoiceDate:              string;
  dueDate?:                 string;
  status:                   InvoiceStatus;
  type:                     string;
  insuranceType?:           string;
  insuranceCoveragePercent: number;
  subtotal:                 number;
  discountAmount:           number;
  taxAmount:                number;
  totalAmount:              number;
  patientShare:             number;
  insurerShare:             number;
  paidAmount:               number;
  remainingAmount:          number;
  currency:                 string;
  notes?:                   string;
  version:                  number;
  issuedAt?:                string;
  createdAt:                string;
  updatedAt:                string;
  items?:                   InvoiceItem[];
  payments?:                Payment[];
  claims?:                  InsuranceClaim[];
}

export type InvoiceStatus =
  | "draft" | "issued" | "partially_paid" | "paid"
  | "overdue" | "cancelled" | "refunded"
  | "pending" | "partial" | "disputed";

export interface BillingStats {
  ca_today:          number;
  ca_month:          number;
  unpaid_count:      number;
  payments_month:    number;
  total_remaining:   number;
  insurance_pending: number;
}

export interface CreateInvoiceInput {
  patientId:                string;
  encounterId?:             string;
  admissionId?:             string;
  consultationId?:          string;
  siteId?:                  string;
  insuranceType?:           string;
  insuranceCoveragePercent?: number;
  dueDate?:                 string;
  notes?:                   string;
  items?:                   Omit<InvoiceItem, "id" | "invoiceId" | "totalPrice">[];
}

export interface CreatePaymentInput {
  invoiceId:  string;
  amount:     number;
  method:     string;
  reference?: string;
  notes?:     string;
}

export interface ServiceCatalogEntry {
  id:            string;
  serviceCode:   string;
  name:          string;
  sourceModule:  string;
  defaultPrice:  number;
  currency:      string;
  isActive:      boolean;
  description?:  string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useBillingApi() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const getStats = useCallback(async (): Promise<BillingStats> => {
    return apiClient.get<BillingStats>("/invoices/stats");
  }, []);

  const listInvoices = useCallback(async (params: {
    search?: string; status?: string; patientId?: string; encounterId?: string;
    dateFrom?: string; dateTo?: string; limit?: number; offset?: number;
  } = {}): Promise<Invoice[]> => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") qs.set(k, String(v)); });
    const data = await apiClient.get<Invoice[]>(`/invoices?${qs.toString()}`);
    return Array.isArray(data) ? data : [];
  }, []);

  const getInvoice = useCallback(async (id: string): Promise<Invoice> => {
    return apiClient.get<Invoice>(`/invoices/${id}`);
  }, []);

  const createInvoice = useCallback(async (input: CreateInvoiceInput): Promise<Invoice> => {
    setLoading(true); setError(null);
    try {
      return await apiClient.post<Invoice>("/invoices", input);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur création facture";
      setError(msg); throw e;
    } finally { setLoading(false); }
  }, []);

  const updateInvoice = useCallback(async (id: string, input: Partial<CreateInvoiceInput>): Promise<Invoice> => {
    setLoading(true); setError(null);
    try {
      return await apiClient.patch<Invoice>(`/invoices/${id}`, input);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur modification";
      setError(msg); throw e;
    } finally { setLoading(false); }
  }, []);

  const issueInvoice = useCallback(async (id: string): Promise<Invoice> => {
    setLoading(true); setError(null);
    try {
      return await apiClient.post<Invoice>(`/invoices/${id}/issue`, {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur émission";
      setError(msg); throw e;
    } finally { setLoading(false); }
  }, []);

  const cancelInvoice = useCallback(async (id: string, reason: string): Promise<Invoice> => {
    setLoading(true); setError(null);
    try {
      return await apiClient.post<Invoice>(`/invoices/${id}/cancel`, { reason });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur annulation"); throw e;
    } finally { setLoading(false); }
  }, []);

  const createCreditNote = useCallback(async (invoiceId: string, amount: number, reason: string) => {
    setLoading(true); setError(null);
    try {
      return await apiClient.post(`/invoices/${invoiceId}/credit-note`, { amount, reason });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur note de crédit"); throw e;
    } finally { setLoading(false); }
  }, []);

  const createPayment = useCallback(async (input: CreatePaymentInput): Promise<Payment & { invoiceStatus: string }> => {
    setLoading(true); setError(null);
    try {
      return await apiClient.post<Payment & { invoiceStatus: string }>("/payments", input);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur paiement"); throw e;
    } finally { setLoading(false); }
  }, []);

  const listPayments = useCallback(async (params: { invoiceId?: string; patientId?: string } = {}): Promise<Payment[]> => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
    const data = await apiClient.get<Payment[]>(`/payments?${qs.toString()}`);
    return Array.isArray(data) ? data : [];
  }, []);

  const createClaim = useCallback(async (input: {
    invoiceId: string; patientId: string; policyId?: string;
    insurerName: string; amountRequested: number; notes?: string;
  }) => {
    setLoading(true); setError(null);
    try {
      return await apiClient.post("/insurance/claims", input);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur dossier assurance"); throw e;
    } finally { setLoading(false); }
  }, []);

  const listClaims = useCallback(async (params: { invoiceId?: string; patientId?: string; status?: string } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
    const data = await apiClient.get<InsuranceClaim[]>(`/insurance/claims?${qs.toString()}`);
    return Array.isArray(data) ? data : [];
  }, []);

  const listPolicies = useCallback(async (patientId?: string) => {
    const qs = patientId ? `?patientId=${patientId}` : "";
    const data = await apiClient.get<unknown[]>(`/insurance/policies${qs}`);
    return Array.isArray(data) ? data : [];
  }, []);

  const createPolicy = useCallback(async (input: {
    patientId: string; insurerName: string; policyNumber: string;
    subscriberNumber?: string; coverageType: string; coveragePercent?: number;
    ceilingAmount?: number; validFrom?: string; validUntil?: string; notes?: string;
  }) => {
    setLoading(true); setError(null);
    try {
      return await apiClient.post("/insurance/policies", input);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur police"); throw e;
    } finally { setLoading(false); }
  }, []);

  const updateClaimStatus = useCallback(async (
    claimId: string,
    status: string,
    extras?: { amountApproved?: number; amountPaid?: number; rejectionReason?: string; notes?: string },
  ) => {
    setLoading(true); setError(null);
    try {
      return await apiClient.patch(`/insurance/claims/${claimId}/status`, { status, ...extras });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur mise à jour"); throw e;
    } finally { setLoading(false); }
  }, []);

  const getServiceCatalog = useCallback(async (params: {
    module?: string; search?: string; activeOnly?: boolean;
  } = {}): Promise<ServiceCatalogEntry[]> => {
    const qs = new URLSearchParams();
    if (params.module)  qs.set("module",     params.module);
    if (params.search)  qs.set("search",     params.search);
    if (params.activeOnly !== undefined) qs.set("activeOnly", String(params.activeOnly));
    const data = await apiClient.get<ServiceCatalogEntry[]>(`/service-catalog?${qs.toString()}`);
    return Array.isArray(data) ? data : [];
  }, []);

  /** Open invoice PDF in a new browser tab */
  const openInvoicePdf = useCallback((invoiceId: string) => {
    const base = apiClient.baseUrl ?? "";
    window.open(`${base}/invoices/${invoiceId}/pdf`, "_blank", "noopener");
  }, []);

  /** Open payment receipt PDF in a new browser tab */
  const openReceiptPdf = useCallback((paymentId: string) => {
    const base = apiClient.baseUrl ?? "";
    window.open(`${base}/payments/${paymentId}/receipt-pdf`, "_blank", "noopener");
  }, []);

  return {
    loading, error, clearError,
    getStats, listInvoices, getInvoice,
    createInvoice, updateInvoice, issueInvoice, cancelInvoice, createCreditNote,
    createPayment, listPayments,
    createClaim, listClaims, listPolicies, createPolicy, updateClaimStatus,
    getServiceCatalog, openInvoicePdf, openReceiptPdf,
  };
}
