/**
 * TransferBedModal — Transfert de lit (mouvement ADT interne).
 *
 * Cascade basée sur la structure réelle de l'hôpital :
 *   Service destination → Bâtiment → Étage → Chambre → Lit disponible
 * Données : /infrastructure/tree (structure active) + /infrastructure/bed-cards
 * (lits réels) — aucune donnée démo.
 *
 * Le motif du transfert est obligatoire. Côté serveur l'opération est atomique :
 * ancien lit libéré (→ nettoyage), nouveau lit occupé, admission réalignée sur
 * la nouvelle chaîne, mouvement ADT journalisé dans l'historique patient.
 */
import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, ArrowRight, BedDouble, Loader2 } from 'lucide-react';
import { apiClient } from '@/services/api/client';
import { useLanguage } from '@/i18n';
import type { Admission } from '@/types/admission';
import { BED_TYPE_LABEL, type BedCardData, type TreeBuilding } from '@/components/beds/types';

const cls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-50 disabled:bg-gray-50';

/** Lit disponible enrichi de sa chaîne réelle (dénormalisée côté serveur). */
interface ChainBed {
  id: string;
  number: string;
  type: string;
  roomId: string;
  roomNumber: string;
  floorId: string;
  floorLabel: string;
  buildingId: string;
  buildingName: string;
  serviceId: string;
  serviceName: string;
}

