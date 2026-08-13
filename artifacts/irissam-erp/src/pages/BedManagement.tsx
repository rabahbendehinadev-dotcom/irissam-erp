/**
 * Gestion des lits — tous les lits de l'hôpital en cartes (PostgreSQL /infrastructure/bed-cards),
 * filtres en cascade Bâtiment → Étage → Service → Chambre → Statut + recherche
 * (n° lit, chambre, patient, MPI/IPP, n° dossier, médecin).
 * Lit occupé : patient, MPI/IPP, n° dossier, n° admission, date/heure d'entrée, médecin
 * responsable + accès direct au dossier patient.
 * Lits historiques « Non affecté » : action « Affecter » vers leur vraie chambre.
 */
import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import {
  BedDouble, CheckCircle, Clock, Wrench, AlertTriangle, RefreshCw,
  Settings2, User, CalendarCheck, Link2, FolderOpen,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuery } from '@/hooks/useQuery';
import { usePermission } from '@/hooks/usePermission';
import { InfrastructureManager } from '@/components/beds/InfrastructureManager';
import { AssignBedDialog } from '@/components/beds/AssignBedDialog';
import {
  BED_TYPE_LABEL, BED_STATUS_LABEL,
  type BedCardData, type TreeBuilding, type ServiceRef,
} from '@/components/beds/types';

const STATUS_COLOR: Record<string, string> = {
  disponible:   'bg-green-50 text-green-800 border-green-200',
  occupe:       'bg-red-50 text-red-800 border-red-200',
  reserve:      'bg-purple-50 text-purple-800 border-purple-200',
  nettoyage:    'bg-amber-50 text-amber-800 border-amber-200',
  maintenance:  'bg-gray-50 text-gray-600 border-gray-200',
  hors_service: 'bg-gray-50 text-gray-400 border-gray-200',
};

const SELECT_CLS = 'text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50';

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function effService(b: BedCardData): string | null {
  return b.serviceName ?? b.admissionServiceName ?? null;
}

// ─── Carte lit ────────────────────────────────────────────────────────────────

