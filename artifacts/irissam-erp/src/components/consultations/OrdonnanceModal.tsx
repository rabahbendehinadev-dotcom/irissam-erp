/**
 * Ordonnance électronique — format classique compact (A5 portrait, comme les
 * ordonnanciers de clinique) + impression/PDF. Logo officiel IRISSAM conservé
 * dans l'en-tête ET répété en filigrane centré, grand et très transparent en
 * arrière-plan (il ne gêne pas la lecture ; les <img> s'impriment nativement,
 * contrairement aux backgrounds CSS).
 *
 * Données 100 % réelles : les lignes proviennent de
 * GET /prescriptions?consultationId=… (prescriptions non annulées) ; le
 * médecin et la spécialité sont ceux de la consultation (identité vérifiée
 * côté serveur). Impression via le pattern iframe + Tailwind CDN du CR.
 * Chaque impression est auditée (action `print`, module consultations).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, FileText, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useQuery } from '@/hooks/useQuery';
import { apiClient } from '@/lib/api-client';
import { auditService } from '@/services/auditService';
import type { Consultation } from '@/types/consultation';

/** Ligne de prescription telle que renvoyée par GET /prescriptions. */
interface RxLine {
  id: string;
  drug: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  route?: string | null;
  status: string;
  notes?: string | null;
  instructions?: string | null;
}

const CANCELLED = new Set(['annulee', 'annule']);

