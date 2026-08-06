import { apiClient } from "@/lib/api-client";

const BASE = "/system";

// ─── Step-up Auth ─────────────────────────────────────────────────────────────
export const stepUpAuth = (password: string): Promise<{ token: string; expiresAt: string }> =>
  apiClient.post<any>(`${BASE}/step-up-auth`, { password });

// ─── Overview & Health ────────────────────────────────────────────────────────
export const getSystemOverview = () =>
  apiClient.get<any>(`${BASE}/health/overview`);

export const getHealthCheck = () =>
  apiClient.get<any>(`${BASE}/health`);

export const getHealthDatabase = () =>
  apiClient.get<any>(`${BASE}/health/database`);

export const getHealthStorage = () =>
  apiClient.get<any>(`${BASE}/health/storage`);

export const getHealthNotifications = () =>
  apiClient.get<any>(`${BASE}/health/notifications`);

export const getHealthEmail = () =>
  apiClient.get<any>(`${BASE}/health/email`);

export const getHealthJobs = () =>
  apiClient.get<any>(`${BASE}/health/background-jobs`);

// ─── Database ─────────────────────────────────────────────────────────────────
export const getDatabaseStats = () =>
  apiClient.get<any>(`${BASE}/database`);

export const getSlowQueries = () =>
  apiClient.get<any>(`${BASE}/database/slow-queries`);

export const getDatabaseLocks = () =>
  apiClient.get<any>(`${BASE}/database/locks`);

export const cancelDatabaseQuery = (pid: number, stepUpToken: string) =>
  apiClient.post<any>(`${BASE}/database/cancel-query`, { pid }, { headers: { "x-step-up-token": stepUpToken } });

export const runDatabaseAnalyze = () =>
  apiClient.post<any>(`${BASE}/database/analyze`, {});

export const exportDatabaseReport = () =>
  apiClient.get<any>(`${BASE}/database/export`);

// ─── Migrations ───────────────────────────────────────────────────────────────
export const getMigrationsList = () =>
  apiClient.get<any>(`${BASE}/migrations`);

export const verifyMigrations = () =>
  apiClient.post<any>(`${BASE}/migrations/verify`, {});

export const applyMigrations = (stepUpToken: string) =>
  apiClient.post<any>(`${BASE}/migrations/apply`, {}, { headers: { "x-step-up-token": stepUpToken } });

export const getMigrationSqlPreview = (name: string) =>
  apiClient.get<any>(`${BASE}/migrations/${encodeURIComponent(name)}/sql-preview`);

// ─── Backups ──────────────────────────────────────────────────────────────────
export const getBackups = () =>
  apiClient.get<any>(`${BASE}/backups`);

export const createBackup = (data: { type?: string; notes?: string }) =>
  apiClient.post<any>(`${BASE}/backups`, data);

export const getBackup = (id: string) =>
  apiClient.get<any>(`${BASE}/backups/${id}`);

export const verifyBackup = (id: string) =>
  apiClient.post<any>(`${BASE}/backups/${id}/verify`, {});

export const getRestorePlan = (id: string, stepUpToken: string) =>
  apiClient.post<any>(`${BASE}/backups/${id}/restore-plan`, {}, { headers: { "x-step-up-token": stepUpToken } });

export const protectBackup = (id: string) =>
  apiClient.patch<any>(`${BASE}/backups/${id}/protect`, {});

export const deleteBackup = (id: string, confirmPhrase: string) =>
  apiClient.request<any>(`${BASE}/backups/${id}`, { method: 'DELETE', body: { confirmPhrase } });

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export const getJobs = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
  return apiClient.get<any>(`${BASE}/jobs${qs}`);
};

export const retryJob = (id: string) =>
  apiClient.post<any>(`${BASE}/jobs/${id}/retry`, {});

export const cancelJob = (id: string) =>
  apiClient.post<any>(`${BASE}/jobs/${id}/cancel`, {});

export const pauseQueue = () =>
  apiClient.post<any>(`${BASE}/jobs/queue/pause`, {});

export const resumeQueue = () =>
  apiClient.post<any>(`${BASE}/jobs/queue/resume`, {});

// ─── Logs ─────────────────────────────────────────────────────────────────────
export const getSystemLogs = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
  return apiClient.get<any>(`${BASE}/logs${qs}`);
};

export const exportSystemLogs = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
  return (apiClient.get as (u: string) => Promise<Blob>)(`${BASE}/logs/export-csv${qs}`);
};

// ─── Audit ────────────────────────────────────────────────────────────────────
export const getAuditLogs = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
  return apiClient.get<any>(`${BASE}/audit${qs}`);
};

export const exportAuditLogs = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
  return (apiClient.get as (u: string) => Promise<Blob>)(`${BASE}/audit/export-csv${qs}`);
};

// ─── Sessions ─────────────────────────────────────────────────────────────────
export const getSessions = () =>
  apiClient.get<any>(`${BASE}/sessions`);

export const revokeSession = (id: string) =>
  apiClient.post<any>(`${BASE}/sessions/${id}/revoke`, {});

export const revokeAllUserSessions = (userId: string, stepUpToken: string) =>
  apiClient.post<any>(`${BASE}/sessions/revoke-all-for-user`, { userId }, { headers: { "x-step-up-token": stepUpToken } });

export const blockAccount = (userId: string, stepUpToken: string) =>
  apiClient.post<any>(`${BASE}/sessions/block-account`, { userId }, { headers: { "x-step-up-token": stepUpToken } });

