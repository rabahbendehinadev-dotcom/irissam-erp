import { useState } from "react";
import { FolderOpen, Folder, ChevronRight, ChevronDown, Plus, Lock, Building2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocFolder } from "@/services/api/documents";

interface Props {
  folders: DocFolder[];
  selectedId?: string;
  onSelect: (folderId: string | undefined) => void;
  onNewFolder?: (parentId?: string) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  Patient: "🏥", Medical: "⚕️", Laboratoire: "🧪", Imagerie: "🩻",
  Pharmacie: "💊", Hospitalisation: "🛏️", Bloc_operatoire: "🔪",
  Facturation: "💰", Assurance: "🛡️", RH: "👥", Biomedical: "🔧",
  Stock: "📦", Qualite: "✅", Juridique: "⚖️", Administratif: "📋",
  Direction: "🎯", Autre: "📄",
};

const CONFIDENTIALITY_BADGE: Record<string, { label: string; cls: string }> = {
  direction_only: { label: "Direction", cls: "bg-red-100 text-red-700" },
  hr_confidential: { label: "RH", cls: "bg-orange-100 text-orange-700" },
  finance_confidential: { label: "Finance", cls: "bg-yellow-100 text-yellow-700" },
  medical_confidential: { label: "Médical", cls: "bg-purple-100 text-purple-700" },
  confidential: { label: "Conf.", cls: "bg-gray-100 text-gray-600" },
};

function FolderNode({
  folder, allFolders, level, selectedId, onSelect, onNewFolder, expanded, onToggle
}: {
  folder: DocFolder;
  allFolders: DocFolder[];
  level: number;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  onNewFolder?: (parentId?: string) => void;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const children = allFolders.filter(f => f.parentId === folder.id);
  const hasChildren = children.length > 0 || folder.childrenCount > 0;
  const isExpanded = expanded.has(folder.id);
  const isSelected = selectedId === folder.id;
  const badge = CONFIDENTIALITY_BADGE[folder.confidentiality];

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 py-1 px-2 rounded cursor-pointer hover:bg-blue-50 text-sm transition-colors",
          isSelected && "bg-blue-100 text-blue-800 font-medium"
        )}
        style={{ paddingLeft: `${8 + level * 16}px` }}
      >
        <button
          onClick={() => hasChildren && onToggle(folder.id)}
          className="w-4 h-4 flex items-center justify-center text-gray-400 flex-shrink-0"
        >
          {hasChildren ? (isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null}
        </button>
        <button
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
          onClick={() => onSelect(isSelected ? undefined : folder.id)}
        >
          <span className="text-sm flex-shrink-0">{CATEGORY_ICONS[folder.category ?? "Autre"] ?? "📁"}</span>
          <span className="truncate">{folder.name}</span>
          {folder.documentCount > 0 && (
            <span className="ml-auto text-xs text-gray-400 flex-shrink-0">{folder.documentCount}</span>
          )}
        </button>
        {badge && (
          <span className={cn("text-[10px] px-1 py-0.5 rounded flex-shrink-0 hidden group-hover:inline", badge.cls)}>
            {badge.label}
          </span>
        )}
        {onNewFolder && !folder.isSystem && (
          <button
            onClick={(e) => { e.stopPropagation(); onNewFolder(folder.id); }}
            className="hidden group-hover:flex text-gray-400 hover:text-blue-600 ml-1"
          >
            <Plus size={12} />
          </button>
        )}
      </div>
      {isExpanded && children.map(child => (
        <FolderNode key={child.id} folder={child} allFolders={allFolders}
          level={level + 1} selectedId={selectedId} onSelect={onSelect}
          onNewFolder={onNewFolder} expanded={expanded} onToggle={onToggle} />
      ))}
    </div>
  );
}

export function DocFolderTree({ folders, selectedId, onSelect, onNewFolder }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const rootFolders = folders.filter(f => !f.parentId);

  return (
    <div className="py-2">
      {/* All documents */}
      <button
        onClick={() => onSelect(undefined)}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-blue-50 transition-colors",
          !selectedId && "bg-blue-100 text-blue-800 font-medium"
        )}
      >
        <FileText size={14} className="text-gray-500" />
        <span>Tous les documents</span>
      </button>

      <div className="mt-2 border-t pt-2">
        <div className="px-2 pb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Dossiers</span>
          {onNewFolder && (
            <button onClick={() => onNewFolder()} className="text-gray-400 hover:text-blue-600">
              <Plus size={12} />
            </button>
          )}
        </div>
        {rootFolders.map(f => (
          <FolderNode key={f.id} folder={f} allFolders={folders} level={0}
            selectedId={selectedId} onSelect={onSelect} onNewFolder={onNewFolder}
            expanded={expanded} onToggle={toggle} />
        ))}
      </div>
    </div>
  );
}
