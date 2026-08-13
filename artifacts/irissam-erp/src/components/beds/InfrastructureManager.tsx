/**
 * InfrastructureManager — modal d'administration de l'infrastructure hospitalière :
 * Bâtiments / Étages / Chambres / Lits — ajout, modification, activation/désactivation.
 * Structure stricte : Bâtiment → Étage → Chambre (service obligatoire) → Lit.
 * Le lit hérite automatiquement étage/bâtiment/service de sa chambre.
 * Réservé à la permission infrastructure.manage (API /infrastructure, PostgreSQL).
 */
import { useState } from 'react';
import {
  X, Plus, Pencil, Power, AlertTriangle, Link2,
  Building2, Layers, DoorOpen, BedDouble,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import {
  BED_TYPE_LABEL, BED_STATUS_LABEL,
  type TreeBuilding, type TreeRoom, type ServiceRef, type BedCardData,
} from './types';
import {
  RoomCascade, EMPTY_CASCADE, findRoomChain, findFloorChain, type CascadeValue,
} from './RoomCascade';

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
  const rooms = flattenRooms(tree);
  const [form, setForm] = useState<{ cascade: CascadeValue; number: string; name: string; serviceId: string }>({
    cascade: EMPTY_CASCADE, number: '', name: '', serviceId: '',
  });
  const [edit, setEdit] = useState<{ id: string; number: string; name: string; cascade: CascadeValue; serviceId: string } | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Ajouter une chambre</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <RoomCascade tree={tree} withRoom={false} value={form.cascade}
            onChange={v => setForm(f => ({ ...f, cascade: v }))}/>
          <select className={INPUT} value={form.serviceId} onChange={e => setForm(f => ({ ...f, serviceId: e.target.value }))}>
            <option value="">— Service (obligatoire) —</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input className={INPUT} placeholder="Numéro (ex : CH-101)" value={form.number}
            onChange={e => setForm(f => ({ ...f, number: e.target.value }))}/>
          <input className={INPUT} placeholder="Nom (optionnel)" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
        </div>
        <button disabled={busy || !form.cascade.floorId || !form.serviceId || !form.number.trim()} className={`${BTN_PRIMARY} mt-2`}
          onClick={() => run(async () => {
            setInfo(null);
            const resp = await apiClient.post<{ attachedBeds?: string[] }>('/infrastructure/rooms', {
              floorId: form.cascade.floorId, number: form.number.trim(), name: form.name.trim(), serviceId: form.serviceId,
            });
            if (resp?.attachedBeds?.length) {
              setInfo(`${resp.attachedBeds.length} lit(s) historique(s) rattaché(s) automatiquement : ${resp.attachedBeds.join(', ')}.`);
            }
            setForm(f => ({ ...f, number: '', name: '' }));
          })}>
          <Plus size={14}/> Ajouter
        </button>
        <p className="text-[11px] text-gray-400 mt-2">
          Astuce : si le numéro saisi correspond à d'anciens lits « Non affecté » (ex : CH-101), ils seront rattachés automatiquement à cette chambre.
        </p>
      </div>
      {info && <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-green-700 text-sm">{info}</div>}
      <div className="space-y-2">
        {rooms.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Aucune chambre. Créez d'abord un bâtiment et un étage.</p>}
        {rooms.map(r => edit?.id === r.id ? (
          <div key={r.id} className="border border-blue-200 rounded-xl p-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <RoomCascade tree={tree} withRoom={false} value={edit.cascade}
                onChange={v => setEdit(s => s && ({ ...s, cascade: v }))}/>
              <select className={INPUT} value={edit.serviceId} onChange={e => setEdit(s => s && ({ ...s, serviceId: e.target.value }))}>
                <option value="">— Service (obligatoire) —</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input className={INPUT} value={edit.number} placeholder="Numéro"
                onChange={e => setEdit(s => s && ({ ...s, number: e.target.value }))}/>
              <input className={INPUT} value={edit.name} placeholder="Nom (optionnel)"
                onChange={e => setEdit(s => s && ({ ...s, name: e.target.value }))}/>
            </div>
            <div className="flex gap-2">
              <button disabled={busy || !edit.number.trim() || !edit.cascade.floorId || !edit.serviceId} className={BTN_PRIMARY}
                onClick={() => run(async () => {
                  await apiClient.patch(`/infrastructure/rooms/${r.id}`, {
                    number: edit.number.trim(), name: edit.name.trim(), floorId: edit.cascade.floorId, serviceId: edit.serviceId,
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
            {!r.serviceId && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Sans service</span>}
            {!r.active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">Désactivée</span>}
            <button className={BTN_LIGHT}
              onClick={() => setEdit({
                id: r.id, number: r.number, name: r.name ?? '',
                cascade: findFloorChain(tree, r.floorId), serviceId: r.serviceId ?? '',
              })}>
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

interface BedEdit {
  id: string; number: string; type: string; status: string;
  cascade: CascadeValue; room: TreeRoom | null;
  occupied: boolean; canSetStatus: boolean;
}

function BedsTab({ tree, beds, run, busy }: {
  tree: TreeBuilding[]; beds: BedCardData[]; run: Run; busy: boolean;
}) {
  const [form, setForm] = useState<{ number: string; type: string; cascade: CascadeValue; room: TreeRoom | null }>({
    number: '', type: 'standard', cascade: EMPTY_CASCADE, room: null,
  });
  const [edit, setEdit] = useState<BedEdit | null>(null);

  const openEdit = (b: BedCardData) => {
    const { value, room } = findRoomChain(tree, b.roomId);
    setEdit({
      id: b.id, number: b.number, type: b.type,
      status: ADMIN_STATUSES.includes(b.status) ? b.status : 'disponible',
      cascade: value, room,
      occupied: b.status === 'occupe' || b.status === 'reserve',
      canSetStatus: ADMIN_STATUSES.includes(b.status),
    });
  };

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
          <RoomCascade tree={tree} value={form.cascade}
            onChange={(v, r) => setForm(f => ({ ...f, cascade: v, room: r }))}/>
        </div>
        <p className="text-xs mt-2">
          {form.room
            ? (form.room.serviceId
                ? <span className="text-gray-600">Service hérité de la chambre : <span className="font-semibold">{form.room.serviceName}</span></span>
                : <span className="text-amber-600 inline-flex items-center gap-1"><AlertTriangle size={12}/> Cette chambre n'a pas de service — modifiez d'abord la chambre.</span>)
            : <span className="text-gray-400">La chambre est obligatoire : le lit hérite automatiquement de l'étage, du bâtiment et du service.</span>}
        </p>
        <button disabled={busy || !form.number.trim() || !form.cascade.roomId || !form.room?.serviceId} className={`${BTN_PRIMARY} mt-2`}
          onClick={() => run(async () => {
            await apiClient.post('/infrastructure/beds', {
              number: form.number.trim(), type: form.type, roomId: form.cascade.roomId,
            });
            setForm(f => ({ ...f, number: '' }));
          })}>
          <Plus size={14}/> Ajouter
        </button>
      </div>
      <div className="space-y-2">
        {beds.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Aucun lit enregistré.</p>}
        {beds.map(b => {
          const occupied = b.status === 'occupe' || b.status === 'reserve';
          if (edit?.id === b.id) {
            return (
              <div key={b.id} className="border border-blue-200 rounded-xl p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input className={INPUT} value={edit.number} placeholder="Numéro"
                    onChange={e => setEdit(s => s && ({ ...s, number: e.target.value }))}/>
                  <select className={INPUT} value={edit.type} onChange={e => setEdit(s => s && ({ ...s, type: e.target.value }))}>
                    {Object.entries(BED_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  {!edit.occupied && (
                    <>
                      <RoomCascade tree={tree} value={edit.cascade}
                        onChange={(v, r) => setEdit(s => s && ({ ...s, cascade: v, room: r }))}/>
                      {edit.canSetStatus && (
                        <select className={INPUT} value={edit.status} onChange={e => setEdit(s => s && ({ ...s, status: e.target.value }))}>
                          {ADMIN_STATUSES.map(st => <option key={st} value={st}>{BED_STATUS_LABEL[st]}</option>)}
                        </select>
                      )}
                    </>
                  )}
                </div>
                {edit.occupied ? (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle size={12}/> Lit {BED_STATUS_LABEL[b.status]?.toLowerCase()} — déplacement, service et statut gérés via Admissions.
                  </p>
                ) : (
                  <p className="text-xs">
                    {edit.cascade.roomId
                      ? (edit.room
                          ? (edit.room.serviceId
                              ? <span className="text-gray-600">Service hérité : <span className="font-semibold">{edit.room.serviceName}</span></span>
                              : <span className="text-amber-600 inline-flex items-center gap-1"><AlertTriangle size={12}/> Cette chambre n'a pas de service — modifiez d'abord la chambre.</span>)
                          : null)
                      : <span className="text-gray-400">Non affecté — sélectionnez une chambre pour hériter étage, bâtiment et service.</span>}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    disabled={busy || !edit.number.trim() || Boolean(edit.cascade.roomId && edit.room && !edit.room.serviceId)}
                    className={BTN_PRIMARY}
                    onClick={() => run(async () => {
                      const payload: Record<string, unknown> = { number: edit.number.trim(), type: edit.type };
                      if (!edit.occupied) {
                        if (edit.canSetStatus) payload.status = edit.status;
                        if (edit.cascade.roomId) payload.roomId = edit.cascade.roomId;
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
              {!b.roomId && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Non affecté</span>}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {BED_STATUS_LABEL[b.status] ?? b.status}
              </span>
              {!b.roomId && !occupied && (
                <button className={`${BTN_LIGHT} !border-amber-200 !text-amber-700 hover:!bg-amber-50`} onClick={() => openEdit(b)}>
                  <Link2 size={12}/> Affecter
                </button>
              )}
              <button className={BTN_LIGHT} onClick={() => openEdit(b)}>
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
          {tab === 'beds'      && <BedsTab tree={tree} beds={beds} run={run} busy={busy}/>}
        </div>
      </div>
    </div>
  );
}
