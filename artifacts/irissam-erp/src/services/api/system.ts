import { apiClient } from "@/lib/api-client";

const BASE = "/system";

// ─── Step-up Auth ─────────────────────────────────────────────────────────────
export const stepUpAuth = (password: string) =>
  apiClient.post(`${BASE}/step-up-auth`, { password }).then((r) => r.data) as Promise<{ token: string; expiresAt: string }>;

// ─── Overview & Health ────────────────────────────────────────────────────────
export const getSystemOverview = () =>
  apiClient.get(`${BASE}/health/overview`).then((r) => r.data);

export const getHealthCheck = () =>
  apiClient.get(`${BASE}/health`).then((r) => r.data);

export const getHealthDatabase = () =>
  apiClient.get(`${BASE}/health/database`).then((r) => r.data);

export const getHealthStorage = () =>
  apiClient.get(`${BASE}/health/storage`).then((r) => r.data);

export const getHealthNotifications = () =>
  apiClient.get(`${BASE}/health/notifications`).then((r) => r.data);

export const getHealthEmail = () =>
  apiClient.get(`${BASE}/health/email`).then((r) => r.data);

export const getHealthJobs = () =>
  apiClient.get(`${BASE}/health/background-jobs`).then((r) => r.data);

// ─── Database ─────────────────────────────────────────────────────────────────
export const getDatabaseStats = () =>
  apiClient.get(`${BASE}/database`).then((r) => r.data);

export const getSlowQueries = () =>
  apiClient.get(`${BASE}/database/slow-queries`).then((r) => r.data);

export const getDatabaseLocks = () =>
  apiClient.get(`${BASE}/database/locks`).then((r) => r.data);

export const cancelDatabaseQuery = (pid: number, stepUpToken: string) =>
  apiClient.post(`${BASE}/database/cancel-query`, { pid }, { headers: { "x-step-up-token": stepUpToken } }).then((r) => r.data);

export const runDatabaseAnalyze = () =>
  apiClient.post(`${BASE}/database/analyze`, {}).then((r) => r.data);

export const exportDatabaseReport = () =>
  apiClient.get(`${BASE}/database/export`).then((r) => r.data);

// ─── Migrations ───────────────────────────────────────────────────────────────
export const getMigrationsList = () =>
  apiClient.get(`${BASE}/migrations`).then((r) => r.data);

export const verifyMigrations = () =>
  apiClient.post(`${BASE}/migrations/verify`, {}).then((r) => r.data);

export const applyMigrations = (stepUpToken: string) =>
  apiClient.post(`${BASE}/migrations/apply`, {}, { headers: { "x-step-up-token": stepUpToken } }).then((r) => r.data);

export const getMigrationSqlPreview = (name: string) =>
  apiClient.get(`${BASE}/migrations/${encodeURIComponent(name)}/sql-preview`).then((r) => r.data);

// ─── Backups ──────────────────────────────────────────────────────────────────
export const getBackups = () =>
  apiClient.get(`${BASE}/backups`).then((r) => r.data);

export const createBackup = (data: { type?: string; notes?: string }) =>
  apiClient.post(`${BASE}/backups`, data).then((r) => r.data);

export const getBackup = (id: string) =>
  apiClient.get(`${BASE}/backups/${id}`).then((r) => r.data);

export const verifyBackup = (id: string) =>
  apiClient.post(`${BASE}/backups/${id}/verify`, {}).then((r) => r.data);

export const getRestorePlan = (id: string, stepUpToken: string) =>
  apiClient.post(`${BASE}/backups/${id}/restore-plan`, {}, { headers: { "x-step-up-token": stepUpToken } }).then((r) => r.data);

export const protectBackup = (id: string) =>
  apiClient.patch(`${BASE}/backups/${id}/protect`, {}).then((r) => r.data);

export const deleteBackup = (id: string, confirmPhrase: string) =>
  apiClient.delete(`${BASE}/backups/${id}`, { data: { confirmPhrase } }).then((r) => r.data);

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export const getJobs = (params?: Record<string, string>) =>
  apiClient.get(`${BASE}/jobs`, { params }).then((r) => r.data);

