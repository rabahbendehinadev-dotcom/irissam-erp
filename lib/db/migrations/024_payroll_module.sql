-- =============================================================================
-- Migration 024 — PAIE / PAYROLL / GESTION DES SALAIRES
-- Requires: 013_hr_module.sql (employees, employee_contracts, attendance_records,
--            absence_records, leave_requests, overtime_records, late_records,
--            employee_profiles, employee_positions, departments)
-- =============================================================================

-- ── ENUMs ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE payroll_period_status   AS ENUM ('draft','collecting_data','calculated','under_review','approved','locked','paid','cancelled');
  CREATE TYPE payroll_run_status      AS ENUM ('draft','collecting_data','calculated','under_review','hr_approved','finance_approved','locked','payslips_generated','paid','cancelled');
  CREATE TYPE payroll_component_type  AS ENUM ('earning','deduction');
  CREATE TYPE payroll_calc_method     AS ENUM ('fixed','percentage_of_base','percentage_of_brut','formula','daily_rate','hourly_rate');
  CREATE TYPE payroll_advance_status  AS ENUM ('pending','approved','rejected','paid','partially_deducted','fully_deducted','cancelled');
  CREATE TYPE payroll_loan_status     AS ENUM ('pending','approved','rejected','active','completed','cancelled');
  CREATE TYPE payroll_payment_method  AS ENUM ('bank_transfer','cash','cheque','mobile');
  CREATE TYPE payroll_order_status    AS ENUM ('draft','approved','sent_to_bank','partially_paid','paid','rejected');
  CREATE TYPE payroll_export_status   AS ENUM ('draft','generated','sent','confirmed');
  CREATE TYPE payroll_anomaly_severity AS ENUM ('info','warning','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── payroll_settings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_settings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                 UUID,
  -- Working time
  working_days_per_month  NUMERIC(4,2)  NOT NULL DEFAULT 26,
  working_hours_per_day   NUMERIC(4,2)  NOT NULL DEFAULT 8,
  -- Overtime rates (multipliers)
  overtime_rate_25        NUMERIC(5,4)  NOT NULL DEFAULT 1.25,
  overtime_rate_50        NUMERIC(5,4)  NOT NULL DEFAULT 1.50,
  overtime_rate_100       NUMERIC(5,4)  NOT NULL DEFAULT 2.00,
  night_shift_rate        NUMERIC(5,4)  NOT NULL DEFAULT 1.30,
  guard_12h_rate          NUMERIC(5,4)  NOT NULL DEFAULT 1.25,
  guard_24h_rate          NUMERIC(5,4)  NOT NULL DEFAULT 1.50,
  -- Late / absence
  late_deduction_method   TEXT          NOT NULL DEFAULT 'pro_rata', -- pro_rata | fixed_per_minute | none
  late_grace_minutes      INTEGER       NOT NULL DEFAULT 5,
  absence_deduction_method TEXT         NOT NULL DEFAULT 'daily_rate', -- daily_rate | fixed
  -- Rounding
  rounding_mode           TEXT          NOT NULL DEFAULT 'round_half_up', -- round_half_up | truncate | ceil
  rounding_decimal        INTEGER       NOT NULL DEFAULT 2,
  -- Currency
  currency                VARCHAR(3)    NOT NULL DEFAULT 'DZD',
  -- Audit
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by              UUID,
  updated_by              UUID,
  version                 INTEGER       NOT NULL DEFAULT 1
);
INSERT INTO payroll_settings (site_id) VALUES (NULL) ON CONFLICT DO NOTHING;

-- ── payroll_tax_rules ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_tax_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID,
  code            VARCHAR(30)   NOT NULL UNIQUE,
  name            TEXT          NOT NULL,
  description     TEXT,
  bracket_min     NUMERIC(12,2) NOT NULL DEFAULT 0,
  bracket_max     NUMERIC(12,2),                      -- NULL = no ceiling
  rate            NUMERIC(7,4)  NOT NULL,              -- e.g. 0.1200 = 12%
  fixed_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  applies_to      TEXT          NOT NULL DEFAULT 'taxable_income', -- taxable_income | brut
  active          BOOLEAN       NOT NULL DEFAULT true,
  effective_from  DATE          NOT NULL DEFAULT CURRENT_DATE,
  effective_to    DATE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_by      UUID,
  version         INTEGER       NOT NULL DEFAULT 1,
  deleted_at      TIMESTAMPTZ
);
-- IRG Algérie tranches indicatives (configurables)
INSERT INTO payroll_tax_rules (code,name,bracket_min,bracket_max,rate,fixed_amount) VALUES
  ('IRG_T1','IRG Tranche 1 (0-20000)',      0,        20000,  0.0000, 0),
  ('IRG_T2','IRG Tranche 2 (20001-40000)',  20001,    40000,  0.2000, 0),
  ('IRG_T3','IRG Tranche 3 (40001-80000)',  40001,    80000,  0.3000, 0),
  ('IRG_T4','IRG Tranche 4 (>80000)',       80001,    NULL,   0.3500, 0)
