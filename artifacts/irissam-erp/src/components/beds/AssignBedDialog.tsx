/** Affecter un lit « Non affecté » à sa vraie chambre — il hérite alors automatiquement
 *  de l'étage, du bâtiment et du service de la chambre (PATCH /infrastructure/beds/:id). */
import { useState } from 'react';
import { X, AlertTriangle, Link2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { RoomCascade, EMPTY_CASCADE, type CascadeValue } from './RoomCascade';
import type { TreeBuilding, TreeRoom, BedCardData } from './types';

export function AssignBedDialog({ bed, tree, onClose, onDone }: {
  bed: BedCardData;
  tree: TreeBuilding[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState<CascadeValue>(EMPTY_CASCADE);
  const [room, setRoom] = useState<TreeRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true); setError(null);
    try {
      await apiClient.patch(`/infrastructure/beds/${bed.id}`, { roomId: value.roomId });
      onDone();
      onClose();
    } catch (e: unknown) {
      const b = e as { data?: { error?: string }; message?: string };
      setError(b?.data?.error ?? b?.message ?? 'Erreur inattendue');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><Link2 size={16}/> Affecter le lit {bed.number}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18}/></button>
        </div>
        <p className="text-xs text-gray-500">
          Choisissez la chambre réelle de ce lit : il héritera automatiquement de l'étage, du bâtiment et du service de la chambre.
        </p>
        <div className="space-y-2">
          <RoomCascade tree={tree} value={value} onChange={(v, r) => { setValue(v); setRoom(r); }}/>
        </div>
        {room && (
          room.serviceId
            ? <p className="text-xs text-gray-600">Service hérité : <span className="font-semibold">{room.serviceName}</span></p>
            : <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle size={12}/> Cette chambre n'a pas de service — modifiez d'abord la chambre.</p>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-700 text-sm flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0"/><span className="min-w-0">{error}</span>
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button className="text-sm font-medium border border-gray-200 rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50" onClick={onClose}>Annuler</button>
          <button disabled={busy || !value.roomId || !room?.serviceId}
            className="text-sm font-medium bg-blue-600 text-white rounded-lg px-3 py-2 hover:bg-blue-700 disabled:opacity-50"
            onClick={confirm}>
            Affecter
          </button>
        </div>
      </div>
    </div>
  );
}
