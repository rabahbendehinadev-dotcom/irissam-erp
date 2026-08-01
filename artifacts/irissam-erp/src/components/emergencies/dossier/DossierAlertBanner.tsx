import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmergencyDossier } from '@/contexts/EmergencyDossierContext';

export function DossierAlertBanner() {
  const { dossier } = useEmergencyDossier();
  const [open, setOpen] = useState(true);

  const hasAlerts =
    dossier.allergies.length > 0 ||
    dossier.chronicDiseases.length > 0 ||
    dossier.bloodThinners ||
    dossier.pregnant ||
    dossier.infectiousDisease ||
    dossier.rareBloodType ||
    dossier.disability ||
    dossier.chronicTreatment;

  if (!hasAlerts) return null;

  const hasCritical = dossier.allergies.length > 0 || dossier.bloodThinners || dossier.infectiousDisease;

  return (
    <div className={cn(
      'border-b print:hidden',
      hasCritical ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50',
    )}>
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:opacity-80 transition-opacity"
      >
        <AlertTriangle size={13} className={cn('flex-shrink-0', hasCritical ? 'text-red-600' : 'text-amber-600')} />
        <span className={cn('text-[10px] font-black uppercase tracking-wide', hasCritical ? 'text-red-700' : 'text-amber-700')}>
          Alertes médicales
          {!open && (
            <span className="ml-2 font-normal normal-case">
              {[
                dossier.allergies.length > 0 && `${dossier.allergies.length} allergie(s)`,
                dossier.bloodThinners && 'Anticoagulant',
                dossier.pregnant && 'Grossesse',
                dossier.infectiousDisease && 'Risque infectieux',
              ].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
        <span className="ml-auto">{open ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}</span>
      </button>

      {/* Alert content */}
      {open && (
        <div className="px-4 pb-2.5 flex flex-wrap gap-x-5 gap-y-2">
          {dossier.allergies.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black text-red-700 uppercase">⚠ Allergies :</span>
              {dossier.allergies.map(a => (
                <span key={a} className="text-[10px] font-bold bg-red-200 text-red-800 border border-red-400 px-1.5 py-0.5 rounded-full">{a}</span>
              ))}
            </div>
          )}
          {dossier.chronicDiseases.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold text-orange-700 uppercase">Antécédents :</span>
              {dossier.chronicDiseases.map(d => (
                <span key={d} className="text-[10px] bg-orange-100 text-orange-800 border border-orange-300 px-1.5 py-0.5 rounded-full">{d}</span>
              ))}
            </div>
          )}
          {dossier.bloodThinners && (
            <span className="text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-400 px-1.5 py-0.5 rounded-full">
              💊 Anticoagulant / Antiplaquettaire
            </span>
          )}
          {dossier.pregnant && (
            <span className="text-[10px] font-bold bg-pink-100 text-pink-800 border border-pink-400 px-1.5 py-0.5 rounded-full">
              🤰 Grossesse en cours
            </span>
          )}
          {dossier.infectiousDisease && (
            <span className="text-[10px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-400 px-1.5 py-0.5 rounded-full">
              🦠 {dossier.infectiousDisease}
            </span>
          )}
          {dossier.rareBloodType && (
            <span className="text-[10px] font-bold bg-red-100 text-red-800 border border-red-300 px-1.5 py-0.5 rounded-full">
              🩸 Groupe sanguin rare — {dossier.bloodType}
            </span>
          )}
          {dossier.disability && (
            <span className="text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 px-1.5 py-0.5 rounded-full">
              ♿ {dossier.disability}
            </span>
          )}
          {dossier.chronicTreatment && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-gray-600 uppercase">Traitement chronique :</span>
              <span className="text-[10px] text-gray-700">{dossier.chronicTreatment}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
