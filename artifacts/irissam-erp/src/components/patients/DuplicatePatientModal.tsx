import { useState } from 'react';
import { AlertTriangle, X, ExternalLink, UserPlus } from 'lucide-react';
import { useLanguage } from '@/i18n';
import type { Patient } from '@/types';
import { PatientAvatar } from '@/components/shared/PatientAvatar';
import { formatDate, calculateAge } from '@/utils/format';

export interface DuplicateCandidate {
  patient: Patient;
  similarity: number;
  matchOn: string[];
}

interface Props {
  open: boolean;
  candidates: DuplicateCandidate[];
  onContinue: (reason: string) => void;
  onOpenExisting: (patient: Patient) => void;
  onCancel: () => void;
}

export function DuplicatePatientModal({ open, candidates, onContinue, onOpenExisting, onCancel }: Props) {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');
  const [showReasonBox, setShowReasonBox] = useState(false);

  if (!open) return null;

  const handleContinue = () => {
    if (!showReasonBox) { setShowReasonBox(true); return; }
    if (!reason.trim()) return;
    onContinue(reason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 p-6 border-b border-gray-100">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-orange-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-gray-900 text-lg">{t('pat.dup.title')}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{t('pat.dup.desc')}</p>
          </div>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Candidates */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {candidates.map(({ patient, similarity, matchOn }) => {
            const fullName = `${patient.lastName} ${patient.firstName}`;
            const age = calculateAge(patient.dateOfBirth);
            return (
              <div key={patient.id} className="border border-orange-200 rounded-xl p-4 bg-orange-50/30">
                <div className="flex items-start gap-3">
                  <PatientAvatar name={fullName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{fullName}</p>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                        {similarity}% {t('pat.dup.similarity')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">{patient.mpiId} — {patient.fileNumber}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {patient.gender === 'M' ? t('pat.gender.m') : t('pat.gender.f')} · {age} {t('pat.age.years')} · {formatDate(patient.dateOfBirth)}
                    </p>
                    {patient.phone && <p className="text-xs text-gray-500">{patient.phone}</p>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-xs text-gray-400">{t('pat.dup.match_on')} :</span>
                      {matchOn.map(m => (
                        <span key={m} className="text-xs px-1.5 py-0.5 bg-white border border-orange-200 rounded text-orange-700">{m}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => onOpenExisting(patient)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                  >
                    <ExternalLink size={12} />
                    {t('pat.dup.open')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reason box */}
        {showReasonBox && (
          <div className="px-6 pb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('pat.dup.reason.label')} *</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={t('pat.dup.reason.hint')}
              rows={2}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 resize-none"
            />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-100 flex-shrink-0">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
            {t('pat.dup.cancel')}
          </button>
          <button
            onClick={handleContinue}
            disabled={showReasonBox && !reason.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <UserPlus size={14} />
            {showReasonBox ? t('pat.dup.confirm') : t('pat.dup.continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
