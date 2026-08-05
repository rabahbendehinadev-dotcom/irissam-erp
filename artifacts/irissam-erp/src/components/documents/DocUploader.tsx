import { useState, useRef } from "react";
import { Upload, X, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { uploadDocumentFile, docsApi, type DocFolder } from "@/services/api/documents";
import { DocConfidentialityBadge } from "./DocStatusBadge";

const ALLOWED_MIMES = [
  "application/pdf",
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/tiff",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword", "application/vnd.ms-excel",
  "text/plain", "text/csv",
];

const CATEGORIES = [
  "Patient","Medical","Laboratoire","Imagerie","Pharmacie","Hospitalisation",
  "Bloc_operatoire","Facturation","Assurance","RH","Biomedical","Stock",
  "Qualite","Juridique","Administratif","Direction","Autre"
];

interface Props {
  folders: DocFolder[];
  defaultFolderId?: string;
  defaultCategory?: string;
  entityType?: string;
  entityId?: string;
  patientId?: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function DocUploader({ folders, defaultFolderId, defaultCategory, entityType, entityId, patientId, onSuccess, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(defaultCategory ?? "Autre");
  const [folderId, setFolderId] = useState(defaultFolderId ?? "");
  const [confidentiality, setConfidentiality] = useState("staff");
  const [tags, setTags] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (f: File) => {
    if (!ALLOWED_MIMES.includes(f.type)) {
      setError(`Type de fichier non autorisé: ${f.type}`);
      return;
    }
    if (f.size > 52428800) {
      setError("Fichier trop volumineux (max 50 Mo)");
      return;
    }
    setFile(f);
    setError("");
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ""));
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!file) return setError("Sélectionnez un fichier");
    if (!title.trim()) return setError("Le titre est requis");

    setUploading(true);
    setError("");
    try {
      const { storageKey } = await uploadDocumentFile(file, setProgress);
      await docsApi.create({
        title: title.trim(),
        description: description || undefined,
        category,
        folderId: folderId || undefined,
        confidentiality,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        storageKey,
        entityType,
        entityId,
        patientId,
      } as any);
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? "Erreur lors du téléversement");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-800">Ajouter un document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e as any); }} className="p-4 space-y-4">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
              ${dragOver ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-400"}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop as any}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" className="hidden"
              accept={ALLOWED_MIMES.join(",")}
              onChange={e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFile(f); }} />
            {file ? (
              <div className="flex items-center gap-2 justify-center text-blue-700">
                <FileText size={20} />
                <span className="font-medium truncate max-w-[200px]">{file.name}</span>
                <span className="text-gray-400 text-sm">({(file.size / 1048576).toFixed(1)} Mo)</span>
              </div>
            ) : (
              <div className="text-gray-500">
                <Upload size={24} className="mx-auto mb-1 text-gray-400" />
                <p className="text-sm">Glissez un fichier ici ou cliquez pour parcourir</p>
                <p className="text-xs text-gray-400 mt-1">PDF, Images, DOCX, XLSX, TXT — max 50 Mo</p>
              </div>
            )}
          </div>

          {/* Progress */}
          {uploading && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Téléversement…</span><span>{progress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-lg p-3">
              <CheckCircle size={16} /><span className="text-sm">Document enregistré avec succès !</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-3">
              <AlertCircle size={16} /><span className="text-sm">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input type="text" value={title} onInput={e => setTitle((e.target as HTMLInputElement).value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Titre du document" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onInput={e => setDescription((e.target as HTMLTextAreaElement).value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2} placeholder="Description optionnelle" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
              <select value={category} onChange={e => setCategory((e.target as HTMLSelectElement).value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace("_"," ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confidentialité</label>
              <select value={confidentiality} onChange={e => setConfidentiality((e.target as HTMLSelectElement).value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="public_internal">Interne</option>
                <option value="staff">Personnel</option>
                <option value="confidential">Confidentiel</option>
                <option value="medical_confidential">Médical conf.</option>
                <option value="hr_confidential">RH conf.</option>
                <option value="finance_confidential">Finance conf.</option>
                <option value="direction_only">Direction seulement</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dossier</label>
            <select value={folderId} onChange={e => setFolderId((e.target as HTMLSelectElement).value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Sans dossier —</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.path}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (séparés par virgule)</label>
            <input type="text" value={tags} onInput={e => setTags((e.target as HTMLInputElement).value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="urgence, externe, signé…" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={uploading || success || !file}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <Upload size={16} />
              {uploading ? `${progress}%…` : "Téléverser"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
