import { useState, useEffect, useCallback } from "react";
import { Search, Upload, Plus, Bell, FolderPlus, LayoutDashboard, Archive, Trash2, Star, Share2, Clock, X, Filter, RefreshCw } from "lucide-react";
import { docsApi, type DocRecord, type DocFolder, type DocFilters } from "@/services/api/documents";
import { DocFolderTree } from "@/components/documents/DocFolderTree";
import { DocList } from "@/components/documents/DocList";
import { DocUploader } from "@/components/documents/DocUploader";
import { DocViewer } from "@/components/documents/DocViewer";
import { DocDashboard } from "@/components/documents/DocDashboard";
import { cn } from "@/lib/utils";

type Section = "all" | "dashboard" | "recent" | "favorites" | "shared" | "pending" | "expiring" | "archived" | "trash";

const SECTION_CONFIG: Record<Section, { label: string; icon: any; filters: Partial<DocFilters> }> = {
  all:       { label: "Tous les documents", icon: null,           filters: {} },
  dashboard: { label: "Tableau de bord",    icon: LayoutDashboard, filters: {} },
  recent:    { label: "Récents",             icon: Clock,          filters: { sort: "created_at", order: "desc", limit: 20 } },
  favorites: { label: "Favoris",             icon: Star,           filters: { favorite: true } },
  shared:    { label: "Partagés avec moi",   icon: Share2,         filters: {} },
  pending:   { label: "En attente d'approbation", icon: Clock,    filters: { status: "under_review" } },
  expiring:  { label: "Expirant bientôt",    icon: Clock,          filters: {} },
  archived:  { label: "Archivés",            icon: Archive,        filters: { status: "archived" } },
  trash:     { label: "Corbeille",           icon: Trash2,         filters: { status: "deleted_soft" } },
};

const CATEGORIES = [
  "Patient","Medical","Laboratoire","Imagerie","Pharmacie","Hospitalisation",
  "Bloc_operatoire","Facturation","Assurance","RH","Biomedical","Stock",
  "Qualite","Juridique","Administratif","Direction","Autre"
];

