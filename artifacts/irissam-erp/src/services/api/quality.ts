import { apiClient } from "@/lib/api-client";

const BASE = "/quality";

// ── Dashboard ──────────────────────────────────────────────────────────────
export const getQualityDashboard = () =>
  apiClient.get(`${BASE}/dashboard`).then(r => r.data);

// ── Incidents ─────────────────────────────────────────────────────────────
export const getIncidents    = (p: Record<string,any> = {}) =>
  apiClient.get(`${BASE}/incidents`, { params: p }).then(r => r.data);
export const getIncident     = (id: string) =>
  apiClient.get(`${BASE}/incidents/${id}`).then(r => r.data);
export const createIncident  = (d: Record<string,any>) =>
  apiClient.post(`${BASE}/incidents`, d).then(r => r.data);
export const updateIncident  = (id: string, d: Record<string,any>) =>
  apiClient.patch(`${BASE}/incidents/${id}`, d).then(r => r.data);
export const advanceIncident = (id: string) =>
  apiClient.post(`${BASE}/incidents/${id}/advance`).then(r => r.data);

// ── Non-conformités ────────────────────────────────────────────────────────
export const getNCs      = (p: Record<string,any> = {}) =>
  apiClient.get(`${BASE}/non-conformities`, { params: p }).then(r => r.data);
export const createNC    = (d: Record<string,any>) =>
  apiClient.post(`${BASE}/non-conformities`, d).then(r => r.data);
export const updateNC    = (id: string, d: Record<string,any>) =>
  apiClient.patch(`${BASE}/non-conformities/${id}`, d).then(r => r.data);
export const advanceNC   = (id: string) =>
  apiClient.post(`${BASE}/non-conformities/${id}/advance`).then(r => r.data);

// ── CAPA ──────────────────────────────────────────────────────────────────
export const getCAPAs      = (p: Record<string,any> = {}) =>
  apiClient.get(`${BASE}/capa`, { params: p }).then(r => r.data);
export const createCAPA    = (d: Record<string,any>) =>
  apiClient.post(`${BASE}/capa`, d).then(r => r.data);
export const updateCAPA    = (id: string, d: Record<string,any>) =>
  apiClient.patch(`${BASE}/capa/${id}`, d).then(r => r.data);
export const advanceCAPA   = (id: string, d: Record<string,any> = {}) =>
  apiClient.post(`${BASE}/capa/${id}/advance`, d).then(r => r.data);

// ── Risks ─────────────────────────────────────────────────────────────────
export const getRisks      = (p: Record<string,any> = {}) =>
  apiClient.get(`${BASE}/risks`, { params: p }).then(r => r.data);
export const getRiskHeatmap = () =>
  apiClient.get(`${BASE}/risks/heatmap`).then(r => r.data);
export const getRisk       = (id: string) =>
  apiClient.get(`${BASE}/risks/${id}`).then(r => r.data);
export const createRisk    = (d: Record<string,any>) =>
  apiClient.post(`${BASE}/risks`, d).then(r => r.data);
export const updateRisk    = (id: string, d: Record<string,any>) =>
  apiClient.patch(`${BASE}/risks/${id}`, d).then(r => r.data);
export const assessRisk    = (id: string, d: Record<string,any>) =>
  apiClient.post(`${BASE}/risks/${id}/assess`, d).then(r => r.data);

// ── Audits ────────────────────────────────────────────────────────────────
export const getAudits     = (p: Record<string,any> = {}) =>
  apiClient.get(`${BASE}/audits`, { params: p }).then(r => r.data);
export const getAudit      = (id: string) =>
  apiClient.get(`${BASE}/audits/${id}`).then(r => r.data);
export const createAudit   = (d: Record<string,any>) =>
  apiClient.post(`${BASE}/audits`, d).then(r => r.data);
export const updateAudit   = (id: string, d: Record<string,any>) =>
  apiClient.patch(`${BASE}/audits/${id}`, d).then(r => r.data);
export const addAuditFinding = (id: string, d: Record<string,any>) =>
  apiClient.post(`${BASE}/audits/${id}/findings`, d).then(r => r.data);
export const updateAuditFinding = (fid: string, d: Record<string,any>) =>
  apiClient.patch(`${BASE}/audits/findings/${fid}`, d).then(r => r.data);

// ── Documents ─────────────────────────────────────────────────────────────
export const getDocuments    = (p: Record<string,any> = {}) =>
  apiClient.get(`${BASE}/documents`, { params: p }).then(r => r.data);
export const getDocument     = (id: string) =>
  apiClient.get(`${BASE}/documents/${id}`).then(r => r.data);
export const createDocument  = (d: Record<string,any>) =>
  apiClient.post(`${BASE}/documents`, d).then(r => r.data);
export const updateDocument  = (id: string, d: Record<string,any>) =>
  apiClient.patch(`${BASE}/documents/${id}`, d).then(r => r.data);
export const newDocVersion   = (id: string, d: Record<string,any>) =>
  apiClient.post(`${BASE}/documents/${id}/new-version`, d).then(r => r.data);
export const addDocApproval  = (id: string, d: Record<string,any>) =>
  apiClient.post(`${BASE}/documents/${id}/approvals`, d).then(r => r.data);

// ── Indicators ────────────────────────────────────────────────────────────
export const getIndicators     = (p: Record<string,any> = {}) =>
  apiClient.get(`${BASE}/indicators`, { params: p }).then(r => r.data);
