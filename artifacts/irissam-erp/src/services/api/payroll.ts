import { apiClient } from '@/lib/api-client';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PayrollPeriod {
  id: string; month: number; year: number;
  start_date: string; end_date: string; payment_date?: string;
  status: 'draft'|'collecting_data'|'calculated'|'under_review'|'approved'|'locked'|'paid'|'cancelled';
  notes?: string; run_count?: number;
  created_at: string; updated_at: string;
}

export interface PayrollRun {
  id: string; period_id: string; label?: string;
  status: 'draft'|'collecting_data'|'calculated'|'under_review'|'hr_approved'|'finance_approved'|'locked'|'payslips_generated'|'paid'|'cancelled';
  total_employees: number; total_brut: number; total_net: number;
  total_earnings: number; total_deductions: number;
  total_tax: number; total_social_sec: number;
  total_advances: number; total_loans: number;
  total_anomalies: number; total_critical_anomalies: number;
  month?: number; year?: number; start_date?: string; end_date?: string;
  employee_runs?: PayrollEmployeeRun[];
  anomalies?: PayrollAnomaly[];
  hr_approved_at?: string; finance_approved_at?: string;
  locked_at?: string; payslips_generated_at?: string; marked_paid_at?: string;
  created_at: string; updated_at: string;
}

export interface PayrollEmployeeRun {
  id: string; run_id: string; employee_id: string; contract_id?: string;
  matricule?: string; first_name?: string; last_name?: string;
  department_name?: string; position_name?: string;
  working_days: number; days_worked: number; days_absent: number;
  days_paid_leave: number; days_unpaid_leave: number;
  minutes_late: number; overtime_minutes: number;
  salary_base: number; daily_rate: number;
  total_earnings: number; total_deductions: number;
  total_advances: number; total_loans: number;
  brut: number; cotisations: number; tax: number; net: number;
  has_anomalies: boolean; anomaly_count: number; critical_anomaly_count: number;
  excluded: boolean; payment_method?: string; bank_account?: string;
}

export interface PayrollAnomaly {
  id: string; run_id: string; employee_id?: string; employee_run_id?: string;
  matricule?: string; first_name?: string; last_name?: string;
  code: string; message: string;
  severity: 'info'|'warning'|'critical';
  resolved: boolean; resolution_note?: string;
  created_at: string;
}

export interface SalaryComponent {
  id: string; code: string; name: string; name_ar?: string; name_en?: string;
  type: 'earning'|'deduction'; calculation_method: string;
  fixed_amount: number; percentage: number;
  taxable: boolean; social_security_applicable: boolean;
  active: boolean; priority: number;
  effective_from: string; effective_to?: string;
}

export interface PayrollAdvance {
  id: string; employee_id: string; amount: number;
  request_date: string; deduction_period_id?: string;
  status: 'pending'|'approved'|'rejected'|'paid'|'partially_deducted'|'fully_deducted'|'cancelled';
  reason?: string; approved_by?: string; approved_at?: string;
  matricule?: string; first_name?: string; last_name?: string;
  created_at: string;
}

export interface PayrollLoan {
  id: string; loan_number: string; employee_id: string;
  total_amount: number; installment_amount: number;
  number_of_installments: number; paid_installments: number;
  remaining_amount: number; start_period_id?: string;
  status: 'pending'|'approved'|'rejected'|'active'|'completed'|'cancelled';
  reason?: string; approved_at?: string;
  matricule?: string; first_name?: string; last_name?: string;
  created_at: string;
}

export interface Payslip {
  id: string; employee_run_id: string; run_id: string; employee_id: string;
  payslip_number: string; period_label: string; language: string;
  generated_at: string; printed_count: number;
  matricule?: string; first_name?: string; last_name?: string;
  net?: number; brut?: number; month?: number; year?: number; payment_date?: string;
}

export interface PaymentOrder {
  id: string; run_id: string; order_number: string;
  method: 'bank_transfer'|'cash'|'cheque'|'mobile';
  total_amount: number; employee_count: number;
  bank?: string; reference?: string;
  status: 'draft'|'approved'|'sent_to_bank'|'partially_paid'|'paid'|'rejected';
  approved_at?: string; paid_at?: string;
  items?: Array<{ employee_id: string; net_amount: number; bank_account?: string; status: string }>;
  created_at: string;
}

