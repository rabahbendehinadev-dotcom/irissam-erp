/**
 * Local VPS Storage Service
 *
 * Replaces Replit/GCS Object Storage with local filesystem storage on VPS.
 * All file access is routed through the backend — no direct filesystem URLs
 * are ever exposed to clients.
 *
 * Storage layout (bind-mounted Docker volumes on VPS):
 *   /app/storage/documents  — GED document files
 *   /app/storage/uploads    — temporary / miscellaneous uploads
 *   /app/storage/pdfs       — generated PDF files
 *   /app/storage/backups    — backup archives (managed externally)
 *
 * Security guarantees:
 *   - Storage keys are always UUIDs v4 — no user-supplied paths ever reach disk
 *   - resolveStoragePath() enforces the key is inside the expected directory
 *   - File permissions: 0o640 (owner rw, group r, world none)
 *   - Directories created with 0o750
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// ── Directory configuration ───────────────────────────────────────────────────
// On VPS production: /app/storage (Docker bind-mount from /data/irissam/*)
// On Replit dev:     /tmp/irissam-storage (writable by the dev process)
const _defaultRoot = process.env.NODE_ENV === 'production'
  ? '/app/storage'
  : '/tmp/irissam-storage';

const STORAGE_ROOT = process.env.LOCAL_STORAGE_ROOT ?? _defaultRoot;

export const DOCUMENTS_DIR = process.env.DOCUMENTS_DIR ?? path.join(STORAGE_ROOT, 'documents');
export const UPLOADS_DIR   = process.env.UPLOADS_DIR   ?? path.join(STORAGE_ROOT, 'uploads');
export const PDF_DIR       = process.env.PDF_DIR        ?? path.join(STORAGE_ROOT, 'pdfs');
export const BACKUP_DIR    = process.env.BACKUP_DIR     ?? path.join(STORAGE_ROOT, 'backups');

// ── Allowed MIME types ────────────────────────────────────────────────────────
export const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword', 'application/vnd.ms-excel',
  'text/plain', 'text/csv',
  'application/dicom', 'application/zip',
]);

// 50 MB default
const MAX_FILE_SIZE = parseInt(process.env.MAX_DOC_FILE_SIZE ?? '52428800', 10);

// ── Error types ───────────────────────────────────────────────────────────────
export class StorageSecurityError extends Error {
  readonly status: number;
  constructor(msg: string, status = 400) {
    super(msg);
    this.name = 'StorageSecurityError';
    this.status = status;
  }
}

export class FileNotFoundError extends Error {
  constructor() {
    super('Fichier introuvable');
    this.name = 'FileNotFoundError';
  }
}

// ── Initialisation ────────────────────────────────────────────────────────────
/**
 * Create all storage directories on startup (idempotent).
 * Called from index.ts before the server starts listening.
 */
export function initStorageDirs(): void {
  for (const dir of [DOCUMENTS_DIR, UPLOADS_DIR, PDF_DIR, BACKUP_DIR]) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
  }
  console.info(`[storage] Répertoires prêts sous ${STORAGE_ROOT}`);
}

// ── Path security ─────────────────────────────────────────────────────────────
/** UUID v4 pattern — the only accepted storage key format */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Resolve a UUID storage key to an absolute filesystem path.
 * Throws StorageSecurityError if the key is not a valid UUID or if the
 * resolved path escapes the expected directory (path-traversal guard).
 */
function resolveStoragePath(storageKey: string, dir: string): string {
  if (!UUID_RE.test(storageKey)) {
    throw new StorageSecurityError('Clé de stockage invalide');
  }
  const base    = path.resolve(dir);
  const resolved = path.resolve(base, storageKey);
  // Must start with `base/` (trailing sep prevents base == resolved being accepted for dir)
  if (!resolved.startsWith(base + path.sep)) {
    throw new StorageSecurityError('Tentative de traversée de répertoire détectée');
  }
  return resolved;
}

// ── Core service ──────────────────────────────────────────────────────────────
export interface StoredFile {
  storageKey: string; // UUID — persist this in the database as storage_key
  checksum:   string; // SHA-256 hex of the file content
  size:       number; // bytes
}

