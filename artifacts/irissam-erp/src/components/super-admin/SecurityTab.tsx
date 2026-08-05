import { toast } from "@/hooks/use-toast";
import { useState, useCallback, useEffect } from "react";
import {
  RefreshCw,
  Shield,
  UserX,
  Unlock,
  AlertTriangle,
  Ban,
  CheckCircle,
} from "lucide-react";
import {
  getSecurityDashboard,
  unlockAccount,
  suspendAccount,
  blockIp,
  addAllowlistIp,
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

interface LockedAccount {
  userId: string;
  userName?: string;
  email?: string;
  lockedAt?: string;
  reason?: string;
  [key: string]: unknown;
}

interface SuspiciousIp {
  ip: string;
  reason?: string;
  attempts?: number;
  lastAttempt?: string;
  blocked?: boolean;
  [key: string]: unknown;
}

interface SecurityEvent {
  id?: string | number;
  timestamp?: string;
  type?: string;
  description?: string;
  severity?: string;
  [key: string]: unknown;
}

interface SecurityData {
  kpi?: {
    lockedAccounts?: number;
    failedLoginsLast24h?: number;
    suspiciousIps?: number;
    activeSessions?: number;
  };
  lockedAccounts?: LockedAccount[];
  suspiciousIps?: SuspiciousIp[];
  recentEvents?: SecurityEvent[];
  [key: string]: unknown;
}

export function SecurityTab() {
  const [data, setData] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [suspendUserId, setSuspendUserId] = useState<string | null>(null);

  const [blockIpValue, setBlockIpValue] = useState("");
  const [blockIpReason, setBlockIpReason] = useState("");
  const [blockIpLoading, setBlockIpLoading] = useState(false);

  const [rowMsg, setRowMsg] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getSecurityDashboard()
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

  const handleUnlock = async (userId: string) => {
    try {
      await unlockAccount(userId);
      setRowMsg((prev) => ({ ...prev, [userId]: "Compte déverrouillé" }));
      load();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setRowMsg((prev) => ({ ...prev, [userId]: err?.message ?? "Erreur" }));
    }
  };

  const handleSuspendClick = (userId: string) => {
    setSuspendUserId(userId);
    setStepUpOpen(true);
  };

  const handleStepUpSuccess = async (token: string) => {
    setStepUpOpen(false);
    if (!suspendUserId) return;
    try {
      await suspendAccount(suspendUserId, token);
      setRowMsg((prev) => ({ ...prev, [suspendUserId]: "Compte suspendu" }));
      load();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setRowMsg((prev) => ({ ...prev, [suspendUserId]: err?.message ?? "Erreur" }));
    } finally {
      setSuspendUserId(null);
    }
  };

  const handleBlockIp = async () => {
    if (!blockIpValue.trim()) return;
    setBlockIpLoading(true);
    try {
      await blockIp(blockIpValue.trim(), blockIpReason.trim());
      setBlockIpValue("");
      setBlockIpReason("");
      load();
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({ variant: "destructive", title: "Erreur", description: err?.message ?? "Opération impossible" });
    } finally {
      setBlockIpLoading(false);
    }
  };

  const handleAllowlistIp = async (ip: string) => {
    try {
      await addAllowlistIp(ip);
      setRowMsg((prev) => ({ ...prev, [`ip-${ip}`]: "Ajouté à la liste blanche" }));
      load();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setRowMsg((prev) => ({ ...prev, [`ip-${ip}`]: err?.message ?? "Erreur" }));
    }
  };

  const kpi = data?.kpi ?? {};
  const lockedAccounts = data?.lockedAccounts ?? [];
  const suspiciousIps = data?.suspiciousIps ?? [];
  const recentEvents = data?.recentEvents ?? [];

  const kpiCards = [
    {
      label: "Comptes verrouillés",
      value: kpi.lockedAccounts ?? 0,
      icon: UserX,
      color: "text-red-600",
      bg: "bg-red-50 border-red-200",
    },
    {
      label: "Échecs login (24h)",
      value: kpi.failedLoginsLast24h ?? 0,
      icon: AlertTriangle,
      color: "text-orange-600",
      bg: "bg-orange-50 border-orange-200",
    },
    {
      label: "IPs suspectes",
      value: kpi.suspiciousIps ?? 0,
      icon: Ban,
      color: "text-yellow-700",
      bg: "bg-yellow-50 border-yellow-200",
    },
    {
      label: "Sessions actives",
      value: kpi.activeSessions ?? 0,
      icon: Shield,
      color: "text-indigo-600",
      bg: "bg-indigo-50 border-indigo-200",
    },
  ];

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div className="space-y-8">
      <StepUpDialog
        open={stepUpOpen}
        onClose={() => setStepUpOpen(false)}
        onSuccess={handleStepUpSuccess}
        title="Suspendre le compte"
        description="Confirmez votre mot de passe pour suspendre ce compte."
      />

      {/* Refresh */}
      <div className="flex justify-end">
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`border rounded-xl p-4 ${card.bg}`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-5 h-5 ${card.color}`} />
                <span className="text-xs font-medium text-gray-600">{card.label}</span>
              </div>
              <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Locked accounts */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <UserX className="w-4 h-4 text-red-500" />
          Comptes verrouillés
        </h3>
        {lockedAccounts.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            Aucun compte verrouillé
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["Utilisateur", "Email", "Verrouillé le", "Raison", "Actions"].map((h) => (
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
                {lockedAccounts.map((acc) => (
                  <tr key={acc.userId} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-800">
                      {acc.userName ?? acc.userId}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-600">{acc.email ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {acc.lockedAt ? new Date(acc.lockedAt).toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-600">{acc.reason ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUnlock(acc.userId)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 border border-green-200 rounded hover:bg-green-50 transition-colors"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          Déverrouiller
                        </button>
                        <button
                          onClick={() => handleSuspendClick(acc.userId)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Suspendre
                        </button>
                      </div>
                      {rowMsg[acc.userId] && (
                        <p className="text-xs text-gray-500 mt-1">{rowMsg[acc.userId]}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Suspicious IPs */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Ban className="w-4 h-4 text-orange-500" />
          IPs suspectes
        </h3>

        {/* Block IP form */}
        <div className="flex flex-wrap gap-3 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <input
            type="text"
            value={blockIpValue}
            onChange={(e) => setBlockIpValue(e.target.value)}
            placeholder="Adresse IP à bloquer"
            className="flex-1 min-w-[140px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            value={blockIpReason}
            onChange={(e) => setBlockIpReason(e.target.value)}
            placeholder="Raison (optionnel)"
            className="flex-1 min-w-[140px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleBlockIp}
            disabled={!blockIpValue.trim() || blockIpLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            <Ban className="w-4 h-4" />
            {blockIpLoading ? "Blocage…" : "Bloquer cette IP"}
          </button>
        </div>

        {suspiciousIps.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Aucune IP suspecte</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["IP", "Tentatives", "Dernière tentative", "Raison", "Statut", "Actions"].map(
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
                {suspiciousIps.map((ip) => (
                  <tr key={ip.ip} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm font-mono text-gray-800">{ip.ip}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-700">{ip.attempts ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {ip.lastAttempt
                        ? new Date(ip.lastAttempt).toLocaleString("fr-FR")
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-600">{ip.reason ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ip.blocked ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}
                      >
                        {ip.blocked ? "Bloquée" : "Suspecte"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {!ip.blocked && (
                          <button
                            onClick={() => blockIp(ip.ip, "Blocage manuel")}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Bloquer
                          </button>
                        )}
                        <button
                          onClick={() => handleAllowlistIp(ip.ip)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 border border-green-200 rounded hover:bg-green-50 transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Whitelist
                        </button>
                      </div>
                      {rowMsg[`ip-${ip.ip}`] && (
                        <p className="text-xs text-gray-500 mt-1">{rowMsg[`ip-${ip.ip}`]}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent events timeline */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-500" />
          Événements récents
        </h3>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            Aucun événement récent
          </p>
        ) : (
          <div className="relative pl-5 space-y-4">
            <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200" />
            {recentEvents.map((evt, idx) => {
              const severity = evt.severity?.toLowerCase();
              const dotColor =
                severity === "critical" || severity === "high"
                  ? "bg-red-500"
                  : severity === "medium"
                  ? "bg-yellow-500"
                  : "bg-indigo-500";

              return (
                <div key={evt.id ?? idx} className="relative flex items-start gap-3">
                  <div
                    className={`absolute -left-3 w-3 h-3 rounded-full border-2 border-white ${dotColor} mt-1`}
                  />
                  <div className="flex-1 bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-gray-800">{evt.description ?? evt.type}</p>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {evt.timestamp
                          ? new Date(evt.timestamp).toLocaleString("fr-FR")
                          : ""}
                      </span>
                    </div>
                    {evt.type && evt.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{evt.type}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
