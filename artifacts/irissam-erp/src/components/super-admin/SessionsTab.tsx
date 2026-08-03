import { useState, useCallback, useEffect } from "react";
import { RefreshCw, LogOut, Users, ShieldOff, KeyRound } from "lucide-react";
import {
  getSessions,
  revokeSession,
  revokeAllUserSessions,
  blockAccount,
  requirePasswordReset,
} from "@/services/api/system";
import { useAuth } from "@/store/AuthContext";
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

interface Session {
  id: string;
  userId: string;
  userName?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: string;
  lastActivityAt?: string;
  isCurrent?: boolean;
  [key: string]: unknown;
}

interface SessionsData {
  sessions?: Session[];
  currentSessionId?: string;
  [key: string]: unknown;
}

type StepUpAction = "revokeAll" | "block";

export function SessionsTab() {
  const { user } = useAuth();
  const [data, setData] = useState<SessionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpAction, setStepUpAction] = useState<StepUpAction>("revokeAll");
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  const [rowMsg, setRowMsg] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getSessions()
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

  const handleRevoke = async (sessionId: string) => {
    try {
      await revokeSession(sessionId);
      setRowMsg((prev) => ({ ...prev, [sessionId]: "Session révoquée" }));
      load();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setRowMsg((prev) => ({ ...prev, [sessionId]: err?.message ?? "Erreur" }));
    }
  };

  const handleRequireReset = async (userId: string) => {
    try {
      await requirePasswordReset(userId);
      setRowMsg((prev) => ({ ...prev, [`reset-${userId}`]: "Réinitialisation demandée" }));
    } catch (e: unknown) {
      const err = e as { message?: string };
      setRowMsg((prev) => ({
        ...prev,
        [`reset-${userId}`]: err?.message ?? "Erreur",
      }));
    }
  };

  const handleRevokeAllClick = (userId: string) => {
    setTargetUserId(userId);
    setStepUpAction("revokeAll");
    setStepUpOpen(true);
  };

  const handleBlockClick = (userId: string) => {
    setTargetUserId(userId);
    setStepUpAction("block");
    setStepUpOpen(true);
  };

  const handleStepUpSuccess = async (token: string) => {
    setStepUpOpen(false);
    if (!targetUserId) return;
    try {
      if (stepUpAction === "revokeAll") {
        await revokeAllUserSessions(targetUserId, token);
        setRowMsg((prev) => ({
          ...prev,
          [`all-${targetUserId}`]: "Toutes les sessions révoquées",
        }));
      } else {
        await blockAccount(targetUserId, token);
        setRowMsg((prev) => ({
          ...prev,
          [`block-${targetUserId}`]: "Compte bloqué",
        }));
      }
      load();
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(err?.message ?? "Erreur");
    } finally {
      setTargetUserId(null);
    }
  };

  const sessions = data?.sessions ?? [];
  const currentSessionId = data?.currentSessionId;

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  // Group sessions by user
  const byUser = sessions.reduce<Record<string, Session[]>>((acc, s) => {
    const uid = s.userId;
    if (!acc[uid]) acc[uid] = [];
    acc[uid].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <StepUpDialog
        open={stepUpOpen}
        onClose={() => setStepUpOpen(false)}
        onSuccess={handleStepUpSuccess}
        title={stepUpAction === "block" ? "Bloquer le compte" : "Révoquer toutes les sessions"}
        description={
          stepUpAction === "block"
            ? "Confirmez pour bloquer ce compte utilisateur."
            : "Confirmez pour révoquer toutes les sessions de cet utilisateur."
        }
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""} active{sessions.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {/* Sessions grouped by user */}
      {Object.keys(byUser).length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">
          Aucune session active
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byUser).map(([userId, userSessions]) => {
            const firstSession = userSessions[0];
            const isCurrentUser = user?.id === userId || String(user?.id) === userId;

            return (
              <div key={userId} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* User header */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-semibold">
                      {(firstSession.userName ?? userId).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {firstSession.userName ?? userId}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                            Vous
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{firstSession.userRole ?? "—"}</p>
                    </div>
                  </div>
                  {!isCurrentUser && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRevokeAllClick(userId)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-600 border border-orange-200 rounded hover:bg-orange-50 transition-colors"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Révoquer tout
                      </button>
                      <button
                        onClick={() => handleBlockClick(userId)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors"
                      >
                        <ShieldOff className="w-3.5 h-3.5" />
                        Bloquer
                      </button>
                      <button
                        onClick={() => handleRequireReset(userId)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-50 transition-colors"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Forcer MDP
                      </button>
                    </div>
                  )}
                </div>

                {/* Messages for user */}
                {(rowMsg[`all-${userId}`] || rowMsg[`block-${userId}`] || rowMsg[`reset-${userId}`]) && (
                  <div className="px-4 py-2 bg-blue-50 text-xs text-blue-700">
                    {rowMsg[`all-${userId}`] || rowMsg[`block-${userId}`] || rowMsg[`reset-${userId}`]}
                  </div>
                )}

                {/* Session list */}
                <div className="divide-y divide-gray-100">
                  {userSessions.map((session) => {
                    const isCurrent =
                      session.isCurrent ||
                      session.id === currentSessionId ||
                      (isCurrentUser && userSessions.indexOf(session) === 0);

                    return (
                      <div
                        key={session.id}
                        className={`px-4 py-3 flex flex-wrap items-start justify-between gap-3 ${isCurrent ? "bg-green-50" : "hover:bg-gray-50"}`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-gray-500">
                              {session.ipAddress ?? "—"}
                            </span>
                            {isCurrent && (
                              <span className="text-xs font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                                Session actuelle
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate max-w-sm">
                            {session.userAgent ?? "—"}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            {session.createdAt && (
                              <span>
                                Créée : {new Date(session.createdAt).toLocaleString("fr-FR")}
                              </span>
                            )}
                            {session.lastActivityAt && (
                              <span>
                                Activité : {new Date(session.lastActivityAt).toLocaleString("fr-FR")}
                              </span>
                            )}
                          </div>
                          {rowMsg[session.id] && (
                            <p className="text-xs text-indigo-700">{rowMsg[session.id]}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRevoke(session.id)}
                          disabled={isCurrent}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isCurrent ? "Impossible de révoquer la session actuelle" : "Révoquer cette session"}
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Révoquer
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