export interface PayrollDashboard {
  latestRun?: PayrollRun;
  kpis: {
    total_brut?: number; total_net?: number; total_employees?: number;
    total_earnings?: number; total_deductions?: number;
    total_advances?: number; total_loans?: number;
    total_anomalies?: number; total_critical_anomalies?: number;
    total_social_sec?: number; total_tax?: number;
    variation_vs_previous?: string;
  };
  anomalies: { critical?: number; warning?: number };
  activeAdvances: { count?: number; balance?: number };
  activeLoans: { count?: number; balance?: number };
  charts: {
    monthlySalary: Array<{ month: number; year: number; total_brut: number; total_net: number; total_employees: number }>;
    byDepartment: Array<{ department: string; total_net: number; headcount: number }>;
  };
}

export interface PayrollSettings {
  id: string; working_days_per_month: number; working_hours_per_day: number;
  overtime_rate_25: number; overtime_rate_50: number; overtime_rate_100: number;
  night_shift_rate: number; guard_12h_rate: number; guard_24h_rate: number;
  late_deduction_method: string; late_grace_minutes: number;
  absence_deduction_method: string; rounding_decimal: number; currency: string;
}

// ── Paginated response wrapper ─────────────────────────────────────────────────
export interface PagedResponse<T> {
  data: T[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    page?: number;
    totalPages?: number;
  };
}

// ── API functions ─────────────────────────────────────────────────────────────
// NOTE: apiClient is new ApiClient('/api') — use .get/.post/.patch/.delete/.request
// The base URL '/api' is already baked into the instance; do NOT include it here.
const BASE = '/payroll';

const qs = (params?: Record<string, unknown>) =>
  params ? new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [k, String(v)])
  ).toString() : '';

