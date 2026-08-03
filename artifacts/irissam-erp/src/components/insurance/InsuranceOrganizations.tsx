import { useState } from 'react';
import {
  useInsuranceOrgs, useCreateOrg, useUpdateOrg, useSuspendOrg,
  useReactivateOrg, useInsurancePlans, useCreatePlan
} from '@/hooks/useInsuranceApi';
import type { InsuranceOrg, InsurancePlan, CreateOrgInput, CreatePlanInput, InsuranceOrgType } from '@/types/insurance';
import { useLanguage } from '@/i18n';
import { Plus, Search, Building2, Edit, Eye, Ban, RotateCcw, X, CheckCircle,
         Filter, FileText, Loader2, ChevronRight, Shield, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n: number) {
  return Number(n).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ORG_TYPE_LABELS: Record<string, string> = {
  cnas: 'CNAS', casnos: 'CASNOS', mutuelle: 'Mutuelle',
  assurance_privee: 'Privée', convention_entreprise: 'Convention', autre: 'Autre',
};
const ORG_TYPE_COLORS: Record<string, string> = {
  cnas: 'bg-blue-100 text-blue-700', casnos: 'bg-purple-100 text-purple-700',
  mutuelle: 'bg-green-100 text-green-700', assurance_privee: 'bg-orange-100 text-orange-700',
  convention_entreprise: 'bg-teal-100 text-teal-700', autre: 'bg-gray-100 text-gray-600',
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ORG_TYPE_COLORS[type] ?? 'bg-gray-100 text-gray-600'}`}>
      {ORG_TYPE_LABELS[type] ?? type}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle size={10}/>Actif</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><Ban size={10}/>Suspendu</span>;
}

// ─── Org Create/Edit Form ─────────────────────────────────────────────────────
function OrgForm({ org, onClose }: { org?: InsuranceOrg | null; onClose: () => void }) {
  const createOrg = useCreateOrg();
  const updateOrg = useUpdateOrg();
  const [form, setForm] = useState<CreateOrgInput>({
    name: org?.name ?? '', code: org?.code ?? '', type: (org?.type ?? 'cnas') as InsuranceOrgType,
    address: org?.address ?? '', phone: org?.phone ?? '',
    contact_email: org?.contact_email ?? '', notes: org?.notes ?? '',
  });
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (org) {
        await updateOrg.mutateAsync({ id: org.id, data: form });
      } else {
        await createOrg.mutateAsync(form);
      }
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Erreur');
    }
  }

  const isSaving = createOrg.isPending || updateOrg.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[95dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{org ? 'Modifier l\'organisme' : 'Nouvel organisme'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={18}/></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Nom *</label>
              <input required value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Code *</label>
              <input required value={form.code} onChange={e => setForm(f=>({...f,code:e.target.value.toUpperCase()}))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Type *</label>
              <select required value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value as InsuranceOrgType}))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                {Object.entries(ORG_TYPE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Téléphone</label>
              <input value={form.phone??''} onChange={e => setForm(f=>({...f,phone:e.target.value}))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Email contact</label>
            <input type="email" value={form.contact_email??''} onChange={e => setForm(f=>({...f,contact_email:e.target.value}))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Adresse</label>
            <input value={form.address??''} onChange={e => setForm(f=>({...f,address:e.target.value}))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Notes</label>
            <textarea rows={2} value={form.notes??''} onChange={e => setForm(f=>({...f,notes:e.target.value}))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-60">
              {isSaving && <Loader2 size={14} className="animate-spin"/>}
              {org ? 'Enregistrer' : 'Créer'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Plan Form ────────────────────────────────────────────────────────────────
function PlanForm({ organizationId, onClose }: { organizationId: string; onClose: () => void }) {
  const createPlan = useCreatePlan();
  const [form, setForm] = useState<Partial<CreatePlanInput>>({ organizationId, coverageType: 'maladie', coverage_percent: 80 });
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createPlan.mutateAsync(form as CreatePlanInput);
      onClose();
    } catch (err: unknown) { setError((err as Error).message ?? 'Erreur'); }
  }

  return (
    <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-4 space-y-3">
      <h4 className="text-sm font-semibold text-blue-800">Nouveau plan de couverture</h4>
      {error && <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nom *</label>
            <input required value={form.name??''} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Code *</label>
            <input required value={form.code??''} onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Type</label>
            <select value={form.coverageType??'maladie'} onChange={e=>setForm(f=>({...f,coverageType:e.target.value}))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="maladie">Maladie</option>
              <option value="accident">Accident</option>
              <option value="maternite">Maternité</option>
              <option value="invalidite">Invalidité</option>
              <option value="deces">Décès</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Couverture %</label>
            <input type="number" min={0} max={100} value={form.coverage_percent??80} onChange={e=>setForm(f=>({...f,coverage_percent:Number(e.target.value)}))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Plafond annuel (DZD)</label>
            <input type="number" min={0} value={form.annual_ceiling??''} onChange={e=>setForm(f=>({...f,annual_ceiling:e.target.value?Number(e.target.value):undefined}))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Illimité"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Ticket modérateur %</label>
            <input type="number" min={0} max={100} value={form.ticket_moderateur_percent??0} onChange={e=>setForm(f=>({...f,ticket_moderateur_percent:Number(e.target.value)}))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={createPlan.isPending}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {createPlan.isPending && <Loader2 size={12} className="animate-spin"/>} Créer
          </button>
          <button type="button" onClick={onClose}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Org Detail Drawer ────────────────────────────────────────────────────────
function OrgDetailDrawer({ org, onClose, onEdit }: { org: InsuranceOrg; onClose: () => void; onEdit: () => void }) {
  const { data: plans = [] } = useInsurancePlans(org.id);
  const suspendOrg = useSuspendOrg();
  const reactivateOrg = useReactivateOrg();
  const [drawerTab, setDrawerTab] = useState<'plans'|'info'>('plans');
  const [showAddPlan, setShowAddPlan] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex" onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div className="flex-1" onClick={onClose} />
      <div className="w-full sm:w-[420px] bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Building2 size={18} className="text-blue-600"/>
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 text-sm truncate">{org.name}</h3>
              <p className="text-xs text-gray-400">{org.code}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 flex-shrink-0"><X size={18}/></button>
        </div>

        {/* Badges + actions */}
        <div className="flex items-center gap-2 px-5 py-2 border-b border-gray-50 flex-shrink-0">
          <TypeBadge type={org.type} />
          <StatusBadge active={org.is_active} />
          <div className="ml-auto flex gap-1">
            <button onClick={onEdit}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
              <Edit size={11}/> Modifier
            </button>
            {org.is_active ? (
              <button onClick={() => suspendOrg.mutate(org.id)} disabled={suspendOrg.isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-60">
                <Ban size={11}/> Suspendre
              </button>
            ) : (
              <button onClick={() => reactivateOrg.mutate(org.id)} disabled={reactivateOrg.isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-50 text-green-600 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-60">
                <RotateCcw size={11}/> Réactiver
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0 px-4">
          {(['plans','info'] as const).map(t => (
            <button key={t} onClick={() => setDrawerTab(t)}
              className={cn('px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                drawerTab===t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600')}>
              {t === 'plans' ? `Plans (${plans.length})` : 'Infos'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {drawerTab === 'info' && (
            <div className="space-y-3">
              {[
                ['Contact email', org.contact_email],
                ['Téléphone', org.phone],
                ['Adresse', org.address],
                ['Notes', org.notes],
              ].filter(([,v])=>v).map(([l,v]) => (
                <div key={l as string}>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{l as string}</p>
                  <p className="text-sm text-gray-800">{v as string}</p>
                </div>
              ))}
            </div>
          )}
          {drawerTab === 'plans' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Plans de couverture</p>
                <button onClick={() => setShowAddPlan(v=>!v)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                  <Plus size={12}/> Ajouter
                </button>
              </div>
              {showAddPlan && <PlanForm organizationId={org.id} onClose={() => setShowAddPlan(false)} />}
              {plans.length === 0 && !showAddPlan && (
                <p className="text-sm text-gray-400 text-center py-6">Aucun plan configuré</p>
              )}
              {plans.map(plan => (
                <div key={plan.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-800">{plan.name}</p>
                    <span className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-500">{plan.code}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-xs text-gray-400">Couverture</p>
                      <p className="text-sm font-bold text-blue-600">{plan.coverage_percent}%</p>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-xs text-gray-400">Ticket mod.</p>
                      <p className="text-sm font-bold text-gray-700">{plan.ticket_moderateur_percent}%</p>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-xs text-gray-400">Plafond</p>
                      <p className="text-sm font-bold text-gray-700">{plan.annual_ceiling ? fmt(plan.annual_ceiling) : '∞'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function InsuranceOrganizations() {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<InsuranceOrg | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editOrg, setEditOrg] = useState<InsuranceOrg | null>(null);

  const { data: orgs = [], isLoading } = useInsuranceOrgs(search || undefined);

  const filtered = typeFilter ? orgs.filter(o => o.type === typeFilter) : orgs;

  const typeFilters = ['', 'cnas', 'casnos', 'mutuelle', 'assurance_privee', 'convention_entreprise', 'autre'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un organisme..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"/>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 whitespace-nowrap">
          <Plus size={16}/> {t('insurance.action.new_org')}
        </button>
      </div>

      {/* Type filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {typeFilters.map(tf => (
          <button key={tf} onClick={() => setTypeFilter(tf)}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors',
              typeFilter === tf ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300')}>
            {tf === '' ? 'Tous' : ORG_TYPE_LABELS[tf]}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2 animate-pulse">
          {Array.from({length:5}).map((_,i) => <div key={i} className="h-16 bg-white rounded-xl border border-gray-100"/>)}
        </div>
      )}

      {/* Desktop table */}
      {!isLoading && (
        <>
          <div className="hidden sm:block bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Nom</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-left">Plans</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">Aucun organisme trouvé</td></tr>
                ) : filtered.map(org => (
                  <tr key={org.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => setSelectedOrg(org)}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{org.code}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{org.name}</td>
                    <td className="px-4 py-3"><TypeBadge type={org.type}/></td>
                    <td className="px-4 py-3"><StatusBadge active={org.is_active}/></td>
                    <td className="px-4 py-3 text-gray-500">{(org.plans?.length ?? 0)} plan(s)</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setSelectedOrg(org)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600" title="Voir détail">
                          <Eye size={15}/>
                        </button>
                        <button onClick={() => { setEditOrg(org); }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Modifier">
                          <Edit size={15}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">Aucun organisme trouvé</div>
            ) : filtered.map(org => (
              <div key={org.id} className="bg-white rounded-xl border border-gray-100 p-4"
                onClick={() => setSelectedOrg(org)}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{org.name}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{org.code}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300"/>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <TypeBadge type={org.type}/>
                  <StatusBadge active={org.is_active}/>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      {(showCreate || editOrg) && (
        <OrgForm org={editOrg} onClose={() => { setShowCreate(false); setEditOrg(null); }} />
      )}

      {/* Detail drawer */}
      {selectedOrg && (
        <OrgDetailDrawer
          org={selectedOrg}
          onClose={() => setSelectedOrg(null)}
          onEdit={() => { setEditOrg(selectedOrg); setSelectedOrg(null); }}
        />
      )}
    </div>
  );
}
