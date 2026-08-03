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

// ── API functions ─────────────────────────────────────────────────────────────
const BASE = '/api/payroll';

export const payrollApi = {
  // Dashboard
  getDashboard: (year?: number): Promise<PayrollDashboard> =>
    apiClient(`${BASE}/dashboard${year ? `?year=${year}` : ''}`),

  // Periods
  getPeriods: (params?: Record<string, any>) =>
    apiClient(`${BASE}/periods?${new URLSearchParams(params as any).toString()}`),
  getPeriod: (id: string) => apiClient(`${BASE}/periods/${id}`),
  createPeriod: (data: Partial<PayrollPeriod>): Promise<PayrollPeriod> =>
    apiClient(`${BASE}/periods`, { method: 'POST', body: JSON.stringify(data) }),
  updatePeriod: (id: string, data: Partial<PayrollPeriod>): Promise<PayrollPeriod> =>
    apiClient(`${BASE}/periods/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Runs
  getRuns: (params?: Record<string, any>) =>
    apiClient(`${BASE}/runs?${new URLSearchParams(params as any).toString()}`),
  getRun: (id: string): Promise<PayrollRun> => apiClient(`${BASE}/runs/${id}`),
  createRun: (data: { periodId: string; label?: string }): Promise<PayrollRun> =>
    apiClient(`${BASE}/runs`, { method: 'POST', body: JSON.stringify(data) }),
  collectData: (id: string) =>
    apiClient(`${BASE}/runs/${id}/collect`, { method: 'POST', body: '{}' }),
  calculateRun: (id: string) =>
    apiClient(`${BASE}/runs/${id}/calculate`, { method: 'POST', body: '{}' }),
  reviewRun: (id: string) =>
    apiClient(`${BASE}/runs/${id}/review`, { method: 'POST', body: '{}' }),
  hrApprove: (id: string, comment?: string) =>
    apiClient(`${BASE}/runs/${id}/hr-approve`, { method: 'POST', body: JSON.stringify({ comment }) }),
  financeApprove: (id: string, comment?: string) =>
    apiClient(`${BASE}/runs/${id}/finance-approve`, { method: 'POST', body: JSON.stringify({ comment }) }),
  lockRun: (id: string) =>
    apiClient(`${BASE}/runs/${id}/lock`, { method: 'POST', body: '{}' }),
  generatePayslips: (id: string) =>
    apiClient(`${BASE}/runs/${id}/generate-payslips`, { method: 'POST', body: '{}' }),
  markPaid: (id: string) =>
    apiClient(`${BASE}/runs/${id}/mark-paid`, { method: 'POST', body: '{}' }),
  getAnomalies: (id: string) => apiClient(`${BASE}/runs/${id}/anomalies`),
  resolveAnomaly: (runId: string, anomalyId: string, note?: string) =>
    apiClient(`${BASE}/runs/${runId}/anomalies/${anomalyId}/resolve`, { method: 'PATCH', body: JSON.stringify({ note }) }),
  getEmployeeProfile: (id: string) => apiClient(`${BASE}/employees/${id}`),

  // Components
  getComponents: (params?: Record<string, any>) =>
    apiClient(`${BASE}/components?${new URLSearchParams(params as any).toString()}`),
  createComponent: (data: Partial<SalaryComponent>): Promise<SalaryComponent> =>
    apiClient(`${BASE}/components`, { method: 'POST', body: JSON.stringify(data) }),
  updateComponent: (id: string, data: Partial<SalaryComponent>): Promise<SalaryComponent> =>
    apiClient(`${BASE}/components/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteComponent: (id: string) =>
    apiClient(`${BASE}/components/${id}`, { method: 'DELETE' }),

  // Advances
  getAdvances: (params?: Record<string, any>) =>
    apiClient(`${BASE}/advances?${new URLSearchParams(params as any).toString()}`),
  createAdvance: (data: { employeeId: string; amount: number; deductionPeriodId?: string; reason?: string }) =>
    apiClient(`${BASE}/advances`, { method: 'POST', body: JSON.stringify(data) }),
  approveAdvance: (id: string) =>
    apiClient(`${BASE}/advances/${id}/approve`, { method: 'PATCH', body: '{}' }),
  rejectAdvance: (id: string, reason: string) =>
    apiClient(`${BASE}/advances/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),

  // Loans
  getLoans: (params?: Record<string, any>) =>
    apiClient(`${BASE}/loans?${new URLSearchParams(params as any).toString()}`),
  getLoanInstallments: (id: string) => apiClient(`${BASE}/loans/${id}/installments`),
  createLoan: (data: any) =>
    apiClient(`${BASE}/loans`, { method: 'POST', body: JSON.stringify(data) }),
  approveLoan: (id: string) =>
    apiClient(`${BASE}/loans/${id}/approve`, { method: 'PATCH', body: '{}' }),
  rejectLoan: (id: string, reason: string) =>
    apiClient(`${BASE}/loans/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),

  // Payslips
  getPayslips: (params?: Record<string, any>) =>
    apiClient(`${BASE}/payslips?${new URLSearchParams(params as any).toString()}`),
  getPayslipPdfUrl: (id: string) => `${BASE}/payslips/${id}/pdf`,
  getEmployeeHistory: (employeeId: string) => apiClient(`${BASE}/employees/${employeeId}/history`),

  // Payment orders
  getPaymentOrders: (params?: Record<string, any>) =>
    apiClient(`${BASE}/payment-orders?${new URLSearchParams(params as any).toString()}`),
  getPaymentOrder: (id: string) => apiClient(`${BASE}/payment-orders/${id}`),
  createPaymentOrder: (data: any) =>
    apiClient(`${BASE}/payment-orders`, { method: 'POST', body: JSON.stringify(data) }),
  approvePaymentOrder: (id: string) =>
    apiClient(`${BASE}/payment-orders/${id}/approve`, { method: 'PATCH', body: '{}' }),
  markPaymentOrderPaid: (id: string) =>
    apiClient(`${BASE}/payment-orders/${id}/mark-paid`, { method: 'PATCH', body: '{}' }),

  // Bank export
  getBankExportUrl: (params: { runId?: string; orderId?: string; format?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return `${BASE}/bank-export?${q}`;
  },

  // Reports
  getReports: (params?: Record<string, any>) =>
    apiClient(`${BASE}/reports?${new URLSearchParams(params as any).toString()}`),
  getAuditLog: (params?: Record<string, any>) =>
    apiClient(`${BASE}/audit?${new URLSearchParams(params as any).toString()}`),

  // Settings
  getSettings: (): Promise<{ settings: PayrollSettings; taxRules: any[]; socialSecurityRules: any[] }> =>
    apiClient(`${BASE}/settings`),
  updateSettings: (data: Partial<PayrollSettings>) =>
    apiClient(`${BASE}/settings`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateTaxRule: (id: string, data: any) =>
    apiClient(`${BASE}/settings/tax-rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateSSRule: (id: string, data: any) =>
    apiClient(`${BASE}/settings/ss-rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
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