function BedCardView({ bed, canManage, onAssign }: {
  bed: BedCardData;
  canManage: boolean;
  onAssign: () => void;
}) {
  const svc = effService(bed);
  const occupied = bed.status === 'occupe' || bed.status === 'reserve';
  return (
    <div className={`border rounded-xl p-3 ${STATUS_COLOR[bed.status] ?? 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <BedDouble size={15} className="shrink-0"/>
          <span className="text-sm font-bold truncate">Lit {bed.number}</span>
        </div>
        <div className="flex items-center gap-1">
          {!bed.roomId && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">Non affecté</span>
          )}
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/70 whitespace-nowrap">
            {BED_STATUS_LABEL[bed.status] ?? bed.status}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
        <span className="opacity-60">Chambre</span><span className="font-medium text-right truncate">{bed.roomNumber ?? '—'}</span>
        <span className="opacity-60">Étage</span><span className="font-medium text-right truncate">{bed.floorLabel ?? '—'}</span>
        <span className="opacity-60">Bâtiment</span><span className="font-medium text-right truncate">{bed.buildingName ?? '—'}</span>
        <span className="opacity-60">Service</span><span className="font-medium text-right truncate">{svc ?? '—'}</span>
        <span className="opacity-60">Type</span><span className="font-medium text-right truncate">{BED_TYPE_LABEL[bed.type] ?? bed.type}</span>
      </div>
      {occupied && (bed.patientFullName || bed.patientName) && (
        <div className="mt-2 bg-white/70 rounded-lg p-2 text-[11px] space-y-0.5">
          <p className="font-bold text-xs truncate flex items-center gap-1">
            <User size={11} className="shrink-0"/>{bed.patientFullName ?? bed.patientName}
          </p>
          <div className="flex justify-between gap-2"><span className="opacity-60">MPI / IPP</span><span className="font-medium truncate">{bed.mpiId ?? '—'}</span></div>
          <div className="flex justify-between gap-2"><span className="opacity-60">N° dossier</span><span className="font-medium truncate">{bed.fileNumber ?? '—'}</span></div>
          <div className="flex justify-between gap-2"><span className="opacity-60">N° admission</span><span className="font-medium truncate">{bed.admissionNumber ?? '—'}</span></div>
          <div className="flex justify-between gap-2"><span className="opacity-60">Entrée</span><span className="font-medium">{fmtDateTime(bed.admissionDate ?? bed.occupiedAt)}</span></div>
          <div className="flex justify-between gap-2"><span className="opacity-60">Médecin</span><span className="font-medium truncate">{bed.doctorName ?? '—'}</span></div>
          {bed.patientId && (
            <Link href={`/patients/${bed.patientId}`}
              className="mt-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-blue-700 bg-white rounded-lg py-1.5 border border-blue-100 hover:bg-blue-50">
              <FolderOpen size={12}/> Dossier patient
            </Link>
          )}
        </div>
      )}
      {canManage && !bed.roomId && !occupied && (
        <button onClick={onAssign}
          className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 rounded-lg py-1.5 hover:bg-amber-200 transition-colors">
          <Link2 size={12}/> Affecter à une chambre
        </button>
      )}
      {canManage && !bed.roomId && occupied && (
        <p className="mt-2 text-[10px] text-amber-700/80 text-center">Affectation possible après libération (Admissions / ADT)</p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BedManagement() {
  const { can } = usePermission();
  const canManage = can('infrastructure.manage');

  const cardsQ    = useQuery<BedCardData[]>('/infrastructure/bed-cards');
  const treeQ     = useQuery<TreeBuilding[]>('/infrastructure/tree');
  const servicesQ = useQuery<ServiceRef[]>('/infrastructure/services');

  const beds     = Array.isArray(cardsQ.data)    ? cardsQ.data    : [];
  const tree     = Array.isArray(treeQ.data)     ? treeQ.data     : [];
  const services = Array.isArray(servicesQ.data) ? servicesQ.data : [];

  const [search, setSearch]       = useState('');
  const [buildingF, setBuildingF] = useState('all');   // 'all' | 'none' | buildingId
  const [floorF, setFloorF]       = useState('all');   // 'all' | floorId
  const [serviceF, setServiceF]   = useState('all');   // 'all' | 'none' | nom du service
  const [roomF, setRoomF]         = useState('all');   // 'all' | 'none' | roomId
  const [statusF, setStatusF]     = useState('all');
  const [managerOpen, setManagerOpen] = useState(false);
  const [assignBed, setAssignBed] = useState<BedCardData | null>(null);

  const refetchAll = () => { cardsQ.refetch(); treeQ.refetch(); };

  const floorOptions = useMemo(() => {
    const source = buildingF !== 'all' && buildingF !== 'none'
      ? tree.filter(b => b.id === buildingF)
      : tree;
    return source.flatMap(b => b.floors.map(f => ({
      id: f.id,
      label: source.length > 1 ? `${b.name} — ${f.name}` : f.name,
    })));
  }, [tree, buildingF]);

  const serviceOptions = useMemo(() => {
    const names = new Set<string>(services.map(s => s.name));
    for (const b of beds) { const s = effService(b); if (s) names.add(s); }
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [services, beds]);

  // Chambres proposées : dépendent du bâtiment, de l'étage et du service sélectionnés (cascade)
  const roomOptions = useMemo(() => {
    const out: { id: string; label: string }[] = [];
    for (const b of tree) {
      if (buildingF !== 'all' && buildingF !== 'none' && b.id !== buildingF) continue;
      for (const f of b.floors) {
        if (floorF !== 'all' && f.id !== floorF) continue;
        for (const r of f.rooms) {
          if (serviceF !== 'all' && serviceF !== 'none' && (r.serviceName ?? '') !== serviceF) continue;
          out.push({ id: r.id, label: buildingF === 'all' ? `${r.number} (${b.name})` : r.number });
        }
      }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [tree, buildingF, floorF, serviceF]);

  const filtered = useMemo(() => beds.filter(b => {
    if (buildingF === 'none' && b.buildingId) return false;
    if (buildingF !== 'all' && buildingF !== 'none' && b.buildingId !== buildingF) return false;
    if (floorF !== 'all' && b.floorId !== floorF) return false;
    const svc = effService(b);
    if (serviceF === 'none' && svc) return false;
    if (serviceF !== 'all' && serviceF !== 'none' && svc !== serviceF) return false;
    if (roomF === 'none' && b.roomId) return false;
    if (roomF !== 'all' && roomF !== 'none' && b.roomId !== roomF) return false;
    if (statusF !== 'all' && b.status !== statusF) return false;
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = [
        b.number, b.roomNumber, b.floorLabel, b.buildingName, svc,
        b.patientFullName ?? b.patientName, b.mpiId, b.fileNumber, b.admissionNumber, b.doctorName,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [beds, buildingF, floorF, serviceF, roomF, statusF, search]);

  const stats = useMemo(() => ({
    total:      beds.length,
    disponible: beds.filter(b => b.status === 'disponible').length,
    occupe:     beds.filter(b => b.status === 'occupe').length,
    reserve:    beds.filter(b => b.status === 'reserve').length,
    nettoyage:  beds.filter(b => b.status === 'nettoyage').length,
    indispo:    beds.filter(b => b.status === 'hors_service' || b.status === 'maintenance').length,
    occupancyRate: beds.length > 0
      ? Math.round((beds.filter(b => b.status === 'occupe').length / beds.length) * 100)
      : 0,
  }), [beds]);

  // ─── Chargement ─────────────────────────────────────────────────────────────
  if (cardsQ.loading) return (
    <DashboardLayout>
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 bg-white/10 rounded-lg w-1/3"/>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 bg-white/10 rounded-xl"/>)}
        </div>
        <div className="h-64 bg-white/10 rounded-xl"/>
      </div>
    </DashboardLayout>
  );

  // ─── Erreur ─────────────────────────────────────────────────────────────────
  if (cardsQ.error) return (
    <DashboardLayout>
      <div className="p-6 max-w-md mx-auto text-center mt-20">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-red-400"/>
        <p className="text-white font-semibold mb-1">Impossible de charger les lits</p>
        <p className="text-white/50 text-sm mb-4">{cardsQ.error}</p>
        <button onClick={cardsQ.refetch}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 text-sm">
          <RefreshCw className="w-4 h-4"/> Réessayer
        </button>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        <PageHeader
          title="Gestion des lits"
          subtitle="Tous les lits par bâtiment, étage, service et chambre"
          actions={
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Occupation : {stats.occupancyRate}%
              </span>
              {canManage && (
                <button onClick={() => setManagerOpen(true)}
                  className="inline-flex items-center gap-2 text-sm font-medium bg-blue-600 text-white rounded-lg px-3 py-2 hover:bg-blue-700 transition-colors">
                  <Settings2 size={15}/> Gérer l'infrastructure
                </button>
              )}
              <button onClick={refetchAll}
                className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors">
                <RefreshCw size={16}/>
              </button>
            </div>
          }
        />

        {/* Statistiques */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total',        value: stats.total,      icon: BedDouble,     color: 'text-gray-600',   bg: 'bg-gray-50' },
            { label: 'Disponibles',  value: stats.disponible, icon: CheckCircle,   color: 'text-green-600',  bg: 'bg-green-50' },
            { label: 'Occupés',      value: stats.occupe,     icon: BedDouble,     color: 'text-red-600',    bg: 'bg-red-50' },
            { label: 'Réservés',     value: stats.reserve,    icon: CalendarCheck, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Nettoyage',    value: stats.nettoyage,  icon: Clock,         color: 'text-amber-600',  bg: 'bg-amber-50' },
            { label: 'Indisponibles',value: stats.indispo,    icon: Wrench,        color: 'text-gray-500',   bg: 'bg-gray-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border border-gray-100 rounded-xl p-4 flex items-center gap-3`}>
              <s.icon size={20} className={s.color}/>
              <div>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filtres en cascade : Bâtiment → Étage → Service → Chambre → Statut */}
        <div className="flex flex-wrap gap-3">
          <select value={buildingF}
            onChange={e => { setBuildingF(e.target.value); setFloorF('all'); setRoomF('all'); }}
            className={SELECT_CLS}>
            <option value="all">Tous les bâtiments</option>
            {tree.map(b => <option key={b.id} value={b.id}>{b.name}{b.active ? '' : ' (désactivé)'}</option>)}
            <option value="none">Non affecté</option>
          </select>
          <select value={floorF}
            onChange={e => { setFloorF(e.target.value); setRoomF('all'); }}
            disabled={buildingF === 'none'}
            className={SELECT_CLS}>
            <option value="all">Tous les étages</option>
            {floorOptions.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          <select value={serviceF}
            onChange={e => { setServiceF(e.target.value); setRoomF('all'); }}
            className={SELECT_CLS}>
            <option value="all">Tous les services</option>
            {serviceOptions.map(s => <option key={s} value={s}>{s}</option>)}
            <option value="none">Sans service</option>
          </select>
          <select value={roomF} onChange={e => setRoomF(e.target.value)}
            disabled={buildingF === 'none'}
            className={SELECT_CLS}>
            <option value="all">Toutes les chambres</option>
            {roomOptions.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            <option value="none">Non affecté</option>
          </select>
          <select value={statusF} onChange={e => setStatusF(e.target.value)}
            className={SELECT_CLS}>
            <option value="all">Tous les statuts</option>
            {Object.entries(BED_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Lit, chambre, patient, MPI/IPP, dossier, médecin…"
            className={`${SELECT_CLS} flex-1 min-w-[220px]`}/>
        </div>

        {/* Compteur */}
        <p className="text-sm text-gray-400">
          {filtered.length} lit{filtered.length !== 1 ? 's' : ''} affiché{filtered.length !== 1 ? 's' : ''} · {beds.length} au total
        </p>

        {/* Cartes */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(bed => (
              <BedCardView key={bed.id} bed={bed} canManage={canManage} onAssign={() => setAssignBed(bed)}/>
            ))}
          </div>
        )}

        {/* États vides */}
        {filtered.length === 0 && beds.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <BedDouble size={40} className="mx-auto mb-3 opacity-30"/>
            <p className="font-medium">Aucun lit enregistré</p>
            <p className="text-sm mt-1">
              {canManage
                ? 'Utilisez « Gérer l\'infrastructure » pour créer bâtiments, étages, chambres et lits.'
                : 'L\'administration n\'a pas encore configuré les lits.'}
            </p>
          </div>
        )}
        {filtered.length === 0 && beds.length > 0 && (
          <div className="text-center py-16 text-gray-400">
            <BedDouble size={40} className="mx-auto mb-3 opacity-30"/>
            <p>Aucun lit ne correspond aux filtres.</p>
          </div>
        )}
      </div>

      <InfrastructureManager
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        tree={tree}
        services={services}
        beds={beds}
        onChanged={refetchAll}
      />
      {assignBed && (
        <AssignBedDialog key={assignBed.id} bed={assignBed} tree={tree}
          onClose={() => setAssignBed(null)} onDone={refetchAll}/>
      )}
    </DashboardLayout>
  );
}
