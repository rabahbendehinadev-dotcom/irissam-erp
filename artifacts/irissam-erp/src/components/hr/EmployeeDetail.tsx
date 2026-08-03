/**
 * EmployeeDetail — full employee dossier with 15 tabs
 */
import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@/hooks/useQuery";
import { apiClient } from "@/lib/api-client";
import { ScrollableTabBar } from "@/components/ui/ScrollableTabBar";
import {
  ArrowLeft, User, MapPin, FileText, Calendar, Clock, Timer,
  AlertCircle, Plane, TrendingUp, FolderOpen, CreditCard,
  MessageSquare, History, Shield, Edit2, Check, X
} from "lucide-react";

const TABS = [
  { label: "Vue générale",  icon: User },
  { label: "Identité",      icon: User },
  { label: "Affectation",   icon: MapPin },
  { label: "Contrat",       icon: FileText },
  { label: "Planning",      icon: Calendar },
  { label: "Présence",      icon: Clock },
  { label: "Retards",       icon: Timer },
  { label: "Absences",      icon: AlertCircle },
  { label: "Congés",        icon: Plane },
  { label: "Heures Sup.",   icon: TrendingUp },
  { label: "Documents",     icon: FolderOpen },
  { label: "Badge",         icon: CreditCard },
  { label: "Notes",         icon: MessageSquare },
  { label: "Historique",    icon: History },
  { label: "Audit",         icon: Shield },
];

const STATUS_BADGE: Record<string, string> = {
  actif: "bg-green-100 text-green-700",
  en_conge: "bg-sky-100 text-sky-700",
  absent: "bg-red-100 text-red-700",
  suspendu: "bg-orange-100 text-orange-700",
  archive: "bg-gray-200 text-gray-500",
};

