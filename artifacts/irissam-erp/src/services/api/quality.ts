import { apiClient } from "@/lib/api-client";

const BASE = "/quality";

/** Builds a query string from a params record, skipping null/undefined/empty values. */
function buildQs(p: Record<string, unknown>): string {
  const entries = Object.entries(p)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => [k, String(v)] as [string, string]);
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
}

// ── Dashboard ──────────────────────────────────────────────────────────────
export const getQualityDashboard = () =>
  apiClient.get(`${BASE}/dashboard`);

// ── Incidents ─────────────────────────────────────────────────────────────
export const getIncidents    = (p: Record<string, unknown> = {}) =>
  apiClient.get(`${BASE}/incidents${buildQs(p)}`);
export const getIncident     = (id: string) =>
  apiClient.get(`${BASE}/incidents/${id}`);
export const createIncident  = (d: Record<string, unknown>) =>
  apiClient.post(`${BASE}/incidents`, d);
export const updateIncident  = (id: string, d: Record<string, unknown>) =>
  apiClient.patch(`${BASE}/incidents/${id}`, d);
export const advanceIncident = (id: string) =>
  apiClient.post(`${BASE}/incidents/${id}/advance`, {});

// ── Non-conformités ────────────────────────────────────────────────────────
export const getNCs      = (p: Record<string, unknown> = {}) =>
  apiClient.get(`${BASE}/non-conformities${buildQs(p)}`);
export const createNC    = (d: Record<string, unknown>) =>
  apiClient.post(`${BASE}/non-conformities`, d);
export const updateNC    = (id: string, d: Record<string, unknown>) =>
  apiClient.patch(`${BASE}/non-conformities/${id}`, d);
export const advanceNC   = (id: string) =>
  apiClient.post(`${BASE}/non-conformities/${id}/advance`, {});

// ── CAPA ──────────────────────────────────────────────────────────────────
export const getCAPAs      = (p: Record<string, unknown> = {}) =>
  apiClient.get(`${BASE}/capa${buildQs(p)}`);
export const createCAPA    = (d: Record<string, unknown>) =>
  apiClient.post(`${BASE}/capa`, d);
export const updateCAPA    = (id: string, d: Record<string, unknown>) =>
  apiClient.patch(`${BASE}/capa/${id}`, d);
export const advanceCAPA   = (id: string, d: Record<string, unknown> = {}) =>
  apiClient.post(`${BASE}/capa/${id}/advance`, d);

// ── Risks ─────────────────────────────────────────────────────────────────
export const getRisks       = (p: Record<string, unknown> = {}) =>
  apiClient.get(`${BASE}/risks${buildQs(p)}`);
export const getRiskHeatmap = () =>
  apiClient.get(`${BASE}/risks/heatmap`);
export const getRisk        = (id: string) =>
  apiClient.get(`${BASE}/risks/${id}`);
export const createRisk     = (d: Record<string, unknown>) =>
  apiClient.post(`${BASE}/risks`, d);
export const updateRisk     = (id: string, d: Record<string, unknown>) =>
  apiClient.patch(`${BASE}/risks/${id}`, d);
export const assessRisk     = (id: string, d: Record<string, unknown>) =>
  apiClient.post(`${BASE}/risks/${id}/assess`, d);

// ── Audits ────────────────────────────────────────────────────────────────
export const getAudits          = (p: Record<string, unknown> = {}) =>
  apiClient.get(`${BASE}/audits${buildQs(p)}`);
export const getAudit           = (id: string) =>
  apiClient.get(`${BASE}/audits/${id}`);
export const createAudit        = (d: Record<string, unknown>) =>
  apiClient.post(`${BASE}/audits`, d);
export const updateAudit        = (id: string, d: Record<string, unknown>) =>
  apiClient.patch(`${BASE}/audits/${id}`, d);
export const addAuditFinding    = (id: string, d: Record<string, unknown>) =>
  apiClient.post(`${BASE}/audits/${id}/findings`, d);
export const updateAuditFinding = (fid: string, d: Record<string, unknown>) =>
  apiClient.patch(`${BASE}/audits/findings/${fid}`, d);

// ── Documents ─────────────────────────────────────────────────────────────
export const getDocuments   = (p: Record<string, unknown> = {}) =>
  apiClient.get(`${BASE}/documents${buildQs(p)}`);
export const getDocument    = (id: string) =>
  apiClient.get(`${BASE}/documents/${id}`);
export const createDocument = (d: Record<string, unknown>) =>
  apiClient.post(`${BASE}/documents`, d);
export const updateDocument = (id: string, d: Record<string, unknown>) =>
  apiClient.patch(`${BASE}/documents/${id}`, d);
export const newDocVersion  = (id: string, d: Record<string, unknown>) =>
  apiClient.post(`${BASE}/documents/${id}/new-version`, d);
export const addDocApproval = (id: string, d: Record<string, unknown>) =>
  apiClient.post(`${BASE}/documents/${id}/approvals`, d);

// ── Indicators ────────────────────────────────────────────────────────────
export const getIndicators      = (p: Record<string, unknown> = {}) =>
  apiClient.get(`${BASE}/indicators${buildQs(p)}`);
