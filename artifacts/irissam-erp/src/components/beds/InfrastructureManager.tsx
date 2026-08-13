/**
 * InfrastructureManager — modal d'administration de l'infrastructure hospitalière :
 * Bâtiments / Étages / Chambres / Lits — ajout, modification, activation/désactivation.
 * Réservé à la permission infrastructure.manage (API /infrastructure, PostgreSQL).
 */
import { useState } from 'react';
import {
  X, Plus, Pencil, Power, AlertTriangle,
  Building2, Layers, DoorOpen, BedDouble,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import {
  BED_TYPE_LABEL, BED_STATUS_LABEL,
  type TreeBuilding, type ServiceRef, type BedCardData,
} from './types';

const INPUT = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg px-3 py-2 hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap';
const BTN_LIGHT = 'inline-flex items-center gap-1 text-xs font-medium border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50 text-gray-600 disabled:opacity-50 whitespace-nowrap';

type Tab = 'buildings' | 'floors' | 'rooms' | 'beds';
type Run = (fn: () => Promise<void>) => Promise<void>;

interface FlatFloor { id: string; name: string; level: number; active: boolean; buildingId: string; buildingName: string; }
interface FlatRoom {
  id: string; number: string; name: string | null; active: boolean; bedCount: number;
  serviceId: string | null; serviceName: string | null;
  floorId: string; floorName: string; buildingName: string;
}

function flattenFloors(tree: TreeBuilding[]): FlatFloor[] {
  return tree.flatMap(b => b.floors.map(f => ({
    id: f.id, name: f.name, level: f.level, active: f.active,
    buildingId: b.id, buildingName: b.name,
  })));
}
function flattenRooms(tree: TreeBuilding[]): FlatRoom[] {
  return tree.flatMap(b => b.floors.flatMap(f => f.rooms.map(r => ({
    id: r.id, number: r.number, name: r.name, active: r.active, bedCount: r.bedCount,
    serviceId: r.serviceId, serviceName: r.serviceName,
    floorId: f.id, floorName: f.name, buildingName: b.name,
  }))));
}

// ─── Bâtiments ────────────────────────────────────────────────────────────────

function BuildingsTab({ tree, run, busy }: { tree: TreeBuilding[]; run: Run; busy: boolean }) {
  const [form, setForm] = useState({ name: '', code: '' });
  const [edit, setEdit] = useState<{ id: string; name: string; code: string } | null>(null);
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Ajouter un bâtiment</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input className={INPUT} placeholder="Nom (ex : Bâtiment Principal)" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
          <input className={`${INPUT} sm:w-44`} placeholder="Code (ex : BAT-A)" value={form.code}
            onChange={e => setForm(f => ({ ...f, code: e.target.value }))}/>
          <button disabled={busy || !form.name.trim() || !form.code.trim()} className={BTN_PRIMARY}
            onClick={() => run(async () => {
              await apiClient.post('/infrastructure/buildings', { name: form.name.trim(), code: form.code.trim() });
              setForm({ name: '', code: '' });
            })}>
            <Plus size={14}/> Ajouter
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {tree.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Aucun bâtiment.</p>}
        {tree.map(b => edit?.id === b.id ? (
          <div key={b.id} className="border border-blue-200 rounded-xl p-3 flex flex-col sm:flex-row gap-2">
            <input className={INPUT} value={edit.name} onChange={e => setEdit(s => s && ({ ...s, name: e.target.value }))}/>
            <input className={`${INPUT} sm:w-44`} value={edit.code} onChange={e => setEdit(s => s && ({ ...s, code: e.target.value }))}/>
            <div className="flex gap-2">
              <button disabled={busy || !edit.name.trim() || !edit.code.trim()} className={BTN_PRIMARY}
                onClick={() => run(async () => {
                  await apiClient.patch(`/infrastructure/buildings/${b.id}`, { name: edit.name.trim(), code: edit.code.trim() });
                  setEdit(null);
                })}>Enregistrer</button>
              <button className={BTN_LIGHT} onClick={() => setEdit(null)}>Annuler</button>
            </div>
          </div>
        ) : (
          <div key={b.id} className={`border border-gray-100 rounded-xl p-3 flex flex-wrap items-center gap-2 ${b.active ? '' : 'bg-gray-50 opacity-70'}`}>
            <Building2 size={16} className="text-gray-400 shrink-0"/>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {b.name} <span className="text-xs text-gray-400 font-normal">({b.code})</span>
              </p>
              <p className="text-xs text-gray-400">{b.floors.length} étage{b.floors.length !== 1 ? 's' : ''}</p>
            </div>
            {!b.active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">Désactivé</span>}
            <button className={BTN_LIGHT} onClick={() => setEdit({ id: b.id, name: b.name, code: b.code })}><Pencil size={12}/> Modifier</button>
            <button disabled={busy} className={BTN_LIGHT}
              onClick={() => run(async () => { await apiClient.patch(`/infrastructure/buildings/${b.id}`, { active: !b.active }); })}>
              <Power size={12}/> {b.active ? 'Désactiver' : 'Activer'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Étages ───────────────────────────────────────────────────────────────────

function FloorsTab({ tree, run, busy }: { tree: TreeBuilding[]; run: Run; busy: boolean }) {
  const floors = flattenFloors(tree);
  const [form, setForm] = useState({ buildingId: '', name: '', level: '' });
  const [edit, setEdit] = useState<{ id: string; name: string; level: string } | null>(null);
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Ajouter un étage</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <select className={INPUT} value={form.buildingId} onChange={e => setForm(f => ({ ...f, buildingId: e.target.value }))}>
            <option value="">— Bâtiment —</option>
            {tree.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input className={INPUT} placeholder="Nom (ex : 1er étage)" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
          <input className={`${INPUT} sm:w-36`} type="number" placeholder="Niveau (0 = RDC)" value={form.level}
            onChange={e => setForm(f => ({ ...f, level: e.target.value }))}/>
          <button disabled={busy || !form.buildingId || !form.name.trim() || form.level === ''} className={BTN_PRIMARY}
            onClick={() => run(async () => {
              await apiClient.post('/infrastructure/floors', {
                buildingId: form.buildingId, name: form.name.trim(), level: Number(form.level),
              });
              setForm({ buildingId: form.buildingId, name: '', level: '' });
            })}>
            <Plus size={14}/> Ajouter
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {floors.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Aucun étage.</p>}
        {floors.map(f => edit?.id === f.id ? (
          <div key={f.id} className="border border-blue-200 rounded-xl p-3 flex flex-col sm:flex-row gap-2">
            <input className={INPUT} value={edit.name} onChange={e => setEdit(s => s && ({ ...s, name: e.target.value }))}/>
            <input className={`${INPUT} sm:w-36`} type="number" value={edit.level} onChange={e => setEdit(s => s && ({ ...s, level: e.target.value }))}/>
            <div className="flex gap-2">
              <button disabled={busy || !edit.name.trim() || edit.level === ''} className={BTN_PRIMARY}
                onClick={() => run(async () => {
                  await apiClient.patch(`/infrastructure/floors/${f.id}`, { name: edit.name.trim(), level: Number(edit.level) });
                  setEdit(null);
                })}>Enregistrer</button>
              <button className={BTN_LIGHT} onClick={() => setEdit(null)}>Annuler</button>
            </div>
          </div>
        ) : (
          <div key={f.id} className={`border border-gray-100 rounded-xl p-3 flex flex-wrap items-center gap-2 ${f.active ? '' : 'bg-gray-50 opacity-70'}`}>
            <Layers size={16} className="text-gray-400 shrink-0"/>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate">{f.name}</p>
              <p className="text-xs text-gray-400">{f.buildingName} · niveau {f.level}</p>
            </div>
            {!f.active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">Désactivé</span>}
            <button className={BTN_LIGHT} onClick={() => setEdit({ id: f.id, name: f.name, level: String(f.level) })}><Pencil size={12}/> Modifier</button>
            <button disabled={busy} className={BTN_LIGHT}
              onClick={() => run(async () => { await apiClient.patch(`/infrastructure/floors/${f.id}`, { active: !f.active }); })}>
              <Power size={12}/> {f.active ? 'Désactiver' : 'Activer'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Chambres ─────────────────────────────────────────────────────────────────

function RoomsTab({ tree, services, run, busy }: { tree: TreeBuilding[]; services: ServiceRef[]; run: Run; busy: boolean }) {
  const floors = flattenFloors(tree);
  const rooms = flattenRooms(tree);
  const [form, setForm] = useState({ floorId: '', number: '', name: '', serviceId: '' });
  const [edit, setEdit] = useState<{ id: string; number: string; name: string; floorId: string; serviceId: string } | null>(null);

  const floorLabel = (f: FlatFloor) => `${f.buildingName} — ${f.name}`;

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Ajouter une chambre</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select className={INPUT} value={form.floorId} onChange={e => setForm(f => ({ ...f, floorId: e.target.value }))}>
            <option value="">— Étage —</option>
            {floors.map(f => <option key={f.id} value={f.id}>{floorLabel(f)}</option>)}
          </select>
          <input className={INPUT} placeholder="Numéro (ex : CH-101)" value={form.number}
            onChange={e => setForm(f => ({ ...f, number: e.target.value }))}/>
          <input className={INPUT} placeholder="Nom (optionnel)" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
          <select className={INPUT} value={form.serviceId} onChange={e => setForm(f => ({ ...f, serviceId: e.target.value }))}>
            <option value="">— Service (optionnel) —</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button disabled={busy || !form.floorId || !form.number.trim()} className={`${BTN_PRIMARY} mt-2`}
          onClick={() => run(async () => {
            await apiClient.post('/infrastructure/rooms', {
              floorId: form.floorId, number: form.number.trim(), name: form.name.trim(), serviceId: form.serviceId,
            });
            setForm({ floorId: form.floorId, number: '', name: '', serviceId: form.serviceId });
          })}>
          <Plus size={14}/> Ajouter
        </button>
      </div>
      <div className="space-y-2">
        {rooms.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Aucune chambre. Créez d'abord un bâtiment et un étage.</p>}
        {rooms.map(r => edit?.id === r.id ? (
          <div key={r.id} className="border border-blue-200 rounded-xl p-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className={INPUT} value={edit.number} placeholder="Numéro"
                onChange={e => setEdit(s => s && ({ ...s, number: e.target.value }))}/>
              <input className={INPUT} value={edit.name} placeholder="Nom (optionnel)"
                onChange={e => setEdit(s => s && ({ ...s, name: e.target.value }))}/>
              <select className={INPUT} value={edit.floorId} onChange={e => setEdit(s => s && ({ ...s, floorId: e.target.value }))}>
                {floors.map(f => <option key={f.id} value={f.id}>{floorLabel(f)}</option>)}
              </select>
              <select className={INPUT} value={edit.serviceId} onChange={e => setEdit(s => s && ({ ...s, serviceId: e.target.value }))}>
                <option value="">— Aucun service —</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button disabled={busy || !edit.number.trim()} className={BTN_PRIMARY}
                onClick={() => run(async () => {
                  await apiClient.patch(`/infrastructure/rooms/${r.id}`, {
                    number: edit.number.trim(), name: edit.name.trim(), floorId: edit.floorId, serviceId: edit.serviceId,
                  });
                  setEdit(null);
                })}>Enregistrer</button>
              <button className={BTN_LIGHT} onClick={() => setEdit(null)}>Annuler</button>
            </div>
          </div>
        ) : (
          <div key={r.id} className={`border border-gray-100 rounded-xl p-3 flex flex-wrap items-center gap-2 ${r.active ? '' : 'bg-gray-50 opacity-70'}`}>
            <DoorOpen size={16} className="text-gray-400 shrink-0"/>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {r.number}{r.name ? ` — ${r.name}` : ''}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {r.buildingName} · {r.floorName} · {r.serviceName ?? 'sans service'} · {r.bedCount} lit{r.bedCount !== 1 ? 's' : ''}
              </p>
            </div>
            {!r.active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">Désactivée</span>}
            <button className={BTN_LIGHT}
              onClick={() => setEdit({ id: r.id, number: r.number, name: r.name ?? '', floorId: r.floorId, serviceId: r.serviceId ?? '' })}>
              <Pencil size={12}/> Modifier
            </button>
            <button disabled={busy} className={BTN_LIGHT}
              onClick={() => run(async () => { await apiClient.patch(`/infrastructure/rooms/${r.id}`, { active: !r.active }); })}>
              <Power size={12}/> {r.active ? 'Désactiver' : 'Activer'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Lits ─────────────────────────────────────────────────────────────────────

const ADMIN_STATUSES = ['disponible', 'hors_service', 'maintenance'];

function BedsTab({ tree, services, beds, run, busy }: {
  tree: TreeBuilding[]; services: ServiceRef[]; beds: BedCardData[]; run: Run; busy: boolean;
}) {
  const rooms = flattenRooms(tree);
  const [form, setForm] = useState({ number: '', type: 'standard', roomId: '', serviceId: '' });
  const [edit, setEdit] = useState<{ id: string; number: string; type: string; roomId: string; serviceId: string; status: string } | null>(null);

  const roomLabel = (r: FlatRoom) => `${r.number} (${r.buildingName} · ${r.floorName})`;

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Ajouter un lit</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input className={INPUT} placeholder="Numéro (ex : 111)" value={form.number}
            onChange={e => setForm(f => ({ ...f, number: e.target.value }))}/>
          <select className={INPUT} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            {Object.entries(BED_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className={INPUT} value={form.roomId} onChange={e => setForm(f => ({ ...f, roomId: e.target.value }))}>
            <option value="">— Chambre (optionnel) —</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{roomLabel(r)}</option>)}
          </select>
          <select className={INPUT} value={form.serviceId} onChange={e => setForm(f => ({ ...f, serviceId: e.target.value }))}>
            <option value="">— Service (hérité de la chambre) —</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button disabled={busy || !form.number.trim()} className={`${BTN_PRIMARY} mt-2`}
          onClick={() => run(async () => {
            await apiClient.post('/infrastructure/beds', {
              number: form.number.trim(), type: form.type, roomId: form.roomId, serviceId: form.serviceId,
            });
            setForm({ number: '', type: form.type, roomId: form.roomId, serviceId: form.serviceId });
          })}>
          <Plus size={14}/> Ajouter
        </button>
      </div>
      <div className="space-y-2">
        {beds.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Aucun lit enregistré.</p>}
        {beds.map(b => {
          const occupied = b.status === 'occupe' || b.status === 'reserve';
          const canSetStatus = ADMIN_STATUSES.includes(b.status);
          if (edit?.id === b.id) {
            return (
              <div key={b.id} className="border border-blue-200 rounded-xl p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input className={INPUT} value={edit.number} placeholder="Numéro"
                    onChange={e => setEdit(s => s && ({ ...s, number: e.target.value }))}/>
                  <select className={INPUT} value={edit.type} onChange={e => setEdit(s => s && ({ ...s, type: e.target.value }))}>
                    {Object.entries(BED_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  {!occupied && (
                    <>
                      <select className={INPUT} value={edit.roomId} onChange={e => setEdit(s => s && ({ ...s, roomId: e.target.value }))}>
                        <option value="">— Aucune chambre —</option>
                        {rooms.map(r => <option key={r.id} value={r.id}>{roomLabel(r)}</option>)}
                      </select>
                      <select className={INPUT} value={edit.serviceId} onChange={e => setEdit(s => s && ({ ...s, serviceId: e.target.value }))}>
                        <option value="">— Aucun service —</option>
                        {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      {canSetStatus && (
                        <select className={INPUT} value={edit.status} onChange={e => setEdit(s => s && ({ ...s, status: e.target.value }))}>
                          {ADMIN_STATUSES.map(st => <option key={st} value={st}>{BED_STATUS_LABEL[st]}</option>)}
                        </select>
                      )}
                    </>
                  )}
                </div>
                {occupied && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle size={12}/> Lit {BED_STATUS_LABEL[b.status]?.toLowerCase()} — déplacement, service et statut gérés via Admissions.
                  </p>
                )}
                <div className="flex gap-2">
                  <button disabled={busy || !edit.number.trim()} className={BTN_PRIMARY}
                    onClick={() => run(async () => {
                      const payload: Record<string, unknown> = { number: edit.number.trim(), type: edit.type };
                      if (!occupied) {
                        payload.roomId = edit.roomId;
                        payload.serviceId = edit.serviceId;
                        if (canSetStatus) payload.status = edit.status;
                      }
                      await apiClient.patch(`/infrastructure/beds/${b.id}`, payload);
                      setEdit(null);
                    })}>Enregistrer</button>
                  <button className={BTN_LIGHT} onClick={() => setEdit(null)}>Annuler</button>
                </div>
              </div>
            );
          }
          return (
            <div key={b.id} className={`border border-gray-100 rounded-xl p-3 flex flex-wrap items-center gap-2 ${b.status === 'hors_service' ? 'bg-gray-50 opacity-70' : ''}`}>
              <BedDouble size={16} className="text-gray-400 shrink-0"/>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  Lit {b.number} <span className="text-xs text-gray-400 font-normal">· {BED_TYPE_LABEL[b.type] ?? b.type}</span>
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {b.roomNumber ? `Chambre ${b.roomNumber}` : 'Sans chambre'}
                  {b.buildingName ? ` · ${b.buildingName}` : ''}
                  {(b.serviceName ?? b.admissionServiceName) ? ` · ${b.serviceName ?? b.admissionServiceName}` : ' · sans service'}
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {BED_STATUS_LABEL[b.status] ?? b.status}
              </span>
              <button className={BTN_LIGHT}
                onClick={() => setEdit({
                  id: b.id, number: b.number, type: b.type,
                  roomId: b.roomId ?? '', serviceId: b.serviceId ?? '',
                  status: ADMIN_STATUSES.includes(b.status) ? b.status : 'disponible',
                })}>
                <Pencil size={12}/> Modifier
              </button>
              {!occupied && b.status !== 'nettoyage' && (
                <button disabled={busy} className={BTN_LIGHT}
                  onClick={() => run(async () => {
                    await apiClient.patch(`/infrastructure/beds/${b.id}`, {
                      status: b.status === 'disponible' ? 'hors_service' : 'disponible',
                    });
                  })}>
                  <Power size={12}/> {b.status === 'disponible' ? 'Désactiver' : 'Activer'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: typeof Building2 }[] = [
  { id: 'buildings', label: 'Bâtiments', icon: Building2 },
  { id: 'floors',    label: 'Étages',    icon: Layers },
  { id: 'rooms',     label: 'Chambres',  icon: DoorOpen },
  { id: 'beds',      label: 'Lits',      icon: BedDouble },
];

export function InfrastructureManager({ open, onClose, tree, services, beds, onChanged }: {
  open: boolean;
  onClose: () => void;
  tree: TreeBuilding[];
  services: ServiceRef[];
  beds: BedCardData[];
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>('buildings');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run: Run = async (fn) => {
    setBusy(true); setError(null);
    try {
      await fn();
      onChanged();
    } catch (e: unknown) {
      const b = e as { data?: { error?: string }; message?: string };
      setError(b?.data?.error ?? b?.message ?? 'Erreur inattendue');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-3xl rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Gérer l'infrastructure</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18}/></button>
        </div>
        <div className="flex gap-1 px-4 pt-3 border-b border-gray-100 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setError(null); }}
              className={`inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-t-lg border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id ? 'border-blue-600 text-blue-700 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <t.icon size={14}/> {t.label}
            </button>
          ))}
        </div>
        {error && (
          <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-700 text-sm flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0"/>
            <span className="min-w-0">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
        <div className="p-4 overflow-y-auto">
          {tab === 'buildings' && <BuildingsTab tree={tree} run={run} busy={busy}/>}
          {tab === 'floors'    && <FloorsTab tree={tree} run={run} busy={busy}/>}
          {tab === 'rooms'     && <RoomsTab tree={tree} services={services} run={run} busy={busy}/>}
          {tab === 'beds'      && <BedsTab tree={tree} services={services} beds={beds} run={run} busy={busy}/>}
        </div>
      </div>
    </div>
  );
}
