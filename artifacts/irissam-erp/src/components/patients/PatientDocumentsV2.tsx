import { useState } from 'react';
import { Upload, Eye, Download, Trash2, FileText, Image, FileSpreadsheet, File, Plus } from 'lucide-react';
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
  preview?: string; // color for placeholder thumbnail
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  cni:          'Carte d\'identité',
  passeport:    'Passeport',
  assurance:    'Assurance',
  ordonnance:   'Ordonnance',
  compte_rendu: 'Compte rendu',
  scanner:      'Scanner',
  radiologie:   'Radiologie',
  analyse:      'Analyse',
  photo:        'Photo',
  autre:        'Autre document',
};

const DOC_TYPE_COLORS: Record<DocType, string> = {
  cni:          'bg-blue-100 text-blue-700',
  passeport:    'bg-indigo-100 text-indigo-700',
  assurance:    'bg-green-100 text-green-700',
  ordonnance:   'bg-purple-100 text-purple-700',
  compte_rendu: 'bg-orange-100 text-orange-700',
  scanner:      'bg-teal-100 text-teal-700',
  radiologie:   'bg-gray-200 text-gray-700',
  analyse:      'bg-yellow-100 text-yellow-700',
  photo:        'bg-pink-100 text-pink-700',
  autre:        'bg-gray-100 text-gray-500',
};

const THUMB_COLORS: Record<DocType, string> = {
  cni:          'bg-blue-50 border-blue-200',
  passeport:    'bg-indigo-50 border-indigo-200',
  assurance:    'bg-green-50 border-green-200',
  ordonnance:   'bg-purple-50 border-purple-200',
  compte_rendu: 'bg-orange-50 border-orange-200',
  scanner:      'bg-teal-50 border-teal-200',
  radiologie:   'bg-gray-900 border-gray-700',
  analyse:      'bg-yellow-50 border-yellow-200',
  photo:        'bg-pink-50 border-pink-200',
  autre:        'bg-gray-50 border-gray-200',
};

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet;
  if (mimeType.includes('pdf') || mimeType.includes('text')) return FileText;
  return File;
}

const MOCK_DOCS: PatientDocument[] = [
  { id: 'd-1', type: 'cni',          name: 'CNI_recto_verso.pdf',         uploadedAt: '2024-01-10T08:30:00', sizeKb: 420,  mimeType: 'application/pdf',  uploadedBy: 'Réception Amira' },
  { id: 'd-2', type: 'assurance',    name: 'Attestation_CNAS_2025.pdf',   uploadedAt: '2024-01-12T10:00:00', sizeKb: 215,  mimeType: 'application/pdf',  uploadedBy: 'Réception Amira' },
  { id: 'd-3', type: 'ordonnance',   name: 'Ordonnance_20260115.pdf',     uploadedAt: '2026-01-15T16:20:00', sizeKb: 88,   mimeType: 'application/pdf',  uploadedBy: 'Dr Karim Benamara' },
  { id: 'd-4', type: 'analyse',      name: 'NFS_CRP_résultats.pdf',       uploadedAt: '2026-07-25T11:08:00', sizeKb: 152,  mimeType: 'application/pdf',  uploadedBy: 'Lab. Bensouna' },
  { id: 'd-5', type: 'radiologie',   name: 'Radio_thorax_face.jpg',       uploadedAt: '2026-06-20T13:55:00', sizeKb: 1840, mimeType: 'image/jpeg',       uploadedBy: 'Imagerie Kadri' },
  { id: 'd-6', type: 'compte_rendu', name: 'CR_consultation_0801.pdf',    uploadedAt: '2026-08-01T09:14:00', sizeKb: 96,   mimeType: 'application/pdf',  uploadedBy: 'Dr Karim Benamara' },
];

function formatSize(kb: number) {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} Mo`;
  return `${kb} Ko`;
}

interface DocCardProps {
  doc: PatientDocument;
  onDelete: (id: string) => void;
}

function DocCard({ doc, onDelete }: DocCardProps) {
  const FileIcon = getFileIcon(doc.mimeType);
  const isImage = doc.mimeType.startsWith('image/');
  const isRadio = doc.type === 'radiologie';

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 hover:shadow-sm transition-all group">
      {/* Thumbnail */}
      <div className={`h-28 border-b flex items-center justify-center relative ${THUMB_COLORS[doc.type]}`}>
        {isImage ? (
          <div className="w-full h-full flex items-center justify-center">
            <Image size={32} className={isRadio ? 'text-gray-400' : 'text-gray-400'} />
          </div>
        ) : (
          <FileIcon size={36} className={isRadio ? 'text-gray-400' : 'text-gray-400 opacity-60'} />
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button
            onClick={() => alert('Prévisualisation disponible avec le backend')}
            className="w-8 h-8 bg-white rounded-full shadow flex items-center justify-center hover:bg-gray-50 text-gray-700"
            title="Prévisualiser"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={() => alert('Téléchargement disponible avec le backend')}
            className="w-8 h-8 bg-white rounded-full shadow flex items-center justify-center hover:bg-gray-50 text-gray-700"
            title="Télécharger"
          >
            <Download size={14} />
          </button>
          <button
            onClick={() => onDelete(doc.id)}
            className="w-8 h-8 bg-white rounded-full shadow flex items-center justify-center hover:bg-red-50 text-red-500"
            title="Supprimer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-medium text-gray-800 truncate" title={doc.name}>{doc.name}</p>
        <div className="flex items-center justify-between mt-1.5 gap-2">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${DOC_TYPE_COLORS[doc.type]}`}>
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

const ADD_DOC_TYPES: DocType[] = ['cni','passeport','assurance','ordonnance','compte_rendu','scanner','radiologie','analyse','photo','autre'];

interface Props {
  patientId: string;
}

export function PatientDocumentsV2({ patientId: _ }: Props) {
  const [docs, setDocs] = useState<PatientDocument[]>(MOCK_DOCS);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedType, setSelectedType] = useState<DocType>('autre');

  const handleDelete = (id: string) => {
    if (confirm('Supprimer ce document ?')) {
      setDocs(prev => prev.filter(d => d.id !== id));
    }
  };

  const handleAdd = () => {
    const newDoc: PatientDocument = {
      id: `d-${Date.now()}`,
      type: selectedType,
      name: `Nouveau_${DOC_TYPE_LABELS[selectedType]}.pdf`,
      uploadedAt: new Date().toISOString(),
      sizeKb: 0,
      mimeType: 'application/pdf',
      uploadedBy: 'Utilisateur courant',
    };
    setDocs(prev => [newDoc, ...prev]);
    setShowAdd(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">Documents du patient</h3>
          <p className="text-xs text-gray-500 mt-0.5">{docs.length} document{docs.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Upload size={14} />
          Ajouter document
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-blue-800">Type de document</p>
          <div className="flex flex-wrap gap-2">
            {ADD_DOC_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  selectedType === t
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >
                {DOC_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={14} /> Ajouter (Mock)
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
            >
              Annuler
            </button>
          </div>
          <p className="text-xs text-blue-600">L'upload réel sera disponible une fois le backend connecté.</p>
        </div>
      )}

      {/* Grid */}
      {docs.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Aucun document</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {docs.map(doc => (
            <DocCard key={doc.id} doc={doc} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
