import { useState } from 'react';
import { Plus, Trash2, FileText, Printer, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MedicalDocument, DocumentType } from '@/types/consultation';

const DOC_TYPES: { value: DocumentType; label: string; icon: string }[] = [
  { value: 'certificat_medical',  label: 'Certificat médical',             icon: '📋' },
  { value: 'arret_travail',       label: "Arrêt de travail",               icon: '📅' },
  { value: 'lettre_orientation',  label: "Lettre d'orientation",           icon: '📨' },
  { value: 'lettre_reference',    label: 'Lettre de référence',            icon: '📩' },
  { value: 'compte_rendu',        label: 'Compte-rendu de consultation',   icon: '📝' },
  { value: 'certificat_aptitude', label: "Certificat d'aptitude",          icon: '✅' },
  { value: 'autre',               label: 'Autre document',                 icon: '📄' },
];

const TEMPLATES: Record<DocumentType, string> = {
  certificat_medical:  "Je soussigné(e), Docteur [NOM], certifie avoir examiné ce jour [PATIENT], qui présente [MOTIF]. Ce certificat est établi à la demande de l'intéressé(e) et lui est remis pour faire valoir ce que de droit.",
  arret_travail:       "Je soussigné(e), Docteur [NOM], prescris un arrêt de travail de [DURÉE] pour [PATIENT] à compter du [DATE], pour le motif suivant : [MOTIF].",
  lettre_orientation:  "Cher(e) Confrère/Consœur,\n\nJe vous adresse [PATIENT], [ÂGE] ans, pour [MOTIF]. Antécédents : [ATCD]. Traitement en cours : [TRAITEMENT]. Je vous remercie de bien vouloir le/la prendre en charge.\n\nCordialement,\nDr [NOM]",
  lettre_reference:    "À l'attention du Médecin spécialiste,\n\nJe vous adresse en référence [PATIENT] pour : [MOTIF]. Résultats des examens effectués : [RÉSULTATS].\n\nDr [NOM]",
  compte_rendu:        "COMPTE-RENDU DE CONSULTATION\n\nPatient : [PATIENT]\nDate : [DATE]\nMédecin : Dr [NOM]\n\nMotif : [MOTIF]\n\nConclusion : [CONCLUSION]\n\nTraitement prescrit : [TRAITEMENT]\n\nProchain RDV : [DATE_RDV]",
  certificat_aptitude: "Je soussigné(e), Docteur [NOM], certifie que [PATIENT] est apte à [ACTIVITÉ] à la date du [DATE]. Cette aptitude est valable pour une durée de [DURÉE].",
  autre:               "",
};

const SEL = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white';
const INP = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20';

interface DocRowProps {
  doc: MedicalDocument;
  readOnly: boolean;
  onChange: (d: MedicalDocument) => void;
  onRemove: () => void;
  doctorName: string;
}

function DocRow({ doc, readOnly, onChange, onRemove, doctorName }: DocRowProps) {
  const typeConfig = DOC_TYPES.find(t => t.value === doc.type);
  const [open, setOpen] = useState(true);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer" onClick={() => setOpen(v => !v)}>
        <span className="text-lg">{typeConfig?.icon ?? '📄'}</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800">{typeConfig?.label ?? 'Document'}</p>
          <p className="text-xs text-gray-500">{doc.date.substring(0, 10)} · Dr {doc.doctorName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); window.print(); }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50">
            <Printer size={13} /> Imprimer
          </button>
          {!readOnly && (
            <button onClick={e => { e.stopPropagation(); onRemove(); }}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">
              <Trash2 size={13} /> Supprimer
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Type de document</label>
              <select value={doc.type} onChange={e => {
                const t = e.target.value as DocumentType;
                onChange({ ...doc, type: t, content: doc.content || TEMPLATES[t] });
              }} disabled={readOnly} className={SEL}>
                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Date du document</label>
              <input type="date" value={doc.date.substring(0, 10)} onChange={e => onChange({ ...doc, date: e.target.value })} disabled={readOnly} className={INP} />
            </div>
          </div>

          {doc.type === 'arret_travail' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Durée de l'arrêt</label>
              <input type="text" value={doc.duration ?? ''} onChange={e => onChange({ ...doc, duration: e.target.value })} disabled={readOnly} placeholder="ex: 5 jours, 2 semaines…" className={INP} />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">Contenu du document</label>
              {!readOnly && !doc.content && (
                <button onClick={() => onChange({ ...doc, content: TEMPLATES[doc.type] })}
                  className="text-xs text-blue-600 hover:underline">Utiliser le modèle</button>
              )}
            </div>
            <textarea value={doc.content} onChange={e => onChange({ ...doc, content: e.target.value })}
              disabled={readOnly} rows={8}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y font-mono leading-relaxed" />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <CheckSquare size={14} className={doc.signaturePlaceholder ? 'text-green-500' : 'text-gray-300'} />
            <span className="text-gray-600">Emplacement signature médecin inclus</span>
          </label>
        </div>
      )}
    </div>
  );
}

interface Props {
  documents: MedicalDocument[];
  onChange: (d: MedicalDocument[]) => void;
  readOnly?: boolean;
  doctorName?: string;
}

export function MedicalDocumentBuilder({ documents, onChange, readOnly = false, doctorName = 'Inconnu' }: Props) {
  const [showTypeMenu, setShowTypeMenu] = useState(false);

  const add = (type: DocumentType) => {
    const now = new Date().toISOString();
    onChange([...documents, {
      id: `doc-new-${Date.now()}`,
      type,
      date: now,
      doctorName,
      content: TEMPLATES[type],
      signaturePlaceholder: true,
      duration: type === 'arret_travail' ? '' : undefined,
    }]);
    setShowTypeMenu(false);
  };

  const update = (i: number, d: MedicalDocument) => onChange(documents.map((x, j) => j === i ? d : x));
  const remove = (i: number) => onChange(documents.filter((_, j) => j !== i));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-violet-600" />
          <div>
            <h4 className="font-semibold text-gray-800 text-sm">Documents médicaux</h4>
            <p className="text-xs text-gray-500">{documents.length} document{documents.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {!readOnly && (
          <div className="relative">
            <button onClick={() => setShowTypeMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700">
              <Plus size={14} /> Ajouter un document
            </button>
            {showTypeMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowTypeMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-white border border-gray-200 rounded-xl shadow-xl py-1 overflow-hidden">
                  {DOC_TYPES.map(t => (
                    <button key={t.value} onClick={() => add(t.value)}
                      className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-violet-50 text-left">
                      <span>{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <FileText size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aucun document généré</p>
          {!readOnly && (
            <button onClick={() => setShowTypeMenu(true)} className="text-sm text-violet-600 hover:underline mt-1">
              + Créer un document médical
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc, i) => (
            <DocRow key={doc.id} doc={doc} readOnly={readOnly} doctorName={doctorName}
              onChange={d => update(i, d)} onRemove={() => remove(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
