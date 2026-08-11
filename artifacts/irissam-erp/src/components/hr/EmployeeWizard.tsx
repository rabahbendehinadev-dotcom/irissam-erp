/**
 * EmployeeWizard — 9-step professional wizard for creating an employee
 * Steps: Identité → Identifiants → Coordonnées → Affectation → Contrat
 *        → Planning → Contact urgence → Documents → Résumé
 */
import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { X, ChevronRight, ChevronLeft, Check, User, CreditCard, Phone, Building2, FileText, Calendar, AlertCircle, FolderOpen, CheckCircle, KeyRound } from "lucide-react";
import { useQuery } from "@/hooks/useQuery";
import { usePermission } from "@/hooks/usePermission";

const STEPS = [
  { title: "Identité",         icon: User },
  { title: "Identifiants",     icon: CreditCard },
  { title: "Coordonnées",      icon: Phone },
  { title: "Affectation",      icon: Building2 },
  { title: "Contrat",          icon: FileText },
  { title: "Planning",         icon: Calendar },
  { title: "Urgence",          icon: AlertCircle },
  { title: "Documents",        icon: FolderOpen },
  { title: "Accès ERP",        icon: KeyRound },
  { title: "Résumé",           icon: CheckCircle },
];

function genPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes).map(b => chars[b % chars.length]).join("");
}

const CONTRACT_TYPES = ["CDI","CDD","vacataire","garde","stage","prestataire","convention"];
const CATEGORIES = ["medical","paramedical","administratif","technique","support"];
const DOC_TYPES = ["CNI","diplome","autorisation_exercice","contrat_signe","certificat_medical","casier_judiciaire","photo","attestation","autre"];

interface Props {
  onClose: () => void;
  onCreated: (emp: any) => void;
}

