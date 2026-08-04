/**
 * Generates and prints a discharge summary (compte rendu de sortie) for an admission.
 * Opens a new browser window with an A4-formatted document and triggers print().
 *
 * Security: ALL dynamic values are passed through escapeHtml() before insertion
 * into the HTML document. The row/section helpers never accept raw HTML from
 * caller-supplied data — only pre-escaped plain-text strings.
 */
import type { Admission } from '@/types/admission';

// ─── Security: HTML escape ─────────────────────────────────────────────────────

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Discharge type map ────────────────────────────────────────────────────────

const DISCHARGE_TYPE_LABELS: Record<string, string> = {
  domicile:          'Retour à domicile',
  transfert_interne: 'Transfert interne',
  transfert_externe: 'Transfert externe',
  deces:             'Décès',
  fugue:             'Fugue',
  contre_avis:       'Sortie contre avis médical',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('fr-DZ', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Renders one table row. Both `label` and `value` are caller-controlled plain-text
 * strings; value must already be escaped before calling this helper.
 * The label is a static string from this module (safe by construction).
 */
function row(label: string, escapedValue: string): string {
  if (!escapedValue) return '';
  return `
    <tr>
      <td class="label">${label}</td>
      <td class="value">${escapedValue}</td>
    </tr>`;
}

function section(title: string, rows: string): string {
  const content = rows.trim();
  if (!content) return '';
  return `
    <div class="section">
      <div class="section-title">${title}</div>
      <table class="info-table"><tbody>${content}</tbody></table>
    </div>`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function printDischargeSummary(admission: Admission): void {
  // ── Escape all admission-derived values up front ──────────────────────────
  const admissionNumber   = escapeHtml(admission.admissionNumber);
  const patientMpiId      = escapeHtml(admission.patientMpiId ?? '—');
  const patientName       = escapeHtml(admission.patientName);
  const serviceName       = escapeHtml(admission.serviceName ?? '—');
  const doctorName        = escapeHtml(admission.doctorName ?? '—');
  const motif             = escapeHtml(admission.motif ?? '—');
  const diagnosis         = escapeHtml(admission.diagnosis ?? '—');
  const transferTo        = escapeHtml(admission.transferTo ?? '');
  const notes             = escapeHtml(admission.dischargeNotes ?? admission.notes ?? '');

  const dischargeLabel = escapeHtml(
    admission.dischargeType
      ? (DISCHARGE_TYPE_LABELS[admission.dischargeType] ?? admission.dischargeType)
      : '—',
  );

  const admissionDateTime = escapeHtml(
    `${fmt(admission.admissionDate)}${admission.admissionTime ? ` à ${admission.admissionTime}` : ''}`,
  );

  const dischargeDateTime = escapeHtml(
    admission.actualDischargeDate
      ? `${fmt(admission.actualDischargeDate)}${admission.actualDischargeTime ? ` à ${admission.actualDischargeTime}` : ''}`
      : '—',
  );

  const transferDate = escapeHtml(fmt(admission.transferDate));

  const durationDays = (() => {
    if (!admission.actualDischargeDate || !admission.admissionDate) return null;
    const ms = new Date(admission.actualDischargeDate).getTime() -
               new Date(admission.admissionDate).getTime();
    const d = Math.round(ms / 86_400_000);
    return d >= 0 ? d : null;
  })();
  const durationLabel = durationDays !== null
    ? escapeHtml(`${durationDays} jour${durationDays !== 1 ? 's' : ''}`)
    : '';

  const bedInfo = escapeHtml(
    [
      admission.bedNumber,
      admission.roomNumber && `Chambre ${admission.roomNumber}`,
      admission.floorLabel,
      admission.buildingName,
    ].filter(Boolean).join(' — ') || '',
  );

  const printedAt = escapeHtml(
    new Date().toLocaleString('fr-DZ', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }),
  );

  // ── Build HTML (only static strings + pre-escaped values enter the template) ─
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Compte rendu de sortie &mdash; ${admissionNumber}</title>
  <style>
    @page { size: A4; margin: 20mm 18mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      color: #1a1a2e;
      background: #fff;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 2.5px solid #1d4ed8;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .hospital-name {
      font-size: 18pt;
      font-weight: 800;
      color: #1d4ed8;
      letter-spacing: -0.5px;
      line-height: 1.1;
    }
    .hospital-sub {
      font-size: 8pt;
      color: #64748b;
      margin-top: 3px;
      letter-spacing: 0.3px;
    }
    .doc-meta {
      text-align: right;
      font-size: 8pt;
      color: #64748b;
      line-height: 1.6;
    }
    .doc-title {
      font-size: 14pt;
      font-weight: 700;
      color: #1e293b;
      text-align: center;
      margin: 18px 0 22px;
      letter-spacing: 0.3px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 10px;
    }

    /* ── Sections ── */
    .section { margin-bottom: 16px; }
    .section-title {
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #1d4ed8;
      background: #eff6ff;
      border-left: 3px solid #1d4ed8;
      padding: 5px 10px;
      margin-bottom: 8px;
    }
    .info-table { width: 100%; border-collapse: collapse; }
    .info-table td {
      padding: 5px 8px;
      vertical-align: top;
      border-bottom: 1px solid #f1f5f9;
      font-size: 10.5pt;
    }
    .info-table td.label {
      width: 38%;
      color: #64748b;
      font-weight: 600;
      font-size: 9.5pt;
      white-space: nowrap;
    }
    .info-table td.value { color: #1e293b; font-weight: 500; }
    .mono { font-family: 'Courier New', monospace; font-size: 10pt; }

    /* ── Notes box ── */
    .notes-box {
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 10px 12px;
      background: #f8fafc;
      font-size: 10.5pt;
      line-height: 1.6;
      color: #334155;
      min-height: 48px;
      white-space: pre-wrap;
    }

    /* ── Signature block ── */
    .sig-block {
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
    }
    .sig-col {
      width: 44%;
      border-top: 1px solid #94a3b8;
      padding-top: 6px;
      font-size: 9pt;
      color: #475569;
      text-align: center;
    }

    /* ── Footer ── */
    .footer {
      margin-top: 30px;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      font-size: 7.5pt;
      color: #94a3b8;
      text-align: center;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <div class="hospital-name">IRISSAM</div>
      <div class="hospital-sub">Établissement de Santé Privé &mdash; Algérie</div>
    </div>
    <div class="doc-meta">
      Imprimé le ${printedAt}<br/>
      Document officiel &mdash; à conserver
    </div>
  </div>

  <div class="doc-title">Compte Rendu de Sortie Hospitalière</div>

  ${section('Informations administratives', `
    ${row("N° Admission",        `<span class="mono">${admissionNumber}</span>`)}
    ${row("N° MPI Patient",      `<span class="mono">${patientMpiId}</span>`)}
    ${row("Patient",             patientName)}
    ${row("Service",             serviceName)}
    ${row("Médecin responsable", doctorName)}
    ${bedInfo ? row("Lit / Chambre", bedInfo) : ''}
  `)}

  ${section('Séjour hospitalier', `
    ${row("Date d'admission",         admissionDateTime)}
    ${row("Date de sortie effective",  dischargeDateTime)}
    ${durationLabel ? row("Durée de séjour", durationLabel) : ''}
    ${row("Type de sortie",            dischargeLabel)}
    ${transferTo ? row("Établissement de transfert", transferTo) : ''}
    ${transferDate !== '—' && transferTo ? row("Date de transfert", transferDate) : ''}
  `)}

  ${section('Informations cliniques', `
    ${row("Motif d'admission", motif)}
    ${row("Diagnostic retenu", diagnosis)}
  `)}

  <div class="section">
    <div class="section-title">Notes de sortie &amp; recommandations</div>
    <div class="notes-box">${notes || 'Aucune note de sortie renseignée.'}</div>
  </div>

  <div class="sig-block">
    <div class="sig-col">
      Cachet et signature du médecin<br/>
      <strong>${doctorName}</strong>
    </div>
    <div class="sig-col">
      Signature du patient / tuteur
    </div>
  </div>

  <div class="footer">
    ${admissionNumber} &middot; IRISSAM &mdash; Document généré automatiquement, valeur officielle uniquement avec signature et cachet
  </div>

  <script>
    window.addEventListener('load', function() {
      window.print();
      window.addEventListener('afterprint', function() { window.close(); });
    });
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('Veuillez autoriser les pop-ups pour imprimer le compte rendu.');
    return;
  }
  win.document.write(html);
  win.document.close();
}
