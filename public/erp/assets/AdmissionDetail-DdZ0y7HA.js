import{l as Z,u as z,h as U,A as G,a as Y,r as u,j as e,D as R,T as X,O as J,p as Q,d as q,S as W,B as ee}from"./index-C0424Csy.js";import{S as te}from"./ScrollableTabBar-UCr_Zz1f.js";import{P as se,a as N}from"./PatientAvatar-Ceha17Pk.js";import{a as ae,A as re,P as ie,c as ne,b as le}from"./AdmissionTimeline-CVUICmzh.js";import{u as oe}from"./usePermission-BEn_AtBZ.js";import{u as ce}from"./useAuditLog-Cc1avq8t.js";import{A as B}from"./arrow-left-BpKqSwb8.js";import{A as E}from"./activity-DcQH_3nn.js";import{S as de}from"./square-pen-BeGreHFG.js";import{A as me}from"./arrow-right-DRve8sKM.js";import{C as xe}from"./clock-wpGcc3pr.js";import{F}from"./file-text-xukBxWAK.js";import{C as ue}from"./circle-check-DpZKqgdL.js";import{M as pe}from"./map-pin-5-1IUXog.js";import{C as H}from"./circle-plus-C8KKsXz2.js";import{P as ge}from"./printer-CACAEso8.js";import"./chevron-right-BQVp1YsM.js";import"./PatientStatusBadge-ixYEUyUA.js";import"./phone-KKqjWpUr.js";import"./circle-alert-D-posUEn.js";import"./info-LiVh-Vyl.js";import"./loader-circle-CrsYRNgN.js";import"./check-B8fwUqyU.js";import"./message-square-CmQYl7w5.js";const he=[["path",{d:"M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z",key:"qazsjp"}],["path",{d:"M15 3v4a2 2 0 0 0 2 2h4",key:"40519r"}]],V=Z("sticky-note",he);function x(t){return t==null?"":String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}const be={domicile:"Retour à domicile",transfert_interne:"Transfert interne",transfert_externe:"Transfert externe",deces:"Décès",fugue:"Fugue",contre_avis:"Sortie contre avis médical"};function P(t){if(!t)return"—";try{return new Date(t).toLocaleDateString("fr-DZ",{day:"2-digit",month:"long",year:"numeric"})}catch{return t}}function h(t,s){return s?`
    <tr>
      <td class="label">${t}</td>
      <td class="value">${s}</td>
    </tr>`:""}function _(t,s){const i=s.trim();return i?`
    <div class="section">
      <div class="section-title">${t}</div>
      <table class="info-table"><tbody>${i}</tbody></table>
    </div>`:""}function fe(t){const s=x(t.admissionNumber),i=x(t.patientMpiId??"—"),r=x(t.patientName),f=x(t.serviceName??"—"),p=x(t.doctorName??"—"),o=x(t.motif??"—"),l=x(t.diagnosis??"—"),a=x(t.transferTo??""),d=x(t.dischargeNotes??t.notes??""),j=x(t.dischargeType?be[t.dischargeType]??t.dischargeType:"—"),w=x(`${P(t.admissionDate)}${t.admissionTime?` à ${t.admissionTime}`:""}`),g=x(t.actualDischargeDate?`${P(t.actualDischargeDate)}${t.actualDischargeTime?` à ${t.actualDischargeTime}`:""}`:"—"),D=x(P(t.transferDate)),y=(()=>{if(!t.actualDischargeDate||!t.admissionDate)return null;const I=new Date(t.actualDischargeDate).getTime()-new Date(t.admissionDate).getTime(),L=Math.round(I/864e5);return L>=0?L:null})(),m=y!==null?x(`${y} jour${y!==1?"s":""}`):"",S=x([t.bedNumber,t.roomNumber&&`Chambre ${t.roomNumber}`,t.floorLabel,t.buildingName].filter(Boolean).join(" — ")||""),A=x(new Date().toLocaleString("fr-DZ",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})),T=`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Compte rendu de sortie &mdash; ${s}</title>
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
      Imprimé le ${A}<br/>
      Document officiel &mdash; à conserver
    </div>
  </div>

  <div class="doc-title">Compte Rendu de Sortie Hospitalière</div>

  ${_("Informations administratives",`
    ${h("N° Admission",`<span class="mono">${s}</span>`)}
    ${h("N° MPI Patient",`<span class="mono">${i}</span>`)}
    ${h("Patient",r)}
    ${h("Service",f)}
    ${h("Médecin responsable",p)}
    ${S?h("Lit / Chambre",S):""}
  `)}

  ${_("Séjour hospitalier",`
    ${h("Date d'admission",w)}
    ${h("Date de sortie effective",g)}
    ${m?h("Durée de séjour",m):""}
    ${h("Type de sortie",j)}
    ${a?h("Établissement de transfert",a):""}
    ${D!=="—"&&a?h("Date de transfert",D):""}
  `)}

  ${_("Informations cliniques",`
    ${h("Motif d'admission",o)}
    ${h("Diagnostic retenu",l)}
  `)}

  <div class="section">
    <div class="section-title">Notes de sortie &amp; recommandations</div>
    <div class="notes-box">${d||"Aucune note de sortie renseignée."}</div>
  </div>

  <div class="sig-block">
    <div class="sig-col">
      Cachet et signature du médecin<br/>
      <strong>${p}</strong>
    </div>
    <div class="sig-col">
      Signature du patient / tuteur
    </div>
  </div>

  <div class="footer">
    ${s} &middot; IRISSAM &mdash; Document généré automatiquement, valeur officielle uniquement avec signature et cachet
  </div>

  <script>
    window.addEventListener('load', function() {
      window.print();
      window.addEventListener('afterprint', function() { window.close(); });
    });
  <\/script>
</body>
</html>`,k=window.open("","_blank","width=900,height=700");if(!k){alert("Veuillez autoriser les pop-ups pour imprimer le compte rendu.");return}k.document.write(T),k.document.close()}function n({label:t,value:s,mono:i}){return s?e.jsxs("div",{className:"flex flex-col gap-0.5",children:[e.jsx("span",{className:"text-xs text-gray-400 uppercase tracking-wide",children:t}),e.jsx("span",{className:`text-sm text-gray-800 font-medium ${i?"font-mono":""}`,children:s})]}):null}function $({title:t,icon:s,children:i}){return e.jsxs("div",{className:"bg-white border border-gray-200 rounded-xl p-5",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-4",children:[e.jsx("span",{className:"text-blue-600",children:s}),e.jsx("h3",{className:"font-semibold text-gray-800 text-sm",children:t})]}),e.jsx("div",{className:"space-y-3",children:i})]})}function je(t,s){switch(t){case"fc":return s<40||s>150?"critical":s<60||s>100?"warning":"normal";case"taSys":return s>180||s<80?"critical":s<90||s>140?"warning":"normal";case"taDia":return s<50||s>120?"critical":s<60||s>90?"warning":"normal";case"temp":return s<35||s>39?"critical":s<36||s>37.5?"warning":"normal";case"spo2":return s<90?"critical":s<95?"warning":"normal";case"glycemie":return s<.5||s>3?"critical":s<.7||s>1.8?"warning":"normal";default:return"normal"}}const ye={normal:"border-gray-200 focus:border-blue-400",warning:"border-amber-400 focus:border-amber-500 bg-amber-50",critical:"border-red-400 focus:border-red-500 bg-red-50"},ve=[{key:"fc",label:"Fréquence cardiaque",unit:"bpm",placeholder:"60–100",min:20,max:300},{key:"taSys",label:"TA systolique",unit:"mmHg",placeholder:"90–140",min:40,max:300},{key:"taDia",label:"TA diastolique",unit:"mmHg",placeholder:"60–90",min:20,max:200},{key:"temp",label:"Température",unit:"°C",placeholder:"36–37.5",min:30,max:45,step:"0.1"},{key:"spo2",label:"SpO₂",unit:"%",placeholder:"95–100",min:50,max:100},{key:"glycemie",label:"Glycémie",unit:"g/L",placeholder:"0.7–1.8",min:.1,max:10,step:"0.1"}];function Ne({onSave:t,onCancel:s}){const[i,r]=u.useState({}),f="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors",p=(l,a)=>r(d=>({...d,[l]:a})),o=Object.values(i).some(l=>l.trim()!=="");return e.jsxs("div",{className:"fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4",children:[e.jsx("div",{className:"absolute inset-0 bg-black/40 backdrop-blur-sm",onClick:s}),e.jsxs("div",{className:"relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg p-6 max-h-[95dvh] overflow-y-auto",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-5",children:[e.jsx("span",{className:"flex items-center justify-center w-8 h-8 rounded-full bg-rose-100 text-rose-600",children:e.jsx(E,{size:16})}),e.jsx("h3",{className:"font-bold text-gray-900 text-lg",children:"Saisie des signes vitaux"})]}),e.jsx("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3",children:ve.map(l=>{const a=i[l.key]?Number(i[l.key]):NaN,d=isNaN(a)?"normal":je(l.key,a);return e.jsxs("div",{children:[e.jsxs("label",{className:"block text-xs font-medium text-gray-600 mb-1",children:[l.label," ",e.jsxs("span",{className:"text-gray-400 font-normal",children:["(",l.unit,")"]}),d==="warning"&&e.jsx("span",{className:"ml-1 text-amber-600 font-semibold",children:"⚠ Anormal"}),d==="critical"&&e.jsx("span",{className:"ml-1 text-red-600 font-bold",children:"⚠ Critique"})]}),e.jsx("input",{type:"number",step:l.step??"1",min:l.min,max:l.max,value:i[l.key]??"",onChange:j=>p(l.key,j.target.value),placeholder:l.placeholder,className:`${f} ${ye[d]}`})]},l.key)})}),e.jsx("p",{className:"text-xs text-gray-400 mt-4",children:"Les champs non remplis seront ignorés. Les valeurs hors normes sont mises en évidence."}),e.jsxs("div",{className:"flex gap-3 mt-5",children:[e.jsx("button",{onClick:s,className:"flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50",children:"Annuler"}),e.jsxs("button",{onClick:()=>t(i),disabled:!o,className:"flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-medium disabled:opacity-40 transition-colors",children:[e.jsx(E,{size:14})," Enregistrer"]})]})]})]})}function we({admission:t,onConfirm:s,onCancel:i}){const{t:r}=z(),f=new Date().toISOString().slice(0,10),p=new Date().toTimeString().slice(0,5),[o,l]=u.useState("domicile"),[a,d]=u.useState(f),[j,w]=u.useState(p),[g,D]=u.useState(""),y="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400";return e.jsxs("div",{className:"fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4",children:[e.jsx("div",{className:"absolute inset-0 bg-black/40 backdrop-blur-sm",onClick:i}),e.jsxs("div",{className:"relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6 max-h-[95dvh] overflow-y-auto",children:[e.jsx("h3",{className:"font-bold text-gray-900 text-lg mb-4",children:r("adm.discharge.title")}),e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs font-medium text-gray-600 mb-1",children:r("adm.discharge.type")}),e.jsx("select",{value:o,onChange:m=>l(m.target.value),className:y,children:["domicile","transfert_interne","transfert_externe","deces","fugue","contre_avis"].map(m=>e.jsx("option",{value:m,children:r(`adm.discharge.type.${m}`)},m))})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs font-medium text-gray-600 mb-1",children:r("adm.discharge.date")}),e.jsx("input",{type:"date",value:a,onChange:m=>d(m.target.value),className:y})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs font-medium text-gray-600 mb-1",children:r("adm.discharge.time")}),e.jsx("input",{type:"time",value:j,onChange:m=>w(m.target.value),className:y})]})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs font-medium text-gray-600 mb-1",children:r("adm.discharge.notes")}),e.jsx("textarea",{value:g,onChange:m=>D(m.target.value),rows:3,className:`${y} resize-none`})]})]}),e.jsxs("div",{className:"flex gap-3 mt-5",children:[e.jsx("button",{onClick:i,className:"flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50",children:r("adm.form.cancel")}),e.jsx("button",{onClick:()=>s(o,a,j,g),className:"flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium",children:r("adm.discharge.confirm")})]})]})]})}function De({admission:t,onConfirm:s,onCancel:i}){const{t:r}=z(),f=new Date().toISOString().slice(0,10),[p,o]=u.useState(""),[l,a]=u.useState(f),[d,j]=u.useState(""),w="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400";return e.jsxs("div",{className:"fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4",children:[e.jsx("div",{className:"absolute inset-0 bg-black/40 backdrop-blur-sm",onClick:i}),e.jsxs("div",{className:"relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6 max-h-[95dvh] overflow-y-auto",children:[e.jsx("h3",{className:"font-bold text-gray-900 text-lg mb-4",children:r("adm.transfer.title")}),e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{children:[e.jsxs("label",{className:"block text-xs font-medium text-gray-600 mb-1",children:[r("adm.transfer.to")," *"]}),e.jsx("input",{value:p,onChange:g=>o(g.target.value),className:w,placeholder:"Ex: CHU Mustapha — Cardiologie"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs font-medium text-gray-600 mb-1",children:r("adm.transfer.date")}),e.jsx("input",{type:"date",value:l,onChange:g=>a(g.target.value),className:w})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs font-medium text-gray-600 mb-1",children:r("adm.transfer.notes")}),e.jsx("textarea",{value:d,onChange:g=>j(g.target.value),rows:2,className:`${w} resize-none`})]})]}),e.jsxs("div",{className:"flex gap-3 mt-5",children:[e.jsx("button",{onClick:i,className:"flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50",children:r("adm.form.cancel")}),e.jsx("button",{onClick:()=>s(p,l,d),disabled:!p.trim(),className:"flex-1 px-3 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium disabled:opacity-40",children:r("adm.transfer.confirm")})]})]})]})}function Se({admission:t}){const{t:s}=z();return e.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-2 gap-4",children:[e.jsxs($,{title:"Informations médicales",icon:e.jsx(W,{size:16}),children:[e.jsx(n,{label:"Service",value:t.serviceName}),e.jsx(n,{label:"Médecin responsable",value:t.doctorName}),e.jsx(n,{label:"Motif d'admission",value:t.motif}),t.diagnosis&&e.jsx(n,{label:"Diagnostic",value:t.diagnosis}),t.notes&&e.jsx(n,{label:"Notes cliniques",value:t.notes})]}),e.jsxs($,{title:"Séjour hospitalier",icon:e.jsx(ee,{size:16}),children:[e.jsx(n,{label:"Date d'admission",value:`${N(t.admissionDate)} à ${t.admissionTime}`}),t.expectedDischargeDate&&e.jsx(n,{label:"Sortie prévisionnelle",value:N(t.expectedDischargeDate)}),t.actualDischargeDate&&e.jsx(n,{label:"Date de sortie effective",value:`${N(t.actualDischargeDate)}${t.actualDischargeTime?` à ${t.actualDischargeTime}`:""}`}),t.dischargeType&&e.jsx(n,{label:"Type de sortie",value:s(`adm.discharge.type.${t.dischargeType}`)}),t.preadmissionDate&&e.jsx(n,{label:"Date d'admission prévue",value:N(t.preadmissionDate)}),t.transferTo&&e.jsx(n,{label:"Transféré vers",value:t.transferTo}),t.transferDate&&e.jsx(n,{label:"Date de transfert",value:N(t.transferDate)})]}),t.bedNumber&&e.jsxs($,{title:"Localisation",icon:e.jsx(pe,{size:16}),children:[e.jsx(n,{label:"Lit",value:t.bedNumber}),t.roomNumber&&e.jsx(n,{label:"Chambre",value:t.roomNumber}),t.floorLabel&&e.jsx(n,{label:"Étage",value:t.floorLabel}),t.buildingName&&e.jsx(n,{label:"Bâtiment",value:t.buildingName})]}),e.jsxs($,{title:"Informations administratives",icon:e.jsx(q,{size:16}),children:[e.jsx(n,{label:"N° Admission",value:t.admissionNumber,mono:!0}),e.jsx(n,{label:"N° MPI Patient",value:t.patientMpiId,mono:!0}),e.jsx(n,{label:"Type",value:s(`adm.type.${t.type}`)}),e.jsx(n,{label:"Priorité",value:s(`adm.priority.${t.priority}`)}),e.jsx(n,{label:"Statut",value:s(`adm.status.${t.status}`)}),e.jsx(n,{label:"Créé le",value:N(t.createdAt)}),t.updatedAt!==t.createdAt&&e.jsx(n,{label:"Mis à jour le",value:N(t.updatedAt)})]})]})}const Te=[{id:"n-1",text:"Patient stable, paramètres vitaux dans les normes. Surveillance rapprochée maintenue.",author:"Dr. Hamidou Karim",date:"2026-08-01T09:30:00Z"},{id:"n-2",text:"Famille informée du plan de soins. Consentement signé.",author:"Infirmière Réception",date:"2026-08-01T10:00:00Z"}];function ke({admission:t}){const[s,i]=u.useState(()=>t.id==="adm-1"?Te:[]),[r,f]=u.useState(""),p=()=>{r.trim()&&(i(o=>[...o,{id:`n-${Date.now()}`,text:r.trim(),author:"Utilisateur courant",date:new Date().toISOString()}]),f(""))};return e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"bg-white border border-gray-200 rounded-xl p-4",children:[e.jsx("p",{className:"text-xs font-medium text-gray-500 mb-2",children:"Nouvelle note clinique"}),e.jsx("textarea",{value:r,onChange:o=>f(o.target.value),rows:3,placeholder:"Saisissez une note…",className:"w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"}),e.jsx("div",{className:"flex justify-end mt-2",children:e.jsxs("button",{onClick:p,disabled:!r.trim(),className:"flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors",children:[e.jsx(H,{size:13})," Ajouter la note"]})})]}),s.length===0?e.jsxs("div",{className:"flex flex-col items-center justify-center py-12 text-gray-400",children:[e.jsx(V,{size:36,className:"opacity-30 mb-2"}),e.jsx("p",{className:"text-sm",children:"Aucune note pour cette admission"})]}):e.jsx("div",{className:"space-y-3",children:[...s].reverse().map(o=>e.jsxs("div",{className:"bg-white border border-gray-200 rounded-xl p-4",children:[e.jsx("p",{className:"text-sm text-gray-800 leading-relaxed",children:o.text}),e.jsxs("div",{className:"flex items-center justify-between mt-2 text-xs text-gray-400",children:[e.jsx("span",{className:"font-medium text-gray-600",children:o.author}),e.jsxs("span",{children:[N(o.date)," à ",new Date(o.date).toLocaleTimeString("fr-DZ",{hour:"2-digit",minute:"2-digit"})]})]})]},o.id))})]})}const Ce=[{id:"d-1",name:"Consentement signé",type:"PDF",date:"2026-08-01",size:"124 Ko"},{id:"d-2",name:"Résultats ECG",type:"PDF",date:"2026-08-01",size:"312 Ko"},{id:"d-3",name:"Compte rendu anesthésiste",type:"DOCX",date:"2026-08-01",size:"88 Ko"}];function $e({admission:t}){const i=t.id==="adm-1"?Ce:[];return e.jsxs("div",{className:"space-y-3",children:[e.jsx("div",{className:"flex justify-end",children:e.jsxs("button",{className:"flex items-center gap-1.5 px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors",children:[e.jsx(H,{size:14})," Ajouter un document"]})}),i.length===0?e.jsxs("div",{className:"flex flex-col items-center justify-center py-12 text-gray-400",children:[e.jsx(F,{size:36,className:"opacity-30 mb-2"}),e.jsx("p",{className:"text-sm",children:"Aucun document joint à cette admission"})]}):e.jsx("div",{className:"bg-white border border-gray-200 rounded-xl overflow-hidden",children:e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:"w-full text-sm",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"border-b border-gray-100 bg-gray-50",children:[e.jsx("th",{className:"text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap",children:"Nom du document"}),e.jsx("th",{className:"text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap",children:"Type"}),e.jsx("th",{className:"text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap",children:"Date"}),e.jsx("th",{className:"text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap",children:"Taille"}),e.jsx("th",{className:"px-4 py-2.5"})]})}),e.jsx("tbody",{className:"divide-y divide-gray-100",children:i.map(r=>e.jsxs("tr",{className:"hover:bg-gray-50 transition-colors",children:[e.jsxs("td",{className:"px-4 py-3 font-medium text-gray-800 flex items-center gap-2",children:[e.jsx(F,{size:14,className:"text-blue-500 flex-shrink-0"}),r.name]}),e.jsx("td",{className:"px-4 py-3 text-gray-500",children:r.type}),e.jsx("td",{className:"px-4 py-3 text-gray-500",children:N(r.date)}),e.jsx("td",{className:"px-4 py-3 text-gray-500",children:r.size}),e.jsx("td",{className:"px-4 py-3 text-right",children:e.jsx("button",{className:"text-xs text-blue-600 hover:underline",children:"Télécharger"})})]},r.id))})]})})})]})}function ze({admission:t}){return["discharged","transferred","cancelled"].includes(t.status)?e.jsx("div",{className:"space-y-4",children:e.jsxs("div",{className:"bg-white border border-gray-200 rounded-xl p-5 space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx("h3",{className:"font-semibold text-gray-800",children:"Compte rendu de sortie"}),e.jsxs("button",{onClick:()=>fe(t),className:"flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors",children:[e.jsx(ge,{size:14})," Imprimer"]})]}),e.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm",children:[e.jsx(n,{label:"Type de sortie",value:t.dischargeType?{domicile:"Retour à domicile",transfert_interne:"Transfert interne",transfert_externe:"Transfert externe",deces:"Décès",fugue:"Fugue",contre_avis:"Contre avis médical"}[t.dischargeType]:void 0}),t.actualDischargeDate&&e.jsx(n,{label:"Date de sortie",value:`${N(t.actualDischargeDate)}${t.actualDischargeTime?` à ${t.actualDischargeTime}`:""}`}),t.transferTo&&e.jsx(n,{label:"Établissement de transfert",value:t.transferTo})]}),t.dischargeNotes||t.notes?e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-gray-400 uppercase tracking-wide mb-1",children:"Notes de sortie"}),e.jsx("p",{className:"text-sm text-gray-700 bg-gray-50 rounded-lg p-3 leading-relaxed",children:t.dischargeNotes??t.notes})]}):e.jsx("p",{className:"text-sm text-gray-400 italic",children:"Aucune note de sortie renseignée."})]})}):e.jsxs("div",{className:"flex flex-col items-center justify-center py-12 text-gray-400 space-y-2",children:[e.jsx(q,{size:40,className:"opacity-30"}),e.jsx("p",{className:"font-semibold text-gray-500",children:"Compte rendu de sortie"}),e.jsx("p",{className:"text-sm text-center max-w-sm",children:"Le compte rendu de sortie sera disponible une fois le patient sorti ou transféré."})]})}const Ae=[{id:"overview",label:"Vue générale",icon:e.jsx(q,{size:14})},{id:"timeline",label:"Timeline",icon:e.jsx(xe,{size:14})},{id:"notes",label:"Notes",icon:e.jsx(V,{size:14})},{id:"documents",label:"Documents",icon:e.jsx(F,{size:14})},{id:"sortie",label:"Sortie",icon:e.jsx(ue,{size:14})}];function st(){const{t}=z(),{can:s}=oe(),{log:i}=ce(),[,r]=U(),[,f]=G("/admissions/:id"),{admissions:p,discharge:o,transfer:l}=Y(),a=p.find(b=>b.id===f?.id),[d,j]=u.useState("overview"),[w,g]=u.useState(!1),[D,y]=u.useState(!1),[m,S]=u.useState(!1),[A,T]=u.useState(!1),[k,I]=u.useState([]);if(!a)return e.jsx(R,{children:e.jsxs("div",{className:"flex flex-col items-center justify-center min-h-[60vh] gap-4",children:[e.jsx(X,{size:40,className:"text-amber-400 opacity-60"}),e.jsx("p",{className:"text-gray-500 font-medium",children:"Admission introuvable"}),e.jsxs("button",{onClick:()=>r("/admissions"),className:"flex items-center gap-2 text-sm text-blue-600 hover:underline",children:[e.jsx(B,{size:14})," Retour à la liste des admissions"]})]})});const K=[...J[a.id]??[],...k],C=["active","preadmission","ambulatoire"].includes(a.status);return e.jsxs(R,{children:[e.jsxs("div",{className:"p-6 space-y-5 max-w-6xl mx-auto",children:[e.jsxs("button",{onClick:()=>r("/admissions"),className:"flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors",children:[e.jsx(B,{size:14}),t("adm.back_to_list")]}),e.jsx("div",{className:"bg-white border border-gray-200 rounded-2xl p-5 shadow-sm",children:e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-start gap-4",children:[e.jsxs("button",{onClick:()=>r(`/patients/${a.patientId}`),className:"flex items-center gap-3 group min-w-0",title:"Voir le dossier patient",children:[e.jsx(se,{name:a.patientName,size:"lg"}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate",children:a.patientName}),e.jsx("p",{className:"text-xs font-mono text-gray-400",children:a.patientMpiId}),e.jsx("p",{className:"text-xs text-blue-500 group-hover:underline mt-0.5",children:"Voir le dossier patient →"})]})]}),e.jsxs("div",{className:"flex-1 min-w-0 sm:pl-2",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-1.5 mb-2",children:[e.jsx(ae,{status:a.status}),e.jsx(re,{type:a.type}),e.jsx(ie,{priority:a.priority})]}),e.jsxs("p",{className:"text-xs text-gray-400",children:[e.jsx("span",{className:"font-mono font-semibold text-gray-700",children:a.admissionNumber})," · ",a.serviceName," · ",a.doctorName]}),e.jsxs("p",{className:"text-xs text-gray-400 mt-0.5",children:["Admis le ",N(a.admissionDate)," à ",a.admissionTime,a.bedNumber&&e.jsxs(e.Fragment,{children:[" · Lit ",e.jsx("span",{className:"font-medium text-gray-600",children:a.bedNumber})]})]})]}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2 flex-shrink-0",children:[s("admissions.edit")&&C&&e.jsxs("button",{onClick:()=>T(!0),className:"flex items-center gap-1.5 px-3 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors",children:[e.jsx(E,{size:13})," Signes vitaux"]}),s("admissions.edit")&&C&&e.jsxs("button",{onClick:()=>{i("view","admission",a.id),g(!0)},className:"flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors",children:[e.jsx(de,{size:13})," Modifier"]}),s("admissions.transfer")&&C&&e.jsxs("button",{onClick:()=>S(!0),className:"flex items-center gap-1.5 px-3 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors",children:[e.jsx(me,{size:13})," Transfert"]}),s("admissions.discharge")&&C&&e.jsxs("button",{onClick:()=>y(!0),className:"flex items-center gap-1.5 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors",children:[e.jsx(Q,{size:13})," Sortie"]})]})]})}),e.jsxs("div",{className:"bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm",children:[e.jsx("div",{className:"border-b border-gray-200",children:e.jsx(te,{tabs:Ae.map(({id:b,label:c,icon:v})=>({id:b,label:c,icon:v})),activeTab:d,onTabChange:b=>j(b),iconSize:14,className:"px-2"})}),e.jsxs("div",{className:"p-5",children:[d==="overview"&&e.jsx(Se,{admission:a}),d==="timeline"&&e.jsx(ne,{events:K}),d==="notes"&&e.jsx(ke,{admission:a}),d==="documents"&&e.jsx($e,{admission:a}),d==="sortie"&&e.jsx(ze,{admission:a})]})]})]}),w&&e.jsx(le,{admission:a,onSave:()=>g(!1),onCancel:()=>g(!1)}),D&&e.jsx(we,{admission:a,onConfirm:(b,c,v,M)=>{o(a.id,b,c,v,M),i("archive","admission",a.id,`Sortie ${b}`),y(!1),j("sortie")},onCancel:()=>y(!1)}),m&&e.jsx(De,{admission:a,onConfirm:(b,c,v)=>{l(a.id,b,c,v),i("update","admission",a.id,`Transfert → ${b}`),S(!1)},onCancel:()=>S(!1)}),A&&e.jsx(Ne,{onSave:b=>{const c=Object.fromEntries(Object.entries(b).filter(([,O])=>O.trim()!==""));if(Object.keys(c).length===0){T(!1);return}const v=[];c.fc&&v.push(`FC: ${c.fc} bpm`),c.taSys&&c.taDia&&v.push(`TA: ${c.taSys}/${c.taDia} mmHg`),c.temp&&v.push(`T°: ${c.temp}°C`),c.spo2&&v.push(`SpO₂: ${c.spo2}%`),c.glycemie&&v.push(`Glyc: ${c.glycemie} g/L`);const M={id:`vitals-${Date.now()}`,admissionId:a.id,type:"vitals",description:"Signes vitaux enregistrés",date:new Date().toISOString(),userId:"current-user",userName:"Utilisateur courant",meta:c};I(O=>[...O,M]),i("create","admission",a.id,`Signes vitaux — ${v.join(", ")}`),T(!1),j("timeline")},onCancel:()=>T(!1)})]})}export{st as default};