function calcAge(dob?: string | null): string | null {
  if (!dob) return null;
  const y = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return Number.isFinite(y) && y >= 0 ? `${y} ans` : null;
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ─── Document A5 (format ordonnance classique) ───────────────────────────────

function OrdonnanceDoc({ consultation: c, lines }: { consultation: Consultation; lines: RxLine[] }) {
  // Enrichissement du dossier patient réel (DOB/sexe/téléphone) ; pour un
  // patient de passage, l'identité vient des colonnes de la consultation.
  const [apiPatient, setApiPatient] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (!c.patientId || c.isWalkIn) return;
    apiClient.get<Record<string, unknown>>(`/patients/${c.patientId}`)
      .then(r => setApiPatient(r))
      .catch(err => console.warn('[OrdonnanceDoc] Patient enrichment fetch failed — non-critical:', err));
  }, [c.patientId, c.isWalkIn]);

  const dob    = c.isWalkIn ? c.patientBirthDate : (apiPatient?.dateOfBirth as string | undefined);
  const gender = c.isWalkIn ? c.patientGender : (apiPatient?.gender as string | undefined);
  const phone  = c.isWalkIn ? c.patientPhone : (apiPatient?.phone as string | undefined);
  const age    = calcAge(dob);

  const printDate = new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div
      className="bg-white font-sans text-gray-900"
      style={{
        width: '148mm', minHeight: '210mm', padding: '9mm 10mm',
        boxSizing: 'border-box', fontSize: '11px',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* ── Filigrane : logo officiel centré, grand et très léger (z-0) ── */}
      <img
        src="/logo.png"
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '118mm',
          height: '118mm',
          objectFit: 'contain',
          opacity: 0.12,
          pointerEvents: 'none',
          zIndex: 0,
          userSelect: 'none',
        }}
      />

      {/* Contenu au-dessus du filigrane */}
      <div style={{ position: 'relative', zIndex: 1 }}>
      {/* ── En-tête établissement (logo conservé) ── */}
      <div className="flex items-start justify-between mb-3 pb-2.5 border-b-2 border-blue-700">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <img src="/logo.png" alt="IRISSAM Hospital" className="w-9 h-9 object-contain rounded" />
            <div>
              <div className="font-black text-[15px] text-blue-800 leading-none">IRISSAM HOSPITAL</div>
              <div className="text-[8.5px] text-gray-500 tracking-widest uppercase mt-0.5">Centre Hospitalier Multidisciplinaire</div>
            </div>
          </div>
          <div className="text-[9px] text-gray-500 mt-0.5">
            Tél : +213 XX XX XX XX · www.irissam-hospital.dz
          </div>
        </div>
        <div className="text-right">
          <div className="font-black text-[12px] text-blue-800 uppercase tracking-wide">Ordonnance Médicale</div>
          <div className="font-mono text-[11px] text-blue-600 font-semibold mt-0.5">{c.number}</div>
          <div className="text-[9px] text-gray-500 mt-0.5">Le {fmtDate(c.scheduledAt)}</div>
        </div>
      </div>

      {/* ── Prescripteur + Patient ── */}
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <div className="border border-gray-200 rounded-lg p-2">
          <div className="font-bold text-[8.5px] text-blue-700 uppercase tracking-widest mb-1">Prescripteur</div>
          <div className="space-y-0.5 text-[10px]">
            <div className="font-bold text-[11.5px] text-gray-900">{c.doctorName}</div>
            <div className="text-gray-600">{c.specialty}</div>
            <div className="text-gray-500">{c.serviceName}</div>
          </div>
        </div>
        <div className="border border-blue-200 rounded-lg p-2 bg-blue-50/40">
          <div className="font-bold text-[8.5px] text-blue-700 uppercase tracking-widest mb-1">Patient</div>
          <div className="space-y-0.5 text-[10px]">
            <div className="font-bold text-[11.5px] text-gray-900">{c.patientName}</div>
            <div className="font-mono text-blue-600">
              {c.patientMpi}
              {c.isWalkIn && <span className="ml-1.5 text-amber-700 font-sans font-semibold">(patient de passage)</span>}
            </div>
            <div className="text-gray-600">
              {[
                age,
                gender === 'M' ? 'Masculin' : gender === 'F' ? 'Féminin' : null,
                dob ? `né(e) le ${fmtDate(dob)}` : null,
              ].filter(Boolean).join(' · ') || '—'}
            </div>
            {phone && <div className="text-gray-500">Tél : {phone}</div>}
          </div>
        </div>
      </div>

      {/* ── Prescriptions ── */}
      <div className="flex items-center gap-2 mb-2">
        <span className="font-serif font-black text-[20px] text-blue-800 leading-none">℞</span>
        <div className="flex-1 border-t-2 border-blue-200" />
      </div>

      <div className="space-y-2 mb-4">
        {lines.map((rx, i) => (
          <div key={rx.id} className="pb-2 border-b border-dashed border-gray-200">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-[11px] text-gray-400 shrink-0">{i + 1}.</span>
              <div className="flex-1">
                <div className="font-bold text-[12px] uppercase tracking-wide text-gray-900">
                  {rx.drug}
                  {rx.dosage && <span className="normal-case font-semibold text-gray-700"> — {rx.dosage}</span>}
                </div>
                <div className="text-[10px] text-gray-700 mt-0.5">
                  {[
                    rx.frequency,
                    rx.duration ? `pendant ${rx.duration}` : null,
                    rx.route ? `voie ${rx.route}` : null,
                  ].filter(Boolean).join(' · ') || 'Selon prescription'}
                </div>
                {rx.instructions && (
                  <div className="text-[10px] text-blue-800 italic mt-0.5">Instructions : {rx.instructions}</div>
                )}
                {rx.notes && <div className="text-[9px] text-gray-500 mt-0.5">{rx.notes}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Signature ── */}
      <div className="mt-5 pt-2.5 border-t border-gray-300">
        <div className="flex justify-between items-end gap-3">
          <div className="text-[8.5px] text-gray-500">
            <div>Ordonnance électronique générée par le système IRISSAM ERP</div>
            <div className="font-mono">{c.number} · imprimée le {printDate}</div>
            <div className="mt-1 italic">Document valable accompagné du cachet du prescripteur.</div>
          </div>
          <div className="text-center shrink-0">
            <div className="border-t border-gray-400 w-40 pt-1 text-[10px] text-gray-600">
              <div className="font-semibold">{c.doctorName}</div>
              <div className="text-gray-500">{c.specialty}</div>
              <div className="mt-6 text-gray-400 italic text-[8.5px]">Signature et cachet</div>
            </div>
          </div>
        </div>
      </div>
      </div>{/* fin contenu (z-1) */}
    </div>
  );
}

// ─── Modal aperçu + impression ────────────────────────────────────────────────

function OrdonnanceModal({
  consultation, lines, onClose, onPrinted,
}: {
  consultation: Consultation;
  lines: RxLine[];
  onClose: () => void;
  onPrinted?: () => void;
}) {
  const previewRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const root = previewRef.current;
    if (!root) return;

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Ordonnance — ${consultation.number}</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    @page { size: A5 portrait; margin: 0; }
    body { margin: 0; padding: 0; background: white; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>${root.innerHTML}</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText =
      'position:fixed;top:-9999px;left:-9999px;width:148mm;height:210mm;border:none;visibility:hidden;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        }, 3000);
      }, 700);
    };

    // Traçabilité : impression auditée côté serveur (user + IP via JWT).
    void auditService.logClinical({
      action:   'print',
      module:   'consultations',
      entityId: consultation.id,
      metadata: { document: 'ordonnance', number: consultation.number, lines: lines.length },
    });
    onPrinted?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-gray-900/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Aperçu de l'ordonnance"
    >
      <div className="flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="IRISSAM" className="w-8 h-8 object-contain rounded" />
          <div>
            <div className="font-semibold text-gray-800 text-sm">Ordonnance médicale</div>
            <div className="text-xs text-blue-600 font-mono">{consultation.number}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Printer size={14} />
            Imprimer / PDF
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            title="Fermer"
          >
            <X size={14} />
            Fermer
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex justify-center py-8 px-4">
        <div ref={previewRef} className="shadow-2xl rounded-sm" style={{ width: '148mm', minHeight: '210mm' }}>
          <OrdonnanceDoc consultation={consultation} lines={lines} />
        </div>
      </div>

      <div className="shrink-0 bg-gray-800 text-center py-2 text-xs text-gray-400">
        Cliquez sur <strong className="text-white">Imprimer / PDF</strong> pour ouvrir la boîte de
        dialogue d&apos;impression · Choisissez «&nbsp;Enregistrer en PDF&nbsp;» pour télécharger
      </div>
    </div>,
    document.body,
  );
}

