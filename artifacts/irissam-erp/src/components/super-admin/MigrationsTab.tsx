import { useState, useCallback, useEffect } from "react";
import {
  RefreshCw,
  CheckCircle,
  Clock,
  Code,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import {
  getMigrationsList,
  verifyMigrations,
  applyMigrations,
  getMigrationSqlPreview,
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
    applied: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    failed: "bg-red-100 text-red-800",
    running: "bg-blue-100 text-blue-800",
  };
  const cls = colors[status?.toLowerCase()] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={"inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium " + cls}>
      {status}
    </span>
  );
}

interface Migration {
  id?: string | number;
  name: string;
  status: string;
  appliedAt?: string;
  durationMs?: number;
  [key: string]: unknown;
}

interface MigrationsList {
  migrations?: Migration[];
  total?: number;
  applied?: number;
  pending?: number;
  [key: string]: unknown;
}

interface VerifyResult {
  ok?: boolean;
  message?: string;
  issues?: string[];
  [key: string]: unknown;
}

export function MigrationsTab() {
  const [data, setData] = useState<MigrationsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const [applyLoading, setApplyLoading] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);
  const [stepUpOpen, setStepUpOpen] = useState(false);

  const [sqlPreview, setSqlPreview] = useState<{ name: string; sql: string } | null>(null);
  const [sqlLoading, setSqlLoading] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getMigrationsList()
      .then(setData)
      .catch((e: unknown) => {
        const err = e as { response?: { data?: { message?: string } }; message?: string };
        setError(err?.response?.data?.message ?? err?.message ?? "Erreur serveur");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleVerify = async () => {
    setVerifyLoading(true);
    setVerifyResult(null);
    try {
      const result = await verifyMigrations();
      setVerifyResult(result);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setVerifyResult({ ok: false, message: err?.response?.data?.message ?? err?.message });
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleApplySuccess = async (token: string) => {
    setStepUpOpen(false);
    setApplyLoading(true);
    setApplyResult(null);
    try {
      const result = await applyMigrations(token);
      setApplyResult(result?.message ?? "Migrations appliquées avec succès.");
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setApplyResult(err?.response?.data?.message ?? err?.message ?? "Erreur");
    } finally {
      setApplyLoading(false);
    }
  };

  const handleSqlPreview = async (name: string) => {
    setSqlLoading(name);
    try {
      const result = await getMigrationSqlPreview(name);
      setSqlPreview({ name, sql: result?.sql ?? JSON.stringify(result, null, 2) });
    } catch (e: unknown) {
      const err = e as { message?: string };
      setSqlPreview({ name, sql: `Erreur: ${err?.message}` });
    } finally {
      setSqlLoading(null);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  const migrations = data?.migrations ?? [];
  const pendingCount = data?.pending ?? migrations.filter((m) => m.status === "pending").length;
  const appliedCount = data?.applied ?? migrations.filter((m) => m.status === "applied").length;
  const totalCount = data?.total ?? migrations.length;

  return (
    <div className="space-y-6">
      <StepUpDialog
        open={stepUpOpen}
        onClose={() => setStepUpOpen(false)}
        onSuccess={handleApplySuccess}
        title="Appliquer les migrations"
        description="Cette action applique toutes les migrations en attente. Confirmez votre mot de passe."
      />

      {/* SQL Preview Modal */}
      {sqlPreview && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSqlPreview(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900 text-sm">
                Aperçu SQL — {sqlPreview.name}
              </h3>
              <button
                onClick={() => setSqlPreview(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ×
              </button>
            </div>
            <pre className="p-4 overflow-auto text-xs font-mono text-gray-800 bg-gray-50 flex-1 whitespace-pre-wrap">
              {sqlPreview.sql}
            </pre>
          </div>
        </div>
      )}

      {/* Pending banner */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-800">
              {pendingCount} migration{pendingCount > 1 ? "s" : ""} en attente
            </p>
            <p className="text-xs text-yellow-700">
              Ces migrations n'ont pas encore été appliquées à la base de données.
            </p>
          </div>
        </div>
      )}

      {/* Summary card */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: totalCount, color: "text-gray-900" },
          { label: "Appliquées", value: appliedCount, color: "text-green-700" },
          { label: "En attente", value: pendingCount, color: "text-yellow-700" },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-white border border-gray-200 rounded-lg p-4 text-center"
          >
            <p className="text-xs text-gray-500 mb-1">{item.label}</p>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
        <button
          onClick={handleVerify}
          disabled={verifyLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          <ShieldCheck className="w-4 h-4" />
          {verifyLoading ? "Vérification…" : "Vérifier"}
        </button>
        <button
          onClick={() => setStepUpOpen(true)}
          disabled={pendingCount === 0 || applyLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={pendingCount === 0 ? "Aucune migration en attente" : undefined}
        >
          <PlayCircle className="w-4 h-4" />
          {applyLoading ? "Application…" : "Appliquer en attente"}
        </button>
      </div>

      {/* Verify result */}
      {verifyResult && (
        <div
          className={`flex items-start gap-3 p-4 rounded-lg border ${verifyResult.ok ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
        >
          <CheckCircle
            className={`w-5 h-5 flex-shrink-0 mt-0.5 ${verifyResult.ok ? "text-green-600" : "text-red-600"}`}
          />
          <div>
            <p className={`text-sm font-medium ${verifyResult.ok ? "text-green-800" : "text-red-800"}`}>
              {verifyResult.message ?? (verifyResult.ok ? "Vérification réussie" : "Problèmes détectés")}
            </p>
            {verifyResult.issues && verifyResult.issues.length > 0 && (
              <ul className="mt-1 text-xs space-y-0.5">
                {verifyResult.issues.map((issue, i) => (
                  <li key={i} className="text-red-700">• {issue}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Apply result */}
      {applyResult && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          {applyResult}
        </div>
      )}

      {/* Migrations table */}
      {migrations.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">
          Aucune migration trouvée
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["#", "Nom", "Statut", "Appliquée le", "Durée (ms)", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {migrations.map((m, idx) => (
                <tr key={m.name} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-sm text-gray-500">{idx + 1}</td>
                  <td className="px-4 py-2.5 text-sm font-mono text-gray-800 max-w-xs truncate">
                    {m.name}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">
                    {m.appliedAt
                      ? new Date(m.appliedAt).toLocaleString("fr-FR")
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">
                    {m.durationMs ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {m.status === "applied" ? (
                      <button
                        onClick={() => handleSqlPreview(m.name)}
                        disabled={sqlLoading === m.name}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-50 transition-colors disabled:opacity-50"
                      >
                        <Code className="w-3.5 h-3.5" />
                        {sqlLoading === m.name ? "…" : "Aperçu SQL"}
                      </button>
                    ) : (
                      <span
                        className="text-xs text-gray-400 cursor-not-allowed"
                        title="Disponible uniquement pour les migrations appliquées"
                      >
                        —
                      </span>
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
export { MigrationsTab as default };