export const requirePasswordReset = (userId: string) =>
  apiClient.post<any>(`${BASE}/sessions/require-password-reset`, { userId });

// ─── Security ─────────────────────────────────────────────────────────────────
export const getSecurityDashboard = () =>
  apiClient.get<any>(`${BASE}/security`);

export const unlockAccount = (userId: string) =>
  apiClient.post<any>(`${BASE}/security/unlock-account`, { userId });

export const suspendAccount = (userId: string, stepUpToken: string) =>
  apiClient.post<any>(`${BASE}/security/suspend-account`, { userId }, { headers: { "x-step-up-token": stepUpToken } });

export const blockIp = (ip: string, reason: string) =>
  apiClient.post<any>(`${BASE}/security/block-ip`, { ip, reason });

export const addAllowlistIp = (ip: string) =>
  apiClient.post<any>(`${BASE}/security/add-allowlist-ip`, { ip });

export const requirePasswordChange = (userId: string) =>
  apiClient.post<any>(`${BASE}/security/require-password-change`, { userId });

// ─── API Keys ─────────────────────────────────────────────────────────────────
export const getApiKeys = () =>
  apiClient.get<any>(`${BASE}/api-keys`);

export const createApiKey = (data: { name: string; scopes: string[]; expiresAt?: string; siteId?: string }, stepUpToken: string) =>
  apiClient.post<any>(`${BASE}/api-keys`, data, { headers: { "x-step-up-token": stepUpToken } });

export const revokeApiKey = (id: string) =>
  apiClient.post<any>(`${BASE}/api-keys/${id}/revoke`, {});

// ─── Webhooks ─────────────────────────────────────────────────────────────────
export const getWebhooks = () =>
  apiClient.get<any>(`${BASE}/webhooks`);

export const createWebhook = (data: Record<string, unknown>) =>
  apiClient.post<any>(`${BASE}/webhooks`, data);

export const updateWebhook = (id: string, data: Record<string, unknown>) =>
  apiClient.patch<any>(`${BASE}/webhooks/${id}`, data);

export const deleteWebhook = (id: string) =>
  apiClient.delete<any>(`${BASE}/webhooks/${id}`);

export const testWebhook = (id: string) =>
  apiClient.post<any>(`${BASE}/webhooks/${id}/test`, {});

export const getWebhookDeliveries = (id: string) =>
  apiClient.get<any>(`${BASE}/webhooks/${id}/deliveries`);

export const retryWebhookDelivery = (webhookId: string, deliveryId: string) =>
  apiClient.post<any>(`${BASE}/webhooks/${webhookId}/retry/${deliveryId}`, {});

// ─── Integrations ─────────────────────────────────────────────────────────────
export const getIntegrations = () =>
  apiClient.get<any>(`${BASE}/integrations`);

export const seedIntegrations = () =>
  apiClient.post<any>(`${BASE}/integrations/seed`, {});

export const testIntegration = (id: string) =>
  apiClient.post<any>(`${BASE}/integrations/${id}/test`, {});

export const updateIntegration = (id: string, data: Record<string, unknown>) =>
  apiClient.patch<any>(`${BASE}/integrations/${id}`, data);

// ─── Feature Flags ────────────────────────────────────────────────────────────
export const getFeatureFlags = () =>
  apiClient.get<any>(`${BASE}/feature-flags`);

export const updateFeatureFlag = (id: string, data: Record<string, unknown>) =>
  apiClient.patch<any>(`${BASE}/feature-flags/${id}`, data);

export const createFeatureFlag = (data: Record<string, unknown>) =>
  apiClient.post<any>(`${BASE}/feature-flags`, data);

// ─── Maintenance ──────────────────────────────────────────────────────────────
export const getMaintenanceModeConfig = () =>
  apiClient.get<any>(`${BASE}/maintenance`);

export const updateMaintenanceMode = (data: Record<string, unknown>, stepUpToken: string) =>
  apiClient.patch<any>(`${BASE}/maintenance`, data, { headers: { "x-step-up-token": stepUpToken } });

// ─── Version ──────────────────────────────────────────────────────────────────
export const getSystemVersion = () =>
  apiClient.get<any>(`${BASE}/version`);

// ─── Settings ─────────────────────────────────────────────────────────────────
export const getSystemSettings = () =>
  apiClient.get<any>(`${BASE}/settings`);

export const updateSystemSettings = (data: Record<string, unknown>) =>
  apiClient.patch<any>(`${BASE}/settings`, data);

export const resetPasswordPolicy = (stepUpToken: string) =>
  apiClient.post<any>(`${BASE}/settings/reset`, {}, { headers: { "x-step-up-token": stepUpToken } });

// ─── Release Notes ────────────────────────────────────────────────────────────
export const getReleaseNotes = () =>
  apiClient.get<any>(`${BASE}/release-notes`);

export const createReleaseNote = (data: { version: string; title: string; body: string; publishedAt?: string }) =>
  apiClient.post<any>(`${BASE}/release-notes`, data);

// ─── Rate Limits ──────────────────────────────────────────────────────────────
export const getRateLimits = () =>
  apiClient.get<any>(`${BASE}/rate-limits`);

export const updateRateLimit = (id: string, data: Record<string, unknown>) =>
  apiClient.patch<any>(`${BASE}/rate-limits/${id}`, data);
