import { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, ClipboardList, Pill, FlaskConical, Scan, FileText, Calendar } from 'lucide-react';
import { ConsultationStatusBadge, ConsultationTypeBadge } from './ConsultationStatusBadge';
import type { Consultation } from '@/types/consultation';

interface CheckItem {
  icon: React.ElementType;
  label: string;
  ok: boolean;
  message: string;
  required: boolean;
}

interface Props {
  consultation: Consultation;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export function ConsultationSummaryModal({ consultation: c, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const dxOk     = (c.diagnoses?.filter(d => d.kind === 'principal' && d.label).length ?? 0) > 0;
  const rxCount  = c.prescriptions?.length ?? 0;
  const labCount = c.labOrders?.length ?? 0;
  const imgCount = c.imagingOrders?.length ?? 0;
  const docCount = c.documents?.length ?? 0;
  const followUp = !!(c.followUp?.controlDate || c.followUp?.newAppointment);

  const checks: CheckItem[] = [
    { icon: ClipboardList, label: 'Diagnostic principal', ok: dxOk,     required: true,  message: dxOk ? 'Diagnostic renseigné' : '⚠ Diagnostic principal manquant' },
    { icon: Pill,          label: 'Ordonnance',           ok: rxCount > 0, required: false, message: rxCount > 0 ? `${rxCount} médicament(s)` : 'Aucune prescription' },
    { icon: FlaskConical,  label: 'Analyses',             ok: labCount > 0, required: false, message: labCount > 0 ? `${labCount} demande(s)` : 'Aucune analyse demandée' },
    { icon: Scan,          label: 'Imagerie',             ok: imgCount > 0, required: false, message: imgCount > 0 ? `${imgCount} examen(s)` : 'Aucun examen d\'imagerie' },
    { icon: FileText,      label: 'Documents',            ok: docCount > 0, required: false, message: docCount > 0 ? `${docCount} document(s)` : 'Aucun document généré' },
    { icon: Calendar,      label: 'Suivi planifié',       ok: followUp,    required: false, message: followUp ? 'Suivi planifié' : 'Aucun suivi planifié' },
  ];

  const canComplete = dxOk && confirmed;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg overflow-hidden max-h-[95dvh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-teal-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 size={20} className="text-green-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">Terminer la consultation</h2>
              <p className="text-xs text-gray-500">{c.number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60 text-gray-500"><X size={18} /></button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Patient summary */}
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
            <div className="flex-1 space-y-1">
              <p className="font-semibold text-gray-900">{c.patientName}</p>
              <p className="text-xs text-gray-500 font-mono">{c.patientMpi}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <ConsultationTypeBadge type={c.type} />
                <ConsultationStatusBadge status="terminee" />
              </div>
            </div>
            <div className="text-right text-xs text-gray-500">
              <p>{c.doctorName}</p>
              <p className="mt-0.5">{c.specialty}</p>
              <p className="mt-0.5">{c.serviceName}</p>
            </div>
          </div>

          {/* Motif */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Motif</p>
            <p className="text-sm text-gray-800">{c.reason}</p>
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Récapitulatif</p>
            {checks.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.label} className={`flex items-center gap-3 p-2.5 rounded-lg ${
                  item.ok ? 'bg-green-50 text-green-700' :
                  item.required ? 'bg-red-50 text-red-600' :
                  'bg-gray-50 text-gray-500'
                }`}>
                  <Icon size={14} className="flex-shrink-0" />
                  <span className="text-xs font-medium flex-1">{item.label}</span>
                  <span className="text-xs">{item.message}</span>
                  {item.ok
                    ? <CheckCircle2 size={13} className="text-green-500" />
                    : item.required
                    ? <AlertTriangle size={13} className="text-red-500" />
                    : null}
                </div>
              );
            })}
          </div>

          {!dxOk && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
              <p>Un <strong>diagnostic principal confirmé</strong> est requis avant de pouvoir terminer la consultation.</p>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Commentaire de clôture (optionnel)
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="Notes de fin de consultation, informations complémentaires…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 resize-none"
            />
          </div>

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500 mt-0.5" />
            <span className="text-sm text-gray-700 group-hover:text-gray-900">
              Je confirme que la consultation est terminée. Le statut sera verrouillé en <strong>Terminée</strong> et toute modification ultérieure créera une nouvelle version.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-600">
            Annuler
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!canComplete}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <CheckCircle2 size={15} />
            Terminer la consultation
          </button>
        </div>
      </div>
    </div>
  );
}
