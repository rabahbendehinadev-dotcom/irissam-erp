/**
 * Local Storage Routes
 *
 * POST /api/storage/upload        — authenticated multipart file upload
 * GET  /api/storage/objects/:uuid — permission-gated file download (stream)
 *
 * Security rules:
 *   - Every request requires a valid JWT (requireAuth middleware)
 *   - Storage keys are UUIDs — no user-supplied paths reach the filesystem
 *   - All downloads are streamed through the backend; real paths are never sent to clients
 *   - Medical files: Cache-Control: no-store
 */

import { Router, type Response, type NextFunction, type Request } from 'express';
import multer, { MulterError } from 'multer';
import type { AuthenticatedRequest } from '../middleware/requireAuth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  localStorageService,
  StorageSecurityError,
  FileNotFoundError,
  ALLOWED_MIMES,
} from '../lib/localStorageService.js';

const router = Router();

// ── Multer: memory storage, 50 MB limit, single field named "file" ────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 52_428_800 /* 50 MB */, files: 1 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Type MIME non autorisé: ${file.mimetype}`));
    }
  },
});

// ── POST /api/storage/upload ──────────────────────────────────────────────────
/**
 * Authenticated multipart upload.
 * Field name: "file"
 * Returns: { storageKey, checksum, size, objectPath }
 *
 * objectPath is the path to use for the GET /api/storage/objects/:uuid endpoint.
 */
// Error handler for multer validation failures (MIME type, file size, etc.)
function handleUploadError(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'Fichier trop volumineux (max 50 Mo)' });
    } else {
      res.status(400).json({ error: `Erreur upload: ${err.message}` });
    }
    return;
  }
  if (err instanceof Error && err.message.startsWith('Type MIME')) {
    res.status(400).json({ error: err.message });
    return;
  }
  next(err);
}

router.post(
  '/storage/upload',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err) => {
      if (err) return handleUploadError(err, req, res, next);
      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: 'Aucun fichier reçu (champ attendu: file)' });
      return;
    }
    try {
      const { storageKey, checksum, size } = await localStorageService.saveFile(
        req.file.buffer,
        req.file.mimetype,
      );
      res.status(201).json({
        storageKey,
        checksum,
        size,
        objectPath: `/api/storage/objects/${storageKey}`,
      });
    } catch (err) {
      if (err instanceof StorageSecurityError) {
        res.status(err.status).json({ error: err.message });
      } else {
        console.error('[storage/upload]', err);
        res.status(500).json({ error: "Erreur lors de l'enregistrement du fichier" });
      }
    }
  },
);

// ── GET /api/storage/objects/:uuid ────────────────────────────────────────────
/**
 * Stream a stored file to the authenticated client.
 * The real filesystem path is never sent to the client.
 * Content-Type is set from the optional ?mime= query param or falls back to
 * application/octet-stream (callers like records.ts set it from the DB row).
 */
router.get(
  '/storage/objects/:uuid',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { uuid } = req.params;
    // Optional caller-supplied content type (set by download/preview endpoints)
    const contentType = (req.query['mime'] as string) || 'application/octet-stream';
    const disposition = (req.query['disposition'] as string) || 'attachment';
    const filename    = (req.query['filename'] as string) || uuid;

    try {
      const { stream, size } = await localStorageService.streamFile(uuid);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', size);
      res.setHeader(
        'Content-Disposition',
        `${disposition}; filename="${encodeURIComponent(filename)}"`,
      );
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      stream.on('error', (err) => {
        console.error('[storage/objects] stream error', err);
        if (!res.headersSent) res.status(500).json({ error: 'Erreur de lecture' });
        res.destroy();
      });

      stream.pipe(res);
    } catch (err) {
      if (err instanceof FileNotFoundError) {
        res.status(404).json({ error: 'Fichier introuvable' });
      } else if (err instanceof StorageSecurityError) {
        res.status(400).json({ error: err.message });
      } else {
        console.error('[storage/objects]', err);
        res.status(500).json({ error: 'Erreur de téléchargement' });
      }
    }
  },
);

export default router;
