import { useState, useCallback, useEffect } from "react";
import {
  RefreshCw,
  Plus,
  ShieldCheck,
  Download,
  Lock,
  Trash2,
} from "lucide-react";
import {
  getBackups,
  createBackup,
  verifyBackup,
  getRestorePlan,
  protectBackup,
  deleteBackup,
} from "@/services/api/system";
import { StepUpDialog } from "./StepUpDialog";

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
      {msg}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: "bg-green-100 text-green-800",
    healthy: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    running: "bg-blue-100 text-blue-800",
    failed: "bg-red-100 text-red-800",
    error: "bg-red-100 text-red-800",
  };
  const cls = colors[status?.toLowerCase()] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={"inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium " + cls}>
      {status}
    </span>
  );
}

interface Backup {
  id: string;
  type: string;
  status: string;
  size?: string;
  createdAt?: string;
  notes?: string;
  protected?: boolean;
  [key: string]: unknown;
}

export function BackupsTab() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create backup modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState("full");
  const [createNotes, setCreateNotes] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Restore plan
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [restorePlanBackupId, setRestorePlanBackupId] = useState<string | null>(null);
  const [restorePlan, setRestorePlan] = useState<unknown>(null);
  const [restorePlanOpen, setRestorePlanOpen] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Per-row actions feedback
  const [rowMsg, setRowMsg] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getBackups()
      .then((d) => setBackups(Array.isArray(d) ? d : d?.backups ?? []))
      .catch((e: unknown) => {
        const err = e as { response?: { data?: { message?: string } }; message?: string };
        setError(err?.response?.data?.message ?? err?.message ?? "Erreur serveur");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    setCreateLoading(true);
    setCreateError(null);
    try {
      await createBackup({ type: createType, notes: createNotes });
      setCreateOpen(false);
      setCreateType("full");
      setCreateNotes("");
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setCreateError(err?.response?.data?.message ?? err?.message ?? "Erreur");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleVerify = async (id: string) => {
    try {
      const result = await verifyBackup(id);
      setRowMsg((prev) => ({
        ...prev,
        [id]: result?.message ?? "Vérification OK",
      }));
    } catch (e: unknown) {
      const err = e as { message?: string };
      setRowMsg((prev) => ({ ...prev, [id]: err?.message ?? "Erreur" }));
    }
  };

  const handleProtect = async (id: string) => {
    try {
      await protectBackup(id);
      load();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setRowMsg((prev) => ({ ...prev, [id]: err?.message ?? "Erreur" }));
    }
  };

  const handleRestorePlanClick = (id: string) => {
    setRestorePlanBackupId(id);
    setStepUpOpen(true);
  };

  const handleStepUpSuccess = async (token: string) => {
    setStepUpOpen(false);
    if (!restorePlanBackupId) return;
    try {
      const plan = await getRestorePlan(restorePlanBackupId, token);
      setRestorePlan(plan);
      setRestorePlanOpen(true);
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(err?.message ?? "Erreur");
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setDeletePhrase("");
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId || deletePhrase !== "SUPPRIMER") {
      setDeleteError("Saisissez exactement : SUPPRIMER");
      return;
    }
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteBackup(deleteId, deletePhrase);
      setDeleteId(null);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setDeleteError(err?.response?.data?.message ?? err?.message ?? "Erreur");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div className="space-y-6">
      {/* Step-up for restore plan */}
      <StepUpDialog
        open={stepUpOpen}
        onClose={() => setStepUpOpen(false)}
        onSuccess={handleStepUpSuccess}
        title="Plan de restauration"
        description="Confirmez votre mot de passe pour afficher le plan de restauration."
      />

      {/* Restore Plan Modal */}
      {restorePlanOpen && restorePlan && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setRestorePlanOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">Plan de restauration</h3>
              <button
                onClick={() => setRestorePlanOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 space-y-3">
              <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <span className="text-orange-600 font-bold">⚠</span>
                <p className="text-sm text-orange-800">
                  La restauration écrasera les données actuelles. Cette opération est irréversible.
                </p>
              </div>
              <pre className="text-xs font-mono text-gray-800 bg-gray-50 p-3 rounded-lg overflow-auto whitespace-pre-wrap">
                {JSON.stringify(restorePlan, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Create Backup Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">Créer une sauvegarde</h3>
              <button
                onClick={() => setCreateOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="full">Complète</option>
                  <option value="incremental">Incrémentale</option>
                  <option value="differential">Différentielle</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optionnel)
                </label>
                <textarea
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Description de cette sauvegarde…"
                />
              </div>
              {createError && <ErrorMsg msg={createError} />}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setCreateOpen(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createLoading}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {createLoading ? "Création…" : "Créer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setDeleteId(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b">
              <h3 className="font-semibold text-red-700">Supprimer la sauvegarde</h3>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-700">
                Pour confirmer la suppression, saisissez <strong>SUPPRIMER</strong> ci-dessous.
              </p>
              <input
                type="text"
                value={deletePhrase}
                onChange={(e) => {
                  setDeletePhrase(e.target.value);
                  setDeleteError(null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="SUPPRIMER"
              />
              {deleteError && <ErrorMsg msg={deleteError} />}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteLoading || deletePhrase !== "SUPPRIMER"}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteLoading ? "Suppression…" : "Supprimer définitivement"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-700">
          {backups.length} sauvegarde{backups.length !== 1 ? "s" : ""}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouvelle sauvegarde
          </button>
        </div>
      </div>

      {/* Table */}
      {backups.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">
          Aucune sauvegarde disponible
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Type", "Statut", "Taille", "Créée le", "Notes", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {backups.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                    <div className="flex items-center gap-1.5">
                      {b.protected && (
                        <Lock className="w-3.5 h-3.5 text-indigo-500" title="Protégée" />
                      )}
                      {b.type}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{b.size ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {b.createdAt ? new Date(b.createdAt).toLocaleString("fr-FR") : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                    {b.notes ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => handleVerify(b.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-50 transition-colors"
                        title="Vérifier l'intégrité"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Vérifier
                      </button>
                      <button
                        onClick={() => handleRestorePlanClick(b.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-600 border border-orange-200 rounded hover:bg-orange-50 transition-colors"
                        title="Voir le plan de restauration"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Restaurer
                      </button>
                      {!b.protected && (
                        <button
                          onClick={() => handleProtect(b.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                          title="Protéger contre la suppression"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          Protéger
                        </button>
                      )}
                      {!b.protected && (
                        <button
                          onClick={() => handleDeleteClick(b.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Supprimer
                        </button>
                      )}
                    </div>
                    {rowMsg[b.id] && (
                      <p className="text-xs text-gray-500 mt-1">{rowMsg[b.id]}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
