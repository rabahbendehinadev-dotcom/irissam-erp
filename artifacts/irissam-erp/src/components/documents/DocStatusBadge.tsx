import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:         { label: "Brouillon",    cls: "bg-gray-100 text-gray-600" },
  uploaded:      { label: "Téléversé",   cls: "bg-blue-100 text-blue-700" },
  under_review:  { label: "En révision",  cls: "bg-yellow-100 text-yellow-700" },
  approved:      { label: "Approuvé",    cls: "bg-green-100 text-green-700" },
  rejected:      { label: "Rejeté",      cls: "bg-red-100 text-red-700" },
  signed:        { label: "Signé",       cls: "bg-purple-100 text-purple-700" },
  archived:      { label: "Archivé",     cls: "bg-gray-200 text-gray-500" },
  expired:       { label: "Expiré",      cls: "bg-orange-100 text-orange-700" },
  deleted_soft:  { label: "Supprimé",    cls: "bg-red-50 text-red-400" },
};

const CONF_CONFIG: Record<string, { label: string; cls: string }> = {
  public_internal:     { label: "Interne",     cls: "bg-green-50 text-green-600" },
  staff:               { label: "Personnel",   cls: "bg-blue-50 text-blue-600" },
  confidential:        { label: "Confidentiel",cls: "bg-orange-50 text-orange-600" },
  medical_confidential:{ label: "Médical conf",cls: "bg-purple-50 text-purple-600" },
  hr_confidential:     { label: "RH conf",     cls: "bg-yellow-50 text-yellow-600" },
  finance_confidential:{ label: "Finance conf",cls: "bg-amber-50 text-amber-600" },
  direction_only:      { label: "Direction",   cls: "bg-red-50 text-red-600" },
};

export function DocStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", cfg.cls)}>
      {cfg.label}
    </span>
  );
}

export function DocConfidentialityBadge({ level }: { level: string }) {
  const cfg = CONF_CONFIG[level] ?? { label: level, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", cfg.cls)}>
      {cfg.label}
    </span>
  );
}

export function DocMimeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === "application/pdf") return <span className="text-red-500 font-bold text-xs">PDF</span>;
  if (mimeType.startsWith("image/")) return <span className="text-blue-500 font-bold text-xs">IMG</span>;
  if (mimeType.includes("word")) return <span className="text-blue-700 font-bold text-xs">DOC</span>;
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return <span className="text-green-700 font-bold text-xs">XLS</span>;
  if (mimeType.startsWith("text/")) return <span className="text-gray-500 font-bold text-xs">TXT</span>;
  return <span className="text-gray-400 font-bold text-xs">FILE</span>;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} Mo`;
  return `${(bytes / 1073741824).toFixed(2)} Go`;
}
