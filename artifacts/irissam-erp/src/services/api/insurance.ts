/**
 * Insurance API service — all calls through the central apiClient.
 * Returns raw data; React Query hooks (useInsuranceApi.ts) wrap these.
 */
import { apiClient } from '@/services/api/client';
import type {
  InsuranceOrg, InsurancePlan, InsurancePolicy, InsuranceClaim,
  InsuranceBordereau, InsuranceOrgPayment, InsuranceDashboardData,
  CoverageRequest, ClaimItem,
  CreateOrgInput, CreatePlanInput, CreatePolicyInput, CreateClaimInput,
  ApproveClaimInput, PartialApproveInput, RejectClaimInput,
  CreateBordereauInput, RegisterPaymentInput,
  ClaimFilters, PolicyFilters,
} from '@/types/insurance';

const base = '/insurance';

// ─── Organizations ────────────────────────────────────────────────────────────

export const insuranceApi = {
  // Organizations
  listOrgs: (search?: string) =>
    apiClient.get<InsuranceOrg[]>(`${base}/organizations${search ? `?search=${encodeURIComponent(search)}` : ''}`),

  getOrg: (id: string) =>
    apiClient.get<InsuranceOrg>(`${base}/organizations/${id}`),

  createOrg: (data: CreateOrgInput) =>
    apiClient.post<InsuranceOrg>(`${base}/organizations`, data),

  updateOrg: (id: string, data: Partial<CreateOrgInput>) =>
    apiClient.patch<InsuranceOrg>(`${base}/organizations/${id}`, data),

  suspendOrg: (id: string) =>
    apiClient.post<InsuranceOrg>(`${base}/organizations/${id}/suspend`, {}),

  reactivateOrg: (id: string) =>
    apiClient.post<InsuranceOrg>(`${base}/organizations/${id}/reactivate`, {}),

  // Plans
  listPlans: (organizationId?: string) =>
    apiClient.get<InsurancePlan[]>(`${base}/plans${organizationId ? `?organizationId=${organizationId}` : ''}`),

  getPlan: (id: string) =>
    apiClient.get<InsurancePlan>(`${base}/plans/${id}`),

  createPlan: (data: CreatePlanInput) =>
    apiClient.post<InsurancePlan>(`${base}/plans`, data),

  updatePlan: (id: string, data: Partial<CreatePlanInput>) =>
    apiClient.patch<InsurancePlan>(`${base}/plans/${id}`, data),

  // Policies
  listPolicies: (filters?: PolicyFilters) => {
    const params = new URLSearchParams();
    if (filters?.patientId)     params.set('patientId', filters.patientId);
    if (filters?.organizationId) params.set('organizationId', filters.organizationId);
    if (filters?.statut)        params.set('statut', filters.statut);
    if (filters?.includeArchived) params.set('includeArchived', 'true');
    const qs = params.toString();
    return apiClient.get<InsurancePolicy[]>(`${base}/policies${qs ? `?${qs}` : ''}`);
  },

  getPolicy: (id: string) =>
    apiClient.get<InsurancePolicy>(`${base}/policies/${id}`),

  createPolicy: (data: CreatePolicyInput) =>
    apiClient.post<InsurancePolicy>(`${base}/policies`, data),

  validatePolicy: (id: string) =>
    apiClient.post<InsurancePolicy>(`${base}/policies/${id}/validate`, {}),

  archivePolicy: (id: string) =>
    apiClient.post<InsurancePolicy>(`${base}/policies/${id}/archive`, {}),

  suspendPolicy: (id: string) =>
    apiClient.post<InsurancePolicy>(`${base}/policies/${id}/suspend`, {}),

  renewPolicy: (id: string, data: { validUntil: string; validFrom?: string }) =>
    apiClient.post<InsurancePolicy>(`${base}/policies/${id}/renew`, data),

  // Coverage requests
  listCoverageRequests: (patientId?: string) =>
    apiClient.get<CoverageRequest[]>(`${base}/coverage-requests${patientId ? `?patientId=${patientId}` : ''}`),

  getCoverageRequest: (id: string) =>
    apiClient.get<CoverageRequest>(`${base}/coverage-requests/${id}`),

  createCoverageRequest: (data: {
    patientId: string; policyId?: string; requestedAmount?: number; notes?: string;
  }) => apiClient.post<CoverageRequest>(`${base}/coverage-requests`, data),

  submitCoverageRequest: (id: string) =>
    apiClient.post<CoverageRequest>(`${base}/coverage-requests/${id}/submit`, {}),

  approveCoverageRequest: (id: string, data: { approvedAmount: number; notes?: string }) =>
    apiClient.post<CoverageRequest>(`${base}/coverage-requests/${id}/approve`, data),

  rejectCoverageRequest: (id: string, data: { reason: string }) =>
    apiClient.post<CoverageRequest>(`${base}/coverage-requests/${id}/reject`, data),

  // Claims
  listClaims: (filters?: ClaimFilters) => {
    const params = new URLSearchParams();
    if (filters?.status)         params.set('status', filters.status);
    if (filters?.organizationId) params.set('organizationId', filters.organizationId);
    if (filters?.patientId)      params.set('patientId', filters.patientId);
    if (filters?.invoiceId)      params.set('invoiceId', filters.invoiceId);
    if (filters?.dateFrom)       params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo)         params.set('dateTo', filters.dateTo);
    if (filters?.limit)          params.set('limit', String(filters.limit));
    if (filters?.offset)         params.set('offset', String(filters.offset));
    const qs = params.toString();
    return apiClient.get<InsuranceClaim[]>(`${base}/claims${qs ? `?${qs}` : ''}`);
  },

  getClaim: (id: string) =>
    apiClient.get<InsuranceClaim & { items?: ClaimItem[] }>(`${base}/claims/${id}`),

  createClaim: (data: CreateClaimInput) =>
    apiClient.post<InsuranceClaim>(`${base}/claims`, data),

  createClaimFromInvoice: (data: {
    invoiceId: string; patientId: string; policyId: string; organizationId: string; notes?: string;
  }) => apiClient.post<InsuranceClaim>(`${base}/claims/from-invoice`, data),

  submitClaim: (id: string) =>
    apiClient.post<InsuranceClaim>(`${base}/claims/${id}/submit`, {}),

  approveClaim: (id: string, data: ApproveClaimInput) =>
    apiClient.post<InsuranceClaim>(`${base}/claims/${id}/approve`, data),

  partialApproveClaim: (id: string, data: PartialApproveInput) =>
    apiClient.post<InsuranceClaim>(`${base}/claims/${id}/partial-approve`, data),

  rejectClaim: (id: string, data: RejectClaimInput) =>
    apiClient.post<InsuranceClaim>(`${base}/claims/${id}/reject`, data),

  markClaimPaid: (id: string, data: { amountPaid: number }) =>
    apiClient.post<InsuranceClaim>(`${base}/claims/${id}/mark-paid`, data),

  transferRejectedToPatient: (id: string) =>
    apiClient.post<InsuranceClaim>(`${base}/claims/${id}/transfer-rejected`, {}),

  // Bordereaux
  listBordereaux: (organizationId?: string) =>
    apiClient.get<InsuranceBordereau[]>(`${base}/bordereaux${organizationId ? `?organizationId=${organizationId}` : ''}`),

  getBordereau: (id: string) =>
    apiClient.get<InsuranceBordereau & { claims?: InsuranceClaim[] }>(`${base}/bordereaux/${id}`),

  createBordereau: (data: CreateBordereauInput) =>
    apiClient.post<InsuranceBordereau>(`${base}/bordereaux`, data),

  addClaimsToBordereau: (id: string, claimIds: string[]) =>
    apiClient.post<InsuranceBordereau>(`${base}/bordereaux/${id}/add-claims`, { claimIds }),

  removeClaimFromBordereau: (bordereauId: string, claimId: string) =>
    apiClient.delete<void>(`${base}/bordereaux/${bordereauId}/claims/${claimId}`),

  submitBordereau: (id: string, data: { reference_externe?: string }) =>
    apiClient.post<InsuranceBordereau>(`${base}/bordereaux/${id}/submit`, data),

  markBordereauReceived: (id: string) =>
    apiClient.post<InsuranceBordereau>(`${base}/bordereaux/${id}/mark-received`, {}),

  // Payments
  listPayments: (organizationId?: string) =>
    apiClient.get<InsuranceOrgPayment[]>(`${base}/payments${organizationId ? `?organizationId=${organizationId}` : ''}`),

  getPayment: (id: string) =>
    apiClient.get<InsuranceOrgPayment>(`${base}/payments/${id}`),

  registerPayment: (data: RegisterPaymentInput) =>
    apiClient.post<InsuranceOrgPayment>(`${base}/payments`, data),

  // Dashboard
  getDashboard: () =>
    apiClient.get<InsuranceDashboardData>(`${base}/dashboard`),
};
