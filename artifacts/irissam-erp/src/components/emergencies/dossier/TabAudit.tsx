import { useState } from 'react';
import { Shield, Clock, User, Download, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmergencyDossier } from '@/contexts/EmergencyDossierContext';
import type { AuditEntry } from '@/types/emergencyDossier';

const CAT_CFG: Record<AuditEntry['category'], { label: string; cls: string; dot: string }> = {
  admin:        { label: 'Admin',        cls: 'bg-gray-100 text-gray-600 border-gray-200',     dot: 'bg-gray-400' },
  clinical:     { label: 'Clinique',     cls: 'bg-blue-100 text-blue-700 border-blue-200',     dot: 'bg-blue-500' },
  prescription: { label: 'Prescription', cls: 'bg-amber-100 text-amber-700 border-amber-200',  dot: 'bg-amber-500' },
  lab:          { label: 'Biologie',     cls: 'bg-green-100 text-green-700 border-green-200',  dot: 'bg-green-500' },
  imaging:      { label: 'Imagerie',     cls: 'bg-cyan-100 text-cyan-700 border-cyan-200',     dot: 'bg-cyan-500' },
  nursing:      { label: 'Infirmier',    cls: 'bg-teal-100 text-teal-700 border-teal-200',     dot: 'bg-teal-500' },
  system:       { label: 'Système',      cls: 'bg-slate-100 text-slate-600 border-slate-200',  dot: 'bg-slate-400' },
  decision:     { label: 'Décision',     cls: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
};

function fmtFull(iso: string) {
  return new Date(iso).toLocaleString('fr-DZ', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function TabAudit() {
  const { dossier } = useEmergencyDossier();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<AuditEntry['category'] | 'all'>('all');

  let logs = [...dossier.auditLog].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  if (catFilter !== 'all') logs = logs.filter(e => e.category === catFilter);
  if (search) {
    const q = search.toLowerCase();
    logs = logs.filter(e =>
      e.action.toLowerCase().includes(q) ||
      e.details.toLowerCase().includes(q) ||
      e.performedBy.toLowerCase().includes(q),
    );
  }

  const exportCSV = () => {
    const rows = [['Horodatage','Catégorie','Action','Détails','Effectué par','Rôle']];
    dossier.auditLog.forEach(e => {
      rows.push([fmtFull(e.timestamp), e.category, e.action, e.details, e.performedBy, e.role]);
    });
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `audit_${dossier.dossierNumber}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white flex-1 max-w-xs">
          <Search size={12} className="text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher dans l'audit…"
            className="text-xs outline-none bg-transparent w-full"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setCatFilter('all')}
            className={cn('text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors',
              catFilter === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500 hover:border-gray-400'
            )}
          >Tous</button>
          {(Object.keys(CAT_CFG) as AuditEntry['category'][]).map(c => (
            <button
              key={c}
              onClick={() => setCatFilter(catFilter === c ? 'all' : c)}
              className={cn('text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors', catFilter === c ? CAT_CFG[c].cls + ' ring-1 ring-current' : 'border-gray-200 text-gray-500 hover:border-gray-400')}
            >
              {CAT_CFG[c].label}
            </button>
          ))}
        </div>
        <button onClick={exportCSV} className="ml-auto flex items-center gap-1 text-xs border border-gray-200 hover:border-gray-400 text-gray-600 hover:text-gray-800 rounded-lg px-2.5 py-1.5 transition-colors">
          <Download size={12} />Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-[10px] text-gray-400 px-1">
        <span className="flex items-center gap-1"><Shield size={9} />{dossier.auditLog.length} événements total</span>
        <span>Affichés: {logs.length}</span>
      </div>

      {/* Timeline */}
      {logs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
          Aucun événement correspondant
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-50">
            {logs.map(entry => {
              const cfg = CAT_CFG[entry.category];
              const isCritical = entry.action.includes('CRITIQUE') || entry.action.includes('⚠');
              return (
                <div key={entry.id} className={cn('flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors', isCritical ? 'bg-red-50/50' : '')}>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5">
                    <div className={cn('w-2.5 h-2.5 rounded-full', isCritical ? 'bg-red-500 animate-pulse' : cfg.dot)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('font-semibold text-xs', isCritical ? 'text-red-700' : 'text-gray-800')}>{entry.action}</span>
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full border', cfg.cls)}>{cfg.label}</span>
                    </div>
                    {entry.details && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{entry.details}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                      <span className="flex items-center gap-0.5"><User size={9} />{entry.performedBy}</span>
                      <span className="text-gray-300">·</span>
                      <span>{entry.role}</span>
                      <span className="flex items-center gap-0.5 ml-auto whitespace-nowrap"><Clock size={9} />{fmtFull(entry.timestamp)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
