/** Central registry of all API endpoint paths. Update as modules are built. */
export const API_ENDPOINTS = {
  // Health
  HEALTH: '/healthz',

  // Auth
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
    REFRESH: '/auth/refresh',
  },

  // Dashboard
  DASHBOARD: {
    STATS: '/dashboard/stats',
    CHARTS: '/dashboard/charts',
    ALERTS: '/dashboard/alerts',
  },

  // Patients
  PATIENTS: {
    LIST: '/patients',
    DETAIL: (id: string) => `/patients/${id}`,
    CREATE: '/patients',
    UPDATE: (id: string) => `/patients/${id}`,
    DELETE: (id: string) => `/patients/${id}`,
    SEARCH: '/patients/search',
  },

  // Appointments
  APPOINTMENTS: {
    LIST: '/appointments',
    DETAIL: (id: string) => `/appointments/${id}`,
    CREATE: '/appointments',
    UPDATE: (id: string) => `/appointments/${id}`,
    CANCEL: (id: string) => `/appointments/${id}/cancel`,
    UPCOMING: '/appointments/upcoming',
  },

  // Admissions
  ADMISSIONS: {
    LIST: '/admissions',
    CREATE: '/admissions',
    DISCHARGE: (id: string) => `/admissions/${id}/discharge`,
  },

  // Sites & Organization
  SITES: {
    LIST: '/sites',
    BUILDINGS: (siteId: string) => `/sites/${siteId}/buildings`,
    FLOORS: (buildingId: string) => `/buildings/${buildingId}/floors`,
    DEPARTMENTS: '/departments',
  },

  // Laboratory
  LABORATORY: {
    LIST: '/lab/results',
    CREATE: '/lab/requests',
    VALIDATE: (id: string) => `/lab/results/${id}/validate`,
  },

  // Pharmacy & Stock
  PHARMACY: {
    LIST: '/pharmacy/inventory',
    LOW_STOCK: '/pharmacy/inventory/low-stock',
    DISPENSE: '/pharmacy/dispense',
  },

  // Finance
  FINANCE: {
    INVOICES: '/finance/invoices',
    STATS: '/finance/stats',
  },

  // Insurance / Tiers payant
  INSURANCE: {
    ORGS: '/insurance/organizations',
    ORG: (id: string) => `/insurance/organizations/${id}`,
    PLANS: '/insurance/plans',
    PLAN: (id: string) => `/insurance/plans/${id}`,
    POLICIES: '/insurance/policies',
    POLICY: (id: string) => `/insurance/policies/${id}`,
    COVERAGE_REQUESTS: '/insurance/coverage-requests',
    COVERAGE_REQUEST: (id: string) => `/insurance/coverage-requests/${id}`,
    CLAIMS: '/insurance/claims',
    CLAIM: (id: string) => `/insurance/claims/${id}`,
    BORDEREAUX: '/insurance/bordereaux',
    BORDEREAU: (id: string) => `/insurance/bordereaux/${id}`,
    PAYMENTS: '/insurance/payments',
    PAYMENT: (id: string) => `/insurance/payments/${id}`,
    DASHBOARD: '/insurance/dashboard',
  },
} as const;