export const payrollApi = {
  // Dashboard
  getDashboard: (year?: number): Promise<PayrollDashboard> =>
    apiClient.get(`${BASE}/dashboard${year ? `?year=${year}` : ''}`),

  // Periods
  getPeriods: (params?: Record<string, unknown>): Promise<PagedResponse<PayrollPeriod>> =>
    apiClient.get(`${BASE}/periods?${qs(params)}`),
  getPeriod: (id: string): Promise<PayrollPeriod> => apiClient.get(`${BASE}/periods/${id}`),
  createPeriod: (data: Partial<PayrollPeriod>): Promise<PayrollPeriod> =>
    apiClient.post(`${BASE}/periods`, data),
  updatePeriod: (id: string, data: Partial<PayrollPeriod>): Promise<PayrollPeriod> =>
    apiClient.patch(`${BASE}/periods/${id}`, data),

  // Runs
  getRuns: (params?: Record<string, unknown>): Promise<PagedResponse<PayrollRun>> =>
    apiClient.get(`${BASE}/runs?${qs(params)}`),
  getRun: (id: string): Promise<PayrollRun> => apiClient.get(`${BASE}/runs/${id}`),
  createRun: (data: { periodId: string; label?: string }): Promise<PayrollRun> =>
    apiClient.post(`${BASE}/runs`, data),
  collectData: (id: string) =>
    apiClient.post(`${BASE}/runs/${id}/collect`, {}),
  calculateRun: (id: string) =>
    apiClient.post(`${BASE}/runs/${id}/calculate`, {}),
  reviewRun: (id: string) =>
    apiClient.post(`${BASE}/runs/${id}/review`, {}),
  hrApprove: (id: string, comment?: string) =>
    apiClient.post(`${BASE}/runs/${id}/hr-approve`, { comment }),
  financeApprove: (id: string, comment?: string) =>
    apiClient.post(`${BASE}/runs/${id}/finance-approve`, { comment }),
  lockRun: (id: string) =>
    apiClient.post(`${BASE}/runs/${id}/lock`, {}),
  generatePayslips: (id: string) =>
    apiClient.post(`${BASE}/runs/${id}/generate-payslips`, {}),
  markPaid: (id: string) =>
    apiClient.post(`${BASE}/runs/${id}/mark-paid`, {}),
  getAnomalies: (id: string): Promise<{ anomalies: PayrollAnomaly[] }> =>
    apiClient.get(`${BASE}/runs/${id}/anomalies`),
  getLoanInstallments: (id: string): Promise<{ data: unknown[] }> =>
    apiClient.get(`${BASE}/loans/${id}/installments`),
  resolveAnomaly: (runId: string, anomalyId: string, note?: string) =>
    apiClient.patch(`${BASE}/runs/${runId}/anomalies/${anomalyId}/resolve`, { note }),
  getEmployeeProfile: (id: string) => apiClient.get(`${BASE}/employees/${id}`),

  // Components
  getComponents: (params?: Record<string, unknown>): Promise<PagedResponse<SalaryComponent>> =>
    apiClient.get(`${BASE}/components?${qs(params)}`),
  createComponent: (data: Partial<SalaryComponent>): Promise<SalaryComponent> =>
    apiClient.post(`${BASE}/components`, data),
  updateComponent: (id: string, data: Partial<SalaryComponent>): Promise<SalaryComponent> =>
    apiClient.patch(`${BASE}/components/${id}`, data),
  deleteComponent: (id: string) =>
    apiClient.delete(`${BASE}/components/${id}`),

  // Advances
  getAdvances: (params?: Record<string, unknown>): Promise<PagedResponse<PayrollAdvance>> =>
    apiClient.get(`${BASE}/advances?${qs(params)}`),
  createAdvance: (data: { employeeId: string; amount: number; deductionPeriodId?: string; reason?: string }) =>
    apiClient.post(`${BASE}/advances`, data),
  approveAdvance: (id: string) =>
    apiClient.patch(`${BASE}/advances/${id}/approve`, {}),
  rejectAdvance: (id: string, reason: string) =>
    apiClient.patch(`${BASE}/advances/${id}/reject`, { reason }),

  // Loans
  getLoans: (params?: Record<string, unknown>): Promise<PagedResponse<PayrollLoan>> =>
    apiClient.get(`${BASE}/loans?${qs(params)}`),
  createLoan: (data: any) =>
    apiClient.post(`${BASE}/loans`, data),
  approveLoan: (id: string) =>
    apiClient.patch(`${BASE}/loans/${id}/approve`, {}),
  rejectLoan: (id: string, reason: string) =>
    apiClient.patch(`${BASE}/loans/${id}/reject`, { reason }),

  // Payslips
  getPayslips: (params?: Record<string, unknown>): Promise<PagedResponse<Payslip>> =>
    apiClient.get(`${BASE}/payslips?${qs(params)}`),
  getPayslipPdfUrl: (id: string) => `/api${BASE}/payslips/${id}/pdf`,
  getEmployeeHistory: (employeeId: string) => apiClient.get(`${BASE}/employees/${employeeId}/history`),

  // Payment orders
  getPaymentOrders: (params?: Record<string, unknown>): Promise<PagedResponse<PaymentOrder>> =>
    apiClient.get(`${BASE}/payment-orders?${qs(params)}`),
  getPaymentOrder: (id: string) => apiClient.get(`${BASE}/payment-orders/${id}`),
  createPaymentOrder: (data: any) =>
    apiClient.post(`${BASE}/payment-orders`, data),
  approvePaymentOrder: (id: string) =>
    apiClient.patch(`${BASE}/payment-orders/${id}/approve`, {}),
  markPaymentOrderPaid: (id: string) =>
    apiClient.patch(`${BASE}/payment-orders/${id}/mark-paid`, {}),

  // Bank export (direct URL — not an API call)
  getBankExportUrl: (params: { runId?: string; orderId?: string; format?: string }) =>
    `/api${BASE}/bank-export?${new URLSearchParams(params as any).toString()}`,

  // Reports
  getReports: (params?: Record<string, unknown>): Promise<PagedResponse<unknown>> =>
    apiClient.get(`${BASE}/reports?${qs(params)}`),
  getAuditLog: (params?: Record<string, unknown>) =>
    apiClient.get(`${BASE}/audit?${qs(params)}`),

  // Settings
  getSettings: (): Promise<{ settings: PayrollSettings; taxRules: any[]; socialSecurityRules: any[] }> =>
    apiClient.get(`${BASE}/settings`),
  updateSettings: (data: Partial<PayrollSettings>) =>
    apiClient.patch(`${BASE}/settings`, data),
  updateTaxRule: (id: string, data: any) =>
    apiClient.patch(`${BASE}/settings/tax-rules/${id}`, data),
  updateSSRule: (id: string, data: any) =>
    apiClient.patch(`${BASE}/settings/ss-rules/${id}`, data),
};

// Helpers
export const PAYROLL_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', collecting_data: 'Collecte données', calculated: 'Calculé',
  under_review: 'En révision', hr_approved: 'Approuvé RH', finance_approved: 'Approuvé Finance',
  locked: 'Verrouillé', payslips_generated: 'Bulletins générés', paid: 'Payé', cancelled: 'Annulé',
};
export const PAYROLL_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700', collecting_data: 'bg-blue-100 text-blue-700',
  calculated: 'bg-yellow-100 text-yellow-700', under_review: 'bg-orange-100 text-orange-700',
  hr_approved: 'bg-teal-100 text-teal-700', finance_approved: 'bg-purple-100 text-purple-700',
  locked: 'bg-indigo-100 text-indigo-700', payslips_generated: 'bg-cyan-100 text-cyan-700',
  paid: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700', active: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
};
export const ANOMALY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
};
export const MONTH_NAMES_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

export function formatAmount(n: any, currency = 'DZD'): string {
  return `${parseFloat(n || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}
