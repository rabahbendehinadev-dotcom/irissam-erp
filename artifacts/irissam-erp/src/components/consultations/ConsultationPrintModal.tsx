/**
 * ConsultationPrintModal
 * Shows a formatted A4 preview of the CR and lets the user print or save as PDF.
 * Printing opens a blank iframe populated with the rendered report HTML + Tailwind CDN.
 */
import { useRef, useCallback } from 'react';
import { X, Printer } from 'lucide-react';
import { createPortal } from 'react-dom';
import { ConsultationReport } from './ConsultationReport';
import type { Consultation } from '@/types/consultation';

interface Props {
  consultation: Consultation;
  onClose: () => void;
}

export function ConsultationPrintModal({ consultation, onClose }: Props) {
  const previewRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    const root = previewRef.current;
    if (!root) return;

    // Grab the rendered HTML from the preview div
    const reportHtml = root.innerHTML;

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>CR — ${consultation.number}</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    @page { size: A4; margin: 0; }
    body { margin: 0; padding: 0; background: white; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>${reportHtml}</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText =
      'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;visibility:hidden;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();

    // Wait for Tailwind CDN script to load then print
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        }, 3000);
      }, 700);
    };
  }, [consultation.number]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-gray-900/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Aperçu du Compte Rendu"
    >
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="IRISSAM" className="w-8 h-8 object-contain rounded" />
          <div>
            <div className="font-semibold text-gray-800 text-sm">Compte Rendu de Consultation</div>
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

      {/* ── Scrollable preview ── */}
      <div className="flex-1 overflow-y-auto flex justify-center py-8 px-4">
        {/* A4 shadow card — this is the node we serialise for print */}
        <div
          ref={previewRef}
          className="shadow-2xl rounded-sm"
          style={{ width: '210mm', minHeight: '297mm' }}
        >
          <ConsultationReport consultation={consultation} />
        </div>
      </div>

      {/* ── Footer hint ── */}
      <div className="shrink-0 bg-gray-800 text-center py-2 text-xs text-gray-400">
        Cliquez sur{' '}
        <strong className="text-white">Imprimer / PDF</strong> pour ouvrir la boîte de dialogue
        d&apos;impression · Choisissez &laquo;&nbsp;Enregistrer en PDF&nbsp;&raquo; pour télécharger
      </div>
    </div>,
    document.body
  );
}
