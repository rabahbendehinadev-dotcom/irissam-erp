/**
 * ServicesTab — gestion du référentiel central des services hospitaliers
 * (table `departments`, API /infrastructure/departments).
 * Ajout, modification, activation/désactivation — JAMAIS de suppression physique :
 * un service utilisé est désactivé pour préserver l'historique.
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Power, Search, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { Run } from './InfrastructureManager';

const INPUT = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg px-3 py-2 hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap';
const BTN_LIGHT = 'inline-flex items-center gap-1 text-xs font-medium border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50 text-gray-600 disabled:opacity-50 whitespace-nowrap';

interface DeptRow {
  id: string;
  name: string;
  code: string;
  color: string;
  isActive: boolean;
  roomsCount: number;
  bedsCount: number;
  activeAdmissionsCount: number;
  staffCount: number;
}

function usageLabel(r: DeptRow): string {
  const parts: string[] = [];
  if (r.roomsCount > 0) parts.push(`${r.roomsCount} chambre${r.roomsCount > 1 ? 's' : ''}`);
  if (r.bedsCount > 0) parts.push(`${r.bedsCount} lit${r.bedsCount > 1 ? 's' : ''}`);
  if (r.activeAdmissionsCount > 0) parts.push(`${r.activeAdmissionsCount} admission${r.activeAdmissionsCount > 1 ? 's' : ''} active${r.activeAdmissionsCount > 1 ? 's' : ''}`);
  if (r.staffCount > 0) parts.push(`${r.staffCount} personnel${r.staffCount > 1 ? 's' : ''}`);
  return parts.length > 0 ? parts.join(' · ') : 'Non utilisé';
}

export function ServicesTab({ run, busy }: { run: Run; busy: boolean }) {
  const [rows, setRows] = useState<DeptRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ name: '', code: '', color: '#6366F1' });
  const [edit, setEdit] = useState<{ id: string; name: string; code: string; color: string } | null>(null);
  const [confirmOff, setConfirmOff] = useState<DeptRow | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiClient.get<DeptRow[]>('/infrastructure/departments');
      setRows(Array.isArray(data) ? data : []);
      setLoadError(null);
    } catch (e: unknown) {
      const b = e as { data?: { error?: string }; message?: string };
      setLoadError(b?.data?.error ?? b?.message ?? 'Chargement du référentiel impossible.');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const needle = q.trim().toLowerCase();
  const filtered = (rows ?? []).filter(r =>
    !needle || r.name.toLowerCase().includes(needle) || (r.code ?? '').toLowerCase().includes(needle));

  const add = () => run(async () => {
    await apiClient.post('/infrastructure/departments', {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      color: form.color,
    });
    setForm({ name: '', code: '', color: '#6366F1' });
    await load();
  });

  const saveEdit = () => {
    if (!edit) return;
    const e = edit;
    run(async () => {
      await apiClient.patch(`/infrastructure/departments/${e.id}`, {
        name: e.name.trim(),
        code: e.code.trim() || undefined,
        color: e.color,
      });
      setEdit(null);
      await load();
    });
  };

  const toggle = (r: DeptRow, active: boolean) => run(async () => {
    await apiClient.patch(`/infrastructure/departments/${r.id}`, { active });
    setConfirmOff(null);
    await load();
  });

  return (
    <div className="space-y-4">
      {/* Ajout */}
      <div className="bg-gray-50 rounded-xl p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase">Ajouter un service</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input className={INPUT} placeholder="Nom du service (ex. Cardiologie)" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
          <input className={`${INPUT} sm:w-36`} placeholder="Code (auto)" value={form.code}
            onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}/>
          <input type="color" value={form.color} title="Couleur du service"
            onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
            className="h-9 w-12 shrink-0 border border-gray-200 rounded-lg bg-white cursor-pointer"/>
          <button className={BTN_PRIMARY} disabled={busy || !form.name.trim()} onClick={add}>
            <Plus size={14}/> Ajouter
          </button>
        </div>
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input className={`${INPUT} pl-8`} placeholder="Rechercher un service (nom ou code)…"
          value={q} onChange={e => setQ(e.target.value)}/>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0"/>
          <span className="min-w-0">{loadError}</span>
          <button onClick={load} className="ml-auto text-xs underline">Réessayer</button>
        </div>
      )}

      {/* Liste */}
      {rows === null && !loadError ? (
        <div className="space-y-2 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl"/>)}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <div key={r.id} className={`border rounded-xl p-3 ${r.isActive ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-80'}`}>
              {edit?.id === r.id ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input className={INPUT} value={edit.name}
                    onChange={e => setEdit(v => v ? { ...v, name: e.target.value } : v)}/>
                  <input className={`${INPUT} sm:w-32`} value={edit.code}
                    onChange={e => setEdit(v => v ? { ...v, code: e.target.value.toUpperCase() } : v)}/>
                  <input type="color" value={edit.color}
                    onChange={e => setEdit(v => v ? { ...v, color: e.target.value } : v)}
                    className="h-9 w-12 shrink-0 border border-gray-200 rounded-lg bg-white cursor-pointer"/>
                  <div className="flex gap-2">
                    <button className={BTN_PRIMARY} disabled={busy || !edit.name.trim()} onClick={saveEdit}>Enregistrer</button>
                    <button className={BTN_LIGHT} disabled={busy} onClick={() => setEdit(null)}>Annuler</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-3 h-3 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: r.color }}/>
                    <span className={`text-sm font-semibold ${r.isActive ? 'text-gray-800' : 'text-gray-500'}`}>{r.name}</span>
                    <span className="text-[10px] font-mono font-semibold text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">{r.code}</span>
                    {!r.isActive && (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Désactivé</span>
                    )}
                    <div className="ml-auto flex items-center gap-1.5">
                      <button className={BTN_LIGHT} disabled={busy}
                        onClick={() => { setConfirmOff(null); setEdit({ id: r.id, name: r.name, code: r.code ?? '', color: r.color ?? '#6366F1' }); }}>
                        <Pencil size={12}/> Modifier
                      </button>
                      {r.isActive ? (
                        <button className={`${BTN_LIGHT} text-amber-700 border-amber-200 hover:bg-amber-50`} disabled={busy}
                          onClick={() => { setEdit(null); setConfirmOff(r); }}>
                          <Power size={12}/> Désactiver
                        </button>
                      ) : (
                        <button className={`${BTN_LIGHT} text-emerald-700 border-emerald-200 hover:bg-emerald-50`} disabled={busy}
                          onClick={() => toggle(r, true)}>
                          <Power size={12}/> Réactiver
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 ml-5">{usageLabel(r)}</p>
                  {confirmOff?.id === r.id && (
                    <div className="mt-2 ml-5 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 space-y-2">
                      <p className="flex items-start gap-1.5">
                        <AlertTriangle size={13} className="shrink-0 mt-0.5"/>
                        <span>
                          Le service ne sera plus proposé pour les nouvelles chambres, admissions ou consultations.
                          {(r.roomsCount > 0 || r.bedsCount > 0 || r.activeAdmissionsCount > 0) && (
                            <> Il est actuellement utilisé ({usageLabel(r)}) — les données existantes et l'historique sont préservés.</>
                          )}
                        </span>
                      </p>
                      <div className="flex gap-2">
                        <button className="text-xs font-semibold bg-amber-600 text-white rounded-lg px-2.5 py-1 hover:bg-amber-700 disabled:opacity-50"
                          disabled={busy} onClick={() => toggle(r, false)}>Confirmer la désactivation</button>
                        <button className={BTN_LIGHT} disabled={busy} onClick={() => setConfirmOff(null)}>Annuler</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {filtered.length === 0 && rows !== null && (
            <p className="text-sm text-gray-400 text-center py-6">
              {needle ? 'Aucun service ne correspond à la recherche.' : 'Aucun service — ajoutez le premier ci-dessus.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
