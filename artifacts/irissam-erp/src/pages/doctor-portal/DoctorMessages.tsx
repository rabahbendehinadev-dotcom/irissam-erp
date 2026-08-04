import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api/client';
import { DoctorPortalLayout } from '@/layouts/DoctorPortalLayout';
import { MessageSquare, Plus, AlertTriangle, X, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type Mailbox = 'inbox' | 'sent';

interface Message {
  id: string;
  sender_name: string;
  recipient_name: string;
  subject: string;
  body: string;
  sent_at: string;
  read_at: string | null;
}

interface ComposeForm {
  recipientId: string;
  subject: string;
  body: string;
}

const defaultCompose: ComposeForm = { recipientId: '', subject: '', body: '' };

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('bg-gray-200 rounded-lg animate-pulse', className)} />;
}

export default function DoctorMessages() {
  const [mailbox, setMailbox] = useState<Mailbox>('inbox');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [compose, setCompose] = useState<ComposeForm>(defaultCompose);
  const [submitting, setSubmitting] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [mobileViewDetail, setMobileViewDetail] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<Message[]>(`/api/doctor-portal/messages?box=${mailbox}`);
      setMessages(Array.isArray(res) ? res : []);
      setSelectedMessage(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [mailbox]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const selectMessage = async (msg: Message) => {
    setSelectedMessage(msg);
    setMobileViewDetail(true);
    if (!msg.read_at) {
      try {
        await apiClient.patch(`/api/doctor-portal/messages/${msg.id}/read`, {});
        setMessages((prev) =>
          prev.map((m) => m.id === msg.id ? { ...m, read_at: new Date().toISOString() } : m),
        );
      } catch {
        // silent
      }
    }
  };

  const submitCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setComposeError(null);
    try {
      await apiClient.post('/api/doctor-portal/messages', {
        recipientId: compose.recipientId,
        subject: compose.subject,
        body: compose.body,
      });
      setModalOpen(false);
      setCompose(defaultCompose);
      await fetchMessages();
    } catch (err: unknown) {
      setComposeError(err instanceof Error ? err.message : 'Erreur lors de l\'envoi');
    } finally {
      setSubmitting(false);
    }
  };

  const unreadCount = messages.filter((m) => !m.read_at).length;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <DoctorPortalLayout>
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Messages
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </h1>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Nouveau message
          </button>
        </div>

        {/* Warning banner */}
        {!warningDismissed && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 flex-1">
              ⚠ Pour une urgence vitale, utilisez le circuit d'urgence — ne pas utiliser la messagerie.
            </p>
            <button
              onClick={() => setWarningDismissed(true)}
              className="text-amber-500 hover:text-amber-700 flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500" />
            <p className="text-red-700 text-sm flex-1">{error}</p>
            <button onClick={fetchMessages} className="text-sm text-red-600 flex items-center gap-1">
              <RefreshCw size={14} /> Réessayer
            </button>
          </div>
        )}

        {/* Two-panel layout */}
        <div className="flex gap-4 min-h-[500px]">
          {/* Left panel (list) */}
          <div className={cn(
            'flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden',
            mobileViewDetail ? 'hidden sm:flex' : 'flex',
            'w-full sm:w-1/3',
          )}>
            {/* Toggle */}
            <div className="flex border-b border-gray-100">
              {(['inbox', 'sent'] as Mailbox[]).map((box) => (
                <button
                  key={box}
                  onClick={() => setMailbox(box)}
                  className={cn(
                    'flex-1 py-3 text-sm font-medium transition-colors',
                    mailbox === box
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  {box === 'inbox' ? 'Boîte de réception' : 'Envoyés'}
                </button>
              ))}
            </div>

            {/* Message list */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-3 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonBlock key={i} className="h-14" />
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-10">
                  <MessageSquare size={32} className="opacity-40 mb-2" />
                  <p className="text-sm">Aucun message</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => selectMessage(msg)}
                    className={cn(
                      'w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50 transition-colors',
                      selectedMessage?.id === msg.id && 'bg-blue-50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('text-sm truncate', !msg.read_at ? 'font-semibold text-gray-900' : 'text-gray-700')}>
                        {mailbox === 'inbox' ? msg.sender_name : msg.recipient_name}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!msg.read_at && (
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(msg.sent_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{msg.subject}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right panel (detail) */}
          <div className={cn(
            'flex-1 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col',
            !mobileViewDetail && selectedMessage === null ? 'hidden sm:flex' : 'flex',
          )}>
            {selectedMessage ? (
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {/* Mobile back */}
                <button
                  onClick={() => setMobileViewDetail(false)}
                  className="sm:hidden text-blue-600 text-sm flex items-center gap-1 mb-2"
                >
                  ← Retour
                </button>

                <div className="space-y-1 border-b border-gray-100 pb-4">
                  <h2 className="font-bold text-gray-900 text-base">{selectedMessage.subject}</h2>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <p>De: <strong>{selectedMessage.sender_name}</strong></p>
                    <p>À: <strong>{selectedMessage.recipient_name}</strong></p>
                    <p>{formatDate(selectedMessage.sent_at)}</p>
                  </div>
                </div>

                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {selectedMessage.body}
                </p>

                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 italic">
                    Réponse — Fonctionnalité à venir
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <MessageSquare size={40} className="opacity-30 mb-3" />
                <p className="text-sm">Sélectionnez un message</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compose Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Nouveau message</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitCompose} className="p-6 space-y-4">
              {/* Warning */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Ne pas inclure de contenu médical confidentiel dans les messages.
                </p>
              </div>

              {composeError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {composeError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID du destinataire <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={compose.recipientId}
                  onChange={(e) => setCompose((prev) => ({ ...prev, recipientId: e.target.value }))}
                  required
                  placeholder="UUID du destinataire"
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sujet <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={compose.subject}
                  onChange={(e) => setCompose((prev) => ({ ...prev, subject: e.target.value }))}
                  required
                  placeholder="Objet du message"
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={compose.body}
                  onChange={(e) => setCompose((prev) => ({ ...prev, body: e.target.value }))}
                  required
                  rows={5}
                  placeholder="Votre message…"
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Envoi…' : 'Envoyer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DoctorPortalLayout>
  );
}