// ─── Onglet Ordonnance de l'espace de travail ─────────────────────────────────

export function OrdonnancePanel({
  consultation, onLog,
}: {
  consultation: Consultation;
  onLog?: (action: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const { data, loading, error, refetch } = useQuery<RxLine[]>(
    `/prescriptions?consultationId=${consultation.id}`,
  );
  const lines = useMemo(
    () => (Array.isArray(data) ? data.filter(r => !CANCELLED.has(r.status)) : []),
    [data],
  );
  const cancelledCount = Array.isArray(data) ? data.length - lines.length : 0;
  const consultationCancelled = consultation.status === 'annulee';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold text-gray-800">Ordonnance électronique</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Format ordonnance classique compact (A5) avec filigrane IRISSAM —
            généré à partir des médicaments prescrits dans cette consultation,
            au nom du médecin traitant, impression auditée.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          title="Actualiser"
          className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
          <Loader2 size={16} className="animate-spin mr-2" /> Chargement des prescriptions…
        </div>
      ) : error ? (
        <div className="text-center py-10">
          <AlertTriangle size={28} className="mx-auto mb-2 text-red-400" />
          <p className="text-sm text-gray-600 font-medium">Impossible de charger les prescriptions</p>
          <button onClick={() => refetch()} className="mt-3 px-3.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Réessayer
          </button>
        </div>
      ) : lines.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <FileText size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium text-gray-500">Aucun médicament actif à imprimer</p>
          <p className="text-xs mt-1 opacity-70">
            Ajoutez d'abord des médicaments dans l'onglet « Médicaments »
            {cancelledCount > 0 ? ` (${cancelledCount} prescription${cancelledCount > 1 ? 's' : ''} annulée${cancelledCount > 1 ? 's' : ''} exclue${cancelledCount > 1 ? 's' : ''})` : ''}.
          </p>
        </div>
      ) : (
        <>
          <div className="border border-gray-200 rounded-xl bg-white divide-y divide-gray-50">
            {lines.map((rx, i) => (
              <div key={rx.id} className="px-4 py-2.5 flex items-baseline gap-2 text-sm">
                <span className="text-xs font-semibold text-gray-400 shrink-0">{i + 1}.</span>
                <div className="min-w-0">
                  <span className="font-semibold text-gray-900">{rx.drug}</span>
                  {rx.dosage && <span className="text-gray-600"> — {rx.dosage}</span>}
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[rx.frequency, rx.duration ? `pendant ${rx.duration}` : null]
                      .filter(Boolean).join(' · ') || 'Selon prescription'}
                    {rx.instructions ? ` · ${rx.instructions}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] text-gray-400">
              {lines.length} médicament{lines.length > 1 ? 's' : ''} actif{lines.length > 1 ? 's' : ''}
              {cancelledCount > 0 ? ` · ${cancelledCount} annulé${cancelledCount > 1 ? 's' : ''} (exclu${cancelledCount > 1 ? 's' : ''} de l'ordonnance)` : ''}
            </p>
            <button
              onClick={() => setOpen(true)}
              disabled={consultationCancelled}
              title={consultationCancelled ? 'Consultation annulée — impression désactivée' : undefined}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Printer size={14} /> Aperçu & impression
            </button>
          </div>
        </>
      )}

      {open && (
        <OrdonnanceModal
          consultation={consultation}
          lines={lines}
          onClose={() => setOpen(false)}
          onPrinted={() => onLog?.(`Ordonnance imprimée — ${lines.length} médicament(s)`)}
        />
      )}
    </div>
  );
}