export function EmployeeWizard({ onClose, onCreated }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState({
    identity: { firstName: "", lastName: "", gender: "", dateOfBirth: "", placeOfBirth: "", nationality: "Algérienne", maritalStatus: "", photoUrl: "" },
    identifiers: { matricule: "", idDocumentNumber: "", socialSecurityNumber: "", professionalOrderNumber: "", linkedUserId: "" },
    contacts: { phonePrimary: "", phoneSecondary: "", emailProfessional: "", emailPersonal: "", address: "", commune: "", wilaya: "", country: "Algérie" },
    assignment: { positionId: "", departmentId: "", siteId: "", building: "", floor: "", service: "", team: "", managerId: "", category: "" },
    contract: { type: "", status: "actif", startDate: "", endDate: "", trialEndDate: "", isFullTime: true, weeklyHours: 40, salaryBase: "", notes: "" },
    schedule: { workDays: [1,2,3,4,5], startTime: "08:00", endTime: "16:00", breakMinutes: 60, rotation: false, nightWork: false, onCall: false },
    emergency: { name: "", relation: "", phone: "", address: "" },
    documents: { types: [] as string[], notes: "" },
    account: { create: false, email: "", roleId: "", tempPassword: "" },
  });

  const { can } = usePermission();
  const canCreateAccount = can("admin.users");
  const { data: positions } = useQuery<any[]>("/hr/positions");
  const { data: departments } = useQuery<any[]>("/hr/positions/departments");
  const { data: roles } = useQuery<any[]>(canCreateAccount ? "/system/users/roles" : null);

  function set(section: keyof typeof data, field: string, value: any) {
    setData(d => ({ ...d, [section]: { ...(d[section] as any), [field]: value } }));
  }

  function toggleWorkDay(day: number) {
    const days = data.schedule.workDays;
    set("schedule", "workDays", days.includes(day) ? days.filter(d => d !== day) : [...days, day].sort());
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const { account, ...rest } = data;
      const payload = {
        ...rest,
        account: account.create
          ? { create: true, email: account.email.trim(), roleId: account.roleId, tempPassword: account.tempPassword }
          : undefined,
      };
      const result = await apiClient.post<{ employee: any }>("/hr/employees", payload);
      onCreated(result.employee);
    } catch (e: any) {
      setError(e.message ?? "Erreur lors de la création");
      setSaving(false);
    }
  }

  const isLastStep = step === STEPS.length - 1;
  const canGoNext = () => {
    if (step === 0) return data.identity.firstName.trim() && data.identity.lastName.trim();
    if (step === 4) return data.contract.type && data.contract.startDate;
    if (step === 8) return !data.account.create || (
      /\S+@\S+\.\S+/.test(data.account.email.trim()) && !!data.account.roleId && data.account.tempPassword.length >= 8
    );
    return true;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-bold text-gray-900">Nouvel employé — {STEPS[step].title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5"/></button>
        </div>

        {/* Step indicator */}
        <div className="px-5 py-3 border-b border-gray-100 shrink-0 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {STEPS.map((s, i) => (
              <button key={i} onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                  i === step ? "bg-blue-600 text-white" :
                  i < step   ? "bg-green-100 text-green-700 cursor-pointer hover:bg-green-200" :
                               "bg-gray-100 text-gray-400"
                }`}>
                {i < step ? <Check className="w-3 h-3"/> : <s.icon className="w-3 h-3"/>}
                <span className="hidden sm:inline">{s.title}</span>
                <span className="sm:hidden">{i+1}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* Step 0 — Identité */}
          {step === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Prénom *" value={data.identity.firstName} onChange={v => set("identity","firstName",v)} />
              <Field label="Nom *" value={data.identity.lastName} onChange={v => set("identity","lastName",v)} />
              <Field label="Sexe" type="select" value={data.identity.gender} onChange={v => set("identity","gender",v)}
                options={[{v:"",l:"—"},{v:"M",l:"Masculin"},{v:"F",l:"Féminin"},{v:"autre",l:"Autre"}]}/>
              <Field label="Date de naissance" type="date" value={data.identity.dateOfBirth} onChange={v => set("identity","dateOfBirth",v)}/>
              <Field label="Lieu de naissance" value={data.identity.placeOfBirth} onChange={v => set("identity","placeOfBirth",v)}/>
              <Field label="Nationalité" value={data.identity.nationality} onChange={v => set("identity","nationality",v)}/>
              <Field label="Situation familiale" type="select" value={data.identity.maritalStatus} onChange={v => set("identity","maritalStatus",v)}
                options={[{v:"",l:"—"},{v:"celibataire",l:"Célibataire"},{v:"marie",l:"Marié(e)"},{v:"divorce",l:"Divorcé(e)"},{v:"veuf",l:"Veuf/Veuve"}]}/>
            </div>
          )}

          {/* Step 1 — Identifiants */}
          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Matricule (auto-généré si vide)" value={data.identifiers.matricule} onChange={v => set("identifiers","matricule",v)} placeholder="EMP-xxxxx"/>
              <Field label="N° pièce d'identité" value={data.identifiers.idDocumentNumber} onChange={v => set("identifiers","idDocumentNumber",v)}/>
              <Field label="N° sécurité sociale" value={data.identifiers.socialSecurityNumber} onChange={v => set("identifiers","socialSecurityNumber",v)}/>
              <Field label="N° ordre professionnel" value={data.identifiers.professionalOrderNumber} onChange={v => set("identifiers","professionalOrderNumber",v)} placeholder="Médecins / Pharmaciens"/>
              <div className="sm:col-span-2">
                <Field label="Type de personnel" type="select" value={data.assignment.category} onChange={v => set("assignment","category",v)}
                  options={[{v:"",l:"—"},{v:"medical",l:"Médical"},{v:"paramedical",l:"Paramédical"},{v:"administratif",l:"Administratif"},{v:"technique",l:"Technique"},{v:"support",l:"Support"}]}/>
              </div>
            </div>
          )}

          {/* Step 2 — Coordonnées */}
          {step === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Téléphone principal" value={data.contacts.phonePrimary} onChange={v => set("contacts","phonePrimary",v)} type="tel"/>
              <Field label="Téléphone secondaire" value={data.contacts.phoneSecondary} onChange={v => set("contacts","phoneSecondary",v)} type="tel"/>
              <Field label="Email professionnel" value={data.contacts.emailProfessional} onChange={v => set("contacts","emailProfessional",v)} type="email"/>
              <Field label="Email personnel" value={data.contacts.emailPersonal} onChange={v => set("contacts","emailPersonal",v)} type="email"/>
              <div className="sm:col-span-2"><Field label="Adresse" value={data.contacts.address} onChange={v => set("contacts","address",v)}/></div>
              <Field label="Commune" value={data.contacts.commune} onChange={v => set("contacts","commune",v)}/>
              <Field label="Wilaya" value={data.contacts.wilaya} onChange={v => set("contacts","wilaya",v)}/>
              <Field label="Pays" value={data.contacts.country} onChange={v => set("contacts","country",v)}/>
            </div>
          )}

          {/* Step 3 — Affectation */}
          {step === 3 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Département</label>
                <select value={data.assignment.departmentId} onChange={e => set("assignment","departmentId",e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="">— Sélectionner —</option>
                  {Array.isArray(departments) && departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Poste / Fonction</label>
                <select value={data.assignment.positionId} onChange={e => set("assignment","positionId",e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="">— Sélectionner —</option>
                  {Array.isArray(positions) && positions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <Field label="Site" value={data.assignment.siteId} onChange={v => set("assignment","siteId",v)} placeholder="Site / Établissement"/>
              <Field label="Bâtiment" value={data.assignment.building} onChange={v => set("assignment","building",v)}/>
              <Field label="Étage" value={data.assignment.floor} onChange={v => set("assignment","floor",v)}/>
              <Field label="Service" value={data.assignment.service} onChange={v => set("assignment","service",v)}/>
              <Field label="Équipe" value={data.assignment.team} onChange={v => set("assignment","team",v)}/>
            </div>
          )}

          {/* Step 4 — Contrat */}
          {step === 4 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type de contrat *</label>
                <select value={data.contract.type} onChange={e => set("contract","type",e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="">— Sélectionner —</option>
                  {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
              </div>
              <Field label="Date début *" type="date" value={data.contract.startDate} onChange={v => set("contract","startDate",v)}/>
              <Field label="Date fin" type="date" value={data.contract.endDate} onChange={v => set("contract","endDate",v)}/>
              <Field label="Fin période d'essai" type="date" value={data.contract.trialEndDate} onChange={v => set("contract","trialEndDate",v)}/>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={data.contract.isFullTime} onChange={e => set("contract","isFullTime",e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"/>
                  Temps plein
                </label>
              </div>
              <Field label="Heures / semaine" type="number" value={String(data.contract.weeklyHours)} onChange={v => set("contract","weeklyHours",parseFloat(v))}/>
              <Field label="Salaire de base (placeholder)" value={data.contract.salaryBase} onChange={v => set("contract","salaryBase",v)} placeholder="DZD"/>
              <div className="sm:col-span-2"><Field label="Notes" value={data.contract.notes} onChange={v => set("contract","notes",v)} multiline/></div>
            </div>
          )}

          {/* Step 5 — Planning */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Jours de travail</label>
                <div className="flex gap-2 flex-wrap">
                  {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map((day, i) => (
                    <button key={i} type="button" onClick={() => toggleWorkDay(i+1)}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${data.schedule.workDays.includes(i+1) ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Heure début" type="time" value={data.schedule.startTime} onChange={v => set("schedule","startTime",v)}/>
                <Field label="Heure fin" type="time" value={data.schedule.endTime} onChange={v => set("schedule","endTime",v)}/>
                <Field label="Pause (min)" type="number" value={String(data.schedule.breakMinutes)} onChange={v => set("schedule","breakMinutes",parseInt(v))}/>
              </div>
              <div className="flex gap-6 flex-wrap">
                {[
                  { label: "Rotation", field: "rotation" as const },
                  { label: "Travail de nuit", field: "nightWork" as const },
                  { label: "Garde / Astreinte", field: "onCall" as const },
                ].map(({ label, field }) => (
                  <label key={field} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={data.schedule[field] as boolean}
                      onChange={e => set("schedule",field,e.target.checked)} className="w-4 h-4 rounded"/>
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 6 — Contact urgence */}
          {step === 6 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nom" value={data.emergency.name} onChange={v => set("emergency","name",v)}/>
              <Field label="Relation" value={data.emergency.relation} onChange={v => set("emergency","relation",v)} placeholder="Parent / Conjoint…"/>
              <Field label="Téléphone" type="tel" value={data.emergency.phone} onChange={v => set("emergency","phone",v)}/>
              <div className="sm:col-span-2"><Field label="Adresse" value={data.emergency.address} onChange={v => set("emergency","address",v)}/></div>
            </div>
          )}

          {/* Step 7 — Documents */}
          {step === 7 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Sélectionnez les types de documents à associer lors de la création :</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DOC_TYPES.map(dt => (
                  <label key={dt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer p-2 border border-gray-100 rounded-lg hover:bg-gray-50">
                    <input type="checkbox" checked={data.documents.types.includes(dt)}
                      onChange={e => set("documents","types", e.target.checked ? [...data.documents.types, dt] : data.documents.types.filter(t => t !== dt))}
                      className="w-4 h-4 rounded"/>
                    {dt.replace(/_/g," ")}
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400">Les fichiers pourront être téléversés après la création dans l'onglet Documents.</p>
            </div>
          )}

          {/* Step 8 — Accès ERP */}
          {step === 8 && (
            <div className="space-y-4">
              {!canCreateAccount ? (
                <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500">
                  <KeyRound className="w-5 h-5 shrink-0 text-gray-400"/>
                  <p>La création de comptes ERP est réservée à l'administration (permission admin.users).
                     Vous pouvez terminer la création de l'employé ; un administrateur pourra créer
                     le compte plus tard depuis la fiche employé.</p>
                </div>
              ) : (
                <>
                  <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={data.account.create}
                      onChange={e => {
                        const create = e.target.checked;
                        setData(d => ({ ...d, account: { ...d.account, create,
                          email: create && !d.account.email ? d.contacts.emailProfessional : d.account.email,
                          tempPassword: create && !d.account.tempPassword ? genPassword() : d.account.tempPassword } }));
                      }}
                      className="w-4 h-4 rounded border-gray-300"/>
                    <div>
                      <p className="text-sm font-medium text-gray-800">Créer un compte ERP pour cet employé</p>
                      <p className="text-xs text-gray-400">L'employé se connectera sous sa propre identité ; toutes ses actions seront tracées à son nom.</p>
                    </div>
                  </label>
                  {data.account.create && (
                    <div className="grid grid-cols-1 gap-4">
                      <Field label="Email de connexion *" type="email" value={data.account.email} onChange={v => set("account","email",v)}/>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Rôle (permissions) *</label>
                        <select value={data.account.roleId} onChange={e => set("account","roleId",e.target.value)}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                          <option value="">— Sélectionner un rôle —</option>
                          {Array.isArray(roles) && roles.map((r: any) => <option key={r.id} value={r.id}>{r.display_name}</option>)}
                        </select>
                        <p className="text-[11px] text-gray-400 mt-1">Le rôle détermine les permissions (ex. un médecin ne crée pas de dossiers patients : le dossier reste unique, créé par l'accueil).</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Mot de passe provisoire * (min. 8 caractères)</label>
                        <div className="flex gap-2">
                          <input value={data.account.tempPassword} onChange={e => set("account","tempPassword",e.target.value)}
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                          <button type="button" onClick={() => set("account","tempPassword",genPassword())}
                            className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">Générer</button>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">Communiquez-le à l'employé : changement obligatoire à la première connexion.</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 9 — Résumé */}
          {step === 9 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3 text-sm">
                <h3 className="font-semibold text-blue-800">Récapitulatif</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <SummaryRow label="Nom" value={`${data.identity.lastName} ${data.identity.firstName}`}/>
                  <SummaryRow label="Matricule" value={data.identifiers.matricule || "Auto-généré"}/>
                  <SummaryRow label="Catégorie" value={data.assignment.category || "—"}/>
                  <SummaryRow label="Téléphone" value={data.contacts.phonePrimary || "—"}/>
                  <SummaryRow label="Type contrat" value={data.contract.type || "—"}/>
                  <SummaryRow label="Date début" value={data.contract.startDate || "—"}/>
                  <SummaryRow label="Compte ERP" value={data.account.create
                    ? `Oui — ${(Array.isArray(roles) && roles.find((r: any) => r.id === data.account.roleId)?.display_name) || "rôle à choisir"}`
                    : "Non"}/>
                </div>
              </div>
              {data.account.create && (
                <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-800">
                  <KeyRound className="w-5 h-5 shrink-0"/>
                  <p>Un compte ERP sera créé et lié à cette fiche ({data.account.email || "email ?"}).
                     Mot de passe provisoire à communiquer ; changement obligatoire au premier login.</p>
                </div>
              )}
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
                <AlertCircle className="w-5 h-5 shrink-0"/>
                <p>En enregistrant, vous créez simultanément le dossier employé, le profil, les coordonnées, le contrat et le planning dans une seule transaction.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between shrink-0 bg-white">
          <button onClick={step === 0 ? onClose : () => setStep(s => s-1)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4"/>
            {step === 0 ? "Annuler" : "Précédent"}
          </button>
          <span className="text-xs text-gray-400">{step+1} / {STEPS.length}</span>
          {isLastStep ? (
            <button onClick={submit} disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60">
              {saving ? "Enregistrement…" : "Enregistrer l'employé"}
            </button>
          ) : (
            <button onClick={() => setStep(s => s+1)} disabled={!canGoNext()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              Suivant <ChevronRight className="w-4 h-4"/>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "date" | "time" | "number" | "tel" | "email" | "select";
  options?: { v: string; l: string }[];
  placeholder?: string;
  multiline?: boolean;
}

function Field({ label, value, onChange, type = "text", options, placeholder, multiline }: FieldProps) {
  const cls = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {type === "select" ? (
        <select value={value} onChange={e => onChange(e.target.value)} className={cls}>
          {options?.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      ) : multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className={cls} placeholder={placeholder}/>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} className={cls} placeholder={placeholder}/>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-500">{label}: </span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}
