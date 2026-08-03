import { apiClient } from '@/lib/api-client';

export type Period = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface ExecFilters {
  period?: Period;
  from?: string;
  to?: string;
  site_id?: string;
}

function params(f: ExecFilters): string {
  const p = new URLSearchParams();
  if (f.period)  p.set('period',  f.period);
  if (f.from)    p.set('from',    f.from);
  if (f.to)      p.set('to',      f.to);
  if (f.site_id) p.set('site_id', f.site_id);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const execApi = {
  overview:   (f: ExecFilters = {}) => apiClient.get(`/executive-dashboard/overview${params(f)}`),
  medical:    (f: ExecFilters = {}) => apiClient.get(`/executive-dashboard/medical${params(f)}`),
  capacity:   (f: ExecFilters = {}) => apiClient.get(`/executive-dashboard/capacity${params(f)}`),
  finance:    (f: ExecFilters = {}) => apiClient.get(`/executive-dashboard/finance${params(f)}`),
  hr:         (f: ExecFilters = {}) => apiClient.get(`/executive-dashboard/hr${params(f)}`),
  stock:      (f: ExecFilters = {}) => apiClient.get(`/executive-dashboard/stock${params(f)}`),
  biomedical: (f: ExecFilters = {}) => apiClient.get(`/executive-dashboard/biomedical${params(f)}`),
  quality:    (f: ExecFilters = {}) => apiClient.get(`/executive-dashboard/quality${params(f)}`),
  alerts:     (f: ExecFilters = {}) => apiClient.get(`/executive-dashboard/alerts${params(f)}`),
  drilldown:  (metric: string, f: ExecFilters = {}) =>
    apiClient.get(`/executive-dashboard/drilldown/${metric}${params(f)}`),
  exportPdf:  (f: ExecFilters = {}) =>
    `${(apiClient as any).baseURL ?? ''}/executive-dashboard/export/pdf${params(f)}`,
  exportExcel:(f: ExecFilters = {}) =>
    apiClient.get(`/executive-dashboard/export/excel${params(f)}`),
};
