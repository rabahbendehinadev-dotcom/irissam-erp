import { useState, useMemo } from 'react';
import { Shield, Eye, Pencil, Trash2, FilePlus, FileText, UserCheck, LogIn, LogOut, RefreshCw,
  Search, Download, FileSpreadsheet, Printer, Filter, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatTime } from '@/utils/format';

type AuditAction =
  | 'view' | 'create' | 'update' | 'delete'
  | 'add_document' | 'view_sensitive' | 'view_audit'
  | 'login' | 'logout' | 'archive' | 'add_consultation'
  | 'validate_analysis' | 'prescription';

interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: AuditAction;
  actionLabel: string;
  module: string;
  target: string;
  date: string;
  ip: string;
  device: string;
  department: string;
  oldValue?: string;
  newValue?: string;
}

const ACTION_CONFIG: Record<AuditAction, { icon: React.ElementType; color: string; bg: string }> = {
  view:              { icon: Eye,       color: 'text-blue-600',   bg: 'bg-blue-50' },
  create:            { icon: FilePlus,  color: 'text-green-600',  bg: 'bg-green-50' },
  update:            { icon: Pencil,    color: 'text-yellow-600', bg: 'bg-yellow-50' },
  delete:            { icon: Trash2,    color: 'text-red-600',    bg: 'bg-red-50' },
  add_document:      { icon: FilePlus,  color: 'text-purple-600', bg: 'bg-purple-50' },
  view_sensitive:    { icon: Shield,    color: 'text-orange-600', bg: 'bg-orange-50' },
  view_audit:        { icon: FileText,  color: 'text-gray-600',   bg: 'bg-gray-100' },
  login:             { icon: LogIn,     color: 'text-green-600',  bg: 'bg-green-50' },
  logout:            { icon: LogOut,    color: 'text-gray-600',   bg: 'bg-gray-100' },
  archive:           { icon: Trash2,    color: 'text-red-600',    bg: 'bg-red-50' },
  add_consultation:  { icon: UserCheck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  validate_analysis: { icon: RefreshCw, color: 'text-teal-600',   bg: 'bg-teal-50' },
  prescription:      { icon: FileText,  color: 'text-blue-600',   bg: 'bg-blue-50' },
};

const MOCK_AUDIT: AuditEntry[] = [
  { id:'a-1', userId:'u-1', userName:'Dr Karim Benamara', userRole:'Médecin', action:'add_consultation', actionLabel:'Ajout d\'une consultation', module:'Consultations', target:'Consultation CON-2026-0042', date:'2026-08-01T09:14:00', ip:'192.168.1.12', device:'Chrome / Windows', department:'Médecine interne', newValue:'Statut : En attente → En cours' },
  { id:'a-2', userId:'u-3', userName:'Admin Hachichi', userRole:'Administrateur', action:'update', actionLabel:'Modification du dossier', module:'Dossier Patient', target:'Champ adresse', date:'2026-07-28T14:32:00', ip:'10.0.0.5', device:'Firefox / Ubuntu', department:'Administration', oldValue:'12 rue Didouche, Alger', newValue:'47 avenue Ben Boulaid, Alger' },
  { id:'a-3', userId:'u-5', userName:'Lab. Bensouna', userRole:'Laborantin', action:'validate_analysis', actionLabel:'Validation d\'analyse', module:'Laboratoire', target:'NFS + CRP — Résultat LAB-2026-0188', date:'2026-07-25T11:08:00', ip:'192.168.1.30', device:'Chrome / Windows', department:'Laboratoire', oldValue:'Statut : En cours', newValue:'Statut : Validé — CRP : 28 mg/L' },
  { id:'a-4', userId:'u-2', userName:'Inf. Meriem Saïdi', userRole:'Infirmière', action:'add_document', actionLabel:'Ajout d\'un document', module:'Documents', target:'Ordonnance PDF — ORD-2026-0441', date:'2026-07-22T10:45:00', ip:'192.168.1.18', device:'Safari / macOS', department:'Soins', newValue:'Document ajouté : Ordonnance Amlodipine 5mg' },
  { id:'a-5', userId:'u-4', userName:'Réception Djamel', userRole:'Réceptionniste', action:'view', actionLabel:'Consultation du dossier', module:'Dossier Patient', target:'Onglet Vue d\'ensemble', date:'2026-07-20T08:30:00', ip:'192.168.1.8', device:'Edge / Windows', department:'Accueil' },
  { id:'a-6', userId:'u-1', userName:'Dr Karim Benamara', userRole:'Médecin', action:'prescription', actionLabel:'Création d\'ordonnance', module:'Prescriptions', target:'Ordonnance #2026-0441', date:'2026-07-15T16:20:00', ip:'192.168.1.12', device:'Chrome / Windows', department:'Médecine interne', newValue:'Amlodipine 5mg + Perindopril 4mg — 30 jours' },
  { id:'a-7', userId:'u-3', userName:'Admin Hachichi', userRole:'Administrateur', action:'view_sensitive', actionLabel:'Accès données sensibles', module:'Dossier Patient', target:'N° CNI / Sécurité sociale', date:'2026-06-30T09:05:00', ip:'10.0.0.5', device:'Firefox / Ubuntu', department:'Administration' },
  { id:'a-8', userId:'u-6', userName:'Imagerie Kadri', userRole:'Radiologue', action:'add_document', actionLabel:'Ajout résultat imagerie', module:'Imagerie', target:'Écho-doppler — IMG-2026-0033', date:'2026-06-20T13:55:00', ip:'192.168.2.44', device:'Chrome / Windows', department:'Imagerie médicale', newValue:'Document PDF ajouté — athérosclérose légère' },
  { id:'a-9', userId:'u-1', userName:'Dr Karim Benamara', userRole:'Médecin', action:'view', actionLabel:'Consultation du dossier', module:'Antécédents', target:'Onglet Antécédents médicaux', date:'2026-05-18T10:00:00', ip:'192.168.1.12', device:'Chrome / Windows', department:'Médecine interne' },
  { id:'a-10', userId:'u-7', userName:'Réception Amira', userRole:'Réceptionniste', action:'create', actionLabel:'Création du dossier patient', module:'Dossier Patient', target:'Dossier MPI-001234', date:'2024-01-10T08:30:00', ip:'192.168.1.9', device:'Chrome / Windows', department:'Accueil', newValue:'Dossier créé — MPI attribué' },
];

const ALL_ACTIONS: AuditAction[] = ['view','create','update','delete','add_document','view_sensitive','view_audit','login','logout','archive','add_consultation','validate_analysis','prescription'];

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(entries: AuditEntry[]) {
  const headers = ['Utilisateur','Rôle','Module','Opération','Cible','Ancienne valeur','Nouvelle valeur','Date','Heure','IP','Appareil','Service'];
  const rows = entries.map(e => [
    e.userName, e.userRole, e.module, e.actionLabel, e.target,
    e.oldValue ?? '', e.newValue ?? '',
    formatDate(e.date), formatTime(e.date), e.ip, e.device, e.department,
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit_patient_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PatientAuditLog() {
  const [search,     setSearch]     = useState('');
  const [fromDate,   setFromDate]   = useState('');
  const [toDate,     setToDate]     = useState('');
  const [actionFilt, setActionFilt] = useState<'all' | AuditAction>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return MOCK_AUDIT.filter(e => {
      if (actionFilt !== 'all' && e.action !== actionFilt) return false;

      if (fromDate) {
        if (new Date(e.date) < new Date(fromDate)) return false;
      }
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59);
        if (new Date(e.date) > to) return false;
      }

      if (search) {
        const q = search.toLowerCase();
        return [e.userName, e.userRole, e.module, e.actionLabel, e.target, e.department]
          .some(f => f.toLowerCase().includes(q));
      }
      return true;
    });
  }, [search, fromDate, toDate, actionFilt]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-gray-800">Journal des actions</h3>
          <p className="text-xs text-gray-500 mt-0.5">Toutes les opérations effectuées sur ce dossier, avec les valeurs avant/après</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Export CSV */}
          <button
            onClick={() => exportCSV(filtered)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
            title="Exporter CSV"
          >
            <Download size={13} /> CSV
          </button>
          {/* Export Excel (mock) */}
          <button
            onClick={() => alert('Export Excel — disponible avec le backend')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
            title="Exporter Excel"
          >
            <FileSpreadsheet size={13} /> Excel
          </button>
          {/* Export PDF (mock) */}
          <button
            onClick={() => alert('Export PDF — disponible avec le backend')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
            title="Exporter PDF"
          >
            <Printer size={13} /> PDF
          </button>
          {/* Toggle filters */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors',
              showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            )}
          >
            <Filter size={13} /> Filtres
          </button>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{filtered.length} / {MOCK_AUDIT.length}</span>
        </div>
      </div>

      {/* Filter bar */}
      <div className={cn('space-y-3 transition-all', showFilters ? 'block' : 'hidden')}>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search */}
            <div className="md:col-span-2 relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher utilisateur, module, opération…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Action type */}
            <div>
              <select
                value={actionFilt}
                onChange={e => setActionFilt(e.target.value as typeof actionFilt)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
              >
                <option value="all">Tous les types</option>
                {ALL_ACTIONS.map(a => (
                  <option key={a} value={a}>{MOCK_AUDIT.find(e => e.action === a)?.actionLabel ?? a}</option>
                ))}
              </select>
            </div>

            {/* Date from */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="w-full pl-8 pr-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Du" />
              </div>
              <div className="flex-1 relative">
                <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  className="w-full pl-8 pr-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Au" />
              </div>
            </div>
          </div>

          {/* Active filters summary */}
          {(search || fromDate || toDate || actionFilt !== 'all') && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs text-gray-500">Filtres actifs :</span>
              {search && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">"{search}"</span>}
              {actionFilt !== 'all' && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{actionFilt}</span>}
              {fromDate && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Depuis {fromDate}</span>}
              {toDate && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Jusqu'au {toDate}</span>}
              <button
                onClick={() => { setSearch(''); setFromDate(''); setToDate(''); setActionFilt('all'); }}
                className="text-xs text-red-600 hover:underline"
              >
                Réinitialiser
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick search always visible */}
      {!showFilters && (
        <div className="relative max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Recherche rapide…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Filter size={32} className="opacity-20 mb-2" />
            <p className="text-sm">Aucun résultat pour ces filtres</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Utilisateur','Rôle','Module','Opération','Ancienne valeur','Nouvelle valeur','Date','Heure','Adresse IP','Appareil','Service'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(entry => {
                  const cfg = ACTION_CONFIG[entry.action];
                  const Icon = cfg.icon;
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0', cfg.bg)}>
                            <Icon size={13} className={cfg.color} />
                          </div>
                          <span className="font-medium text-gray-800 whitespace-nowrap">{entry.userName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">{entry.userRole}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full border whitespace-nowrap', cfg.bg, cfg.color)}>
                          {entry.module}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700 whitespace-nowrap font-medium">{entry.actionLabel}</p>
                        <p className="text-xs text-gray-400 mt-0.5 max-w-[180px] truncate">{entry.target}</p>
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        {entry.oldValue
                          ? <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded line-through">{entry.oldValue}</span>
                          : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        {entry.newValue
                          ? <span className="text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded">{entry.newValue}</span>
                          : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">{formatDate(entry.date)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">{formatTime(entry.date)}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">{entry.ip}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{entry.device}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">{entry.department}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Export CSV fonctionnel · Export PDF/Excel disponible avec le backend
      </p>
    </div>
  );
}
