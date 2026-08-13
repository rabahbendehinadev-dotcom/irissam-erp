/**
 * FavoritesPicker — favoris personnels du praticien (diagnostics / médicaments).
 *
 * Données réelles : GET/POST/PATCH/DELETE /consultation-favorites (table
 * doctor_favorites, scope user_id du JWT côté serveur). Recherche, épinglage,
 * compteur d'usage (tri serveur : épinglés → plus utilisés → alphabétique),
 * ajout personnalisé. Réutilisé par l'onglet Diagnostic (kind=diagnosis) et
 * le formulaire de prescription (kind=medication).
 */
import { useMemo, useState } from 'react';
import { Star, Trash2, Plus, X, Search, Loader2, AlertTriangle } from 'lucide-react';
import { useQuery } from '@/hooks/useQuery';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { DoctorFavorite } from '@/types/consultation';

interface Props {
  kind: 'diagnosis' | 'medication';
  /** Applique un favori (insertion dans le champ / pré-remplissage du formulaire). */
  onApply: (fav: DoctorFavorite) => void;
  /** Valeur suggérée pour « Ajouter aux favoris » (ex : texte du diagnostic en cours). */
  suggestedLabel?: string;
  /** Valeurs par défaut suggérées pour un favori médicament (formulaire en cours). */
  suggestedDefaults?: { medicationId?: string | null; dosage?: string; frequency?: string; duration?: string; instructions?: string };
  disabled?: boolean;
}

const KIND_LABEL: Record<Props['kind'], string> = {
  diagnosis:  'Diagnostics favoris',
  medication: 'Médicaments favoris',
};

export function FavoritesPicker({ kind, onApply, suggestedLabel, suggestedDefaults, disabled }: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const { data, loading, error, refetch } = useQuery<DoctorFavorite[]>(`/consultation-favorites?kind=${kind}`);
  const favorites = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? favorites.filter(f => f.label.toLowerCase().includes(q)) : favorites;
  }, [favorites, search]);

  const visible = showAll || search ? filtered : filtered.slice(0, 12);

  const apiError = (err: unknown, fallback: string) =>
    (err as { data?: { error?: string } })?.data?.error ?? (err instanceof Error ? err.message : fallback);

  const handleApply = (fav: DoctorFavorite) => {
    if (disabled) return;
    onApply(fav);
    // Compteur d'usage (tri intelligent) — best effort, sans bloquer l'UI.
    apiClient.post(`/consultation-favorites/${fav.id}/use`, {}).then(() => refetch()).catch(() => {});
  };

  const handlePin = async (fav: DoctorFavorite) => {
    if (busy) return;
    setBusy(fav.id);
    try {
      await apiClient.patch(`/consultation-favorites/${fav.id}`, { pinned: !fav.pinned });
      refetch();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erreur', description: apiError(err, 'Épinglage impossible') });
    } finally { setBusy(null); }
  };

  const handleDelete = async (fav: DoctorFavorite) => {
    if (busy) return;
    setBusy(fav.id);
    try {
      await apiClient.delete(`/consultation-favorites/${fav.id}`);
      toast({ title: 'Favori supprimé', description: fav.label });
      refetch();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erreur', description: apiError(err, 'Suppression impossible') });
    } finally { setBusy(null); }
  };

  const handleAdd = async () => {
    const label = newLabel.trim().replace(/\s+/g, ' ');
    if (label.length < 2 || busy) return;
    setBusy('add');
    try {
      await apiClient.post('/consultation-favorites', {
        kind,
        label,
        ...(kind === 'medication' && suggestedDefaults ? {
          medicationId: suggestedDefaults.medicationId || undefined,
          dosage:       suggestedDefaults.dosage || undefined,
          frequency:    suggestedDefaults.frequency || undefined,
          duration:     suggestedDefaults.duration || undefined,
          instructions: suggestedDefaults.instructions || undefined,
        } : {}),
      });
      toast({ title: 'Ajouté aux favoris', description: label });
      setNewLabel('');
      setAdding(false);
      refetch();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Favori non ajouté', description: apiError(err, 'Ajout impossible') });
    } finally { setBusy(null); }
  };

  return (
    <div className="border border-gray-100 bg-gray-50/60 rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Star size={13} className="text-amber-500 fill-amber-400" />
        <span className="text-xs font-semibold text-gray-600">{KIND_LABEL[kind]}</span>
        <span className="text-[11px] text-gray-400">({favorites.length})</span>

        {favorites.length > 6 && (
          <div className="relative ml-1">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="pl-6 pr-2 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 w-36"
            />
          </div>
        )}

        {!adding && (
          <button
            type="button"
            onClick={() => { setAdding(true); setNewLabel((suggestedLabel ?? '').slice(0, 200)); }}
            className="ml-auto flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-800 px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors"
          >
            <Plus size={11} /> Ajouter aux favoris
          </button>
        )}
      </div>

      {adding && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder={kind === 'diagnosis' ? 'Ex : Grippe saisonnière' : 'Ex : Paracétamol 1g'}
            maxLength={200}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleAdd(); } }}
            className="flex-1 min-w-[180px] px-2.5 py-1.5 text-xs border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={newLabel.trim().length < 2 || busy === 'add'}
            className="px-2.5 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {busy === 'add' ? <Loader2 size={11} className="animate-spin" /> : 'Enregistrer'}
          </button>
          <button type="button" onClick={() => setAdding(false)} className="p-1.5 text-gray-400 hover:text-gray-600">
            <X size={13} />
          </button>
          {kind === 'medication' && suggestedDefaults && (suggestedDefaults.dosage || suggestedDefaults.frequency) && (
            <span className="text-[10px] text-gray-400 w-full">
              La posologie du formulaire en cours sera mémorisée avec ce favori.
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
          <Loader2 size={12} className="animate-spin" /> Chargement des favoris…
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-xs text-red-500 py-1">
          <AlertTriangle size={12} /> Favoris indisponibles
          <button onClick={() => refetch()} className="underline hover:text-red-600">réessayer</button>
        </div>
      ) : favorites.length === 0 ? (
        <p className="text-[11px] text-gray-400">
          Aucun favori — utilisez « Ajouter aux favoris » pour mémoriser vos
          {kind === 'diagnosis' ? ' diagnostics' : ' médicaments'} fréquents.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {visible.map(fav => (
            <div
              key={fav.id}
              className={cn(
                'group flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-0.5 text-xs transition-colors',
                fav.pinned
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-amber-200 hover:bg-amber-50/50',
              )}
            >
              <button
                type="button"
                onClick={() => handleApply(fav)}
                disabled={disabled}
                title={fav.dosage || fav.frequency
                  ? `${fav.dosage ?? ''} ${fav.frequency ?? ''} ${fav.duration ?? ''}`.trim()
                  : `Utilisé ${fav.usageCount} fois`}
                className="disabled:cursor-not-allowed max-w-[220px] truncate font-medium"
              >
                {fav.label}
              </button>
              <button
                type="button"
                onClick={() => void handlePin(fav)}
                title={fav.pinned ? 'Désépingler' : 'Épingler'}
                className={cn('p-0.5 rounded-full transition-opacity',
                  fav.pinned ? 'text-amber-500' : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-amber-500')}
              >
                <Star size={11} className={fav.pinned ? 'fill-amber-400' : ''} />
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(fav)}
                title="Supprimer ce favori"
                className="p-0.5 rounded-full text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          {!showAll && !search && filtered.length > 12 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-[11px] text-gray-400 hover:text-gray-600 px-2 py-0.5"
            >
              +{filtered.length - 12} autres…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