ON CONFLICT (code) DO NOTHING;

-- ── payroll_social_security_rules ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_social_security_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID,
  code            VARCHAR(30)   NOT NULL UNIQUE,
  name            TEXT          NOT NULL,
  employee_rate   NUMERIC(7,4)  NOT NULL DEFAULT 0,   -- e.g. 0.09 = 9%
  employer_rate   NUMERIC(7,4)  NOT NULL DEFAULT 0,
  applies_to      TEXT          NOT NULL DEFAULT 'brut',
  ceiling         NUMERIC(12,2),
  active          BOOLEAN       NOT NULL DEFAULT true,
  effective_from  DATE          NOT NULL DEFAULT CURRENT_DATE,
  effective_to    DATE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_by      UUID,
  version         INTEGER       NOT NULL DEFAULT 1,
  deleted_at      TIMESTAMPTZ
);
INSERT INTO payroll_social_security_rules (code,name,employee_rate,employer_rate) VALUES
  ('CNAS_EMP','CNAS Part Employé',     0.0900, 0.0000),
  ('CNAS_EMPR','CNAS Part Employeur',  0.0000, 0.2600),
  ('CASNOS','CASNOS Retraite',         0.0100, 0.0000)
ON CONFLICT (code) DO NOTHING;

-- ── payroll_salary_components ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_salary_components (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                   UUID,
  code                      VARCHAR(30)          NOT NULL UNIQUE,
  name                      TEXT                 NOT NULL,
  name_ar                   TEXT,
  name_en                   TEXT,
  type                      payroll_component_type NOT NULL,
  calculation_method        payroll_calc_method  NOT NULL DEFAULT 'fixed',
  fixed_amount              NUMERIC(12,2)        NOT NULL DEFAULT 0,
  percentage                NUMERIC(7,4)         NOT NULL DEFAULT 0,   -- 0.15 = 15%
  formula                   TEXT,                                       -- optional SQL expression
  taxable                   BOOLEAN              NOT NULL DEFAULT true,
  social_security_applicable BOOLEAN             NOT NULL DEFAULT true,
  active                    BOOLEAN              NOT NULL DEFAULT true,
  priority                  INTEGER              NOT NULL DEFAULT 100,  -- lower = applied first
  effective_from            DATE                 NOT NULL DEFAULT CURRENT_DATE,
  effective_to              DATE,
  applies_to_categories     TEXT[],                                     -- NULL = all
  created_at                TIMESTAMPTZ          NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ          NOT NULL DEFAULT now(),
  created_by                UUID,
  updated_by                UUID,
  version                   INTEGER              NOT NULL DEFAULT 1,
  deleted_at                TIMESTAMPTZ
);
INSERT INTO payroll_salary_components (code,name,name_ar,name_en,type,calculation_method,fixed_amount,percentage,taxable,social_security_applicable,priority) VALUES
  ('SAL_BASE',      'Salaire de base',        'الراتب الأساسي',      'Base Salary',           'earning','fixed',        0,      0,      true,  true,  10),
  ('PRIME_GARDE',   'Prime de garde',          'علاوة الحراسة',       'Guard Premium',         'earning','fixed',        5000,   0,      true,  false, 20),
  ('PRIME_NUIT',    'Prime de nuit',           'علاوة الليل',         'Night Premium',         'earning','percentage_of_base',0, 0.30, true,  false, 30),
  ('PRIME_RISQUE',  'Prime de risque',         'علاوة المخاطر',       'Risk Premium',          'earning','fixed',        3000,   0,      true,  false, 40),
  ('PRIME_RESP',    'Prime de responsabilité', 'علاوة المسؤولية',     'Responsibility Premium', 'earning','fixed',       4000,   0,      true,  true,  50),
  ('PRIME_RENDMT',  'Prime de rendement',      'علاوة الأداء',        'Performance Premium',   'earning','percentage_of_base',0, 0.15, true,  false, 60),
  ('INDEM_TRANSP',  'Indemnité transport',     'تعويض النقل',         'Transport Allowance',   'earning','fixed',        2000,   0,      false, false, 70),
  ('INDEM_REPAS',   'Indemnité repas',         'تعويض الوجبات',       'Meal Allowance',        'earning','fixed',        1500,   0,      false, false, 80),
  ('HEURES_SUP',    'Heures supplémentaires',  'ساعات إضافية',        'Overtime',              'earning','hourly_rate',  0,      0,      true,  true,  90),
  ('BONUS',         'Bonus',                   'مكافأة',              'Bonus',                 'earning','fixed',        0,      0,      true,  false, 100),
  ('RAPPEL',        'Rappel',                  'استدراك',             'Recall',                'earning','fixed',        0,      0,      true,  true,  110),
  ('AUTRE_GAIN',    'Autre gain',              'إضافات أخرى',         'Other Earnings',        'earning','fixed',        0,      0,      true,  true,  120),
  ('DED_ABSENCE',   'Absence',                 'غياب',                'Absence',               'deduction','daily_rate', 0,     0,      false, false, 200),
  ('DED_RETARD',    'Retard',                  'تأخر',                'Late',                  'deduction','hourly_rate',0,     0,      false, false, 210),
  ('DED_CONGE_SS',  'Congé sans solde',        'إجازة بدون أجر',      'Unpaid Leave',          'deduction','daily_rate', 0,     0,      false, false, 220),
  ('DED_AVANCE',    'Avance',                  'سلفة',                'Advance',               'deduction','fixed',      0,     0,      false, false, 230),
  ('DED_PRET',      'Prêt',                    'قرض',                 'Loan',                  'deduction','fixed',      0,     0,      false, false, 240),
  ('DED_DISC',      'Retenue disciplinaire',   'خصم تأديبي',          'Disciplinary',          'deduction','fixed',      0,     0,      false, false, 250),
  ('DED_SOCIALE',   'Retenue sociale (CNAS)',  'اقتطاع اجتماعي',     'Social Security',       'deduction','percentage_of_brut',0,0.09, false, false, 260),
  ('DED_IMPOT',     'Impôt (IRG)',             'ضريبة الدخل',         'Income Tax',            'deduction','formula',    0,     0,      false, false, 270),
  ('AUTRE_DED',     'Autre retenue',           'خصومات أخرى',         'Other Deductions',      'deduction','fixed',      0,     0,      false, false, 280)
