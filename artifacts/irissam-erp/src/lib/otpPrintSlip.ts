/**
 * Opens a browser print window with the OTP activation slip for IRISSAM Hospital.
 * The slip contains no medical data — only patient name, MRN, OTP, and instructions.
 */
export interface OtpPrintSlipData {
  otp: string;
  otpExpiresAt: string;
  patientName?: string;
  mrn?: string;
}

export function printOtpSlip({ otp, otpExpiresAt, patientName = '—', mrn = '—' }: OtpPrintSlipData): void {
  const expiresStr = new Date(otpExpiresAt).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Code d'activation — IRISSAM</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;padding:48px 40px;color:#111;background:#fff;max-width:480px}
    .header{text-align:center;margin-bottom:28px}
    .header h1{font-size:22px;font-weight:700;letter-spacing:1px}
    .header p{font-size:13px;color:#555;margin-top:4px}
    hr{border:none;border-top:2px solid #111;margin:18px 0}
    .field{margin-bottom:14px}
    .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#666;margin-bottom:2px}
    .val{font-size:15px;font-weight:600}
    .otp-box{background:#f4f4f4;border:2px solid #111;border-radius:8px;text-align:center;padding:18px 12px;margin:20px 0}
    .otp-lbl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#555;margin-bottom:8px}
    .otp-code{font-size:42px;font-family:'Courier New',monospace;font-weight:700;letter-spacing:10px;color:#0a3d62}
    .instr{margin-top:24px;border-top:1px solid #ccc;padding-top:18px}
    .instr h3{font-size:12px;text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px}
    .instr ol{padding-left:18px}
    .instr li{font-size:13px;margin-bottom:6px;line-height:1.5}
    .footer{margin-top:28px;border-top:1px solid #ccc;padding-top:12px;font-size:10px;color:#888;text-align:center;line-height:1.6}
    @media print{body{padding:20px}}
  </style>
</head>
<body>
  <div class="header">
    <h1>IRISSAM HOSPITAL</h1>
    <p>Activation Portail Patient</p>
  </div>
  <hr/>
  <div class="field"><div class="lbl">Nom patient</div><div class="val">${escHtml(patientName)}</div></div>
  <div class="field"><div class="lbl">N° de dossier (MRN)</div><div class="val">${escHtml(mrn)}</div></div>
  <div class="otp-box">
    <div class="otp-lbl">Code d'activation (usage unique)</div>
    <div class="otp-code">${escHtml(otp)}</div>
  </div>
  <div class="field"><div class="lbl">Valable jusqu'au</div><div class="val">${expiresStr}</div></div>
  <div class="field"><div class="lbl">Adresse du portail</div><div class="val">https://irissamhospital.com/patient-portal</div></div>
  <div class="instr">
    <h3>Instructions d'activation :</h3>
    <ol>
      <li>Ouvrir le portail : <strong>https://irissamhospital.com/patient-portal</strong></li>
      <li>Choisir <strong>Activer mon compte</strong></li>
      <li>Saisir votre N° de dossier, date de naissance, téléphone et code</li>
      <li>Créer votre mot de passe sécurisé</li>
    </ol>
  </div>
  <div class="footer">
    Document confidentiel — Usage unique — Ne pas reproduire<br/>
    Valable 30 minutes · Pour toute aide, contactez l'accueil IRISSAM Hospital
  </div>
  <script>window.onload=function(){window.print()};<\/script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=640,height=900,toolbar=no,menubar=no,scrollbars=yes');
  if (w) { w.document.write(html); w.document.close(); }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