export function TransferBedModal({ admission, onConfirm, onCancel }: {
  admission: Admission;
  onConfirm: (payload: { newBedId: string; motif: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useLanguage();

  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState('');
  const [beds, setBeds]           = useState<ChainBed[]>([]);

  const [svcId, setSvcId]   = useState('');
  const [bldId, setBldId]   = useState('');
  const [flrId, setFlrId]   = useState('');
  const [roomId, setRoomId] = useState('');
  const [bedId, setBedId]   = useState('');
  const [motif, setMotif]   = useState('');
  const [error, setError]   = useState('');
  const [busy, setBusy]     = useState(false);

  // ── Chargement structure réelle + lits disponibles ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiClient.get<TreeBuilding[]>('/infrastructure/tree'),
      apiClient.get<BedCardData[]>('/infrastructure/bed-cards'),
    ])
      .then(([tree, cards]) => {
        if (cancelled) return;
        // Chambres actives uniquement (bâtiment + étage + chambre actifs)
        const activeRooms = new Set<string>();
        for (const b of tree ?? []) {
          if (!b.active) continue;
          for (const f of b.floors ?? []) {
            if (!f.active) continue;
            for (const r of f.rooms ?? []) {
              if (r.active) activeRooms.add(r.id);
            }
          }
        }
        const rows: ChainBed[] = [];
        for (const c of cards ?? []) {
          if (c.status !== 'disponible') continue;          // lits libres uniquement
          if (c.id === admission.bedId) continue;           // pas le lit actuel
          // Structure stricte : lit rattaché à une chambre active avec service
          if (!c.roomId || !activeRooms.has(c.roomId)) continue;
          if (!c.serviceId || !c.serviceName) continue;
          rows.push({
            id: c.id, number: c.number, type: c.type,
            roomId: c.roomId, roomNumber: c.roomNumber ?? '—',
            floorId: c.floorId ?? '', floorLabel: c.floorLabel ?? '—',
            buildingId: c.buildingId ?? '', buildingName: c.buildingName ?? '—',
            serviceId: c.serviceId, serviceName: c.serviceName,
          });
        }
        setBeds(rows);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setLoadError('Impossible de charger la structure et les lits disponibles.'); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [admission.bedId]);

  // ── Options en cascade (chaque niveau filtre les lits disponibles) ──────────
  const services = useMemo(() => {
    const m = new Map<string, { id: string; name: string; count: number }>();
    for (const b of beds) {
      const e = m.get(b.serviceId) ?? { id: b.serviceId, name: b.serviceName, count: 0 };
      e.count++; m.set(b.serviceId, e);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [beds]);

  const inSvc = useMemo(() => beds.filter(b => b.serviceId === svcId), [beds, svcId]);

  const buildings = useMemo(() => {
    const m = new Map<string, { id: string; name: string; count: number }>();
    for (const b of inSvc) {
      const e = m.get(b.buildingId) ?? { id: b.buildingId, name: b.buildingName, count: 0 };
      e.count++; m.set(b.buildingId, e);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [inSvc]);

  const inBld = useMemo(() => inSvc.filter(b => b.buildingId === bldId), [inSvc, bldId]);

  const floors = useMemo(() => {
    const m = new Map<string, { id: string; name: string; count: number }>();
    for (const b of inBld) {
      const e = m.get(b.floorId) ?? { id: b.floorId, name: b.floorLabel, count: 0 };
      e.count++; m.set(b.floorId, e);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [inBld]);

  const inFlr = useMemo(() => inBld.filter(b => b.floorId === flrId), [inBld, flrId]);

  const rooms = useMemo(() => {
    const m = new Map<string, { id: string; number: string; count: number }>();
    for (const b of inFlr) {
      const e = m.get(b.roomId) ?? { id: b.roomId, number: b.roomNumber, count: 0 };
      e.count++; m.set(b.roomId, e);
    }
    return [...m.values()].sort((a, b) => a.number.localeCompare(b.number, 'fr', { numeric: true }));
  }, [inFlr]);

  const bedOptions = useMemo(
    () => inFlr.filter(b => b.roomId === roomId).sort((a, b) => a.number.localeCompare(b.number, 'fr', { numeric: true })),
    [inFlr, roomId],
  );

  const selectedBed = useMemo(() => beds.find(b => b.id === bedId) ?? null, [beds, bedId]);

  // ── Soumission ───────────────────────────────────────────────────────────────
  const canSubmit = !!bedId && !!motif.trim() && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm({ newBedId: bedId, motif: motif.trim() });
    } catch (e: any) {
      setError(e?.data?.error ?? e?.message ?? 'Échec du transfert');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6 max-h-[95dvh] overflow-y-auto">
        <h3 className="font-bold text-gray-900 text-lg mb-1">{t('adm.transfer.title')}</h3>
        <p className="text-xs text-gray-500 mb-4">
          {admission.patientName} · Lit actuel : {admission.bedNumber || '—'}
          {admission.roomNumber ? ` — Ch. ${admission.roomNumber}` : ''} · {admission.serviceName}
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
            <Loader2 size={16} className="animate-spin" /> Chargement de la structure…
          </div>
        ) : loadError ? (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-700 mb-4">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /> {loadError}
          </div>
        ) : beds.length === 0 ? (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-4">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            Aucun lit disponible rattaché à une chambre active. Libérez un lit ou rattachez des lits via Gestion des lits.
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Service destination *</label>
              <select value={svcId} className={cls}
                onChange={e => { setSvcId(e.target.value); setBldId(''); setFlrId(''); setRoomId(''); setBedId(''); }}>
                <option value="">— Choisir un service —</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.count} lit{s.count > 1 ? 's' : ''} dispo)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bâtiment *</label>
              <select value={bldId} disabled={!svcId} className={cls}
                onChange={e => { setBldId(e.target.value); setFlrId(''); setRoomId(''); setBedId(''); }}>
                <option value="">— Choisir un bâtiment —</option>
                {buildings.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.count})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Étage *</label>
              <select value={flrId} disabled={!bldId} className={cls}
                onChange={e => { setFlrId(e.target.value); setRoomId(''); setBedId(''); }}>
                <option value="">— Choisir un étage —</option>
                {floors.map(f => (
                  <option key={f.id} value={f.id}>{f.name} ({f.count})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Chambre *</label>
              <select value={roomId} disabled={!flrId} className={cls}
                onChange={e => { setRoomId(e.target.value); setBedId(''); }}>
                <option value="">— Choisir une chambre —</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>Ch. {r.number} ({r.count} lit{r.count > 1 ? 's' : ''})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lit disponible *</label>
              <select value={bedId} disabled={!roomId} className={cls}
                onChange={e => setBedId(e.target.value)}>
                <option value="">— Choisir un lit —</option>
                {bedOptions.map(b => (
                  <option key={b.id} value={b.id}>Lit {b.number} · {BED_TYPE_LABEL[b.type] ?? b.type}</option>
                ))}
              </select>
            </div>

            {selectedBed && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-900 space-y-1">
                <p className="flex items-center gap-1.5 font-semibold">
                  <BedDouble size={13} /> Lit {selectedBed.number} — Ch. {selectedBed.roomNumber}
                </p>
                <p className="flex items-center gap-1.5">
                  <ArrowRight size={12} /> {selectedBed.buildingName} · {selectedBed.floorLabel} · Service {selectedBed.serviceName}
                </p>
                {admission.bedNumber && (
                  <p className="text-blue-700/70">L'ancien lit {admission.bedNumber} sera libéré (→ nettoyage).</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Motif du transfert *</label>
              <textarea value={motif} onChange={e => setMotif(e.target.value)} rows={2}
                className={`${cls} resize-none`} placeholder="Ex : rapprochement du plateau technique, isolement, demande du patient…" />
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-700">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /> {error}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} disabled={busy}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
            {t('adm.form.cancel')}
          </button>
          {!loading && !loadError && beds.length > 0 && (
            <button onClick={submit} disabled={!canSubmit}
              className="flex-1 px-3 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium disabled:opacity-40 flex items-center justify-center gap-1.5">
              {busy && <Loader2 size={13} className="animate-spin" />}
              {t('adm.transfer.confirm')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