export const retryJob = (id: string) =>
  apiClient.post(`${BASE}/jobs/${id}/retry`, {}).then((r) => r.data);

export const cancelJob = (id: string) =>
  apiClient.post(`${BASE}/jobs/${id}/cancel`, {}).then((r) => r.data);

export const pauseQueue = () =>
  apiClient.post(`${BASE}/jobs/queue/pause`, {}).then((r) => r.data);

export const resumeQueue = () =>
  apiClient.post(`${BASE}/jobs/queue/resume`, {}).then((r) => r.data);

// ─── Logs ─────────────────────────────────────────────────────────────────────
export const getSystemLogs = (params?: Record<string, string>) =>
  apiClient.get(`${BASE}/logs`, { params }).then((r) => r.data);

export const exportSystemLogs = (params?: Record<string, string>) =>
  apiClient.get(`${BASE}/logs/export-csv`, { params, responseType: "blob" }).then((r) => r.data);

// ─── Audit ────────────────────────────────────────────────────────────────────
export const getAuditLogs = (params?: Record<string, string>) =>
  apiClient.get(`${BASE}/audit`, { params }).then((r) => r.data);

export const exportAuditLogs = (params?: Record<string, string>) =>
  apiClient.get(`${BASE}/audit/export-csv`, { params, responseType: "blob" }).then((r) => r.data);

// ─── Sessions ─────────────────────────────────────────────────────────────────
export const getSessions = () =>
  apiClient.get(`${BASE}/sessions`).then((r) => r.data);

export const revokeSession = (id: string) =>
  apiClient.post(`${BASE}/sessions/${id}/revoke`, {}).then((r) => r.data);

export const revokeAllUserSessions = (userId: string, stepUpToken: string) =>
  apiClient.post(`${BASE}/sessions/revoke-all-for-user`, { userId }, { headers: { "x-step-up-token": stepUpToken } }).then((r) => r.data);

export const blockAccount = (userId: string, stepUpToken: string) =>
  apiClient.post(`${BASE}/sessions/block-account`, { userId }, { headers: { "x-step-up-token": stepUpToken } }).then((r) => r.data);

export const requirePasswordReset = (userId: string) =>
  apiClient.post(`${BASE}/sessions/require-password-reset`, { userId }).then((r) => r.data);

// ─── Security ─────────────────────────────────────────────────────────────────
export const getSecurityDashboard = () =>
  apiClient.get(`${BASE}/security`).then((r) => r.data);

export const unlockAccount = (userId: string) =>
  apiClient.post(`${BASE}/security/unlock-account`, { userId }).then((r) => r.data);

export const suspendAccount = (userId: string, stepUpToken: string) =>
  apiClient.post(`${BASE}/security/suspend-account`, { userId }, { headers: { "x-step-up-token": stepUpToken } }).then((r) => r.data);

export const blockIp = (ip: string, reason: string) =>
  apiClient.post(`${BASE}/security/block-ip`, { ip, reason }).then((r) => r.data);

export const addAllowlistIp = (ip: string) =>
  apiClient.post(`${BASE}/security/add-allowlist-ip`, { ip }).then((r) => r.data);

export const requirePasswordChange = (userId: string) =>
  apiClient.post(`${BASE}/security/require-password-change`, { userId }).then((r) => r.data);

// ─── API Keys ─────────────────────────────────────────────────────────────────
export const getApiKeys = () =>
  apiClient.get(`${BASE}/api-keys`).then((r) => r.data);

export const createApiKey = (data: { name: string; scopes: string[]; expiresAt?: string; siteId?: string }, stepUpToken: string) =>
  apiClient.post(`${BASE}/api-keys`, data, { headers: { "x-step-up-token": stepUpToken } }).then((r) => r.data);

export const revokeApiKey = (id: string) =>
  apiClient.post(`${BASE}/api-keys/${id}/revoke`, {}).then((r) => r.data);

