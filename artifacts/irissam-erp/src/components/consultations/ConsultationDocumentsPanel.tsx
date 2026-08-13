/**
 * Onglet Documents de l'espace consultation — 100 % PostgreSQL + stockage réel.
 *
 * Téléversement en deux temps (traçabilité) :
 *  1. POST /api/storage/upload (multipart, JWT, MIME whitelist, 50 Mo max)
 *     → storageKey ;
 *  2. POST /consultations/:id/attachments → ligne `attachments`
 *     (utilisateur + horodatage). Pas de suppression : les documents
 *     cliniques restent au dossier.
 * Téléchargement authentifié via GET /api/storage/objects/:key (Blob).
 */
import { useMemo, useRef, useState } from 'react';
import {
  Paperclip, Upload, RefreshCw, AlertTriangle, Loader2, Download,
  FileText, Image as ImageIcon, File as FileIcon,
} from 'lucide-react';
import { useQuery } from '@/hooks/useQuery';
import { apiClient } from '@/lib/api-client';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import type { Consultation, ConsultationAttachment } from '@/types/consultation';

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'result',         label: 'Résultat (labo / imagerie)' },
  { value: 'report',         label: 'Compte rendu / rapport' },
  { value: 'image',          label: 'Image médicale' },
  { value: 'prescription',   label: 'Ordonnance numérisée' },
  { value: 'identity',       label: "Pièce d'identité" },
  { value: 'administrative', label: 'Document administratif' },
  { value: 'other',          label: 'Autre' },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map(o => [o.value, o.label]),
);

function fmtSize(bytes?: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function MimeIcon({ mime }: { mime: string }) {
  if (mime.startsWith('image/')) return <ImageIcon size={16} className="text-purple-500" />;
  if (mime === 'application/pdf') return <FileText size={16} className="text-red-500" />;
  return <FileIcon size={16} className="text-gray-400" />;
}

export function ConsultationDocumentsPanel({
  consultation, readOnly, onLog,
}: {
  consultation: Consultation;
  readOnly: boolean;
  onLog?: (action: string) => void;
}) {
  const { can } = usePermission();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState('result');
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data, loading, error, refetch } = useQuery<ConsultationAttachment[]>(
    `/consultations/${consultation.id}/attachments`,
  );
  const attachments = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const canEdit = can('consultations.edit') && !readOnly;

  const handleFileChosen = async (file: File | null) => {
    if (!file || uploading) return;
    if (file.size > 50 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Fichier trop volumineux', description: 'Taille maximale : 50 Mo.' });
      return;
    }
    setUploading(true);
    try {
      // 1) Téléversement physique → storageKey
      const form = new FormData();
      form.append('file', file);
      const uploaded = await apiClient.postForm<{ storageKey: string }>('/storage/upload', form);

      // 2) Rattachement à la consultation (ligne attachments tracée)
      await apiClient.post(`/consultations/${consultation.id}/attachments`, {
        storageKey: uploaded.storageKey,
        fileName:   file.name.slice(0, 200),
        mimeType:   file.type || 'application/octet-stream',
        fileSize:   file.size,
        category,
      });

      toast({ title: 'Document ajouté', description: file.name });
      onLog?.(`Document ajouté — ${file.name}`);
      refetch();
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error
        ?? (err instanceof Error ? err.message : 'Téléversement impossible');
      toast({ variant: 'destructive', title: 'Document refusé', description: msg });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (att: ConsultationAttachment) => {
    if (downloadingId) return;
    setDownloadingId(att.id);
    try {
      const blob = await apiClient.getBlob(`/storage/objects/${att.storageKey}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onLog?.(`Document téléchargé — ${att.fileName}`);
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error
        ?? (err instanceof Error ? err.message : 'Téléchargement impossible');
      toast({ variant: 'destructive', title: 'Téléchargement impossible', description: msg });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold text-gray-800">Documents de la consultation</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Résultats d'examens, comptes rendus, images — conservés au dossier
            avec l'utilisateur et la date d'ajout (aucune suppression).
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => refetch()}
            title="Actualiser"
            className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={14} />
          </button>
          {canEdit && (
            <>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                disabled={uploading}
                className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Catégorie du document"
              >
                {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={e => void handleFileChosen(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? 'Téléversement…' : 'Ajouter un document'}
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
          <Loader2 size={16} className="animate-spin mr-2" /> Chargement des documents…
        </div>
      ) : error ? (
        <div className="text-center py-10">
          <AlertTriangle size={28} className="mx-auto mb-2 text-red-400" />
          <p className="text-sm text-gray-600 font-medium">Impossible de charger les documents</p>
          <button onClick={() => refetch()} className="mt-3 px-3.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Réessayer
          </button>
        </div>
      ) : attachments.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Paperclip size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium text-gray-500">Aucun document rattaché à cette consultation</p>
          {canEdit && (
            <p className="text-xs mt-1 opacity-70">Formats acceptés : PDF, images, documents — 50 Mo max.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {attachments.map(att => (
            <div key={att.id} className="border border-gray-200 rounded-xl p-3.5 bg-white">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <MimeIcon mime={att.mimeType} />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{att.title || att.fileName}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {CATEGORY_LABELS[att.category] ?? att.category} · {fmtSize(att.fileSize)}
                      {' · '}ajouté le {fmtDateTime(att.createdAt)}
                      {att.createdByName ? ` par ${att.createdByName}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => void handleDownload(att)}
                  disabled={downloadingId === att.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
                >
                  {downloadingId === att.id
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Download size={12} />}
                  Télécharger
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