ON CONFLICT (code) DO NOTHING;

-- ── payroll_periods ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_periods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID,
  month           SMALLINT      NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            SMALLINT      NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  start_date      DATE          NOT NULL,
  end_date        DATE          NOT NULL,
  payment_date    DATE,
  status          payroll_period_status NOT NULL DEFAULT 'draft',
  notes           TEXT,
  locked_at       TIMESTAMPTZ,
  locked_by       UUID,
  paid_at         TIMESTAMPTZ,
  paid_by         UUID,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER       NOT NULL DEFAULT 1,
  UNIQUE (year, month, site_id)
);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON payroll_periods(status);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_year_month ON payroll_periods(year, month);

-- ── payroll_runs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             UUID,
  period_id           UUID          NOT NULL REFERENCES payroll_periods(id),
  run_number          SERIAL,
  label               TEXT,
  status              payroll_run_status NOT NULL DEFAULT 'draft',
  -- Totals (filled after calculation)
  total_employees     INTEGER       NOT NULL DEFAULT 0,
  total_brut          NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_net           NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_earnings      NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_deductions    NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_tax           NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_social_sec    NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_advances      NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_loans         NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_anomalies     INTEGER       NOT NULL DEFAULT 0,
  total_critical_anomalies INTEGER  NOT NULL DEFAULT 0,
  -- Workflow transitions
  data_collected_at   TIMESTAMPTZ,
  data_collected_by   UUID,
  calculated_at       TIMESTAMPTZ,
  calculated_by       UUID,
  reviewed_at         TIMESTAMPTZ,
  reviewed_by         UUID,
  hr_approved_at      TIMESTAMPTZ,
  hr_approved_by      UUID,
  hr_approval_comment TEXT,
  finance_approved_at TIMESTAMPTZ,
  finance_approved_by UUID,
  finance_approval_comment TEXT,
  locked_at           TIMESTAMPTZ,
  locked_by           UUID,
  payslips_generated_at TIMESTAMPTZ,
  payslips_generated_by UUID,
  marked_paid_at      TIMESTAMPTZ,
  marked_paid_by      UUID,
  cancelled_at        TIMESTAMPTZ,
  cancelled_by        UUID,
  cancel_reason       TEXT,
  -- Audit
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_by          UUID,
  deleted_at          TIMESTAMPTZ,
  version             INTEGER       NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_period ON payroll_runs(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON payroll_runs(status);

-- ── payroll_employee_runs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_employee_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             UUID,
  run_id              UUID          NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id         UUID          NOT NULL REFERENCES employees(id),
  contract_id         UUID          REFERENCES employee_contracts(id),
  -- Attendance snapshot
  working_days        NUMERIC(5,2)  NOT NULL DEFAULT 0,
  days_worked         NUMERIC(5,2)  NOT NULL DEFAULT 0,
  days_absent         NUMERIC(5,2)  NOT NULL DEFAULT 0,
  days_paid_leave     NUMERIC(5,2)  NOT NULL DEFAULT 0,
  days_unpaid_leave   NUMERIC(5,2)  NOT NULL DEFAULT 0,
  minutes_late        INTEGER       NOT NULL DEFAULT 0,
  overtime_minutes    INTEGER       NOT NULL DEFAULT 0,
  night_shifts        INTEGER       NOT NULL DEFAULT 0,
  guards_12h          INTEGER       NOT NULL DEFAULT 0,
  guards_24h          INTEGER       NOT NULL DEFAULT 0,
  -- Salary components
  salary_base         NUMERIC(12,2) NOT NULL DEFAULT 0,
  daily_rate          NUMERIC(12,2) GENERATED ALWAYS AS (
    CASE WHEN salary_base > 0 THEN ROUND(salary_base / 26, 2) ELSE 0 END
  ) STORED,
  total_earnings      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_deductions    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_advances      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_loans         NUMERIC(12,2) NOT NULL DEFAULT 0,
  brut                NUMERIC(12,2) NOT NULL DEFAULT 0,
  cotisations         NUMERIC(12,2) NOT NULL DEFAULT 0,   -- CNAS employee
  tax                 NUMERIC(12,2) NOT NULL DEFAULT 0,   -- IRG
  net                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Status
  has_anomalies       BOOLEAN       NOT NULL DEFAULT false,
  anomaly_count       INTEGER       NOT NULL DEFAULT 0,
  critical_anomaly_count INTEGER    NOT NULL DEFAULT 0,
  excluded            BOOLEAN       NOT NULL DEFAULT false,
  exclusion_reason    TEXT,
  -- Payment
  payment_method      payroll_payment_method,
  bank_account        TEXT,
  -- Audit
  calculated_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_by          UUID,
  version             INTEGER       NOT NULL DEFAULT 1,
  UNIQUE (run_id, employee_id)
);
CREATE INDEX IF NOT EXISTS idx_per_run ON payroll_employee_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_per_employee ON payroll_employee_runs(employee_id);

