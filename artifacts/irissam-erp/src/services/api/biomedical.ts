import { apiClient } from "@/lib/api-client";

const B = "/biomedical";

/** Builds a query string from a params record, skipping null/undefined/empty values. */
function buildQs(p: Record<string, unknown>): string {
  const entries = Object.entries(p)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => [k, String(v)] as [string, string]);
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getBiomedDashboard    = () => apiClient.get(`${B}/dashboard`);
export const getBiomedMTBF         = () => apiClient.get(`${B}/dashboard/mtbf`);
export const getBiomedCosts        = (from?: string, to?: string) =>
  apiClient.get(`${B}/dashboard/costs${buildQs({ from, to })}`);
export const getBiomedAvailability = () => apiClient.get(`${B}/dashboard/availability`);

// ── Equipment ─────────────────────────────────────────────────────────────────
export const getEquipment        = (params?: Record<string, unknown>) =>
  apiClient.get(`${B}/equipment${params ? buildQs(params) : ''}`);
export const getEquipmentById    = (id: string) =>
  apiClient.get(`${B}/equipment/${id}`);
export const getEquipmentHistory = (id: string) =>
  apiClient.get(`${B}/equipment/${id}/history`);
export const createEquipment     = (data: unknown) =>
  apiClient.post(`${B}/equipment`, data);
export const updateEquipment     = (id: string, data: unknown) =>
  apiClient.patch(`${B}/equipment/${id}`, data);
export const deleteEquipment     = (id: string) =>
  apiClient.delete(`${B}/equipment/${id}`);

// ── Work Orders ───────────────────────────────────────────────────────────────
export const getWorkOrders        = (params?: Record<string, unknown>) =>
  apiClient.get(`${B}/work-orders${params ? buildQs(params) : ''}`);
export const getWorkOrderById     = (id: string) =>
  apiClient.get(`${B}/work-orders/${id}`);
export const createWorkOrder      = (data: unknown) =>
  apiClient.post(`${B}/work-orders`, data);
export const startWorkOrder       = (id: string) =>
  apiClient.post(`${B}/work-orders/${id}/start`, {});
export const closeWorkOrder       = (id: string, data: unknown) =>
  apiClient.post(`${B}/work-orders/${id}/close`, data);
export const updateWorkOrderTask  = (woId: string, taskId: string, data: unknown) =>
  apiClient.patch(`${B}/work-orders/${woId}/tasks/${taskId}`, data);

// ── Calibrations ──────────────────────────────────────────────────────────────
export const getCalibrations     = (params?: Record<string, unknown>) =>
  apiClient.get(`${B}/calibrations${params ? buildQs(params) : ''}`);
export const getCalibrationById  = (id: string) =>
  apiClient.get(`${B}/calibrations/${id}`);
export const createCalibration   = (data: unknown) =>
  apiClient.post(`${B}/calibrations`, data);
export const recordCalibration   = (id: string, data: unknown) =>
  apiClient.post(`${B}/calibrations/${id}/record`, data);
export const addCalibrationCert  = (id: string, data: unknown) =>
  apiClient.post(`${B}/calibrations/${id}/certificates`, data);

// ── Incidents ─────────────────────────────────────────────────────────────────
export const getIncidents       = (params?: Record<string, unknown>) =>
  apiClient.get(`${B}/incidents${params ? buildQs(params) : ''}`);
export const createIncident     = (data: unknown) =>
  apiClient.post(`${B}/incidents`, data);
export const transitionIncident = (id: string, action: string, data?: unknown) =>
  apiClient.post(`${B}/incidents/${id}/${action}`, data ?? {});

// ── Contracts ─────────────────────────────────────────────────────────────────
export const getContracts    = (params?: Record<string, unknown>) =>
  apiClient.get(`${B}/contracts${params ? buildQs(params) : ''}`);
export const getContractById = (id: string) =>
  apiClient.get(`${B}/contracts/${id}`);
export const createContract  = (data: unknown) =>
  apiClient.post(`${B}/contracts`, data);
export const updateContract  = (id: string, data: unknown) =>
  apiClient.patch(`${B}/contracts/${id}`, data);

// ── Suppliers ─────────────────────────────────────────────────────────────────
export const getBiomedSuppliers   = () =>
  apiClient.get(`${B}/suppliers`);
export const createBiomedSupplier = (data: unknown) =>
  apiClient.post(`${B}/suppliers`, data);

// ── Spare Parts ───────────────────────────────────────────────────────────────
export const getSpareParts      = (params?: Record<string, unknown>) =>
  apiClient.get(`${B}/spare-parts${params ? buildQs(params) : ''}`);
export const createSparePart    = (data: unknown) =>
  apiClient.post(`${B}/spare-parts`, data);
export const sparePartMovement  = (id: string, data: unknown) =>
  apiClient.post(`${B}/spare-parts/${id}/movement`, data);

// ── Inspections ───────────────────────────────────────────────────────────────
export const getInspections   = (params?: Record<string, unknown>) =>
  apiClient.get(`${B}/inspections${params ? buildQs(params) : ''}`);
export const createInspection = (data: unknown) =>
  apiClient.post(`${B}/inspections`, data);

// ── Disposals ─────────────────────────────────────────────────────────────────
export const getDisposals      = (params?: Record<string, unknown>) =>
  apiClient.get(`${B}/disposals${params ? buildQs(params) : ''}`);
export const createDisposal    = (data: unknown) =>
  apiClient.post(`${B}/disposals`, data);
export const approveDisposal   = (id: string) =>
  apiClient.post(`${B}/disposals/${id}/approve`, {});
export const finalizeDisposal  = (id: string, data: unknown) =>
  apiClient.post(`${B}/disposals/${id}/finalize`, data);

// ── Catalog ───────────────────────────────────────────────────────────────────
export const getBiomedCategories     = () => apiClient.get(`${B}/categories`);
export const getBiomedManufacturers  = () => apiClient.get(`${B}/manufacturers`);
export const getBiomedModels         = (params?: Record<string, unknown>) =>
  apiClient.get(`${B}/models${params ? buildQs(params) : ''}`);
export const getBiomedLocations      = () => apiClient.get(`${B}/locations`);
export const createBiomedCategory    = (d: unknown) => apiClient.post(`${B}/categories`, d);
export const createBiomedManufacturer= (d: unknown) => apiClient.post(`${B}/manufacturers`, d);
export const createBiomedModel       = (d: unknown) => apiClient.post(`${B}/models`, d);
export const createBiomedLocation    = (d: unknown) => apiClient.post(`${B}/locations`, d);
