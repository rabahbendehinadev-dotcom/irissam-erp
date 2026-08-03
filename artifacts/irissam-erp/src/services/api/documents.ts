import { apiClient } from "@/lib/api-client";

export interface DocRecord {
  id: string;
  documentNumber: string;
  title: string;
  description?: string;
  category: string;
  module?: string;
  entityType?: string;
  entityId?: string;
  patientId?: string;
  patientName?: string;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  storageProvider: string;
  versionNumber: number;
  confidentiality: string;
  status: string;
  isFavorite: boolean;
  retentionUntil?: string;
  expiresAt?: string;
  archivedAt?: string;
  signedAt?: string;
  legalHold: boolean;
  tags: string[];
  folderId?: string;
  folderName?: string;
  folderPath?: string;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  versions?: DocVersion[];
  comments?: DocComment[];
  signatures?: DocSignature[];
  approvals?: DocApproval[];
}

export interface DocFolder {
  id: string;
  name: string;
  path: string;
  parentId?: string;
  category?: string;
  description?: string;
  confidentiality: string;
  isSystem: boolean;
  color?: string;
  icon?: string;
  documentCount: number;
  childrenCount: number;
}

export interface DocVersion {
  id: string;
  versionNumber: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  checksum?: string;
  changeReason?: string;
  createdAt: string;
  createdByName?: string;
}

export interface DocComment {
  id: string;
  content: string;
  createdAt: string;
  createdBy?: string;
  isInternal: boolean;
}

export interface DocSignature {
  id: string;
  signerName: string;
  signerRole?: string;
  signatureType: string;
  signedAt: string;
  reason?: string;
  docHash: string;
}

export interface DocApproval {
  id: string;
  action: string;
  comment?: string;
  decidedAt?: string;
  approverId: string;
  approverName?: string;
}

