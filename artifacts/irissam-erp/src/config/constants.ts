export const APP_NAME = 'IRISSAM HOSPITAL ERP';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Système de gestion hospitalière';

export const SUPPORTED_LANGUAGES = ['fr', 'ar', 'en'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const DEFAULT_LANGUAGE = 'fr' as const;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const STORAGE_KEYS = {
  LANGUAGE: 'irissam_lang',
  THEME: 'irissam_theme',
  SIDEBAR_COLLAPSED: 'irissam_sidebar_collapsed',
  ACTIVE_SITE: 'irissam_active_site',
} as const;

export const QUERY_STALE_TIME = 5 * 60 * 1000; // 5 minutes
export const QUERY_CACHE_TIME = 10 * 60 * 1000; // 10 minutes

export const ALERT_SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-600 bg-red-50 border-red-200',
  high: 'text-orange-600 bg-orange-50 border-orange-200',
  medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  low: 'text-blue-600 bg-blue-50 border-blue-200',
};

export const APPOINTMENT_STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-blue-100 text-blue-700',
  no_show: 'bg-gray-100 text-gray-700',
};

export const DEPARTMENT_COLORS: Record<string, string> = {
  medecine_interne: '#3B82F6',
  chirurgie: '#06B6D4',
  pediatrie: '#10B981',
  gynecologie: '#8B5CF6',
  cardiologie: '#F97316',
  urgences: '#EF4444',
  autres: '#94A3B8',
};
