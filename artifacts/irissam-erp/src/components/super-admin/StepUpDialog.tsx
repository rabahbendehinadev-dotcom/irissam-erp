import { useState, useEffect, useCallback, type ReactElement } from "react";
import { Lock, X } from "lucide-react";
import { stepUpAuth } from "@/services/api/system";

interface StepUpDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (token: string) => void;
  title?: string;
  description?: string;
}

export function StepUpDialog({
  open,
  onClose,
  onSuccess,
  title = "Authentification renforcée requise",
  description = "Pour effectuer cette action sensible, veuillez confirmer votre mot de passe.",
}: StepUpDialogProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password.trim()) {
        setError("Le mot de passe est requis.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await stepUpAuth(password);
        const token: string = (result as any)?.token ?? (result as any)?.stepUpToken ?? String(result);
        onSuccess(token);
        setPassword("");
      } catch (err: unknown) {
        const e = err as { response?: { data?: { message?: string } }; message?: string };
        setError(
          e?.response?.data?.message ?? e?.message ?? "Mot de passe incorrect."
        );
      } finally {
        setLoading(false);
      }
    },
    [password, onSuccess]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    },
    [open, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full sm:w-full sm:max-w-md rounded-t-xl sm:rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-600">{description}</p>

          <div>
            <label
              htmlFor="step-up-password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Mot de passe
            </label>
            <input
              id="step-up-password"
              type="password"
              autoFocus={open}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="••••••••"
              disabled={loading}
            />
            {error && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                <span>{error}</span>
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Vérification…
                </>
              ) : (
                "Confirmer"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StepUpDialog;
