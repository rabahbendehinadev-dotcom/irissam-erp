/** Sélecteurs en cascade Bâtiment → Étage → (Chambre) — structure hospitalière stricte.
 *  Le service n'est jamais choisi au niveau du lit : il est hérité de la chambre. */
import type { TreeBuilding, TreeRoom } from './types';

export interface CascadeValue { buildingId: string; floorId: string; roomId: string; }
export const EMPTY_CASCADE: CascadeValue = { buildingId: '', floorId: '', roomId: '' };

/** Retrouve bâtiment + étage à partir d'une chambre connue (préremplissage d'une édition). */
export function findRoomChain(tree: TreeBuilding[], roomId: string | null): { value: CascadeValue; room: TreeRoom | null } {
  if (roomId) {
    for (const b of tree) {
      for (const f of b.floors) {
        const room = f.rooms.find(r => r.id === roomId);
        if (room) return { value: { buildingId: b.id, floorId: f.id, roomId: room.id }, room };
      }
    }
  }
  return { value: EMPTY_CASCADE, room: null };
}

/** Retrouve le bâtiment d'un étage (préremplissage de l'édition d'une chambre). */
export function findFloorChain(tree: TreeBuilding[], floorId: string | null): CascadeValue {
  if (floorId) {
    for (const b of tree) {
      if (b.floors.some(f => f.id === floorId)) return { buildingId: b.id, floorId, roomId: '' };
    }
  }
  return EMPTY_CASCADE;
}

const INPUT = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50';

export function RoomCascade({ tree, value, onChange, withRoom = true }: {
  tree: TreeBuilding[];
  value: CascadeValue;
  /** room = chambre sélectionnée (null tant que la cascade n'est pas complète). */
  onChange: (v: CascadeValue, room: TreeRoom | null) => void;
  /** false → Bâtiment + Étage uniquement (formulaires de chambre). */
  withRoom?: boolean;
}) {
  const building = tree.find(b => b.id === value.buildingId) ?? null;
  const floors = building?.floors ?? [];
  const floor = floors.find(f => f.id === value.floorId) ?? null;
  const rooms = floor?.rooms ?? [];
  return (
    <>
      <select className={INPUT} value={value.buildingId}
        onChange={e => onChange({ buildingId: e.target.value, floorId: '', roomId: '' }, null)}>
        <option value="">— Bâtiment —</option>
        {tree.map(b => <option key={b.id} value={b.id}>{b.name}{b.active ? '' : ' (désactivé)'}</option>)}
      </select>
      <select className={INPUT} value={value.floorId} disabled={!building}
        onChange={e => onChange({ buildingId: value.buildingId, floorId: e.target.value, roomId: '' }, null)}>
        <option value="">— Étage —</option>
        {floors.map(f => <option key={f.id} value={f.id}>{f.name}{f.active ? '' : ' (désactivé)'}</option>)}
      </select>
      {withRoom && (
        <select className={INPUT} value={value.roomId} disabled={!floor}
          onChange={e => onChange({ ...value, roomId: e.target.value }, rooms.find(r => r.id === e.target.value) ?? null)}>
          <option value="">— Chambre —</option>
          {rooms.map(r => (
            <option key={r.id} value={r.id}>
              {r.number}{r.name ? ` — ${r.name}` : ''} · {r.serviceName ?? 'sans service'}{r.active ? '' : ' (désactivée)'}
            </option>
          ))}
        </select>
      )}
    </>
  );
}
