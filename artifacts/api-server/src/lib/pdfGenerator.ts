/**
 * PDF generation utilities for IRISSAM Hospital ERP.
 *
 * Uses pdfkit (no-screenshot approach).
 * Generates:
 *   • Invoice PDF  (generateInvoicePdf)
 *   • Receipt PDF  (generateReceiptPdf)
 *
 * Layout: A4, French header, bilingual FR/AR support via unicode fallback.
 */
import PDFDocument from "pdfkit";
import type { Writable } from "stream";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InvoiceItem {
  description: string;
  category:    string;
  quantity:    number;
  unitPrice:   number;
  discount:    number;
  tax:         number;
  totalPrice:  number;
}

export interface PaymentRow {
  paymentNumber: string;
  method:        string;
  amount:        number;
  paidAt:        string | Date;
}

export interface InvoiceData {
  invoiceNumber:           string;
  invoiceDate:             string | Date;
  dueDate?:                string | Date | null;
  status:                  string;
  patientName:             string;
  patientMrn?:             string;
  encounterNumber?:        string;
  insuranceType?:          string;
  insuranceCoveragePercent: number;
  subtotal:                number;
  discountAmount:          number;
  taxAmount:               number;
  totalAmount:             number;
  patientShare:            number;
  insurerShare:            number;
  paidAmount:              number;
  remainingAmount:         number;
  currency:                string;
  notes?:                  string;
  items:                   InvoiceItem[];
  payments:                PaymentRow[];
}