export const getIndicatorValues = (id: string, limit = 24) =>
  apiClient.get(`${BASE}/indicators/${id}/values?limit=${limit}`);
export const createIndicator    = (d: Record<string, unknown>) =>
  apiClient.post(`${BASE}/indicators`, d);
export const addIndicatorValue  = (id: string, d: Record<string, unknown>) =>
  apiClient.post(`${BASE}/indicators/${id}/values`, d);

// ── Meetings ──────────────────────────────────────────────────────────────
export const getCommittees = () =>
  apiClient.get(`${BASE}/meetings/committees`);
export const getMeetings   = (p: Record<string, unknown> = {}) =>
  apiClient.get(`${BASE}/meetings${buildQs(p)}`);
export const getMeeting    = (id: string) =>
  apiClient.get(`${BASE}/meetings/${id}`);
export const createMeeting = (d: Record<string, unknown>) =>
  apiClient.post(`${BASE}/meetings`, d);
export const updateMeeting = (id: string, d: Record<string, unknown>) =>
  apiClient.patch(`${BASE}/meetings/${id}`, d);
export const addMinutes    = (id: string, d: Record<string, unknown>) =>
  apiClient.post(`${BASE}/meetings/${id}/minutes`, d);

// ── Checklists ────────────────────────────────────────────────────────────
export const getChecklists       = (p: Record<string, unknown> = {}) =>
  apiClient.get(`${BASE}/checklists${buildQs(p)}`);
export const getChecklist        = (id: string) =>
  apiClient.get(`${BASE}/checklists/${id}`);
export const createChecklist     = (d: Record<string, unknown>) =>
  apiClient.post(`${BASE}/checklists`, d);
export const addChecklistItems   = (id: string, items: unknown[]) =>
  apiClient.post(`${BASE}/checklists/${id}/items`, items);
export const updateChecklistItem = (iid: string, d: Record<string, unknown>) =>
  apiClient.patch(`${BASE}/checklists/items/${iid}`, d);

// ── Improvements ──────────────────────────────────────────────────────────
export const getImprovements   = (p: Record<string, unknown> = {}) =>
  apiClient.get(`${BASE}/improvements${buildQs(p)}`);
export const createImprovement = (d: Record<string, unknown>) =>
  apiClient.post(`${BASE}/improvements`, d);
export const updateImprovement = (id: string, d: Record<string, unknown>) =>
  apiClient.patch(`${BASE}/improvements/${id}`, d);

// ── Analytics ─────────────────────────────────────────────────────────────────

interface QualityDashboardRaw {
  incidents_by_month?: unknown[];
  nc_by_type?: unknown[];
  capa_by_status?: unknown[];
  risk_matrix?: unknown[];
  [key: string]: unknown;
}

export const getQualityAnalytics = () =>
  apiClient.get<QualityDashboardRaw>(`${BASE}/dashboard`).then(r => ({
    ...r,
    incident_trend:     r.incidents_by_month ?? [],
    nc_by_department:   r.nc_by_type ?? [],
    capa_effectiveness: r.capa_by_status ?? [],
    risk_distribution:  [] as unknown[],
    audit_scores:       [] as unknown[],
    indicator_summary:  {} as Record<string, unknown>,
    risk_matrix:        r.risk_matrix ?? [],
  }));

// ── Component aliases ─────────────────────────────────────────────────────────
export const getQualityIncidents   = getIncidents;
export const createQualityIncident = createIncident;
export const transitionQualityIncident = (id: string, _action: string, data?: Record<string, unknown>) =>
  apiClient.post(`${BASE}/incidents/${id}/advance`, data ?? {});

export const getNonConformities  = getNCs;
export const createNonConformity = createNC;
export const transitionNC = (id: string, _action: string, data?: Record<string, unknown>) =>
  apiClient.post(`${BASE}/non-conformities/${id}/advance`, data ?? {});

export const getCapas    = getCAPAs;
export const createCapa  = createCAPA;
export const transitionCapa = (id: string, _action: string, data?: Record<string, unknown>) =>
  advanceCAPA(id, data ?? {});

export const getRiskMatrix = getRiskHeatmap;

export const transitionAudit = (id: string, action: string, data?: Record<string, unknown>) =>
  apiClient.post(`${BASE}/audits/${id}/${action}`, data ?? {});

export const getQualityDocuments    = getDocuments;
export const createQualityDocument  = createDocument;
export const publishQualityDocument = (id: string) => updateDocument(id, { status: "publie" });
export const archiveQualityDocument = (id: string) => updateDocument(id, { status: "archive" });

export const getIndicatorHistory  = getIndicatorValues;
export const recordIndicatorValue = addIndicatorValue;

export const createCommittee = (d: Record<string, unknown>) =>
  apiClient.post(`${BASE}/meetings/committees`, d);
export const closeMeeting = (id: string, data?: Record<string, unknown>) =>
  addMinutes(id, data ?? {});

export const getChecklistDetail  = getChecklist;
export const recordChecklistItem = (_checklistId: string, itemId: string, d: Record<string, unknown>) =>
  updateChecklistItem(itemId, d);

export const transitionImprovement = (id: string, action: string, data?: Record<string, unknown>) =>
  apiClient.post(`${BASE}/improvements/${id}/${action}`, data ?? {});
