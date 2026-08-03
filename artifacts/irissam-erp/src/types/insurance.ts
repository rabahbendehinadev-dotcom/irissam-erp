// ─── Insurance Module Types ───────────────────────────────────────────────────

export type InsuranceOrgType = 'cnas' | 'casnos' | 'mutuelle' | 'assurance_privee' | 'convention_entreprise' | 'autre';

export interface InsuranceOrg {
  id: string;
  code: string;
  name: string;
  type: InsuranceOrgType;
  address?: string;
  phone?: string;
  email?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  convention_number?: string;
  convention_date?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  plans?: InsurancePlan[];
}

export interface InsurancePlan {
  id: string;
  organization_id: string;
  organization_name?: string;
  code: string;
  name: string;
  coverage_type: string;
  coverage_percent: number;
  annual_ceiling?: number;
  per_act_ceiling?: number;
  per_day_ceiling?: number;
  ticket_moderateur_percent: number;
  franchise_amount: number;
  max_acts_per_year?: number;
  requires_prior_auth: boolean;
  excluded_services?: string[];
  covered_services?: string[];
  waiting_period_days: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export type PolicyStatus = 'active' | 'expiree' | 'suspendue' | 'en_attente_validation' | 'refusee' | 'archivee';

export interface InsurancePolicy {
  id: string;
  patient_id: string;
  patient_name?: string;
  mrn?: string;
  organization_id?: string;
  organization_name?: string;
  plan_id?: string;
  plan_name?: string;
  insurer_name?: string;
  policy_number: string;
  subscriber_number?: string;
  numero_adherent?: string;
  beneficiaire_principal?: string;
  ayant_droit: boolean;
  coverage_type?: string;
  coverage_percent: number;
  ceiling_amount?: number;
  ticket_moderateur_percent: number;
  franchise_amount: number;
  valid_from?: string;
  valid_until?: string;
  plafond_consomme: number;
  priorite: number;
  statut: PolicyStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type CoverageRequestStatus =
  | 'brouillon' | 'soumise' | 'en_cours' | 'infos_requises'
  | 'approuvee' | 'partiellement_approuvee' | 'refusee' | 'expiree' | 'annulee';

export interface CoverageRequest {
  id: string;
  request_number: string;
  patient_id: string;
  patient_name?: string;
  mrn?: string;
  policy_id?: string;
  organization_id?: string;
  organization_name?: string;
  requested_amount?: number;
  requested_services?: unknown[];
  request_date: string;
  expected_response_date?: string;
  status: CoverageRequestStatus;
  approved_amount?: number;
  patient_share?: number;
  organization_share?: number;
  rejection_reason?: string;
  decision_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type ClaimStatus =
  | 'draft' | 'submitted' | 'under_review' | 'approved'
  | 'partially_approved' | 'rejected' | 'paid' | 'transferred';

export interface InsuranceClaim {
  id: string;
  claim_number: string;
  invoice_id?: string;
  invoice_number?: string;
  patient_id: string;
  patient_name?: string;
  mrn?: string;
  policy_id?: string;
  policy_number?: string;
  organization_id?: string;
  organization_name?: string;
  insurer_name?: string;
  coverage_request_id?: string;
  bordereau_id?: string;
  amount_requested: number;
  amount_requested_num?: string;
  amount_approved?: number;
  amount_approved_num?: string;
  amount_paid?: number;
  amount_rejected?: string;
  patient_share?: string;
  status: ClaimStatus;
  submitted_at?: string;
  reviewed_at?: string;
  paid_at?: string;
  decision_date?: string;
  rejection_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ClaimItem {
  id: string;
  claim_id: string;
  invoice_item_id?: string;
  service_code?: string;
  description?: string;
  amount_billed: number;
  amount_requested: number;
  amount_approved?: number;
  amount_rejected?: number;
  quantity: number;
  unit?: string;
  coverage_percent?: number;
  rejection_reason?: string;
  notes?: string;
}

export interface ClaimRejection {
  id: string;
  claim_id: string;
  item_id?: string;
  rejection_type: string;
  rejection_reason: string;
  amount_rejected: number;
  transferred_to_patient: boolean;
  transferred_at?: string;
  created_at: string;
}

export type BordereauStatus = 'en_preparation' | 'soumis' | 'en_cours_traitement' | 'recu' | 'regle_partiellement' | 'regle' | 'conteste' | 'archive';

export interface InsuranceBordereau {
  id: string;
  bordereau_number: string;
  organization_id: string;
  organization_name?: string;
  period_from?: string;
  period_to?: string;
  status: BordereauStatus;
  claim_count: number;
  total_requested: number;
  total_approved?: number;
  total_paid?: number;
  total_rejected?: number;
  reference_externe?: string;
  submitted_at?: string;
  received_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InsuranceOrgPayment {
  id: string;
  payment_number: string;
  organization_id: string;
  organization_name?: string;
  bordereau_id?: string;
  bordereau_number?: string;
  amount: number;
  payment_date: string;
  payment_method?: string;
  reference?: string;
  notes?: string;
  created_at: string;
}

export interface InsuranceDashboardData {
  kpis: {
    pending_claims: string;
    total_requested: string;
    total_approved: string;
    total_rejected: string;
    total_paid: string;
    remaining_to_collect: string;
    overdue_claims: string;
    active_policies: string;
    expiring_policies: string;
    bordereau_count: string;
  };
  charts?: {
    claims_by_status?: Array<{ status: string; count: number; amount: number }>;
    monthly_payments?: Array<{ month: string; amount: number }>;
    by_organization?: Array<{ name: string; count: number; amount: number }>;
    requested_vs_approved?: Array<{ month: string; requested: number; approved: number }>;
  };
  alerts?: {
    expiring_policies?: Array<{ patient_name: string; policy_number: string; days_left: number }>;
    overdue_claims?: Array<{ claim_number: string; days_overdue: number; amount: number }>;
    pending_bordereaux?: Array<{ bordereau_number: string; claim_count: number; total: number }>;
  };
}

// ─── API Input Types ──────────────────────────────────────────────────────────

export interface CreateOrgInput {
  name: string;
  code: string;
  type: InsuranceOrgType;
  address?: string;
  phone?: string;
  contact_email?: string;
  contact_name?: string;
  contact_phone?: string;
  convention_number?: string;
  notes?: string;
}

export interface CreatePlanInput {
  organizationId: string;
  code: string;
  name: string;
  coverageType: string;
  coverage_percent?: number;
  annual_ceiling?: number;
  ticket_moderateur_percent?: number;
  franchise_amount?: number;
  requires_prior_auth?: boolean;
  waiting_period_days?: number;
  notes?: string;
}

export interface CreatePolicyInput {
  patientId: string;
  organizationId?: string;
  planId?: string;
  policyNumber: string;
  subscriberNumber?: string;
  numeroAdherent?: string;
  coverageType?: string;
  coveragePercent?: number;
  ceilingAmount?: number;
  validFrom?: string;
  validUntil?: string;
  notes?: string;
}

export interface CreateClaimInput {
  invoiceId: string;
  patientId: string;
  policyId?: string;
  organizationId?: string;
  insurerName: string;
  amountRequested: number;
  notes?: string;
}

export interface ApproveClaimInput {
  amountApproved: number;
  notes?: string;
}

export interface PartialApproveInput {
  items: Array<{ itemId: string; amountApproved: number; notes?: string }>;
}

export interface RejectClaimInput {
  reason: string;
}

export interface CreateBordereauInput {
  organizationId: string;
  periodFrom?: string;
  periodTo?: string;
  notes?: string;
}

export interface RegisterPaymentInput {
  organizationId: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  reference?: string;
  bordereauId?: string;
  claimIds?: string[];
  notes?: string;
}

// ─── Filter Types ─────────────────────────────────────────────────────────────

export interface ClaimFilters {
  status?: string;
  organizationId?: string;
  patientId?: string;
  invoiceId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface PolicyFilters {
  patientId?: string;
  organizationId?: string;
  statut?: string;
  includeArchived?: boolean;
}
