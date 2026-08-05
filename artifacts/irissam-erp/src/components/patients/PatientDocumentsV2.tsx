import { useState, useMemo, useEffect } from 'react';
import { Eye, Download, Trash2, FileText, Image, FileSpreadsheet,
  File, Search, X, Printer, ArrowUpDown, ExternalLink, AlertTriangle, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/format';

type DocType =
  | 'cni' | 'passeport' | 'assurance' | 'ordonnance'
  | 'compte_rendu' | 'scanner' | 'radiologie' | 'analyse'
  | 'photo' | 'autre';

interface PatientDocument {
  id: string;
  type: DocType;
  name: string;
  uploadedAt: string;
  sizeKb: number;
  mimeType: string;
  uploadedBy: string;
  version?: number;
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  cni: 'Carte d\'identité', passeport: 'Passeport', assurance: 'Assurance',
  ordonnance: 'Ordonnance', compte_rendu: 'Compte rendu', scanner: 'Scanner',
  radiologie: 'Radiologie', analyse: 'Analyse', photo: 'Photo', autre: 'Autre document',
};

const DOC_TYPE_COLORS: Record<DocType, string> = {
  cni: 'bg-blue-100 text-blue-700', passeport: 'bg-indigo-100 text-indigo-700',
  assurance: 'bg-green-100 text-green-700', ordonnance: 'bg-purple-100 text-purple-700',
  compte_rendu: 'bg-orange-100 text-orange-700', scanner: 'bg-teal-100 text-teal-700',
  radiologie: 'bg-gray-200 text-gray-700', analyse: 'bg-yellow-100 text-yellow-700',
  photo: 'bg-pink-100 text-pink-700', autre: 'bg-gray-100 text-gray-500',
};

const THUMB_COLORS: Record<DocType, string> = {
  cni: 'bg-blue-50 border-blue-200', passeport: 'bg-indigo-50 border-indigo-200',
  assurance: 'bg-green-50 border-green-200', ordonnance: 'bg-purple-50 border-purple-200',
  compte_rendu: 'bg-orange-50 border-orange-200', scanner: 'bg-teal-50 border-teal-200',
  radiologie: 'bg-gray-900 border-gray-700', analyse: 'bg-yellow-50 border-yellow-200',
  photo: 'bg-pink-50 border-pink-200', autre: 'bg-gray-50 border-gray-200',
};

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/'))                               return Image;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet;
  if (mimeType.includes('pdf') || mimeType.includes('text'))      return FileText;
  return File;
}

const VALID_DOC_TYPES = new Set<DocType>(['cni','passeport','assurance','ordonnance','compte_rendu','scanner','radiologie','analyse','photo','autre']);
function mapCategory(cat: string | null | undefined): DocType {
  return VALID_DOC_TYPES.has(cat as DocType) ? (cat as DocType) : 'autre';
}

