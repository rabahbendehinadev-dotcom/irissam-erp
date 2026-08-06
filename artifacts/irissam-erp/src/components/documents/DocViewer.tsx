import { useState, useEffect } from "react";
import { X, Download, Printer, Clock, CheckCircle, XCircle, PenSquare, Archive, Share2, Tag, Star, MessageSquare, RotateCcw, ShieldCheck, History, FileText, Eye } from "lucide-react";
import { docsApi, type DocRecord } from "@/services/api/documents";
import { DocStatusBadge, DocConfidentialityBadge, formatFileSize } from "./DocStatusBadge";

interface Props {
  documentId: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

type Tab = "preview" | "metadata" | "versions" | "approvals" | "signatures" | "comments" | "audit" | "links";

export function DocViewer({ documentId, onClose, onRefresh }: Props) {
  const [doc, setDoc] = useState<DocRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("preview");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState("");
  const [comment, setComment] = useState("");
  const [signReason, setSignReason] = useState("");
  const [rejectComment, setRejectComment] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showSignForm, setShowSignForm] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!documentId) return;
    setLoading(true);
    setError("");
    docsApi.get(documentId)
      .then(d => { setDoc(d); setLoading(false); })
      .catch(e => { setError(e?.data?.error ?? e?.message ?? "Erreur de chargement"); setLoading(false); });
  }, [documentId]);

  useEffect(() => {
    if (activeTab === "audit" && documentId) {
      docsApi.getDocumentAudit(documentId).then(r => setAuditLogs(r.logs ?? []));
    }
  }, [activeTab, documentId]);

  const action = async (fn: () => Promise<any>, msg: string) => {
    setActionLoading(msg);
    setError("");
    try {
      await fn();
      const updated = await docsApi.get(documentId!);
      setDoc(updated);
      onRefresh();
    } catch (e: any) {
      setError(e?.data?.error ?? e?.message ?? "Erreur");
    } finally {
      setActionLoading("");
    }
  };

  const previewUrl = documentId ? docsApi.getPreviewUrl(documentId) : null;
  const downloadUrl = documentId ? docsApi.getDownloadUrl(documentId) : null;

  if (!documentId) return null;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "preview", label: "Aperçu" },
    { id: "metadata", label: "Infos" },
    { id: "versions", label: "Versions", count: doc?.versions?.length },
    { id: "approvals", label: "Approbations", count: doc?.approvals?.length },
    { id: "signatures", label: "Signatures", count: doc?.signatures?.length },
    { id: "comments", label: "Commentaires", count: doc?.comments?.length },
    { id: "audit", label: "Audit" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1" />
      {/* Panel */}
      <div
        className="w-full sm:w-[680px] lg:w-[800px] bg-white shadow-2xl flex flex-col h-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b bg-gray-50 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            {loading ? (
              <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <DocStatusBadge status={doc?.status ?? ""} />
                  <DocConfidentialityBadge level={doc?.confidentiality ?? ""} />
                </div>
                <h2 className="font-semibold text-gray-800 mt-1 truncate">{doc?.title}</h2>
                <p className="text-xs text-gray-500">{doc?.documentNumber} · {doc?.fileName} · {formatFileSize(doc?.fileSize ?? 0)}</p>
              </>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Action bar */}
        {doc && !loading && (
          <div className="flex items-center gap-1 p-2 border-b bg-white flex-shrink-0 overflow-x-auto">
            <a href={`/api/documents/records/${documentId}/download-url`} target="_blank"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 whitespace-nowrap">
              <Download size={14} /><span className="hidden sm:inline">Télécharger</span>
            </a>
            <button onClick={() => window.open(`/api/documents/records/${documentId}/preview-url`, "_blank")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 whitespace-nowrap">
              <Printer size={14} /><span className="hidden sm:inline">Imprimer</span>
            </button>
            {doc.status !== "approved" && doc.status !== "archived" && (
              <button onClick={() => action(() => docsApi.approve(doc.id), "approve")}
                disabled={!!actionLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-green-600 hover:bg-green-50 whitespace-nowrap disabled:opacity-50">
                <CheckCircle size={14} /><span className="hidden sm:inline">Approuver</span>
              </button>
            )}
            {doc.status !== "rejected" && doc.status !== "archived" && (
              <button onClick={() => setShowRejectForm(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 whitespace-nowrap">
                <XCircle size={14} /><span className="hidden sm:inline">Rejeter</span>
              </button>
            )}
            <button onClick={() => setShowSignForm(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-purple-600 hover:bg-purple-50 whitespace-nowrap">
              <PenSquare size={14} /><span className="hidden sm:inline">Signer</span>
            </button>
            {doc.status !== "archived" && (
              <button onClick={() => action(() => docsApi.archive(doc.id), "archive")}
                disabled={!!actionLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 whitespace-nowrap">
                <Archive size={14} /><span className="hidden sm:inline">Archiver</span>
              </button>
            )}
            {doc.status === "archived" && (
              <button onClick={() => action(() => docsApi.restore(doc.id), "restore")}
                disabled={!!actionLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 whitespace-nowrap">
                <RotateCcw size={14} /><span className="hidden sm:inline">Restaurer</span>
              </button>
            )}
            <button onClick={() => action(() => docsApi.favorite(doc.id), "favorite")}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${doc.isFavorite ? "text-yellow-600 bg-yellow-50" : "text-gray-600 hover:bg-gray-100"}`}>
              <Star size={14} />
            </button>
          </div>
        )}

        {/* Reject form */}
        {showRejectForm && (
          <div className="p-3 border-b bg-red-50 flex-shrink-0">
            <p className="text-sm font-medium text-red-700 mb-2">Raison du rejet (obligatoire)</p>
            <textarea value={rejectComment} onInput={e => setRejectComment((e.target as HTMLTextAreaElement).value)}
              className="w-full border rounded px-2 py-1.5 text-sm resize-none" rows={2} placeholder="Expliquez la raison du rejet…" />
            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowRejectForm(false)} className="px-3 py-1.5 text-sm border rounded text-gray-600 hover:bg-white">Annuler</button>
              <button onClick={() => {
                if (!rejectComment.trim()) return;
                action(() => docsApi.reject(doc!.id, rejectComment), "reject");
                setShowRejectForm(false); setRejectComment("");
              }} disabled={!rejectComment.trim()} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded disabled:opacity-50">Confirmer le rejet</button>
            </div>
          </div>
        )}

        {/* Sign form */}
        {showSignForm && (
          <div className="p-3 border-b bg-purple-50 flex-shrink-0">
            <p className="text-sm font-medium text-purple-700 mb-2">Raison de signature (obligatoire)</p>
            <input type="text" value={signReason} onInput={e => setSignReason((e.target as HTMLInputElement).value)}
              className="w-full border rounded px-2 py-1.5 text-sm" placeholder="Ex: Validation médicale, Certification…" />
            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowSignForm(false)} className="px-3 py-1.5 text-sm border rounded text-gray-600 hover:bg-white">Annuler</button>
              <button onClick={() => {
                if (!signReason.trim()) return;
                action(() => docsApi.sign(doc!.id, signReason), "sign");
                setShowSignForm(false); setSignReason("");
              }} disabled={!signReason.trim()} className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded disabled:opacity-50">Signer</button>
            </div>
          </div>
        )}

        {error && (
          <div className="px-4 py-2 bg-red-50 text-red-700 text-sm flex-shrink-0">{error}</div>
        )}

        {/* Tabs */}
        <div className="flex border-b overflow-x-auto flex-shrink-0 bg-white">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors
                ${activeTab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t.label}
              {t.count ? <span className="ml-1 bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5 text-[10px]">{t.count}</span> : null}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : !doc ? (
            <div className="p-8 text-center text-gray-500">Document introuvable</div>
          ) : (
            <>
              {activeTab === "preview" && (
                <div className="h-full min-h-[400px] flex items-center justify-center bg-gray-100">
                  {doc.mimeType === "application/pdf" ? (
                    <iframe src={`/api/documents/records/${doc.id}/preview-url`}
                      className="w-full h-full min-h-[400px]" title={doc.title} />
                  ) : doc.mimeType.startsWith("image/") ? (
                    <img src={`/api/documents/records/${doc.id}/preview-url`}
                      alt={doc.title} className="max-w-full max-h-[600px] object-contain rounded shadow" />
                  ) : (
                    <div className="text-center p-8">
                      <FileText size={48} className="text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 font-medium">{doc.fileName}</p>
                      <p className="text-gray-400 text-sm mb-4">{doc.mimeType}</p>
                      <a href={`/api/documents/records/${doc.id}/download-url`} target="_blank"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-2">
                        <Download size={16} /> Télécharger pour afficher
                      </a>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "metadata" && (
                <div className="p-4 space-y-3">
                  {[
                    ["N° Document", doc.documentNumber],
                    ["Titre", doc.title],
                    ["Description", doc.description],
                    ["Catégorie", doc.category],
                    ["Module", doc.module],
                    ["Dossier", doc.folderPath],
                    ["Confidentialité", doc.confidentiality],
                    ["Statut", doc.status],
                    ["Version", doc.versionNumber],
                    ["Taille", formatFileSize(doc.fileSize)],
                    ["Type MIME", doc.mimeType],
                    ["Tags", doc.tags?.join(", ")],
                    ["Rétention jusqu'au", doc.retentionUntil],
                    ["Expire le", doc.expiresAt],
                    ["Archivé le", doc.archivedAt],
                    ["Signé le", doc.signedAt],
                    ["Legal Hold", doc.legalHold ? "Oui" : "Non"],
                    ["Créé le", doc.createdAt ? new Date(doc.createdAt).toLocaleString("fr-FR") : ""],
                    ["Par", doc.createdByName],
                  ].filter(([_, v]) => v).map(([label, value]) => (
                    <div key={label} className="flex gap-4">
                      <dt className="text-sm text-gray-500 w-40 flex-shrink-0">{label}</dt>
                      <dd className="text-sm text-gray-800 flex-1">{value as string}</dd>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "versions" && (
                <div className="p-4">
                  <div className="space-y-2">
                    {(doc.versions ?? []).map(v => (
                      <div key={v.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center flex-shrink-0">
                          v{v.versionNumber}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{v.fileName}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(v.fileSize)} · {v.createdByName} · {new Date(v.createdAt).toLocaleString("fr-FR")}</p>
                          {v.changeReason && <p className="text-xs text-gray-600 italic mt-0.5">{v.changeReason}</p>}
                        </div>
                      </div>
                    ))}
                    {!doc.versions?.length && <p className="text-sm text-gray-400 text-center py-6">Aucune version antérieure</p>}
                  </div>
                </div>
              )}

              {activeTab === "approvals" && (
                <div className="p-4 space-y-2">
                  {(doc.approvals ?? []).map(a => (
                    <div key={a.id} className={`flex items-start gap-3 p-3 border rounded-lg
                      ${a.action === "approved" ? "border-green-200 bg-green-50" : a.action === "rejected" ? "border-red-200 bg-red-50" : "border-gray-200"}`}>
                      <div className={`mt-0.5 ${a.action === "approved" ? "text-green-600" : a.action === "rejected" ? "text-red-600" : "text-yellow-600"}`}>
                        {a.action === "approved" ? <CheckCircle size={18} /> : a.action === "rejected" ? <XCircle size={18} /> : <Clock size={18} />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{a.approverName} — <span className="capitalize">{a.action}</span></p>
                        {a.decidedAt && <p className="text-xs text-gray-500">{new Date(a.decidedAt).toLocaleString("fr-FR")}</p>}
                        {a.comment && <p className="text-xs text-gray-600 mt-0.5 italic">{a.comment}</p>}
                      </div>
                    </div>
                  ))}
                  {!doc.approvals?.length && <p className="text-sm text-gray-400 text-center py-6">Aucune approbation enregistrée</p>}
                </div>
              )}

              {activeTab === "signatures" && (
                <div className="p-4 space-y-2">
                  {(doc.signatures ?? []).map(s => (
                    <div key={s.id} className="flex items-start gap-3 p-3 border rounded-lg border-purple-200 bg-purple-50">
                      <ShieldCheck size={18} className="text-purple-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-purple-800">{s.signerName} ({s.signerRole})</p>
                        <p className="text-xs text-gray-500">{new Date(s.signedAt).toLocaleString("fr-FR")} · {s.signatureType}</p>
                        {s.reason && <p className="text-xs italic mt-0.5">{s.reason}</p>}
                        <p className="text-[10px] text-gray-400 mt-1 font-mono break-all">Hash: {s.docHash.slice(0, 32)}…</p>
                      </div>
                    </div>
                  ))}
                  {!doc.signatures?.length && <p className="text-sm text-gray-400 text-center py-6">Aucune signature</p>}
                </div>
              )}

              {activeTab === "comments" && (
                <div className="p-4 flex flex-col gap-3">
                  <div className="space-y-3 flex-1">
                    {(doc.comments ?? []).map(c => (
                      <div key={c.id} className={`p-3 rounded-lg ${c.isInternal ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50 border"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-700">{c.createdBy}</span>
                          {c.isInternal && <span className="text-[10px] bg-yellow-200 text-yellow-700 rounded px-1">Interne</span>}
                          <span className="text-xs text-gray-400 ml-auto">{new Date(c.createdAt).toLocaleString("fr-FR")}</span>
                        </div>
                        <p className="text-sm text-gray-700">{c.content}</p>
                      </div>
                    ))}
                    {!doc.comments?.length && <p className="text-sm text-gray-400 text-center py-6">Aucun commentaire</p>}
                  </div>
                  <div className="flex gap-2 pt-2 border-t">
                    <input type="text" value={comment} onInput={e => setComment((e.target as HTMLInputElement).value)}
                      placeholder="Ajouter un commentaire…"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button onClick={() => {
                      if (!comment.trim()) return;
                      action(() => docsApi.addComment(doc.id, comment), "comment");
                      setComment("");
                    }} disabled={!comment.trim() || !!actionLoading}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                      <MessageSquare size={16} />
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "audit" && (
                <div className="p-4">
                  <div className="space-y-1.5">
                    {auditLogs.map(l => (
                      <div key={l.id} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium
                          ${l.denied ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                          {l.denied ? "❌ " : ""}{l.action}
                        </span>
                        <span className="text-gray-700 flex-1">{l.userName ?? "—"}</span>
                        <span className="text-gray-400 text-xs">{new Date(l.createdAt).toLocaleString("fr-FR")}</span>
                      </div>
                    ))}
                    {!auditLogs.length && <p className="text-sm text-gray-400 text-center py-6">Aucun log disponible</p>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