// ─── Webhooks ─────────────────────────────────────────────────────────────────
export const getWebhooks = () =>
  apiClient.get(`${BASE}/webhooks`).then((r) => r.data);

export const createWebhook = (data: Record<string, unknown>) =>
  apiClient.post(`${BASE}/webhooks`, data).then((r) => r.data);

export const updateWebhook = (id: string, data: Record<string, unknown>) =>
  apiClient.patch(`${BASE}/webhooks/${id}`, data).then((r) => r.data);

export const deleteWebhook = (id: string) =>
  apiClient.delete(`${BASE}/webhooks/${id}`).then((r) => r.data);

export const testWebhook = (id: string) =>
  apiClient.post(`${BASE}/webhooks/${id}/test`, {}).then((r) => r.data);

export const getWebhookDeliveries = (id: string) =>
  apiClient.get(`${BASE}/webhooks/${id}/deliveries`).then((r) => r.data);

export const retryWebhookDelivery = (webhookId: string, deliveryId: string) =>
  apiClient.post(`${BASE}/webhooks/${webhookId}/retry/${deliveryId}`, {}).then((r) => r.data);

// ─── Integrations ─────────────────────────────────────────────────────────────
export const getIntegrations = () =>
  apiClient.get(`${BASE}/integrations`).then((r) => r.data);

export const seedIntegrations = () =>
  apiClient.post(`${BASE}/integrations/seed`, {}).then((r) => r.data);

export const testIntegration = (id: string) =>
  apiClient.post(`${BASE}/integrations/${id}/test`, {}).then((r) => r.data);

export const updateIntegration = (id: string, data: Record<string, unknown>) =>
  apiClient.patch(`${BASE}/integrations/${id}`, data).then((r) => r.data);

// ─── Feature Flags ────────────────────────────────────────────────────────────
export const getFeatureFlags = () =>
  apiClient.get(`${BASE}/feature-flags`).then((r) => r.data);

export const updateFeatureFlag = (id: string, data: Record<string, unknown>) =>
  apiClient.patch(`${BASE}/feature-flags/${id}`, data).then((r) => r.data);

export const createFeatureFlag = (data: Record<string, unknown>) =>
  apiClient.post(`${BASE}/feature-flags`, data).then((r) => r.data);

// ─── Maintenance ──────────────────────────────────────────────────────────────
export const getMaintenanceModeConfig = () =>
  apiClient.get(`${BASE}/maintenance`).then((r) => r.data);

export const updateMaintenanceMode = (data: Record<string, unknown>, stepUpToken: string) =>
  apiClient.patch(`${BASE}/maintenance`, data, { headers: { "x-step-up-token": stepUpToken } }).then((r) => r.data);

// ─── Version ──────────────────────────────────────────────────────────────────
export const getSystemVersion = () =>
  apiClient.get(`${BASE}/version`).then((r) => r.data);

// ─── Settings ─────────────────────────────────────────────────────────────────
export const getSystemSettings = () =>
  apiClient.get(`${BASE}/settings`).then((r) => r.data);

export const updateSystemSettings = (data: Record<string, unknown>) =>
  apiClient.patch(`${BASE}/settings`, data).then((r) => r.data);

export const resetPasswordPolicy = (stepUpToken: string) =>
  apiClient.post(`${BASE}/settings/reset`, {}, { headers: { "x-step-up-token": stepUpToken } }).then((r) => r.data);

// ─── Release Notes ────────────────────────────────────────────────────────────
export const getReleaseNotes = () =>
  apiClient.get(`${BASE}/release-notes`).then((r) => r.data);

export const createReleaseNote = (data: { version: string; title: string; body: string; publishedAt?: string }) =>
  apiClient.post(`${BASE}/release-notes`, data).then((r) => r.data);

// ─── Rate Limits ──────────────────────────────────────────────────────────────
export const getRateLimits = () =>
  apiClient.get(`${BASE}/rate-limits`).then((r) => r.data);

export const updateRateLimit = (id: string, data: Record<string, unknown>) =>
  apiClient.patch(`${BASE}/rate-limits/${id}`, data).then((r) => r.data);
