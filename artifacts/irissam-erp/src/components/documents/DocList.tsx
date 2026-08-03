import { useState } from "react";
import { LayoutGrid, LayoutList, Table2, FileText, Eye, Download, Star, MoreVertical, Clock, Archive, XCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DocStatusBadge, DocConfidentialityBadge, DocMimeIcon, formatFileSize } from "./DocStatusBadge";
import type { DocRecord } from "@/services/api/documents";

type ViewMode = "grid" | "list" | "table";

interface Props {
  documents: DocRecord[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onView: (id: string) => void;
  onRefresh: () => void;
}

const CATEGORY_EMOJI: Record<string, string> = {
  Patient: "🏥", Medical: "⚕️", Laboratoire: "🧪", Imagerie: "🩻",
  Pharmacie: "💊", Hospitalisation: "🛏️", Bloc_operatoire: "🔪",
  Facturation: "💰", Assurance: "🛡️", RH: "👥", Biomedical: "🔧",
  Stock: "📦", Qualite: "✅", Juridique: "⚖️", Administratif: "📋",
  Direction: "🎯", Autre: "📄",
};

function DocCard({ doc, onView }: { doc: DocRecord; onView: (id: string) => void }) {
  return (
    <div onClick={() => onView(doc.id)}
      className="bg-white border rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
          {CATEGORY_EMOJI[doc.category] ?? "📄"}
        </div>
        <DocStatusBadge status={doc.status} />
      </div>
      <h3 className="text-sm font-medium text-gray-800 line-clamp-2 mb-1">{doc.title}</h3>
      <p className="text-xs text-gray-400 mb-2 truncate">{doc.documentNumber}</p>
      <div className="flex items-center gap-2 mt-auto">
        <DocMimeIcon mimeType={doc.mimeType} />
        <span className="text-xs text-gray-400">{formatFileSize(doc.fileSize)}</span>
        <span className="text-xs text-gray-400 ml-auto">{new Date(doc.createdAt).toLocaleDateString("fr-FR")}</span>
      </div>
      {doc.isFavorite && <Star size={12} className="absolute top-3 right-3 text-yellow-400 fill-yellow-400" />}
    </div>
  );
}

function DocRow({ doc, onView }: { doc: DocRecord; onView: (id: string) => void }) {
  return (
    <tr onClick={() => onView(doc.id)} className="hover:bg-blue-50 cursor-pointer border-b last:border-0 text-sm">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base flex-shrink-0">{CATEGORY_EMOJI[doc.category] ?? "📄"}</span>
          <div className="min-w-0">
            <p className="font-medium text-gray-800 truncate max-w-[200px]">{doc.title}</p>
            <p className="text-xs text-gray-400">{doc.documentNumber}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 hidden sm:table-cell">
        <DocStatusBadge status={doc.status} />
      </td>
      <td className="px-3 py-3 hidden md:table-cell text-gray-600">{doc.category.replace("_", " ")}</td>
      <td className="px-3 py-3 hidden lg:table-cell">
        <DocConfidentialityBadge level={doc.confidentiality} />
      </td>
      <td className="px-3 py-3 hidden lg:table-cell text-gray-500 text-xs">v{doc.versionNumber}</td>
      <td className="px-3 py-3 hidden xl:table-cell text-gray-500 text-xs">{formatFileSize(doc.fileSize)}</td>
      <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">
        {new Date(doc.createdAt).toLocaleDateString("fr-FR")}
      </td>
      <td className="px-3 py-3 text-gray-500 text-xs hidden sm:table-cell truncate max-w-[120px]">
        {doc.createdByName}
      </td>
    </tr>
  );
}

export function DocList({ documents, total, loading, page, pageSize, onPageChange, onView, onRefresh }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white flex-shrink-0">
        <span className="text-sm text-gray-500">{total} document{total !== 1 ? "s" : ""}</span>
        <div className="flex gap-1">
          {([["list", LayoutList], ["grid", LayoutGrid], ["table", Table2]] as [ViewMode, any][]).map(([m, Icon]) => (
            <button key={m} onClick={() => setViewMode(m)}
              className={cn("p-1.5 rounded", viewMode === m ? "bg-blue-100 text-blue-700" : "text-gray-400 hover:text-gray-600")}>
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <FileText size={40} className="mb-2 opacity-50" />
            <p className="text-sm">Aucun document trouvé</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {documents.map(doc => <DocCard key={doc.id} doc={doc} onView={onView} />)}
          </div>
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Document</th>
                  <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">Statut</th>
                  <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Catégorie</th>
                  <th className="px-3 py-2 text-left font-medium hidden lg:table-cell">Conf.</th>
                  <th className="px-3 py-2 text-left font-medium hidden lg:table-cell">Version</th>
                  <th className="px-3 py-2 text-left font-medium hidden xl:table-cell">Taille</th>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">Créé par</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => <DocRow key={doc.id} doc={doc} onView={onView} />)}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="divide-y">
            {documents.map(doc => (
              <div key={doc.id} onClick={() => onView(doc.id)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 cursor-pointer group">
                <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
                  {CATEGORY_EMOJI[doc.category] ?? "📄"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800 truncate">{doc.title}</p>
                    {doc.isFavorite && <Star size={12} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />}
                    {doc.legalHold && <span className="text-[10px] bg-red-100 text-red-600 rounded px-1">Legal Hold</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{doc.documentNumber}</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{doc.folderPath ?? doc.category.replace("_", " ")}</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{formatFileSize(doc.fileSize)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <DocStatusBadge status={doc.status} />
                  <span className="text-xs text-gray-400 hidden sm:block">{new Date(doc.createdAt).toLocaleDateString("fr-FR")}</span>
                  <span className="text-xs text-gray-500 hidden md:block truncate max-w-[100px]">{doc.createdByName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 p-3 border-t bg-white flex-shrink-0">
          <button onClick={() => onPageChange(page - 1)} disabled={page === 0}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">←</button>
          <span className="text-sm text-gray-600">{page + 1} / {totalPages}</span>
          <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">→</button>
        </div>
      )}
    </div>
  );
}
