/**
 * EmployeeDeleteDialog — suppression définitive d'une fiche employé
 * (fiches de test ou créées par erreur), avec repli Désactiver / Archiver
 * quand des données RH / Paie / Pointage sont liées (le serveur bloque en 409).
 */
import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { AlertTriangle, Trash2, UserX, Archive, X, Loader2 } from "lucide-react";

type Blocker = { type: string; count: number };
type Emp = {
  id: string;
  first_name?: string;
  last_name?: string;
  matricule?: string;
  status?: string;
};

export function EmployeeDeleteDialog({ employee, onClose, onDone }: {
  employee: Emp;
  onClose: () => void;
  onDone: (action: "deleted" | "archived" | "deactivated") => void;
}) {
  const [phase, setPhase] = useState<"confirm" | "blocked">("confirm");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [blockedMsg, setBlockedMsg] = useState("");

  const name = `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()
    || employee.matricule || "cet employé";

  const doDelete = async () => {
    setBusy("delete"); setError(null);
    try {
      await apiClient.delete(`/hr/employees/${employee.id}/permanent`);
      onDone("deleted");
    } catch (e: any) {
      if (e?.status === 409) {
        setBlockers(Array.isArray(e?.data?.blockers) ? e.data.blockers : []);
        setBlockedMsg(e?.data?.error ?? "Suppression impossible : cet employé possède des données liées.");
        setPhase("blocked");
      } else {
        setError(e?.data?.error ?? e?.message ?? "Erreur lors de la suppression");
      }
    } finally { setBusy(null); }
  };

  const doDeactivate = async () => {
    setBusy("deactivate"); setError(null);
    try {
      await apiClient.patch(`/hr/employees/${employee.id}/status`, {
        status: "suspendu",
        reason: "Désactivation — suppression définitive bloquée (données liées)",
      });
      onDone("deactivated");
    } catch (e: any) {
      setError(e?.data?.error ?? e?.message ?? "Erreur lors de la désactivation");
    } finally { setBusy(null); }
  };

  const doArchive = async () => {
    setBusy("archive"); setError(null);
    try {
      await apiClient.delete(`/hr/employees/${employee.id}`);
      onDone("archived");
    } catch (e: any) {
      setError(e?.data?.error ?? e?.message ?? "Erreur lors de l'archivage");
    } finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4"
        onClick={e => e.stopPropagation()}>

        {phase === "confirm" && (
          <>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600"/>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900">Supprimer définitivement ?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  <span className="font-medium">{name}</span>
                  {employee.matricule ? <span className="text-gray-400"> · {employee.matricule}</span> : null}
                </p>
              </div>
              <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4"/>
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Action <span className="font-semibold text-red-600">irréversible</span>, réservée aux fiches
              créées par erreur ou de test. Si l'employé possède des données liées
              (pointage, paie, congés, badge…), la suppression sera bloquée et vous
              pourrez le <span className="font-medium">désactiver</span> ou l'<span className="font-medium">archiver</span> à la place.
            </p>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={onClose} disabled={busy !== null}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Annuler
              </button>
              <button onClick={doDelete} disabled={busy !== null}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {busy === "delete" ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
                Supprimer définitivement
              </button>
            </div>
          </>
        )}

        {phase === "blocked" && (
          <>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-orange-600"/>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900">Suppression bloquée</h3>
                <p className="text-sm text-gray-600 mt-1">{blockedMsg}</p>
              </div>
              <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4"/>
              </button>
            </div>
            {blockers.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                <ul className="space-y-1">
                  {blockers.map((b, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{b.type}</span>
                      <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-xs font-medium">{b.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-1">
              <button onClick={onClose} disabled={busy !== null}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 order-3 sm:order-1">
                Annuler
              </button>
              <button onClick={doDeactivate} disabled={busy !== null || employee.status === "suspendu"}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium border border-orange-200 text-orange-700 rounded-lg hover:bg-orange-50 disabled:opacity-50 order-2"
                title={employee.status === "suspendu" ? "Déjà suspendu" : "Passer au statut Suspendu"}>
                {busy === "deactivate" ? <Loader2 className="w-4 h-4 animate-spin"/> : <UserX className="w-4 h-4"/>}
                Désactiver
              </button>
              <button onClick={doArchive} disabled={busy !== null}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 order-1 sm:order-3">
                {busy === "archive" ? <Loader2 className="w-4 h-4 animate-spin"/> : <Archive className="w-4 h-4"/>}
                Archiver
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