export default function Documents() {
  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [documents, setDocuments] = useState<DocRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const [selectedFolder, setSelectedFolder] = useState<string | undefined>(undefined);
  const [section, setSection] = useState<Section>("dashboard");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterConf, setFilterConf] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [showUploader, setShowUploader] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParent, setNewFolderParent] = useState<string | undefined>(undefined);
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  // Load folders
  const loadFolders = useCallback(() => {
    docsApi.getFolders().then(r => setFolders(r.folders ?? [])).catch(() => {});
  }, []);

  // Load documents
  const loadDocuments = useCallback(() => {
    if (section === "dashboard") return;
    setLoading(true);
    const sectionFilters = SECTION_CONFIG[section]?.filters ?? {};
    const filters: DocFilters = {
      ...sectionFilters,
      folderId: selectedFolder,
      search: search || undefined,
      category: filterCategory || undefined,
      status: filterStatus || sectionFilters.status,
      confidentiality: filterConf || undefined,
      limit: pageSize,
      offset: page * pageSize,
    };
    docsApi.list(filters)
      .then(r => { setDocuments(r.documents ?? []); setTotal(r.total ?? 0); })
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, [section, selectedFolder, search, filterCategory, filterStatus, filterConf, page]);

  useEffect(() => { loadFolders(); }, [loadFolders]);
  useEffect(() => { loadDocuments(); }, [loadDocuments]);
  useEffect(() => {
    docsApi.getNotifications().then(r => setNotifications(r.notifications ?? [])).catch(() => {});
  }, []);

  const handleFolderSelect = (id: string | undefined) => {
    setSelectedFolder(id);
    setSection("all");
    setPage(0);
  };

  const handleSectionChange = (s: Section) => {
    setSection(s);
    setSelectedFolder(undefined);
    setPage(0);
    setMobileNavOpen(false);
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await docsApi.createFolder({ name: newFolderName.trim(), parentId: newFolderParent });
      setShowNewFolder(false);
      setNewFolderName("");
      loadFolders();
    } catch {}
  };

  const unreadNotifs = notifications.filter(n => !n.is_read).length;

  const sidebarSections: Section[] = ["dashboard", "all", "recent", "favorites", "shared", "pending", "expiring", "archived", "trash"];

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden">
      {/* Mobile sidebar overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "flex-shrink-0 bg-white border-r flex flex-col transition-all duration-200",
        sidebarOpen ? "w-56" : "w-0 overflow-hidden",
        "fixed inset-y-0 left-0 z-40 lg:relative lg:translate-x-0",
        mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        sidebarOpen ? "lg:w-56" : "lg:w-0 lg:overflow-hidden"
      )}>
        <div className="p-3 border-b flex items-center justify-between flex-shrink-0">
          <span className="font-semibold text-gray-700 text-sm">GED</span>
          <button onClick={() => setSidebarOpen(false)} className="lg:flex hidden text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        {/* Quick sections */}
        <div className="p-2 flex-shrink-0">
          {sidebarSections.map(s => {
            const { label, icon: Icon } = SECTION_CONFIG[s];
            return (
              <button key={s} onClick={() => handleSectionChange(s)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors",
                  section === s ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100"
                )}>
                {Icon && <Icon size={14} className="flex-shrink-0" />}
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Folder tree */}
        <div className="flex-1 overflow-y-auto border-t">
          <DocFolderTree
            folders={folders}
            selectedId={selectedFolder}
            onSelect={handleFolderSelect}
            onNewFolder={(parentId) => { setNewFolderParent(parentId); setShowNewFolder(true); }}
          />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="bg-white border-b px-4 py-3 flex items-center gap-3 flex-shrink-0">
          {/* Menu / sidebar toggle */}
          <button onClick={() => { setSidebarOpen(v => !v); setMobileNavOpen(v => !v); }}
            className="text-gray-500 hover:text-gray-700">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          {/* Search */}
          <div className="flex-1 relative max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onInput={e => { setSearch((e.target as HTMLInputElement).value); setPage(0); }}
              placeholder="Rechercher un document…"
              className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            />
          </div>

          {/* Filter toggle */}
          <button onClick={() => setShowFilters(v => !v)}
            className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm border transition-colors",
              showFilters ? "bg-blue-50 border-blue-300 text-blue-700" : "text-gray-500 hover:bg-gray-50")}>
            <Filter size={14} />
            <span className="hidden sm:inline">Filtres</span>
          </button>

          <button onClick={loadDocuments} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-50">
            <RefreshCw size={15} />
          </button>

          {/* Notifications */}
          <div className="relative">
            <button onClick={() => setShowNotifs(v => !v)}
              className="relative text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-50">
              <Bell size={16} />
              {unreadNotifs > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                  {unreadNotifs > 9 ? "9+" : unreadNotifs}
                </span>
              )}
            </button>
            {showNotifs && (
              <div className="absolute right-0 top-9 w-80 bg-white border rounded-xl shadow-xl z-50">
                <div className="p-3 border-b font-medium text-sm text-gray-700 flex justify-between">
                  Notifications
                  <button onClick={() => setShowNotifs(false)}><X size={14} /></button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center p-4">Aucune notification</p>
                  ) : notifications.slice(0, 10).map(n => (
                    <div key={n.id} onClick={() => { docsApi.markNotificationRead(n.id); setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x)); }}
                      className={cn("p-3 border-b cursor-pointer hover:bg-gray-50", !n.is_read && "bg-blue-50")}>
                      <p className="text-sm font-medium text-gray-800">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{n.document_title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(n.created_at).toLocaleString("fr-FR")}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={() => setShowNewFolder(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg text-gray-600 hover:bg-gray-50">
              <FolderPlus size={15} />
              <span className="hidden sm:inline">Dossier</span>
            </button>
            <button onClick={() => setShowUploader(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              <Upload size={15} />
              <span>Ajouter</span>
            </button>
          </div>
        </div>

        {/* Filters bar */}
        {showFilters && (
          <div className="bg-white border-b px-4 py-2 flex flex-wrap items-center gap-3">
            <select value={filterCategory} onChange={e => { setFilterCategory((e.target as HTMLSelectElement).value); setPage(0); }}
              className="border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Toutes catégories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.replace("_"," ")}</option>)}
            </select>
            <select value={filterStatus} onChange={e => { setFilterStatus((e.target as HTMLSelectElement).value); setPage(0); }}
              className="border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Tous statuts</option>
              {["draft","uploaded","under_review","approved","rejected","signed","archived","expired"].map(s => (
                <option key={s} value={s}>{s.replace("_"," ")}</option>
              ))}
            </select>
            <select value={filterConf} onChange={e => { setFilterConf((e.target as HTMLSelectElement).value); setPage(0); }}
              className="border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Toutes confidentialités</option>
              {["public_internal","staff","confidential","medical_confidential","hr_confidential","finance_confidential","direction_only"].map(c => (
                <option key={c} value={c}>{c.replace("_"," ")}</option>
              ))}
            </select>
            {(filterCategory || filterStatus || filterConf) && (
              <button onClick={() => { setFilterCategory(""); setFilterStatus(""); setFilterConf(""); }}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                <X size={12} /> Effacer
              </button>
            )}
          </div>
        )}

        {/* Page title */}
        <div className="px-4 py-2.5 border-b bg-white flex items-center gap-2 flex-shrink-0">
          <h1 className="text-base font-semibold text-gray-800">
            {selectedFolder ? folders.find(f => f.id === selectedFolder)?.path : SECTION_CONFIG[section]?.label}
          </h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {section === "dashboard" ? (
            <DocDashboard onNavigate={f => { setSection("all"); Object.assign({}, f); }} />
          ) : (
            <DocList
              documents={documents}
              total={total}
              loading={loading}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onView={setViewingDocId}
              onRefresh={loadDocuments}
            />
          )}
        </div>
      </div>

      {/* New folder dialog */}
      {showNewFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowNewFolder(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold text-gray-800 mb-4">Nouveau dossier</h2>
            <input type="text" value={newFolderName} onInput={e => setNewFolderName((e.target as HTMLInputElement).value)}
              placeholder="Nom du dossier" autoFocus
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
            {newFolderParent && (
              <p className="text-xs text-gray-500 mb-3">
                Sous-dossier de : {folders.find(f => f.id === newFolderParent)?.path}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}
                className="flex-1 border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
              <button onClick={createFolder} disabled={!newFolderName.trim()}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload dialog */}
      {showUploader && (
        <DocUploader
          folders={folders}
          defaultFolderId={selectedFolder}
          onSuccess={loadDocuments}
          onClose={() => setShowUploader(false)}
        />
      )}

      {/* Document viewer */}
      <DocViewer
        documentId={viewingDocId}
        onClose={() => setViewingDocId(null)}
        onRefresh={loadDocuments}
      />
    </div>
  );
}