function formatSize(kb: number) {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} Mo`;
  return `${kb} Ko`;
}

type FilterKey = 'all' | 'pdf' | 'images' | 'analyse' | 'ordonnance';

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: 'Tous' },
  { key: 'pdf',       label: 'PDF' },
  { key: 'images',    label: 'Images' },
  { key: 'analyse',   label: 'Analyses' },
  { key: 'ordonnance', label: 'Ordonnances' },
];

function applyDocFilter(docs: PatientDocument[], f: FilterKey): PatientDocument[] {
  if (f === 'all')       return docs;
  if (f === 'pdf')       return docs.filter(d => d.mimeType.includes('pdf'));
  if (f === 'images')    return docs.filter(d => d.mimeType.startsWith('image/'));
  if (f === 'analyse')   return docs.filter(d => d.type === 'analyse');
  if (f === 'ordonnance') return docs.filter(d => d.type === 'ordonnance');
  return docs;
}

// ─── Preview modal ────────────────────────────────────────────────────────────

function PreviewModal({ doc, onClose }: { doc: PatientDocument; onClose: () => void }) {
  const isImage = doc.mimeType.startsWith('image/');
  const Icon = getFileIcon(doc.mimeType);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg overflow-hidden max-h-[95dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Icon size={16} className="text-gray-500" />
            <span className="font-semibold text-gray-800 text-sm truncate max-w-xs">{doc.name}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={15} />
          </button>
        </div>

        {/* Preview area */}
        <div className={cn('h-64 flex flex-col items-center justify-center gap-3 border-b', THUMB_COLORS[doc.type])}>
          <Icon size={48} className={doc.type === 'radiologie' ? 'text-gray-300' : 'text-gray-300'} />
          <p className="text-sm text-gray-500 italic">
            {isImage ? 'Aperçu image' : 'Aperçu document'}
            {' — '}prévisualisation réelle disponible avec le backend
          </p>
        </div>

        {/* Metadata */}
        <div className="p-5 grid grid-cols-2 gap-3 text-xs">
          <div><p className="text-gray-400 uppercase tracking-wide mb-0.5">Type</p><p className="text-gray-800 font-medium">{DOC_TYPE_LABELS[doc.type]}</p></div>
          <div><p className="text-gray-400 uppercase tracking-wide mb-0.5">Taille</p><p className="text-gray-800 font-medium">{formatSize(doc.sizeKb)}</p></div>
          <div><p className="text-gray-400 uppercase tracking-wide mb-0.5">Ajouté le</p><p className="text-gray-800 font-medium">{formatDate(doc.uploadedAt)}</p></div>
          <div><p className="text-gray-400 uppercase tracking-wide mb-0.5">Par</p><p className="text-gray-800 font-medium">{doc.uploadedBy}</p></div>
          {doc.version && <div><p className="text-gray-400 uppercase tracking-wide mb-0.5">Version</p><p className="text-gray-800 font-medium">v{doc.version}</p></div>}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-4">
          <button onClick={() => alert('Téléchargement disponible avec le backend')}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Download size={13} /> Télécharger
          </button>
          <button onClick={() => alert('Impression disponible avec le backend')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
            <Printer size={13} /> Imprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Doc card ─────────────────────────────────────────────────────────────────

function DocCard({ doc, onDelete, onPreview }: { doc: PatientDocument; onDelete: (id: string) => void; onPreview: (doc: PatientDocument) => void }) {
  const FileIcon = getFileIcon(doc.mimeType);
  const isRadio = doc.type === 'radiologie';

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 hover:shadow-sm transition-all group">
      {/* Thumbnail */}
      <div className={cn('h-28 border-b flex items-center justify-center relative', THUMB_COLORS[doc.type])}>
        <FileIcon size={36} className={isRadio ? 'text-gray-400' : 'text-gray-400 opacity-60'} />
        {doc.version && doc.version > 1 && (
          <span className="absolute top-2 right-2 text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-bold">
            v{doc.version}
          </span>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/8 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button onClick={() => onPreview(doc)} className="w-8 h-8 bg-white rounded-full shadow flex items-center justify-center hover:bg-gray-50 text-gray-700" title="Prévisualiser">
            <Eye size={14} />
          </button>
          <button onClick={() => alert('Téléchargement disponible avec le backend')} className="w-8 h-8 bg-white rounded-full shadow flex items-center justify-center hover:bg-gray-50 text-gray-700" title="Télécharger">
            <Download size={14} />
          </button>
          <button onClick={() => onDelete(doc.id)} className="w-8 h-8 bg-white rounded-full shadow flex items-center justify-center hover:bg-red-50 text-red-500" title="Supprimer">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-medium text-gray-800 truncate" title={doc.name}>{doc.name}</p>
        <div className="flex items-center justify-between mt-1.5 gap-2">
          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', DOC_TYPE_COLORS[doc.type])}>
            {DOC_TYPE_LABELS[doc.type]}
          </span>
          <span className="text-xs text-gray-400">{formatSize(doc.sizeKb)}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">{formatDate(doc.uploadedAt)}</p>
        <p className="text-xs text-gray-500 truncate">{doc.uploadedBy}</p>
      </div>
    </div>
  );
}


interface Props { patientId: string; }

export function PatientDocumentsV2({ patientId }: Props) {
  const [docs,        setDocs]        = useState<PatientDocument[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [apiError,    setApiError]    = useState(false);
  const [search,      setSearch]      = useState('');
  const [filter,      setFilter]      = useState<FilterKey>('all');
  const [sortAsc,     setSortAsc]     = useState(false);
  const [previewDoc,  setPreviewDoc]  = useState<PatientDocument | null>(null);

  const fetchDocs = () => {
    if (!patientId) return;
    setIsLoading(true);
    setApiError(false);
    apiClient
      .get<{ documents: Record<string, unknown>[] }>(`/documents/records?patientId=${encodeURIComponent(patientId)}&limit=100`)
      .then(res => {
        const list = Array.isArray(res?.documents) ? res.documents : [];
        setDocs(list.map(r => ({
          id:         String(r.id ?? ''),
          type:       mapCategory(r.category as string),
          name:       String(r.title ?? r.document_number ?? 'Document'),
          uploadedAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
          sizeKb:     Math.round((Number(r.file_size ?? 0)) / 1024),
          mimeType:   String(r.mime_type ?? r.mimeType ?? 'application/pdf'),
          uploadedBy: String(r.created_by_name ?? r.createdByName ?? ''),
          version:    Number(r.version ?? 1),
        })));
        setIsLoading(false);
      })
      .catch(() => { setApiError(true); setIsLoading(false); });
  };

  useEffect(() => { fetchDocs(); }, [patientId]);

  const handleDelete = (id: string) => {
    if (confirm('Supprimer ce document ?')) setDocs(prev => prev.filter(d => d.id !== id));
  };

  const filtered = useMemo(() => {
    let result = applyDocFilter(docs, filter);
    if (search) result = result.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || DOC_TYPE_LABELS[d.type].toLowerCase().includes(search.toLowerCase()));
    result = [...result].sort((a, b) => {
      const diff = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      return sortAsc ? diff : -diff;
    });
    return result;
  }, [docs, filter, search, sortAsc]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-gray-800">Documents du patient</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {isLoading ? 'Chargement…' : `${docs.length} document${docs.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <a href="/documents" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <ExternalLink size={13} /> Gérer les documents (GED)
        </a>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher un document…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg self-start">
          {FILTER_TABS.map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={cn('text-xs px-2.5 py-1 rounded-md font-medium transition-colors',
                filter === tab.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {tab.label}
            </button>
          ))}
        </div>

        <button onClick={() => setSortAsc(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 self-start transition-colors whitespace-nowrap"
          title="Inverser l'ordre">
          <ArrowUpDown size={12} />
          {sortAsc ? 'Plus ancien en premier' : 'Plus récent en premier'}
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
          <RefreshCw size={16} className="animate-spin" />
          <span className="text-sm">Chargement des documents…</span>
        </div>
      )}

      {/* Error */}
      {apiError && !isLoading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <AlertTriangle size={36} className="text-amber-400" />
          <p className="text-sm font-medium text-gray-700">Impossible de charger les documents</p>
          <button onClick={fetchDocs}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
            Réessayer
          </button>
        </div>
      )}

      {/* Grid */}
      {!isLoading && !apiError && (filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Aucun document{search ? ' pour cette recherche' : ''}</p>
          <p className="text-xs mt-1">Utilisez le module GED pour ajouter des documents à ce patient.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map(doc => (
            <DocCard key={doc.id} doc={doc} onDelete={handleDelete} onPreview={setPreviewDoc} />
          ))}
        </div>
      ))}

      {/* Preview modal */}
      {previewDoc && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}