-- ── payroll_earnings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_earnings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID,
  employee_run_id UUID          NOT NULL REFERENCES payroll_employee_runs(id) ON DELETE CASCADE,
  component_id    UUID          REFERENCES payroll_salary_components(id),
  component_code  VARCHAR(30)   NOT NULL,
  component_name  TEXT          NOT NULL,
  quantity        NUMERIC(10,4) NOT NULL DEFAULT 1,
  unit_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  taxable         BOOLEAN       NOT NULL DEFAULT true,
  social_sec      BOOLEAN       NOT NULL DEFAULT true,
  note            TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_earnings_emp_run ON payroll_earnings(employee_run_id);

-- ── payroll_deductions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_deductions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID,
  employee_run_id UUID          NOT NULL REFERENCES payroll_employee_runs(id) ON DELETE CASCADE,
  component_id    UUID          REFERENCES payroll_salary_components(id),
  component_code  VARCHAR(30)   NOT NULL,
  component_name  TEXT          NOT NULL,
  quantity        NUMERIC(10,4) NOT NULL DEFAULT 1,
  unit_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  note            TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deductions_emp_run ON payroll_deductions(employee_run_id);

-- ── payroll_overtime_lines ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_overtime_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID,
  employee_run_id UUID          NOT NULL REFERENCES payroll_employee_runs(id) ON DELETE CASCADE,
  overtime_record_id UUID       REFERENCES overtime_records(id),
  record_date     DATE,
  overtime_hours  NUMERIC(6,2)  NOT NULL DEFAULT 0,
  rate_multiplier NUMERIC(5,4)  NOT NULL DEFAULT 1.25,
  hourly_base     NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── payroll_absence_lines ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_absence_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID,
  employee_run_id UUID          NOT NULL REFERENCES payroll_employee_runs(id) ON DELETE CASCADE,
  absence_record_id UUID        REFERENCES absence_records(id),
  leave_request_id  UUID        REFERENCES leave_requests(id),
  date_from       DATE,
  date_to         DATE,
  days            NUMERIC(5,2)  NOT NULL DEFAULT 0,
  absence_type    TEXT,
  paid            BOOLEAN       NOT NULL DEFAULT false,
  daily_rate      NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0,   -- deduction amount
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── payroll_advances ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_advances (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             UUID,
  employee_id         UUID          NOT NULL REFERENCES employees(id),
  amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  request_date        DATE          NOT NULL DEFAULT CURRENT_DATE,
  deduction_period_id UUID          REFERENCES payroll_periods(id),
  status              payroll_advance_status NOT NULL DEFAULT 'pending',
  reason              TEXT,
  approved_by         UUID,
  approved_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  deducted_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  deducted_at         TIMESTAMPTZ,
  deducted_in_run_id  UUID          REFERENCES payroll_runs(id),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_by          UUID,
  deleted_at          TIMESTAMPTZ,
  version             INTEGER       NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_advances_employee ON payroll_advances(employee_id);
CREATE INDEX IF NOT EXISTS idx_advances_status ON payroll_advances(status);

-- ── payroll_loans ─────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS payroll_loan_seq START 1;
CREATE TABLE IF NOT EXISTS payroll_loans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id               UUID,
  loan_number           TEXT          NOT NULL UNIQUE DEFAULT ('LOAN-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(NEXTVAL('payroll_loan_seq')::TEXT, 5, '0')),
  employee_id           UUID          NOT NULL REFERENCES employees(id),
  total_amount          NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  installment_amount    NUMERIC(12,2) NOT NULL CHECK (installment_amount > 0),
  number_of_installments INTEGER      NOT NULL CHECK (number_of_installments > 0),
  paid_installments     INTEGER       NOT NULL DEFAULT 0,
  remaining_amount      NUMERIC(12,2) NOT NULL,
  start_period_id       UUID          REFERENCES payroll_periods(id),
  status                payroll_loan_status NOT NULL DEFAULT 'pending',
  reason                TEXT,
  approved_by           UUID,
  approved_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by            UUID,
  updated_by            UUID,
  deleted_at            TIMESTAMPTZ,
  version               INTEGER       NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_loans_employee ON payroll_loans(employee_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON payroll_loans(status);

-- ── payroll_loan_installments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_loan_installments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID,
  loan_id         UUID          NOT NULL REFERENCES payroll_loans(id) ON DELETE CASCADE,
  employee_run_id UUID          REFERENCES payroll_employee_runs(id),
  run_id          UUID          REFERENCES payroll_runs(id),
  installment_no  INTEGER       NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  status          TEXT          NOT NULL DEFAULT 'pending', -- pending | paid | skipped
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loan_installments_loan ON payroll_loan_installments(loan_id);

-- ── payroll_bonuses ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_bonuses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID,
  employee_id     UUID          NOT NULL REFERENCES employees(id),
  run_id          UUID          REFERENCES payroll_runs(id),
  component_id    UUID          REFERENCES payroll_salary_components(id),
  amount          NUMERIC(12,2) NOT NULL CHECK (amount != 0),
  description     TEXT,
  taxable         BOOLEAN       NOT NULL DEFAULT true,
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER       NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_bonuses_employee ON payroll_bonuses(employee_id);
CREATE INDEX IF NOT EXISTS idx_bonuses_run ON payroll_bonuses(run_id);

-- ── payroll_adjustments ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID,
  employee_id     UUID          NOT NULL REFERENCES employees(id),
  run_id          UUID          REFERENCES payroll_runs(id),
  type            TEXT          NOT NULL DEFAULT 'earning', -- earning | deduction
  amount          NUMERIC(12,2) NOT NULL CHECK (amount != 0),
  description     TEXT          NOT NULL,
  reason          TEXT,
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER       NOT NULL DEFAULT 1
);

-- ── payroll_anomalies ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_anomalies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID,
  run_id          UUID          NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id     UUID          REFERENCES employees(id),
  employee_run_id UUID          REFERENCES payroll_employee_runs(id),
  code            VARCHAR(50)   NOT NULL,
  message         TEXT          NOT NULL,
  severity        payroll_anomaly_severity NOT NULL DEFAULT 'warning',
  resolved        BOOLEAN       NOT NULL DEFAULT false,
  resolved_by     UUID,
  resolved_at     TIMESTAMPTZ,
  resolution_note TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anomalies_run ON payroll_anomalies(run_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON payroll_anomalies(severity);

-- ── payroll_payslips ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_payslips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID,
  employee_run_id UUID          NOT NULL REFERENCES payroll_employee_runs(id) UNIQUE,
  run_id          UUID          NOT NULL REFERENCES payroll_runs(id),
  employee_id     UUID          NOT NULL REFERENCES employees(id),
  payslip_number  TEXT          NOT NULL UNIQUE,
  period_label    TEXT          NOT NULL,
  language        VARCHAR(5)    NOT NULL DEFAULT 'fr',
  pdf_storage_key TEXT,
  generated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  generated_by    UUID,
  printed_count   INTEGER       NOT NULL DEFAULT 0,
  last_printed_at TIMESTAMPTZ,
  last_printed_by UUID,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_by      UUID,
  version         INTEGER       NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_payslips_run ON payroll_payslips(run_id);
CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payroll_payslips(employee_id);
CREATE SEQUENCE IF NOT EXISTS payslip_number_seq START 1;

-- ── payroll_payment_orders ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_payment_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID,
  run_id          UUID          NOT NULL REFERENCES payroll_runs(id),
  order_number    TEXT          NOT NULL UNIQUE,
  method          payroll_payment_method NOT NULL DEFAULT 'bank_transfer',
  total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  employee_count  INTEGER       NOT NULL DEFAULT 0,
  bank            TEXT,
  reference       TEXT,
  status          payroll_order_status NOT NULL DEFAULT 'draft',
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  sent_to_bank_at TIMESTAMPTZ,
  sent_to_bank_by UUID,
  paid_at         TIMESTAMPTZ,
  paid_by         UUID,
  rejection_reason TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ,
  version         INTEGER       NOT NULL DEFAULT 1
);
CREATE SEQUENCE IF NOT EXISTS payment_order_seq START 1;
CREATE INDEX IF NOT EXISTS idx_payment_orders_run ON payroll_payment_orders(run_id);

-- ── payroll_payment_order_items ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_payment_order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID,
  order_id        UUID          NOT NULL REFERENCES payroll_payment_orders(id) ON DELETE CASCADE,
  employee_run_id UUID          NOT NULL REFERENCES payroll_employee_runs(id),
  employee_id     UUID          NOT NULL REFERENCES employees(id),
  net_amount      NUMERIC(12,2) NOT NULL,
  bank_account    TEXT,
  reference       TEXT,
  status          TEXT          NOT NULL DEFAULT 'pending', -- pending | paid | failed
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_poi_order ON payroll_payment_order_items(order_id);

-- ── payroll_bank_exports ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_bank_exports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID,
  run_id          UUID          NOT NULL REFERENCES payroll_runs(id),
  order_id        UUID          REFERENCES payroll_payment_orders(id),
  format          TEXT          NOT NULL DEFAULT 'csv', -- csv | excel | fixed_width
  filename        TEXT          NOT NULL,
  storage_key     TEXT,
  record_count    INTEGER       NOT NULL DEFAULT 0,
  total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  status          payroll_export_status NOT NULL DEFAULT 'draft',
  generated_at    TIMESTAMPTZ,
  generated_by    UUID,
  confirmed_at    TIMESTAMPTZ,
  confirmed_by    UUID,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_by      UUID,
  version         INTEGER       NOT NULL DEFAULT 1
);

-- ── payroll_audit_events ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_audit_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID,
  user_id         UUID,
  user_role       TEXT,
  action          TEXT          NOT NULL,
  entity_type     TEXT          NOT NULL,
  entity_id       UUID,
  run_id          UUID,
  period_id       UUID,
  employee_id     UUID,
  before_state    JSONB,
  after_state     JSONB,
  metadata        JSONB,
  ip_address      INET,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payroll_audit_run ON payroll_audit_events(run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_audit_employee ON payroll_audit_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_audit_action ON payroll_audit_events(action);
CREATE INDEX IF NOT EXISTS idx_payroll_audit_created ON payroll_audit_events(created_at DESC);