export const getIndicatorValues = (id: string, limit = 24) =>
  apiClient.get(`${BASE}/indicators/${id}/values`, { params: { limit } }).then(r => r.data);
export const createIndicator   = (d: Record<string,any>) =>
  apiClient.post(`${BASE}/indicators`, d).then(r => r.data);
export const addIndicatorValue  = (id: string, d: Record<string,any>) =>
  apiClient.post(`${BASE}/indicators/${id}/values`, d).then(r => r.data);

// ── Meetings ──────────────────────────────────────────────────────────────
export const getCommittees = () =>
  apiClient.get(`${BASE}/meetings/committees`).then(r => r.data);
export const getMeetings   = (p: Record<string,any> = {}) =>
  apiClient.get(`${BASE}/meetings`, { params: p }).then(r => r.data);
export const getMeeting    = (id: string) =>
  apiClient.get(`${BASE}/meetings/${id}`).then(r => r.data);
export const createMeeting = (d: Record<string,any>) =>
  apiClient.post(`${BASE}/meetings`, d).then(r => r.data);
export const updateMeeting = (id: string, d: Record<string,any>) =>
  apiClient.patch(`${BASE}/meetings/${id}`, d).then(r => r.data);
export const addMinutes    = (id: string, d: Record<string,any>) =>
  apiClient.post(`${BASE}/meetings/${id}/minutes`, d).then(r => r.data);

// ── Checklists ────────────────────────────────────────────────────────────
export const getChecklists    = (p: Record<string,any> = {}) =>
  apiClient.get(`${BASE}/checklists`, { params: p }).then(r => r.data);
export const getChecklist     = (id: string) =>
  apiClient.get(`${BASE}/checklists/${id}`).then(r => r.data);
export const createChecklist  = (d: Record<string,any>) =>
  apiClient.post(`${BASE}/checklists`, d).then(r => r.data);
export const addChecklistItems = (id: string, items: any[]) =>
  apiClient.post(`${BASE}/checklists/${id}/items`, items).then(r => r.data);
export const updateChecklistItem = (iid: string, d: Record<string,any>) =>
  apiClient.patch(`${BASE}/checklists/items/${iid}`, d).then(r => r.data);

// ── Improvements ──────────────────────────────────────────────────────────
export const getImprovements  = (p: Record<string,any> = {}) =>
  apiClient.get(`${BASE}/improvements`, { params: p }).then(r => r.data);
export const createImprovement = (d: Record<string,any>) =>
  apiClient.post(`${BASE}/improvements`, d).then(r => r.data);
export const updateImprovement = (id: string, d: Record<string,any>) =>
  apiClient.patch(`${BASE}/improvements/${id}`, d).then(r => r.data);

// ── Analytics ─────────────────────────────────────────────────────────────────
export const getQualityAnalytics = () =>
  apiClient.get(`${BASE}/dashboard`).then(r => ({
    ...r.data,
    incident_trend:     r.data?.incidents_by_month ?? [],
    nc_by_department:   r.data?.nc_by_type ?? [],
    capa_effectiveness: r.data?.capa_by_status ?? [],
    risk_distribution:  [],
    audit_scores:       [],
    indicator_summary:  {},
    risk_matrix:        r.data?.risk_matrix ?? [],
  }));

// ── Component aliases ─────────────────────────────────────────────────────────
export const getQualityIncidents   = getIncidents;
export const createQualityIncident = createIncident;
export const transitionQualityIncident = (id: string, _action: string, data?: Record<string,any>) =>
  apiClient.post(`${BASE}/incidents/${id}/advance`, data ?? {}).then(r => r.data);

export const getNonConformities  = getNCs;
export const createNonConformity = createNC;
export const transitionNC = (id: string, _action: string, data?: Record<string,any>) =>
  apiClient.post(`${BASE}/non-conformities/${id}/advance`, data ?? {}).then(r => r.data);

export const getCapas    = getCAPAs;
export const createCapa  = createCAPA;
export const transitionCapa = (id: string, _action: string, data?: Record<string,any>) =>
  advanceCAPA(id, data ?? {});

export const getRiskMatrix = getRiskHeatmap;

export const transitionAudit = (id: string, action: string, data?: Record<string,any>) =>
  apiClient.post(`${BASE}/audits/${id}/${action}`, data ?? {}).then(r => r.data);

export const getQualityDocuments   = getDocuments;
export const createQualityDocument = createDocument;
export const publishQualityDocument = (id: string) => updateDocument(id, { status: "publie" });
export const archiveQualityDocument = (id: string) => updateDocument(id, { status: "archive" });

export const getIndicatorHistory  = getIndicatorValues;
export const recordIndicatorValue = addIndicatorValue;

export const createCommittee = (d: Record<string,any>) =>
  apiClient.post(`${BASE}/meetings/committees`, d).then(r => r.data);
export const closeMeeting = (id: string, data?: Record<string,any>) =>
  addMinutes(id, data ?? {});

export const getChecklistDetail = getChecklist;
export const recordChecklistItem = (_checklistId: string, itemId: string, d: Record<string,any>) =>
  updateChecklistItem(itemId, d);

export const transitionImprovement = (id: string, action: string, data?: Record<string,any>) =>
  apiClient.post(`${BASE}/improvements/${id}/${action}`, data ?? {}).then(r => r.data);