export default function EmployeeDetail() {
  const [, params] = useRoute("/hr/employees/:id");
  const id = params?.id ?? "";
  const [tab, setTab] = useState(0);

  const { data, loading, error, refetch } = useQuery<any>(`/hr/employees/${id}`);
  const { data: attendanceData } = useQuery<any[]>(`/hr/employees/${id}/attendance?limit=10`);
  const { data: leavesData } = useQuery<any>(`/hr/employees/${id}/leaves`);
  const { data: docsData } = useQuery<any[]>(`/hr/employees/${id}/documents`);
  const { data: notesData, refetch: refetchNotes } = useQuery<any[]>(`/hr/employees/${id}/notes`);
  const { data: auditData } = useQuery<any[]>(`/hr/employees/${id}/audit`);

  if (loading) return <div className="p-6 animate-pulse space-y-4"><div className="h-24 bg-gray-100 rounded-xl"/><div className="h-64 bg-gray-100 rounded-xl"/></div>;
  if (error || !data) return <div className="p-6 text-center text-red-500"><AlertCircle className="w-8 h-8 mx-auto mb-2"/><p>Employé non trouvé</p></div>;

  const emp = data.employee ?? {};
  const profile = data.profile ?? {};
  const contacts = data.contacts ?? {};
  const emergency = data.emergency_contacts ?? [];
  const contracts = data.contracts ?? [];
  const balances = data.leave_balances ?? [];
  const st = STATUS_BADGE[emp.status] ?? "bg-gray-100 text-gray-500";

  return (
    <div className="pb-8">
      {/* Back + Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 sm:px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href="/hr/employees">
            <span className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer"><ArrowLeft className="w-5 h-5 text-gray-600"/></span>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 truncate">{emp.last_name} {emp.first_name}</h1>
            <p className="text-xs text-gray-500">{emp.matricule} · {profile.position_name ?? "—"}</p>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${st}`}>{emp.status}</span>
        </div>
      </div>

      {/* Profile Header */}
      <div className="mx-4 sm:mx-6 mt-4 bg-gradient-to-r from-[#1B2A4A] to-[#0e3460] rounded-2xl p-5 text-white">
        <div className="flex gap-4 items-start">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold shrink-0 overflow-hidden">
            {emp.photo_url ? <img src={emp.photo_url} alt="" className="w-full h-full object-cover"/> : `${emp.first_name?.[0]}${emp.last_name?.[0]}`}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold">{emp.last_name} {emp.first_name}</h2>
            <p className="text-white/70 text-sm">{profile.position_name ?? "—"}</p>
            <p className="text-white/50 text-xs">{profile.department_name ?? "—"} · {profile.site_id ?? "—"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: "Matricule",      value: emp.matricule },
            { label: "Embauché le",    value: emp.hire_date ? new Date(emp.hire_date).toLocaleDateString("fr-FR") : "—" },
            { label: "Contrat actif",  value: contracts.find((c: any) => c.status === "actif")?.type ?? "—" },
            { label: "Solde congés",   value: `${balances.find((b: any) => b.leave_type === "annuel" && b.year === new Date().getFullYear())?.remaining_days ?? 0} j` },
          ].map(f => (
            <div key={f.label} className="bg-white/10 rounded-lg px-3 py-2">
              <p className="text-[10px] text-white/50 uppercase">{f.label}</p>
              <p className="text-sm font-semibold">{f.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4">
        <ScrollableTabBar
          tabs={TABS.map((t, i) => ({ id: `ed-${i}`, label: t.label, icon: t.icon }))}
          activeTab={`ed-${tab}`}
          onTabChange={(id: string) => { const i = parseInt(id.replace("ed-",""),10); if (!isNaN(i)) setTab(i); }}
        />
      </div>

      {/* Tab Content */}
      <div className="px-4 sm:px-6 mt-4">

        {/* Tab 0 — Vue générale */}
        {tab === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoCard title="Informations personnelles" items={[
              { label: "Nom complet", value: `${emp.last_name} ${emp.first_name}` },
              { label: "Genre", value: emp.gender ?? "—" },
              { label: "Date naissance", value: emp.date_of_birth ? new Date(emp.date_of_birth).toLocaleDateString("fr-FR") : "—" },
              { label: "Nationalité", value: emp.nationality ?? "—" },
            ]}/>
            <InfoCard title="Affectation" items={[
              { label: "Département", value: profile.department_name ?? "—" },
              { label: "Poste", value: profile.position_name ?? "—" },
              { label: "Site", value: profile.site_id ?? "—" },
              { label: "Manager", value: profile.manager_name ?? "—" },
            ]}/>
            <InfoCard title="Contact" items={[
              { label: "Téléphone", value: contacts.phone_primary ?? "—" },
              { label: "Email pro", value: contacts.email_professional ?? "—" },
              { label: "Adresse", value: contacts.address ?? "—" },
            ]}/>
            {emergency[0] && (
              <InfoCard title="Contact d'urgence" items={[
                { label: "Nom", value: emergency[0].name },
                { label: "Relation", value: emergency[0].relation ?? "—" },
                { label: "Téléphone", value: emergency[0].phone ?? "—" },
              ]}/>
            )}
          </div>
        )}

        {/* Tab 1 — Identité */}
        {tab === 1 && (
          <InfoCard title="Identité complète" items={[
            { label: "Nom", value: emp.last_name ?? "—" },
            { label: "Prénom", value: emp.first_name ?? "—" },
            { label: "Genre", value: emp.gender ?? "—" },
            { label: "Date de naissance", value: emp.date_of_birth ? new Date(emp.date_of_birth).toLocaleDateString("fr-FR") : "—" },
            { label: "Lieu de naissance", value: emp.place_of_birth ?? "—" },
            { label: "Nationalité", value: emp.nationality ?? "—" },
            { label: "Situation familiale", value: emp.marital_status ?? "—" },
            { label: "N° pièce d'identité", value: emp.id_document_number ?? "—" },
            { label: "N° sécurité sociale", value: emp.social_security_number ?? "—" },
            { label: "N° ordre professionnel", value: emp.professional_order_number ?? "—" },
          ]}/>
        )}

        {/* Tab 2 — Affectation */}
        {tab === 2 && (
          <InfoCard title="Affectation" items={[
            { label: "Département", value: profile.department_name ?? "—" },
            { label: "Poste / Fonction", value: profile.position_name ?? "—" },
            { label: "Site", value: profile.site_id ?? "—" },
            { label: "Bâtiment", value: profile.building ?? "—" },
            { label: "Étage", value: profile.floor ?? "—" },
            { label: "Service", value: profile.service ?? "—" },
            { label: "Équipe", value: profile.team ?? "—" },
            { label: "Manager", value: profile.manager_name ?? "—" },
            { label: "Catégorie", value: emp.category ?? "—" },
          ]}/>
        )}

        {/* Tab 3 — Contrat */}
        {tab === 3 && (
          <div className="space-y-3">
            {contracts.length === 0 && <p className="text-sm text-gray-400">Aucun contrat</p>}
            {contracts.map((c: any) => (
              <div key={c.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-800">{c.contract_number}</p>
                    <p className="text-sm text-gray-500">{c.type?.toUpperCase()} · {c.is_full_time ? "Temps plein" : "Temps partiel"}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.status === "actif" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{c.status}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <span>Début: {c.start_date ? new Date(c.start_date).toLocaleDateString("fr-FR") : "—"}</span>
                  <span>Fin: {c.end_date ? new Date(c.end_date).toLocaleDateString("fr-FR") : "CDI"}</span>
                  <span>{c.weekly_hours}h/semaine</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 5 — Présence */}
        {tab === 5 && (
          <div className="space-y-3">
            {Array.isArray(attendanceData) && attendanceData.length === 0 && <p className="text-sm text-gray-400">Aucun enregistrement</p>}
            {Array.isArray(attendanceData) && attendanceData.map((a: any) => (
              <div key={a.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm flex items-center gap-3 text-sm">
                <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-gray-400"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800">{new Date(a.record_date).toLocaleDateString("fr-FR", { weekday:"short", day:"numeric", month:"short" })}</p>
                  <p className="text-xs text-gray-400">
                    {a.check_in ? `Entrée ${new Date(a.check_in).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}` : "Pas de pointage"}
                    {a.check_out ? ` · Sortie ${new Date(a.check_out).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}` : ""}
                    {a.total_worked_minutes ? ` · ${Math.floor(a.total_worked_minutes/60)}h${a.total_worked_minutes%60 > 0 ? (a.total_worked_minutes%60)+"min" : ""}` : ""}
                  </p>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${a.status === "present" ? "bg-green-100 text-green-700" : a.status === "retard" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>{a.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tab 8 — Congés */}
        {tab === 8 && (
          <div className="space-y-4">
            {/* Balances */}
            <div>
              <h3 className="font-semibold text-sm text-gray-700 mb-2">Soldes {new Date().getFullYear()}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {balances.filter((b: any) => b.year === new Date().getFullYear()).map((b: any) => (
                  <div key={`${b.leave_type}-${b.year}`} className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <p className="text-xs text-blue-600 font-medium">{b.leave_type}</p>
                    <p className="text-xl font-bold text-blue-800">{parseFloat(b.remaining_days ?? 0).toFixed(1)}</p>
                    <p className="text-[10px] text-blue-500">restants / {b.total_days} total</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Requests */}
            <div>
              <h3 className="font-semibold text-sm text-gray-700 mb-2">Demandes de congé</h3>
              {(leavesData?.requests ?? []).length === 0 && <p className="text-sm text-gray-400">Aucune demande</p>}
              {(leavesData?.requests ?? []).map((lr: any) => (
                <div key={lr.id} className="bg-white border border-gray-100 rounded-xl p-3 mb-2 flex items-center gap-3 text-sm shadow-sm">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{lr.leave_type} · {lr.number_of_days}j</p>
                    <p className="text-xs text-gray-400">{new Date(lr.date_from).toLocaleDateString("fr-FR")} → {new Date(lr.date_to).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${lr.status === "approuvee" ? "bg-green-100 text-green-700" : lr.status === "rejetee" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{lr.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 10 — Documents */}
        {tab === 10 && (
          <div className="space-y-3">
            {Array.isArray(docsData) && docsData.length === 0 && <p className="text-sm text-gray-400">Aucun document</p>}
            {Array.isArray(docsData) && docsData.map((doc: any) => (
              <div key={doc.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3 shadow-sm">
                <FolderOpen className="w-5 h-5 text-blue-400 shrink-0"/>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{doc.title}</p>
                  <p className="text-xs text-gray-400">{doc.doc_type} · {new Date(doc.created_at).toLocaleDateString("fr-FR")}</p>
                  {doc.expiry_date && (
                    <p className={`text-xs ${new Date(doc.expiry_date) < new Date() ? "text-red-600" : "text-amber-600"}`}>
                      Expire: {new Date(doc.expiry_date).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                </div>
                {doc.file_url && (
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                    Voir
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tab 12 — Notes */}
        {tab === 12 && <NotesTab employeeId={id} notes={notesData ?? []} onAdded={refetchNotes}/>}

        {/* Tab 14 — Audit */}
        {tab === 14 && (
          <div className="space-y-2">
            {Array.isArray(auditData) && auditData.map((ev: any) => (
              <div key={ev.id} className="bg-white border border-gray-100 rounded-xl p-3 text-sm flex items-start gap-3 shadow-sm">
                <Shield className="w-4 h-4 text-gray-400 shrink-0 mt-0.5"/>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{ev.action}</p>
                  <p className="text-xs text-gray-400">{ev.actor_name} · {new Date(ev.created_at).toLocaleString("fr-FR")}</p>
                  {ev.new_values && <p className="text-xs text-gray-500 mt-1 break-all">{JSON.stringify(ev.new_values)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs with no data yet — graceful empty states */}
        {[4,6,7,9,11,13].includes(tab) && (() => {
          const TabIcon = TABS[tab].icon;
          return (
            <div className="text-center py-12 text-gray-400">
              <TabIcon className="w-10 h-10 mx-auto mb-3 opacity-30"/>
              <p className="font-medium">{TABS[tab].label}</p>
              <p className="text-sm mt-1">Données disponibles après enregistrement de l'employé</p>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function InfoCard({ title, items }: { title: string; items: { label: string; value: string }[] }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <h3 className="font-semibold text-sm text-gray-700 mb-3">{title}</h3>
      <dl className="space-y-2">
        {items.map(i => (
          <div key={i.label} className="flex gap-2 text-sm">
            <dt className="text-gray-400 shrink-0 w-36">{i.label}</dt>
            <dd className="text-gray-800 font-medium">{i.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function NotesTab({ employeeId, notes, onAdded }: { employeeId: string; notes: any[]; onAdded: () => void }) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function addNote() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await apiClient.post(`/hr/employees/${employeeId}/notes`, { content });
      setContent("");
      onAdded();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={3}
          placeholder="Ajouter une note…"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
        <div className="flex justify-end mt-2">
          <button onClick={addNote} disabled={saving || !content.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? "…" : "Ajouter"}
          </button>
        </div>
      </div>
      {notes.map((n: any) => (
        <div key={n.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm text-sm">
          <p className="text-gray-800">{n.content}</p>
          <p className="text-xs text-gray-400 mt-1">{n.author_name ?? "Système"} · {new Date(n.created_at).toLocaleString("fr-FR")}</p>
        </div>
      ))}
    </div>
  );
}
