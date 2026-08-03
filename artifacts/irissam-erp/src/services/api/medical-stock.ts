import { apiClient } from "@/services/api/client";

const base = "/medical-stock";

export const stockApi = {
  // ── Dashboard ─────────────────────────────────────────────────────────
  getDashboard: () => apiClient.get<any>(`${base}/dashboard`),

  // ── Reports ───────────────────────────────────────────────────────────
  getMovementsReport: (params?: Record<string,string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiClient.get<any>(`${base}/reports/movements${qs}`);
  },
  getValuations: () => apiClient.get<any>(`${base}/reports/valuations`),

  // ── Items ─────────────────────────────────────────────────────────────
  listItems: (params?: Record<string,string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiClient.get<any>(`${base}/items${qs}`);
  },
  getItem: (id: string) => apiClient.get<any>(`${base}/items/${id}`),
  createItem: (body: any) => apiClient.post<any>(`${base}/items`, body),
  updateItem: (id: string, body: any) => apiClient.patch<any>(`${base}/items/${id}`, body),
  deleteItem: (id: string) => apiClient.delete<any>(`${base}/items/${id}`),

  // ── Categories ────────────────────────────────────────────────────────
  listCategories: () => apiClient.get<any>(`${base}/categories`),
  createCategory: (body: any) => apiClient.post<any>(`${base}/categories`, body),
  updateCategory: (id: string, body: any) => apiClient.patch<any>(`${base}/categories/${id}`, body),
  deleteCategory: (id: string) => apiClient.delete<any>(`${base}/categories/${id}`),

  // ── Units ─────────────────────────────────────────────────────────────
  listUnits: () => apiClient.get<any>(`${base}/units`),
  createUnit: (body: any) => apiClient.post<any>(`${base}/units`, body),

  // ── Suppliers ─────────────────────────────────────────────────────────
  listSuppliers: (params?: Record<string,string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiClient.get<any>(`${base}/suppliers${qs}`);
  },
  getSupplier: (id: string) => apiClient.get<any>(`${base}/suppliers/${id}`),
  createSupplier: (body: any) => apiClient.post<any>(`${base}/suppliers`, body),
  updateSupplier: (id: string, body: any) => apiClient.patch<any>(`${base}/suppliers/${id}`, body),
  deleteSupplier: (id: string) => apiClient.delete<any>(`${base}/suppliers/${id}`),

  // ── Manufacturers ─────────────────────────────────────────────────────
  listManufacturers: (params?: Record<string,string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiClient.get<any>(`${base}/manufacturers${qs}`);
  },
  createManufacturer: (body: any) => apiClient.post<any>(`${base}/manufacturers`, body),
  updateManufacturer: (id: string, body: any) => apiClient.patch<any>(`${base}/manufacturers/${id}`, body),
  deleteManufacturer: (id: string) => apiClient.delete<any>(`${base}/manufacturers/${id}`),

  // ── Batches ───────────────────────────────────────────────────────────
  listBatches: (params?: Record<string,string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiClient.get<any>(`${base}/batches${qs}`);
  },
  getExpiringBatches: () => apiClient.get<any>(`${base}/batches/expiring`),
  createBatch: (body: any) => apiClient.post<any>(`${base}/batches`, body),
  updateBatch: (id: string, body: any) => apiClient.patch<any>(`${base}/batches/${id}`, body),

  // ── Movements ─────────────────────────────────────────────────────────
  listMovements: (params?: Record<string,string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiClient.get<any>(`${base}/movements${qs}`);
  },
  createMovement: (body: any) => apiClient.post<any>(`${base}/movements`, body),

  // ── Purchase Orders ───────────────────────────────────────────────────
  listPurchaseOrders: (params?: Record<string,string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiClient.get<any>(`${base}/purchase-orders${qs}`);
  },
  getPurchaseOrder: (id: string) => apiClient.get<any>(`${base}/purchase-orders/${id}`),
  createPurchaseOrder: (body: any) => apiClient.post<any>(`${base}/purchase-orders`, body),
  submitPurchaseOrder: (id: string) => apiClient.post<any>(`${base}/purchase-orders/${id}/submit`, {}),
  approvePurchaseOrder: (id: string) => apiClient.post<any>(`${base}/purchase-orders/${id}/approve`, {}),
  receivePurchaseOrder: (id: string, body: any) => apiClient.post<any>(`${base}/purchase-orders/${id}/receive`, body),

  // ── Transfers ─────────────────────────────────────────────────────────
  listTransfers: (params?: Record<string,string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiClient.get<any>(`${base}/transfers${qs}`);
  },
  getTransfer: (id: string) => apiClient.get<any>(`${base}/transfers/${id}`),
  createTransfer: (body: any) => apiClient.post<any>(`${base}/transfers`, body),
  submitTransfer: (id: string) => apiClient.post<any>(`${base}/transfers/${id}/submit`, {}),
  approveTransfer: (id: string) => apiClient.post<any>(`${base}/transfers/${id}/approve`, {}),
  receiveTransfer: (id: string, body: any) => apiClient.post<any>(`${base}/transfers/${id}/receive`, body),

  // ── Adjustments ───────────────────────────────────────────────────────
  listAdjustments: (params?: Record<string,string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiClient.get<any>(`${base}/adjustments${qs}`);
  },
  createAdjustment: (body: any) => apiClient.post<any>(`${base}/adjustments`, body),

  // ── Inventory ─────────────────────────────────────────────────────────
  listInventory: (params?: Record<string,string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiClient.get<any>(`${base}/inventory${qs}`);
  },
  getInventorySession: (id: string) => apiClient.get<any>(`${base}/inventory/${id}`),
  createInventorySession: (body: any) => apiClient.post<any>(`${base}/inventory`, body),
  countInventoryItem: (sessionId: string, itemId: string, body: any) =>
    apiClient.patch<any>(`${base}/inventory/${sessionId}/items/${itemId}`, body),
  validateInventory: (id: string) => apiClient.post<any>(`${base}/inventory/${id}/validate`, {}),

  // ── Consumptions ──────────────────────────────────────────────────────
  listConsumptions: (params?: Record<string,string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiClient.get<any>(`${base}/consumptions${qs}`);
  },
  getConsumption: (id: string) => apiClient.get<any>(`${base}/consumptions/${id}`),
  createConsumption: (body: any) => apiClient.post<any>(`${base}/consumptions`, body),
  validateConsumption: (id: string) => apiClient.post<any>(`${base}/consumptions/${id}/validate`, {}),
};