export interface DocFilters {
  folderId?: string;
  category?: string;
  status?: string;
  confidentiality?: string;
  patientId?: string;
  entityType?: string;
  entityId?: string;
  search?: string;
  tags?: string[];
  module?: string;
  favorite?: boolean;
  limit?: number;
  offset?: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface DocListResponse {
  documents: DocRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface DocDashboardKpis {
  total: number;
  uploadedToday: number;
  pendingApproval: number;
  toSign: number;
  expiringIn30Days: number;
  archived: number;
  sensitiveViewedToday: number;
  storageUsedBytes?: number;
}

export interface DocDashboardCharts {
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
  uploadsMonthly: { month: string; count: number }[];
  storageByCategory: { category: string; total_bytes: number; count: number }[];
}

const BASE = "/api/documents";

export const docsApi = {
  // Documents
  list: (filters: DocFilters = {}): Promise<DocListResponse> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        if (Array.isArray(v)) v.forEach(i => params.append(k, i));
        else params.set(k, String(v));
      }
    });
    return apiClient.get(`${BASE}/records?${params}`).then(r => r.data);
  },
  get: (id: string): Promise<DocRecord> =>
    apiClient.get(`${BASE}/records/${id}`).then(r => r.data),
  create: (body: Partial<DocRecord> & { storageKey: string }): Promise<DocRecord> =>
    apiClient.post(`${BASE}/records`, body).then(r => r.data),
  update: (id: string, body: Partial<DocRecord>): Promise<DocRecord> =>
    apiClient.patch(`${BASE}/records/${id}`, body).then(r => r.data),
  delete: (id: string): Promise<void> =>
    apiClient.delete(`${BASE}/records/${id}`).then(() => {}),
  approve: (id: string, comment?: string): Promise<void> =>
    apiClient.post(`${BASE}/records/${id}/approve`, { comment }).then(() => {}),
  reject: (id: string, comment: string): Promise<void> =>
    apiClient.post(`${BASE}/records/${id}/reject`, { comment }).then(() => {}),
  sign: (id: string, reason: string, signatureType?: string): Promise<DocSignature> =>
    apiClient.post(`${BASE}/records/${id}/sign`, { reason, signatureType }).then(r => r.data),
  archive: (id: string): Promise<void> =>
    apiClient.post(`${BASE}/records/${id}/archive`, {}).then(() => {}),
  restore: (id: string): Promise<void> =>
    apiClient.post(`${BASE}/records/${id}/restore`, {}).then(() => {}),
  favorite: (id: string): Promise<void> =>
    apiClient.post(`${BASE}/records/${id}/favorite`, {}).then(() => {}),
  addComment: (id: string, content: string, isInternal?: boolean): Promise<DocComment> =>
    apiClient.post(`${BASE}/records/${id}/comments`, { content, isInternal }).then(r => r.data),
  getDownloadUrl: (id: string) => `${BASE}/records/${id}/download-url`,
  getPreviewUrl: (id: string) => `${BASE}/records/${id}/preview-url`,
  requestUploadUrl: (fileName: string, mimeType: string, fileSize: number) =>
    apiClient.post(`${BASE}/records/upload-url`, { fileName, mimeType, fileSize }).then(r => r.data as { uploadURL: string; objectPath: string }),

  // Versions
  getVersions: (docId: string): Promise<{ versions: DocVersion[] }> =>
    apiClient.get(`${BASE}/versions/${docId}`).then(r => r.data),
  createVersion: (docId: string, body: { storageKey: string; fileName: string; mimeType: string; fileSize?: number; checksum?: string; changeReason?: string }) =>
    apiClient.post(`${BASE}/versions/${docId}`, body).then(r => r.data),
  restoreVersion: (docId: string, versionNumber: number) =>
    apiClient.post(`${BASE}/versions/${docId}/restore/${versionNumber}`, {}).then(r => r.data),

  // Folders
  getFolders: (): Promise<{ folders: DocFolder[] }> =>
    apiClient.get(`${BASE}/folders`).then(r => r.data),
  createFolder: (body: { name: string; parentId?: string; category?: string; description?: string; confidentiality?: string }) =>
    apiClient.post(`${BASE}/folders`, body).then(r => r.data),
  updateFolder: (id: string, body: Partial<DocFolder>) =>
    apiClient.patch(`${BASE}/folders/${id}`, body).then(r => r.data),
  deleteFolder: (id: string) =>
    apiClient.delete(`${BASE}/folders/${id}`).then(() => {}),

  // Workflows
  getWorkflows: (): Promise<{ workflows: any[] }> =>
    apiClient.get(`${BASE}/workflows`).then(r => r.data),
  startWorkflow: (body: any) =>
    apiClient.post(`${BASE}/workflows`, body).then(r => r.data),
  decideStep: (stepId: string, action: string, comment?: string) =>
    apiClient.post(`${BASE}/workflows/step/${stepId}/decide`, { action, comment }).then(r => r.data),

  // Shares
  getShares: (docId: string) =>
    apiClient.get(`${BASE}/shares/${docId}`).then(r => r.data),
  createShare: (body: any) =>
    apiClient.post(`${BASE}/shares`, body).then(r => r.data),
  deleteShare: (shareId: string) =>
    apiClient.delete(`${BASE}/shares/${shareId}`).then(() => {}),

  // Dashboard
  getDashboardKpis: (): Promise<DocDashboardKpis> =>
    apiClient.get(`${BASE}/dashboard/kpis`).then(r => r.data),
  getDashboardCharts: (): Promise<DocDashboardCharts> =>
    apiClient.get(`${BASE}/dashboard/charts`).then(r => r.data),
  getRecent: (): Promise<{ documents: DocRecord[] }> =>
    apiClient.get(`${BASE}/dashboard/recent`).then(r => r.data),
  getNotifications: () =>
    apiClient.get(`${BASE}/dashboard/notifications`).then(r => r.data),
  markNotificationRead: (id: string) =>
    apiClient.patch(`${BASE}/dashboard/notifications/${id}/read`, {}).then(() => {}),

  // Audit
  getDocumentAudit: (docId: string, limit?: number) =>
    apiClient.get(`${BASE}/audit/${docId}?limit=${limit ?? 50}`).then(r => r.data),
  getGlobalAudit: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiClient.get(`${BASE}/audit${qs}`).then(r => r.data);
  },
};

// Helper: upload file to GCS using presigned URL
export async function uploadDocumentFile(
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ storageKey: string; checksum?: string }> {
  const { uploadURL, objectPath } = await docsApi.requestUploadUrl(file.name, file.type, file.size);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({ storageKey: objectPath });
      else reject(new Error(`Upload échoué: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Erreur réseau lors du téléversement"));
    xhr.open("PUT", uploadURL);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}