export interface ReceiptData {
  receiptNumber:  string;
  paymentNumber:  string;
  invoiceNumber:  string;
  patientName:    string;
  patientMrn?:    string;
  amount:         number;
  method:         string;
  reference?:     string;
  currency:       string;
  paidAt:         string | Date;
  collectorName?: string;
  notes?:         string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const HOSPITAL_NAME   = "IRISSAM HOSPITAL";
const HOSPITAL_SUB    = "Établissement Hospitalier Privé";
const HOSPITAL_ADDR   = "Alger, Algérie  •  irissam.dz";
const BRAND_COLOR     = "#1e40af"; // blue-800
const LINE_COLOR      = "#e2e8f0";

function fmt(n: number, currency = "DZD") {
  return n.toLocaleString("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + currency;
}

function fmtDate(d?: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function statusLabel(s: string): string {
  const m: Record<string, string> = {
    draft: "Brouillon", issued: "Émise", partially_paid: "Part. payée",
    paid: "Payée", overdue: "En retard", cancelled: "Annulée", refunded: "Remboursée",
  };
  return m[s] ?? s;
}

function paymentMethodLabel(m: string): string {
  const map: Record<string, string> = {
    cash: "Espèces", card: "Carte bancaire", virement: "Virement",
    cheque: "Chèque", mobile: "Mobile", tiers_payant: "Tiers payant",
    insurance: "Assurance", convention: "Convention",
  };
  return map[m] ?? m;
}

// ── Header shared by invoice & receipt ───────────────────────────────────────

function drawHeader(doc: PDFKit.PDFDocument, title: string, number: string) {
  // Background banner
  doc.rect(0, 0, doc.page.width, 90).fill(BRAND_COLOR);

  // Hospital name
  doc.fillColor("#ffffff").fontSize(18).font("Helvetica-Bold")
     .text(HOSPITAL_NAME, 40, 22);
  doc.fontSize(9).font("Helvetica")
     .text(HOSPITAL_SUB, 40, 44)
     .text(HOSPITAL_ADDR, 40, 56);

  // Document type + number (right side)
  doc.fontSize(16).font("Helvetica-Bold")
     .text(title, 0, 22, { align: "right", width: doc.page.width - 40 });
  doc.fontSize(10).font("Helvetica")
     .text(number, 0, 44, { align: "right", width: doc.page.width - 40 });

  doc.fillColor("#1a1a1a").moveDown(0);
  doc.y = 105;
}

function hLine(doc: PDFKit.PDFDocument, y?: number) {
  const yy = y ?? doc.y;
  doc.moveTo(40, yy).lineTo(doc.page.width - 40, yy)
     .strokeColor(LINE_COLOR).lineWidth(0.5).stroke();
}

// ── Invoice PDF ───────────────────────────────────────────────────────────────

export function generateInvoicePdf(data: InvoiceData, output: Writable): void {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  doc.pipe(output);

  drawHeader(doc, "FACTURE", data.invoiceNumber);

  // ── Patient + info block ──────────────────────────────────────────────────
  const col1 = 40, col2 = 320;

  doc.fontSize(9).font("Helvetica-Bold").fillColor(BRAND_COLOR).text("PATIENT", col1, doc.y);
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#1a1a1a")
     .text(data.patientName, col1, doc.y + 4);
  doc.fontSize(8).font("Helvetica").fillColor("#555")
     .text(`MRN: ${data.patientMrn ?? "—"}`, col1)
     .text(`Encounter: ${data.encounterNumber ?? "—"}`, col1);

  const infoTop = 110;
  doc.fontSize(8).font("Helvetica").fillColor("#555")
     .text(`Date: ${fmtDate(data.invoiceDate)}`,   col2, infoTop)
     .text(`Échéance: ${fmtDate(data.dueDate)}`,   col2)
     .text(`Statut: ${statusLabel(data.status)}`,  col2);
  if (data.insuranceType) {
    doc.text(`Couverture: ${data.insuranceType.toUpperCase()} (${data.insuranceCoveragePercent}%)`, col2);
  }

  doc.y = Math.max(doc.y, 175);
  hLine(doc);
  doc.moveDown(0.5);

  // ── Items table ───────────────────────────────────────────────────────────
  const tableTop = doc.y;
  const W  = doc.page.width - 80;
  const cW = [W * 0.45, W * 0.1, W * 0.15, W * 0.1, W * 0.2];
  const cX = [40, 40 + cW[0], 40 + cW[0] + cW[1], 40 + cW[0] + cW[1] + cW[2],
              40 + cW[0] + cW[1] + cW[2] + cW[3]];

  // Header row
  doc.rect(40, tableTop - 2, W, 16).fill("#f1f5f9");
  const headers = ["Description", "Qté", "P.U.", "Remise", "Total"];
  headers.forEach((h, i) => {
    doc.fillColor("#374151").fontSize(8).font("Helvetica-Bold")
       .text(h, cX[i], tableTop + 1, { width: cW[i], align: i > 0 ? "right" : "left" });
  });
  doc.y = tableTop + 18;

  data.items.forEach((it, idx) => {
    if (doc.y > doc.page.height - 120) { doc.addPage(); doc.y = 40; }
    const rowY = doc.y;
    if (idx % 2 === 0) doc.rect(40, rowY - 1, W, 14).fill("#f9fafb");

    doc.fillColor("#1a1a1a").fontSize(8).font("Helvetica")
       .text(it.description, cX[0], rowY, { width: cW[0] - 4 })
       .text(String(it.quantity),      cX[1], rowY, { width: cW[1], align: "right" })
       .text(fmt(it.unitPrice, ""),    cX[2], rowY, { width: cW[2], align: "right" })
       .text(it.discount > 0 ? fmt(it.discount, "") : "—", cX[3], rowY, { width: cW[3], align: "right" })
       .text(fmt(it.totalPrice, ""),   cX[4], rowY, { width: cW[4], align: "right" });
    doc.y = rowY + 14;
  });

  hLine(doc, doc.y + 4); doc.moveDown(0.8);

  // ── Totals block (right-aligned) ──────────────────────────────────────────
  const labelX = doc.page.width - 280, valX = doc.page.width - 100;
  function totLine(label: string, value: string, bold = false) {
    if (doc.y > doc.page.height - 60) { doc.addPage(); doc.y = 40; }
    doc.fontSize(9)
       .font(bold ? "Helvetica-Bold" : "Helvetica")
       .fillColor(bold ? BRAND_COLOR : "#374151")
       .text(label, labelX, doc.y, { width: 160 })
       .text(value, valX - 80, doc.y - 12, { width: 120, align: "right" });
    doc.moveDown(0.3);
  }

  totLine("Sous-total",           fmt(data.subtotal,       data.currency));
  if (data.discountAmount > 0)
    totLine("Remises",            "- " + fmt(data.discountAmount, data.currency));
  if (data.taxAmount > 0)
    totLine("TVA",                "+ " + fmt(data.taxAmount,      data.currency));
  totLine("TOTAL",                fmt(data.totalAmount, data.currency), true);
  if (data.insurerShare > 0) {
    totLine(`Part ${(data.insuranceType ?? "organisme").toUpperCase()}`,
            "- " + fmt(data.insurerShare, data.currency));
    totLine("Part patient",       fmt(data.patientShare, data.currency));
  }
  if (data.paidAmount > 0)
    totLine("Déjà payé",         "- " + fmt(data.paidAmount, data.currency));
  totLine("RESTE À PAYER",        fmt(data.remainingAmount, data.currency), true);

  // ── Payments received ─────────────────────────────────────────────────────
  if (data.payments.length > 0) {
    doc.moveDown(0.8);
    hLine(doc); doc.moveDown(0.5);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(BRAND_COLOR).text("Paiements reçus", 40);
    doc.moveDown(0.3);
    data.payments.forEach(p => {
      doc.fontSize(8).font("Helvetica").fillColor("#374151")
         .text(`${p.paymentNumber}  ${paymentMethodLabel(p.method)}  ${fmtDate(p.paidAt)}  →  ${fmt(p.amount, data.currency)}`, 40);
    });
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (data.notes) {
    doc.moveDown(0.8);
    doc.fontSize(8).font("Helvetica").fillColor("#6b7280").text(`Notes: ${data.notes}`, 40);
  }

  // ── Signature zone ────────────────────────────────────────────────────────
  const sigY = Math.max(doc.y + 30, doc.page.height - 100);
  doc.moveTo(40,    sigY).lineTo(180, sigY).strokeColor("#999").lineWidth(0.5).stroke();
  doc.moveTo(doc.page.width - 180, sigY).lineTo(doc.page.width - 40, sigY).stroke();
  doc.fontSize(8).font("Helvetica").fillColor("#999")
     .text("Cachet et signature du caissier", 40, sigY + 4)
     .text("Cachet et signature du patient",  doc.page.width - 180, sigY + 4);

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = doc.page.height - 28;
  doc.rect(0, footerY - 4, doc.page.width, 32).fill("#f8fafc");
  doc.fontSize(7).font("Helvetica").fillColor("#9ca3af")
     .text(`${HOSPITAL_NAME}  •  ${HOSPITAL_ADDR}  •  Facture ${data.invoiceNumber}  •  Imprimé le ${fmtDate(new Date())}`,
           40, footerY, { align: "center", width: doc.page.width - 80 });

  doc.end();
}

// ── Receipt PDF ───────────────────────────────────────────────────────────────

export function generateReceiptPdf(data: ReceiptData, output: Writable): void {
  const doc = new PDFDocument({ size: [300, 420], margin: 24 });
  doc.pipe(output);

  // Header
  doc.rect(0, 0, 300, 70).fill(BRAND_COLOR);
  doc.fillColor("#fff").fontSize(14).font("Helvetica-Bold").text(HOSPITAL_NAME, 16, 14);
  doc.fontSize(8).font("Helvetica").text(HOSPITAL_SUB, 16, 32).text(HOSPITAL_ADDR, 16, 44);

  doc.y = 82;
  doc.fillColor(BRAND_COLOR).fontSize(13).font("Helvetica-Bold")
     .text("REÇU DE PAIEMENT", { align: "center" });
  doc.fontSize(10).font("Helvetica").fillColor("#1a1a1a")
     .text(data.receiptNumber, { align: "center" });

  doc.moveDown(0.6);
  hLine(doc);
  doc.moveDown(0.4);

  const row = (label: string, value: string) => {
    doc.fontSize(8).font("Helvetica").fillColor("#555").text(label, 16, doc.y, { continued: false });
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#1a1a1a").text(value, 120, doc.y - 12, { width: 160, align: "right" });
    doc.moveDown(0.4);
  };

  row("Patient",        data.patientName);
  row("MRN",            data.patientMrn ?? "—");
  row("Facture N°",     data.invoiceNumber);
  row("Paiement N°",    data.paymentNumber);

  doc.moveDown(0.3); hLine(doc); doc.moveDown(0.3);

  row("Date",           fmtDate(data.paidAt));
  row("Mode",           paymentMethodLabel(data.method));
  if (data.reference)
    row("Référence",    data.reference);

  doc.moveDown(0.4); hLine(doc); doc.moveDown(0.4);

  // Amount — big box
  doc.rect(16, doc.y, 268, 38).fill("#f0fdf4");
  doc.fillColor("#15803d").fontSize(11).font("Helvetica-Bold")
     .text("MONTANT PAYÉ", 16, doc.y + 6, { width: 268, align: "center" });
  doc.fontSize(16).font("Helvetica-Bold")
     .text(fmt(data.amount, data.currency), 16, doc.y + 20, { width: 268, align: "center" });
  doc.y += 46;

  if (data.notes) {
    doc.moveDown(0.4);
    doc.fontSize(7).font("Helvetica").fillColor("#6b7280").text(`Notes: ${data.notes}`, 16);
  }

  // Signature
  const sigY = doc.y + 20;
  doc.moveTo(16, sigY).lineTo(120, sigY).strokeColor("#ccc").lineWidth(0.5).stroke();
  doc.fontSize(7).fillColor("#999").text("Caissier", 16, sigY + 3);
  if (data.collectorName)
    doc.fontSize(7).fillColor("#555").text(data.collectorName, 16, sigY + 12);

  // Footer
  doc.fontSize(6).fillColor("#aaa")
     .text(`Imprimé le ${fmtDate(new Date())}`, 16, doc.page.height - 24, { align: "center", width: 268 });

  doc.end();
}
