/**
 * useInsuranceApi — React Query hooks for the insurance module.
 * Uses @tanstack/react-query (QueryClient is provided by AppProvider).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { insuranceApi } from '@/services/api/insurance';
import type {
  ClaimFilters, PolicyFilters,
  CreateOrgInput, CreatePlanInput, CreatePolicyInput, CreateClaimInput,
  ApproveClaimInput, PartialApproveInput, RejectClaimInput,
  CreateBordereauInput, RegisterPaymentInput,
} from '@/types/insurance';

// ─── Query keys ───────────────────────────────────────────────────────────────
export const insKeys = {
  all:            ['insurance'] as const,
  orgs:           (search?: string) => ['insurance', 'orgs', search] as const,
  org:            (id: string)  => ['insurance', 'org', id] as const,
  plans:          (orgId?: string) => ['insurance', 'plans', orgId] as const,
  plan:           (id: string)  => ['insurance', 'plan', id] as const,
  policies:       (f?: PolicyFilters) => ['insurance', 'policies', f] as const,
  policy:         (id: string)  => ['insurance', 'policy', id] as const,
  coverageReqs:   (patientId?: string) => ['insurance', 'coverage-requests', patientId] as const,
  claims:         (f?: ClaimFilters) => ['insurance', 'claims', f] as const,
  claim:          (id: string)  => ['insurance', 'claim', id] as const,
  bordereaux:     (orgId?: string) => ['insurance', 'bordereaux', orgId] as const,
  bordereau:      (id: string)  => ['insurance', 'bordereau', id] as const,
  payments:       (orgId?: string) => ['insurance', 'payments', orgId] as const,
  payment:        (id: string)  => ['insurance', 'payment', id] as const,
  dashboard:      ['insurance', 'dashboard'] as const,
};

// ─── Organization hooks ───────────────────────────────────────────────────────

export function useInsuranceOrgs(search?: string) {
  return useQuery({
    queryKey: insKeys.orgs(search),
    queryFn: () => insuranceApi.listOrgs(search),
    staleTime: 60_000,
  });
}

export function useInsuranceOrg(id: string) {
  return useQuery({
    queryKey: insKeys.org(id),
    queryFn: () => insuranceApi.getOrg(id),
    enabled: Boolean(id),
  });
}

export function useCreateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOrgInput) => insuranceApi.createOrg(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance', 'orgs'] }),
  });
}

export function useUpdateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateOrgInput> }) =>
      insuranceApi.updateOrg(id, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['insurance', 'orgs'] });
      qc.invalidateQueries({ queryKey: insKeys.org(v.id) });
    },
  });
}

export function useSuspendOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => insuranceApi.suspendOrg(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance', 'orgs'] }),
  });
}

export function useReactivateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => insuranceApi.reactivateOrg(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance', 'orgs'] }),
  });
}

// ─── Plan hooks ───────────────────────────────────────────────────────────────

export function useInsurancePlans(organizationId?: string) {
  return useQuery({
    queryKey: insKeys.plans(organizationId),
    queryFn: () => insuranceApi.listPlans(organizationId),
    staleTime: 60_000,
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePlanInput) => insuranceApi.createPlan(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance', 'plans'] }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreatePlanInput> }) =>
      insuranceApi.updatePlan(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance', 'plans'] }),
  });
}

// ─── Policy hooks ─────────────────────────────────────────────────────────────

export function useInsurancePolicies(filters?: PolicyFilters) {
  return useQuery({
    queryKey: insKeys.policies(filters),
    queryFn: () => insuranceApi.listPolicies(filters),
    staleTime: 30_000,
  });
}

export function useInsurancePolicy(id: string) {
  return useQuery({
    queryKey: insKeys.policy(id),
    queryFn: () => insuranceApi.getPolicy(id),
    enabled: Boolean(id),
  });
}

export function useCreatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePolicyInput) => insuranceApi.createPolicy(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance', 'policies'] }),
  });
}

export function useValidatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => insuranceApi.validatePolicy(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance', 'policies'] }),
  });
}

export function useRenewPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { validUntil: string; validFrom?: string } }) =>
      insuranceApi.renewPolicy(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance', 'policies'] }),
  });
}

// ─── Coverage request hooks ───────────────────────────────────────────────────

export function useCoverageRequests(patientId?: string) {
  return useQuery({
    queryKey: insKeys.coverageReqs(patientId),
    queryFn: () => insuranceApi.listCoverageRequests(patientId),
    staleTime: 30_000,
  });
}

// ─── Claims hooks ─────────────────────────────────────────────────────────────

export function useInsuranceClaims(filters?: ClaimFilters) {
  return useQuery({
    queryKey: insKeys.claims(filters),
    queryFn: () => insuranceApi.listClaims(filters),
    staleTime: 20_000,
  });
}

export function useInsuranceClaim(id: string) {
  return useQuery({
    queryKey: insKeys.claim(id),
    queryFn: () => insuranceApi.getClaim(id),
    enabled: Boolean(id),
  });
}

export function useCreateClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClaimInput) => insuranceApi.createClaim(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance', 'claims'] }),
  });
}

export function useSubmitClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => insuranceApi.submitClaim(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['insurance', 'claims'] });
      qc.invalidateQueries({ queryKey: insKeys.claim(id) });
    },
  });
}

export function useApproveClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApproveClaimInput }) =>
      insuranceApi.approveClaim(id, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['insurance', 'claims'] });
      qc.invalidateQueries({ queryKey: insKeys.claim(v.id) });
    },
  });
}

export function usePartialApproveClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PartialApproveInput }) =>
      insuranceApi.partialApproveClaim(id, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['insurance', 'claims'] });
      qc.invalidateQueries({ queryKey: insKeys.claim(v.id) });
    },
  });
}

export function useRejectClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectClaimInput }) =>
      insuranceApi.rejectClaim(id, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['insurance', 'claims'] });
      qc.invalidateQueries({ queryKey: insKeys.claim(v.id) });
    },
  });
}

export function useMarkClaimPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amountPaid }: { id: string; amountPaid: number }) =>
      insuranceApi.markClaimPaid(id, { amountPaid }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['insurance', 'claims'] });
      qc.invalidateQueries({ queryKey: insKeys.claim(v.id) });
    },
  });
}

export function useTransferRejectedToPatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => insuranceApi.transferRejectedToPatient(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['insurance', 'claims'] });
      qc.invalidateQueries({ queryKey: insKeys.claim(id) });
    },
  });
}

// ─── Bordereau hooks ──────────────────────────────────────────────────────────

export function useInsuranceBordereaux(organizationId?: string) {
  return useQuery({
    queryKey: insKeys.bordereaux(organizationId),
    queryFn: () => insuranceApi.listBordereaux(organizationId),
    staleTime: 30_000,
  });
}

export function useInsuranceBordereau(id: string) {
  return useQuery({
    queryKey: insKeys.bordereau(id),
    queryFn: () => insuranceApi.getBordereau(id),
    enabled: Boolean(id),
  });
}

export function useCreateBordereau() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBordereauInput) => insuranceApi.createBordereau(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance', 'bordereaux'] }),
  });
}

export function useAddClaimsToBordereau() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, claimIds }: { id: string; claimIds: string[] }) =>
      insuranceApi.addClaimsToBordereau(id, claimIds),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['insurance', 'bordereaux'] });
      qc.invalidateQueries({ queryKey: insKeys.bordereau(v.id) });
    },
  });
}

export function useRemoveClaimFromBordereau() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bordereauId, claimId }: { bordereauId: string; claimId: string }) =>
      insuranceApi.removeClaimFromBordereau(bordereauId, claimId),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: insKeys.bordereau(v.bordereauId) });
    },
  });
}

export function useSubmitBordereau() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, referenceExterne }: { id: string; referenceExterne?: string }) =>
      insuranceApi.submitBordereau(id, { reference_externe: referenceExterne }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['insurance', 'bordereaux'] });
      qc.invalidateQueries({ queryKey: insKeys.bordereau(v.id) });
    },
  });
}

export function useMarkBordereauReceived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => insuranceApi.markBordereauReceived(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['insurance', 'bordereaux'] });
      qc.invalidateQueries({ queryKey: insKeys.bordereau(id) });
    },
  });
}

// ─── Payment hooks ────────────────────────────────────────────────────────────

export function useInsurancePayments(organizationId?: string) {
  return useQuery({
    queryKey: insKeys.payments(organizationId),
    queryFn: () => insuranceApi.listPayments(organizationId),
    staleTime: 30_000,
  });
}

export function useInsurancePayment(id: string) {
  return useQuery({
    queryKey: insKeys.payment(id),
    queryFn: () => insuranceApi.getPayment(id),
    enabled: Boolean(id),
  });
}

export function useRegisterPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RegisterPaymentInput) => insuranceApi.registerPayment(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insurance', 'payments'] });
      qc.invalidateQueries({ queryKey: ['insurance', 'claims'] });
      qc.invalidateQueries({ queryKey: ['insurance', 'dashboard'] });
    },
  });
}

// ─── Dashboard hook ───────────────────────────────────────────────────────────

export function useInsuranceDashboard() {
  return useQuery({
    queryKey: insKeys.dashboard,
    queryFn: () => insuranceApi.getDashboard(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
