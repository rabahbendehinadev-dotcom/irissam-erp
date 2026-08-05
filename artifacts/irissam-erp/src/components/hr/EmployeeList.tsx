/**
 * EmployeeList — searchable, filterable employee directory with stats header
 */
import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@/hooks/useQuery";
import { apiClient } from "@/lib/api-client";
import {
  Plus, Search, Filter, Download, Users, UserCheck, UserX,
  Timer, Plane, Clock, FileText, Eye, Edit2, Calendar,
  MoreVertical, ChevronDown, AlertTriangle
} from "lucide-react";
import { EmployeeWizard } from "./EmployeeWizard";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  actif:        { label: "Actif",         cls: "bg-green-100 text-green-700" },
  en_conge:     { label: "En congé",      cls: "bg-sky-100 text-sky-700" },
  absent:       { label: "Absent",        cls: "bg-red-100 text-red-700" },
  suspendu:     { label: "Suspendu",      cls: "bg-orange-100 text-orange-700" },
  detache:      { label: "Détaché",       cls: "bg-purple-100 text-purple-700" },
  en_formation: { label: "Formation",     cls: "bg-indigo-100 text-indigo-700" },
  en_arret:     { label: "Arrêt maladie", cls: "bg-amber-100 text-amber-700" },
  fin_contrat:  { label: "Fin contrat",   cls: "bg-gray-100 text-gray-600" },
  archive:      { label: "Archivé",       cls: "bg-gray-200 text-gray-500" },
};

const CONTRACT_BADGE: Record<string, string> = {
  CDI: "bg-blue-100 text-blue-700",
  CDD: "bg-amber-100 text-amber-700",
  vacataire: "bg-purple-100 text-purple-700",
  garde: "bg-green-100 text-green-700",
  stage: "bg-pink-100 text-pink-700",
  prestataire: "bg-orange-100 text-orange-700",
  convention: "bg-sky-100 text-sky-700",
};

const CATEGORY_LABEL: Record<string, string> = {
  medical: "Médical", paramedical: "Paramédical",
  administratif: "Administratif", technique: "Technique", support: "Support",
};

type Filters = { status: string; category: string; search: string };

