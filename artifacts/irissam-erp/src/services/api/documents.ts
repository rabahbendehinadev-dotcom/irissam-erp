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
    return apiClient.get<DocListResponse>(`${BASE}/records?${params}`);
  },
  get: (id: string): Promise<DocRecord> =>
    apiClient.get<DocRecord>(`${BASE}/records/${id}`),
  create: (body: Partial<DocRecord> & { storageKey: string }): Promise<DocRecord> =>
    apiClient.post<DocRecord>(`${BASE}/records`, body),
  update: (id: string, body: Partial<DocRecord>): Promise<DocRecord> =>
    apiClient.patch<DocRecord>(`${BASE}/records/${id}`, body),
  delete: (id: string): Promise<void> =>
    apiClient.delete(`${BASE}/records/${id}`).then(() => {}),
  approve: (id: string, comment?: string): Promise<void> =>
    apiClient.post(`${BASE}/records/${id}/approve`, { comment }).then(() => {}),
  reject: (id: string, comment: string): Promise<void> =>
    apiClient.post(`${BASE}/records/${id}/reject`, { comment }).then(() => {}),
  sign: (id: string, reason: string, signatureType?: string): Promise<DocSignature> =>
    apiClient.post<DocSignature>(`${BASE}/records/${id}/sign`, { reason, signatureType }),
  archive: (id: string): Promise<void> =>
    apiClient.post(`${BASE}/records/${id}/archive`, {}).then(() => {}),
  restore: (id: string): Promise<void> =>
    apiClient.post(`${BASE}/records/${id}/restore`, {}).then(() => {}),
  favorite: (id: string): Promise<void> =>
    apiClient.post(`${BASE}/records/${id}/favorite`, {}).then(() => {}),
  addComment: (id: string, content: string, isInternal?: boolean): Promise<DocComment> =>
    apiClient.post<DocComment>(`${BASE}/records/${id}/comments`, { content, isInternal }),
  getDownloadUrl: (id: string) => `${BASE}/records/${id}/download-url`,
  getPreviewUrl: (id: string) => `${BASE}/records/${id}/preview-url`,

  // Versions
  getVersions: (docId: string): Promise<{ versions: DocVersion[] }> =>
    apiClient.get<{ versions: DocVersion[] }>(`${BASE}/versions/${docId}`),
  createVersion: (docId: string, body: { storageKey: string; fileName: string; mimeType: string; fileSize?: number; checksum?: string; changeReason?: string }) =>
    apiClient.post(`${BASE}/versions/${docId}`, body),
  restoreVersion: (docId: string, versionNumber: number) =>
    apiClient.post(`${BASE}/versions/${docId}/restore/${versionNumber}`, {}),

  // Folders
  getFolders: (): Promise<{ folders: DocFolder[] }> =>
    apiClient.get<{ folders: DocFolder[] }>(`${BASE}/folders`),
  createFolder: (body: { name: string; parentId?: string; category?: string; description?: string; confidentiality?: string }) =>
    apiClient.post(`${BASE}/folders`, body),
  updateFolder: (id: string, body: Partial<DocFolder>) =>
    apiClient.patch(`${BASE}/folders/${id}`, body),
  deleteFolder: (id: string) =>
    apiClient.delete(`${BASE}/folders/${id}`).then(() => {}),

  // Workflows
  getWorkflows: (): Promise<{ workflows: unknown[] }> =>
    apiClient.get<{ workflows: unknown[] }>(`${BASE}/workflows`),
  startWorkflow: (body: unknown) =>
    apiClient.post(`${BASE}/workflows`, body),
  decideStep: (stepId: string, action: string, comment?: string) =>
    apiClient.post(`${BASE}/workflows/step/${stepId}/decide`, { action, comment }),

  // Shares
  getShares: (docId: string) =>
    apiClient.get(`${BASE}/shares/${docId}`),
  createShare: (body: unknown) =>
    apiClient.post(`${BASE}/shares`, body),
  deleteShare: (shareId: string) =>
    apiClient.delete(`${BASE}/shares/${shareId}`).then(() => {}),

  // Dashboard
  getDashboardKpis: (): Promise<DocDashboardKpis> =>
    apiClient.get<DocDashboardKpis>(`${BASE}/dashboard/kpis`),
  getDashboardCharts: (): Promise<DocDashboardCharts> =>
    apiClient.get<DocDashboardCharts>(`${BASE}/dashboard/charts`),
  getRecent: (): Promise<{ documents: DocRecord[] }> =>
    apiClient.get<{ documents: DocRecord[] }>(`${BASE}/dashboard/recent`),
  getNotifications: (): Promise<{ notifications: unknown[] }> =>
    apiClient.get<{ notifications: unknown[] }>(`${BASE}/dashboard/notifications`),
  markNotificationRead: (id: string) =>
    apiClient.patch(`${BASE}/dashboard/notifications/${id}/read`, {}).then(() => {}),

  // Audit
  getDocumentAudit: (docId: string, limit?: number): Promise<{ logs: unknown[] }> =>
    apiClient.get<{ logs: unknown[] }>(`${BASE}/audit/${docId}?limit=${limit ?? 50}`),
  getGlobalAudit: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiClient.get(`${BASE}/audit${qs}`);
  },
};

/**
 * Upload a file to local VPS storage via the backend API.
 *
 * Uses multipart/form-data POST to /api/storage/upload — the backend validates
 * MIME type, size, writes to the Docker volume, and returns a UUID storage key.
 * The real filesystem path is never exposed to the client.
 *
 * @param file       Browser File object to upload
 * @param onProgress Optional progress callback (0-100)
 * @returns { storageKey, checksum } — storageKey is the UUID to persist in the document record
 */
export async function uploadDocumentFile(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ storageKey: string; checksum?: string }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const { storageKey, checksum } = JSON.parse(xhr.responseText);
          resolve({ storageKey, checksum });
        } catch {
          reject(new Error("Réponse du serveur invalide"));
        }
      } else {
        let msg = `Upload échoué (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body?.error) msg = body.error;
        } catch {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error("Erreur réseau lors du téléversement"));
    xhr.ontimeout = () => reject(new Error("Délai d'attente dépassé lors du téléversement"));

    xhr.open("POST", "/api/storage/upload");
    xhr.timeout = 5 * 60 * 1000; // 5 min timeout for large files

    // Attach JWT from localStorage (same key used by the ERP api-client interceptor)
    const token =
      localStorage.getItem("accessToken") ??
      sessionStorage.getItem("accessToken");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.send(formData);
  });
}
