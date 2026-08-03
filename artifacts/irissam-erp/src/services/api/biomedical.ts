import apiClient from "@/lib/api-client";

const B = "/biomedical";

// Dashboard
export const getBiomedDashboard = () => apiClient.get(`${B}/dashboard`).then(r => r.data);
export const getBiomedMTBF      = () => apiClient.get(`${B}/dashboard/mtbf`).then(r => r.data);
export const getBiomedCosts     = (from?: string, to?: string) =>
  apiClient.get(`${B}/dashboard/costs`, { params: { from, to } }).then(r => r.data);
export const getBiomedAvailability = () => apiClient.get(`${B}/dashboard/availability`).then(r => r.data);

// Equipment
export const getEquipment = (params?: Record<string,unknown>) =>
  apiClient.get(`${B}/equipment`, { params }).then(r => r.data);
export const getEquipmentById = (id: string) =>
  apiClient.get(`${B}/equipment/${id}`).then(r => r.data);
export const getEquipmentHistory = (id: string) =>
  apiClient.get(`${B}/equipment/${id}/history`).then(r => r.data);
export const createEquipment = (data: unknown) =>
  apiClient.post(`${B}/equipment`, data).then(r => r.data);
export const updateEquipment = (id: string, data: unknown) =>
  apiClient.patch(`${B}/equipment/${id}`, data).then(r => r.data);
export const deleteEquipment = (id: string) =>
  apiClient.delete(`${B}/equipment/${id}`);

// Work Orders
export const getWorkOrders = (params?: Record<string,unknown>) =>
  apiClient.get(`${B}/work-orders`, { params }).then(r => r.data);
export const getWorkOrderById = (id: string) =>
  apiClient.get(`${B}/work-orders/${id}`).then(r => r.data);
export const createWorkOrder = (data: unknown) =>
  apiClient.post(`${B}/work-orders`, data).then(r => r.data);
export const startWorkOrder = (id: string) =>
  apiClient.post(`${B}/work-orders/${id}/start`).then(r => r.data);
export const closeWorkOrder = (id: string, data: unknown) =>
  apiClient.post(`${B}/work-orders/${id}/close`, data).then(r => r.data);
export const updateWorkOrderTask = (woId: string, taskId: string, data: unknown) =>
  apiClient.patch(`${B}/work-orders/${woId}/tasks/${taskId}`, data).then(r => r.data);

// Calibrations
export const getCalibrations = (params?: Record<string,unknown>) =>
  apiClient.get(`${B}/calibrations`, { params }).then(r => r.data);
export const getCalibrationById = (id: string) =>
  apiClient.get(`${B}/calibrations/${id}`).then(r => r.data);
export const createCalibration = (data: unknown) =>
  apiClient.post(`${B}/calibrations`, data).then(r => r.data);
export const recordCalibration = (id: string, data: unknown) =>
  apiClient.post(`${B}/calibrations/${id}/record`, data).then(r => r.data);
export const addCalibrationCert = (id: string, data: unknown) =>
  apiClient.post(`${B}/calibrations/${id}/certificates`, data).then(r => r.data);

// Incidents
export const getIncidents = (params?: Record<string,unknown>) =>
  apiClient.get(`${B}/incidents`, { params }).then(r => r.data);
export const createIncident = (data: unknown) =>
  apiClient.post(`${B}/incidents`, data).then(r => r.data);
export const transitionIncident = (id: string, action: string, data?: unknown) =>
  apiClient.post(`${B}/incidents/${id}/${action}`, data ?? {}).then(r => r.data);

// Contracts
export const getContracts = (params?: Record<string,unknown>) =>
  apiClient.get(`${B}/contracts`, { params }).then(r => r.data);
export const getContractById = (id: string) =>
  apiClient.get(`${B}/contracts/${id}`).then(r => r.data);
export const createContract = (data: unknown) =>
  apiClient.post(`${B}/contracts`, data).then(r => r.data);
export const updateContract = (id: string, data: unknown) =>
  apiClient.patch(`${B}/contracts/${id}`, data).then(r => r.data);

// Suppliers
export const getBiomedSuppliers = () =>
  apiClient.get(`${B}/suppliers`).then(r => r.data);
export const createBiomedSupplier = (data: unknown) =>
  apiClient.post(`${B}/suppliers`, data).then(r => r.data);

// Spare parts
export const getSpareParts = (params?: Record<string,unknown>) =>
  apiClient.get(`${B}/spare-parts`, { params }).then(r => r.data);
export const createSparePart = (data: unknown) =>
  apiClient.post(`${B}/spare-parts`, data).then(r => r.data);
export const sparePartMovement = (id: string, data: unknown) =>
  apiClient.post(`${B}/spare-parts/${id}/movement`, data).then(r => r.data);

// Inspections
export const getInspections = (params?: Record<string,unknown>) =>
  apiClient.get(`${B}/inspections`, { params }).then(r => r.data);
export const createInspection = (data: unknown) =>
  apiClient.post(`${B}/inspections`, data).then(r => r.data);

// Disposals
export const getDisposals = (params?: Record<string,unknown>) =>
  apiClient.get(`${B}/disposals`, { params }).then(r => r.data);
export const createDisposal = (data: unknown) =>
  apiClient.post(`${B}/disposals`, data).then(r => r.data);
export const approveDisposal = (id: string) =>
  apiClient.post(`${B}/disposals/${id}/approve`).then(r => r.data);
export const finalizeDisposal = (id: string, data: unknown) =>
  apiClient.post(`${B}/disposals/${id}/finalize`, data).then(r => r.data);

// Catalog
export const getBiomedCategories    = () => apiClient.get(`${B}/categories`).then(r => r.data);
export const getBiomedManufacturers = () => apiClient.get(`${B}/manufacturers`).then(r => r.data);
export const getBiomedModels        = (params?: Record<string,unknown>) =>
  apiClient.get(`${B}/models`, { params }).then(r => r.data);
export const getBiomedLocations     = () => apiClient.get(`${B}/locations`).then(r => r.data);
export const createBiomedCategory    = (d: unknown) => apiClient.post(`${B}/categories`, d).then(r => r.data);
export const createBiomedManufacturer= (d: unknown) => apiClient.post(`${B}/manufacturers`, d).then(r => r.data);
export const createBiomedModel       = (d: unknown) => apiClient.post(`${B}/models`, d).then(r => r.data);
export const createBiomedLocation    = (d: unknown) => apiClient.post(`${B}/locations`, d).then(r => r.data);