export default function EmployeeList() {
  const [filters, setFilters] = useState<Filters>({ status: "", category: "", search: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [showWizard, setShowWizard] = useState(false);
  const limit = 25;

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(page * limit),
    ...(filters.search   && { q: filters.search }),
    ...(filters.status   && { status: filters.status }),
    ...(filters.category && { category: filters.category }),
  });

  const { data, loading, error, refetch } = useQuery<any>(`/hr/employees?${params}`);
  const employees = data?.data ?? [];
  const total     = data?.total ?? 0;
  const stats     = data?.stats ?? {};

  const statCards = [
    { label: "Total",         value: stats.total ?? 0,               icon: Users,     color: "text-blue-600",  bg: "bg-blue-50" },
    { label: "Présents",      value: stats.present ?? 0,             icon: UserCheck, color: "text-green-600", bg: "bg-green-50" },
    { label: "Absents",       value: stats.absent ?? 0,              icon: UserX,     color: "text-red-600",   bg: "bg-red-50" },
    { label: "Retards",       value: stats.late ?? 0,                icon: Timer,     color: "text-amber-600", bg: "bg-amber-50" },
    { label: "En congé",      value: stats.on_leave ?? 0,            icon: Plane,     color: "text-sky-600",   bg: "bg-sky-50" },
    { label: "En garde",      value: stats.on_shift ?? 0,            icon: Clock,     color: "text-indigo-600",bg: "bg-indigo-50" },
    { label: "Contrats exp.", value: stats.expiring_contracts ?? 0,  icon: FileText,  color: "text-orange-600",bg: "bg-orange-50" },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Employés</h1>
          <p className="text-sm text-gray-500">{total.toLocaleString("fr-FR")} employé{total > 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4"/>
            <span className="hidden sm:inline">Exporter</span>
          </button>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4"/>
            <span>Ajouter un employé</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {statCards.map((s, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm flex items-center gap-2">
            <div className={`w-7 h-7 ${s.bg} rounded-lg flex items-center justify-center shrink-0`}>
              <s.icon className={`w-3.5 h-3.5 ${s.color}`}/>
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-gray-900 leading-tight">{s.value}</p>
              <p className="text-[10px] text-gray-500 truncate">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
            <input
              value={filters.search}
              onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(0); }}
              placeholder="Nom, prénom, matricule…"
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-4 h-4"/>
            <span className="hidden sm:inline">Filtres</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`}/>
          </button>
        </div>
        {showFilters && (
          <div className="flex gap-3 flex-wrap pt-1">
            <select value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(0); }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Tous les statuts</option>
              {Object.entries(STATUS_BADGE).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={filters.category} onChange={e => { setFilters(f => ({ ...f, category: e.target.value })); setPage(0); }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Toutes catégories</option>
              {Object.entries(CATEGORY_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={() => { setFilters({ status: "", category: "", search: "" }); setPage(0); }}
              className="text-sm text-blue-600 hover:underline">Réinitialiser</button>
          </div>
        )}
      </div>

      {/* Table — desktop */}
      <div className="hidden sm:block bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Employé</th>
              <th className="px-4 py-3 text-left">Fonction / Dép.</th>
              <th className="px-4 py-3 text-left">Contact</th>
              <th className="px-4 py-3 text-center">Contrat</th>
              <th className="px-4 py-3 text-center">Statut</th>
              <th className="px-4 py-3 text-center">Présence</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded"/></td>)}
              </tr>
            ))}
            {!loading && employees.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Aucun employé trouvé</td></tr>
            )}
            {employees.map((emp: any) => {
              const st = STATUS_BADGE[emp.status] ?? { label: emp.status, cls: "bg-gray-100 text-gray-600" };
              return (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0 overflow-hidden">
                        {emp.photo_url ? <img src={emp.photo_url} alt="" className="w-full h-full object-cover"/> : `${emp.first_name?.[0]}${emp.last_name?.[0]}`}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{emp.last_name} {emp.first_name}</p>
                        <p className="text-[10px] text-gray-400">{emp.matricule}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700">{emp.position_name ?? "—"}</p>
                    <p className="text-xs text-gray-400">{emp.department_name ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    <p className="text-xs">{emp.phone_primary ?? "—"}</p>
                    <p className="text-xs">{emp.email_professional ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {emp.contract_type
                      ? <span className={`px-2 py-0.5 rounded text-xs font-medium ${CONTRACT_BADGE[emp.contract_type] ?? "bg-gray-100 text-gray-600"}`}>{emp.contract_type}</span>
                      : <span className="text-gray-400 text-xs">—</span>}
                    {emp.contract_end_date && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(emp.contract_end_date) < new Date(Date.now() + 30*86400000)
                          ? <span className="text-orange-600 flex items-center gap-0.5 justify-center"><AlertTriangle className="w-3 h-3"/>{new Date(emp.contract_end_date).toLocaleDateString("fr-FR")}</span>
                          : new Date(emp.contract_end_date).toLocaleDateString("fr-FR")}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {emp.today_status
                      ? <span className={`px-2 py-0.5 rounded text-xs ${STATUS_BADGE[emp.today_status]?.cls ?? "bg-gray-100 text-gray-500"}`}>
                          {STATUS_BADGE[emp.today_status]?.label ?? emp.today_status}
                        </span>
                      : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Link href={`/hr/employees/${emp.id}`}>
                        <span className="p-1.5 rounded hover:bg-blue-50 text-blue-600 transition-colors cursor-pointer" title="Voir">
                          <Eye className="w-3.5 h-3.5"/>
                        </span>
                      </Link>
                      <Link href={`/hr/employees/${emp.id}`}>
                        <span className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer" title="Modifier">
                          <Edit2 className="w-3.5 h-3.5"/>
                        </span>
                      </Link>
                      <Link href={`/hr/planning?employee_id=${emp.id}`}>
                        <span className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer" title="Planning">
                          <Calendar className="w-3.5 h-3.5"/>
                        </span>
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cards — mobile */}
      <div className="sm:hidden space-y-3">
        {loading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 animate-pulse">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0"/>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-100 rounded w-3/4"/>
                <div className="h-3 bg-gray-100 rounded w-1/2"/>
              </div>
            </div>
          </div>
        ))}
        {!loading && employees.map((emp: any) => {
          const st = STATUS_BADGE[emp.status] ?? { label: emp.status, cls: "bg-gray-100 text-gray-600" };
          return (
            <Link key={emp.id} href={`/hr/employees/${emp.id}`}>
              <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm active:bg-gray-50 cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 shrink-0 overflow-hidden">
                    {emp.photo_url ? <img src={emp.photo_url} alt="" className="w-full h-full object-cover"/> : `${emp.first_name?.[0]}${emp.last_name?.[0]}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900 truncate">{emp.last_name} {emp.first_name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-gray-500">{emp.matricule} · {emp.position_name ?? "—"}</p>
                    <p className="text-xs text-gray-400">{emp.department_name ?? "—"}</p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-500">{page*limit+1}–{Math.min((page+1)*limit, total)} / {total}</p>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p-1)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Précédent</button>
            <button disabled={(page+1)*limit >= total} onClick={() => setPage(p => p+1)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Suivant</button>
          </div>
        </div>
      )}

      {/* Wizard */}
      {showWizard && <EmployeeWizard onClose={() => setShowWizard(false)} onCreated={() => { setShowWizard(false); refetch(); }}/>}
    </div>
  );
}
