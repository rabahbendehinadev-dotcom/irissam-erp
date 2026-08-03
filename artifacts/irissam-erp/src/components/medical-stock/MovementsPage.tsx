import { useState } from "react";
import { useQuery } from "@/hooks/useQuery";
import { ArrowUpRight, ArrowDownLeft, AlertTriangle, RefreshCw, Activity } from "lucide-react";

const MVT_ICONS: Record<string, React.ElementType> = {
  entree: ArrowUpRight, sortie: ArrowDownLeft, transfert_in: ArrowUpRight,
  transfert_out: ArrowDownLeft, consommation: ArrowDownLeft, ajustement_plus: ArrowUpRight,
  ajustement_moins: ArrowDownLeft, retour_fournisseur: ArrowDownLeft, retour_patient: ArrowUpRight,
  perte: ArrowDownLeft, peremption: ArrowDownLeft, inventaire_plus: ArrowUpRight, inventaire_moins: ArrowDownLeft,
};
const MVT_COLORS: Record<string, string> = {
  entree: "text-green-600 bg-green-50", sortie: "text-red-600 bg-red-50",
  transfert_in: "text-blue-600 bg-blue-50", transfert_out: "text-orange-600 bg-orange-50",
  consommation: "text-red-600 bg-red-50", ajustement_plus: "text-green-600 bg-green-50",
  ajustement_moins: "text-red-600 bg-red-50", perte: "text-red-700 bg-red-50",
  peremption: "text-purple-600 bg-purple-50", inventaire_plus: "text-teal-600 bg-teal-50",
  inventaire_moins: "text-orange-600 bg-orange-50",
};

const MVT_LABELS: Record<string, string> = {
  entree: "Entrée", sortie: "Sortie", transfert_in: "Transfert entrant",
  transfert_out: "Transfert sortant", consommation: "Consommation",
  ajustement_plus: "Ajustement +", ajustement_moins: "Ajustement −",
  retour_fournisseur: "Retour fournisseur", retour_patient: "Retour patient",
  perte: "Perte", peremption: "Péremption", inventaire_plus: "Inventaire +", inventaire_moins: "Inventaire −",
};

export default function MovementsPage() {
  const [movementType, setMovementType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);
  const limit = 50;

  const params: Record<string,string> = { limit: String(limit), offset: String(page * limit) };
  if (movementType) params.movement_type = movementType;
  if (fromDate)     params.from_date = fromDate;
  if (toDate)       params.to_date = toDate;
  const qs = "?" + new URLSearchParams(params).toString();

  const { data, loading, error, refetch } = useQuery<any>(`/medical-stock/movements${qs}`);
  const movements = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <select value={movementType} onChange={e => { setMovementType(e.target.value); setPage(0); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
          <option value="">Tous les types</option>
          {Object.entries(MVT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(0); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
        <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(0); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
        <button onClick={refetch} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          <AlertTriangle className="w-4 h-4 shrink-0" /> Erreur
          <button onClick={refetch} className="ml-auto text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Réessayer</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2 animate-pulse">{[...Array(10)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg" />)}</div>
      ) : (
        <>
          <div className="space-y-2">
            {movements.map((m: any) => {
              const Icon = MVT_ICONS[m.movement_type] ?? Activity;
              const colorClass = MVT_COLORS[m.movement_type] ?? "text-gray-600 bg-gray-50";
              const isIn = ["entree","transfert_in","ajustement_plus","retour_patient","inventaire_plus"].includes(m.movement_type);
              return (
                <div key={m.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 truncate">{m.item_name}</span>
                      <span className="text-xs text-gray-400">{m.item_code}</span>
                      {m.batch_number && <span className="text-xs font-mono text-blue-500">{m.batch_number}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                      <span>{MVT_LABELS[m.movement_type] ?? m.movement_type}</span>
                      <span>{new Date(m.performed_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      {m.performed_by_name && <span>par {m.performed_by_name}</span>}
                      {m.notes && <span className="truncate max-w-32">{m.notes}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-sm font-bold ${isIn ? "text-green-700" : "text-red-700"}`}>
                      {isIn ? "+" : "−"}{Number(m.quantity).toFixed(0)}
                    </span>
                    <div className="text-xs text-gray-400">
                      {Number(m.quantity_before).toFixed(0)} → {Number(m.quantity_after).toFixed(0)}
                    </div>
                  </div>
                </div>
              );
            })}
            {movements.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucun mouvement trouvé</p>
              </div>
            )}
          </div>
          {total > limit && (
            <div className="flex items-center justify-between pt-2 text-sm text-gray-500">
              <span>{total} mouvements</span>
              <div className="flex gap-2">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40">Précédent</button>
                <button disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40">Suivant</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
