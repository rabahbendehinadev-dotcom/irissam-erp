import { useEffect, useMemo, useState } from 'react';
import { FilePlus, Pencil, Trash2, Eye, FileText, Download, Search, History, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/services/api/client';

// ─── Types (real API data only — /patients/:id/audit ← audit_logs) ───────────

interface AuditEntry {
  id: string;
  timestamp: string;
  module: string;
  action: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  resourceId?: string | null;
  resourceType?: string | null;
  ip?: string | null;
  severity?: 'info' | 'warning' | 'critical' | null;
}

function actionCfg(action: string): { icon: typeof FilePlus; cls: string } {
  const a = action.toLowerCase();
  if (a.includes('creat') || a === 'create')  return { icon: FilePlus, cls: 'text-green-600 bg-green-50 border-green-200' };
  if (a.includes('updat') || a.includes('edit') || a.includes('modif')) return { icon: Pencil, cls: 'text-amber-600 bg-amber-50 border-amber-200' };
  if (a.includes('delet') || a.includes('suppr')) return { icon: Trash2, cls: 'text-red-600 bg-red-50 border-red-200' };
  if (a.includes('view') || a.includes('consult') || a.includes('read')) return { icon: Eye, cls: 'text-blue-600 bg-blue-50 border-blue-200' };
  return { icon: FileText, cls: 'text-gray-500 bg-gray-50 border-gray-200' };
}

const SEVERITY_CLS: Record<string, string> = {
  info:     'bg-gray-100 text-gray-500 border-gray-200',
  warning:  'bg-amber-100 text-amber-700 border-amber-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
};

function fmtDay(d: string): string {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTime(d: string): string {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function valPreview(v: unknown): string {
  if (v == null) return '—';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 64 ? `${s.slice(0, 61)}…` : s;
}
function valFull(v: unknown): string {
  if (v == null) return '';
  return typeof v === 'string' ? v : JSON.stringify(v, null, 1);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PatientAuditLog({ patientId }: { patientId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    let aborted = false;
    setLoading(true); setError(false);
    apiClient.get<AuditEntry[]>(`/patients/${encodeURIComponent(patientId)}/audit`)
      .then(rows => { if (!aborted) setEntries(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!aborted) setError(true); })
      .finally(() => { if (!aborted) setLoading(false); });
    return () => { aborted = true; };
  }, [patientId, tick]);

  const actions = useMemo(
    () => Array.from(new Set(entries.map(e => e.action))).sort(),
    [entries],
  );

  const filtered = useMemo(() => entries.filter(e => {
    if (actionFilter !== 'all' && e.action !== actionFilter) return false;
    if (dateFrom && e.timestamp.slice(0, 10) < dateFrom) return false;
    if (dateTo && e.timestamp.slice(0, 10) > dateTo) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const hay = [e.userName, e.userRole, e.module, e.action, e.resourceType, e.resourceId, valFull(e.oldValue), valFull(e.newValue)]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [entries, query, actionFilter, dateFrom, dateTo]);

  const exportCsv = () => {
    const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const header = ['Utilisateur', 'Rôle', 'Module', 'Action', 'Ressource', 'Ancienne valeur', 'Nouvelle valeur', 'Date', 'Heure', 'IP', 'Sévérité'];
    const lines = filtered.map(e => [
      esc(e.userName ?? 'Système'), esc(e.userRole ?? ''), esc(e.module), esc(e.action),
      esc([e.resourceType, e.resourceId].filter(Boolean).join(' ')),
      esc(valFull(e.oldValue)), esc(valFull(e.newValue)),
      esc(fmtDay(e.timestamp)), esc(fmtTime(e.timestamp)), esc(e.ip ?? ''), esc(e.severity ?? ''),
    ].join(';'));
    const blob = new Blob([`\uFEFF${[header.map(esc).join(';'), ...lines].join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_patient_${patientId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[240px]">
        <div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[240px] text-red-500 space-y-2">
        <AlertTriangle size={32} className="opacity-50" />
        <p className="text-sm font-medium">Impossible de charger l'historique d'audit de ce patient.</p>
        <button onClick={() => setTick(t => t + 1)} className="text-xs text-blue-600 hover:underline">Réessayer</button>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 space-y-2 bg-white border border-gray-200 rounded-xl">
        <History size={36} className="opacity-20" />
        <p className="font-semibold text-sm">Aucune action enregistrée sur ce dossier</p>
        <p className="text-xs">Chaque création, modification ou suppression liée à ce patient apparaîtra ici.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher (utilisateur, module, action…)"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200">
          <option value="all">Toutes les actions</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200" />
        <span className="text-xs text-gray-400">→</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200" />
        <button onClick={exportCsv}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors ml-auto">
          <Download size={14} /> Exporter CSV
        </button>
      </div>

      <p className="text-xs text-gray-400">
        {filtered.length} entrée{filtered.length !== 1 ? 's' : ''} — journal d'audit réel du dossier (max 500 dernières actions)
      </p>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100 bg-gray-50/60">
                <th className="px-4 py-2.5 font-medium">Utilisateur</th>
                <th className="px-4 py-2.5 font-medium">Module</th>
                <th className="px-4 py-2.5 font-medium">Opération</th>
                <th className="px-4 py-2.5 font-medium">Ancienne valeur</th>
                <th className="px-4 py-2.5 font-medium">Nouvelle valeur</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">IP</th>
                <th className="px-4 py-2.5 font-medium">Sévérité</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const cfg = actionCfg(e.action);
                const Icon = cfg.icon;
                return (
                  <tr key={e.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{e.userName || 'Système'}</p>
                      {e.userRole && <p className="text-[11px] text-gray-400">{e.userRole}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{e.module}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium', cfg.cls)}>
                        <Icon size={11} /> {e.action}
                      </span>
                      {(e.resourceType || e.resourceId) && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          {e.resourceType}{e.resourceId ? ` · ${String(e.resourceId).slice(0, 8)}` : ''}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px]">
                      <span className="block truncate" title={valFull(e.oldValue)}>{valPreview(e.oldValue)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px]">
                      <span className="block truncate" title={valFull(e.newValue)}>{valPreview(e.newValue)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-gray-600">{fmtDay(e.timestamp)}</p>
                      <p className="text-[11px] text-gray-400">{fmtTime(e.timestamp)}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">{e.ip || '—'}</td>
                    <td className="px-4 py-3">
                      {e.severity ? (
                        <span className={cn('inline-flex px-2 py-0.5 rounded-full border text-[11px] font-medium', SEVERITY_CLS[e.severity] ?? SEVERITY_CLS['info'])}>
                          {e.severity}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-10 text-center text-sm text-gray-400">Aucune entrée ne correspond aux filtres.</div>
        )}
      </div>
    </div>
  );
}