export class LocalStorageService {
  /**
   * Save a Buffer to disk under a UUID filename.
   * Validates MIME type and file size before writing.
   *
   * @param buffer   File content
   * @param mimeType Declared MIME type (validated against allowlist)
   * @param dir      Target directory (defaults to DOCUMENTS_DIR)
   * @returns StoredFile metadata including the UUID storage key
   */
  async saveFile(buffer: Buffer, mimeType: string, dir?: string): Promise<StoredFile> {
    const targetDir = dir ?? DOCUMENTS_DIR;

    if (!ALLOWED_MIMES.has(mimeType)) {
      throw new StorageSecurityError(`Type MIME non autorisé: ${mimeType}`);
    }
    if (buffer.length === 0) {
      throw new StorageSecurityError('Fichier vide');
    }
    if (buffer.length > MAX_FILE_SIZE) {
      throw new StorageSecurityError(
        `Fichier trop volumineux (max ${Math.round(MAX_FILE_SIZE / 1048576)} Mo)`,
      );
    }

    const storageKey = crypto.randomUUID();
    const filePath   = resolveStoragePath(storageKey, targetDir);
    const checksum   = crypto.createHash('sha256').update(buffer).digest('hex');

    await fs.promises.writeFile(filePath, buffer, { mode: 0o640 });

    return { storageKey, checksum, size: buffer.length };
  }

  /**
   * Save a PDF buffer (generated by pdfGenerator) without MIME restrictions.
   * Always stored in PDF_DIR.
   */
  async savePdf(buffer: Buffer): Promise<StoredFile> {
    const storageKey = crypto.randomUUID();
    const filePath   = resolveStoragePath(storageKey, PDF_DIR);
    const checksum   = crypto.createHash('sha256').update(buffer).digest('hex');
    await fs.promises.writeFile(filePath, buffer, { mode: 0o640 });
    return { storageKey, checksum, size: buffer.length };
  }

  /**
   * Open a read stream for a stored file.
   * Throws FileNotFoundError if the file does not exist.
   * Throws StorageSecurityError if the key format is invalid.
   */
  async streamFile(storageKey: string, dir?: string): Promise<{
    stream: fs.ReadStream;
    size:   number;
  }> {
    const targetDir = dir ?? DOCUMENTS_DIR;
    const filePath  = resolveStoragePath(storageKey, targetDir);
    try {
      const stat   = await fs.promises.stat(filePath);
      const stream = fs.createReadStream(filePath);
      return { stream, size: stat.size };
    } catch (err: any) {
      if (err?.code === 'ENOENT') throw new FileNotFoundError();
      throw err;
    }
  }

  /** Return true if a file with the given key exists in the target directory. */
  async fileExists(storageKey: string, dir?: string): Promise<boolean> {
    const targetDir = dir ?? DOCUMENTS_DIR;
    try {
      const filePath = resolveStoragePath(storageKey, targetDir);
      await fs.promises.access(filePath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a stored file. Silent no-op if the file is already gone.
   * Throws StorageSecurityError on invalid keys (prevents targeted deletes).
   */
  async deleteFile(storageKey: string, dir?: string): Promise<void> {
    const targetDir = dir ?? DOCUMENTS_DIR;
    try {
      const filePath = resolveStoragePath(storageKey, targetDir);
      await fs.promises.unlink(filePath);
    } catch (err: any) {
      if (err?.code !== 'ENOENT') throw err; // only ignore "not found"
    }
  }

  /** Return total used storage in bytes across all managed directories. */
  async getStorageUsageBytes(): Promise<number> {
    let total = 0;
    for (const dir of [DOCUMENTS_DIR, UPLOADS_DIR, PDF_DIR]) {
      try {
        for (const name of await fs.promises.readdir(dir)) {
          try {
            total += (await fs.promises.stat(path.join(dir, name))).size;
          } catch {}
        }
      } catch {}
    }
    return total;
  }
}

export const localStorageService = new LocalStorageService();
