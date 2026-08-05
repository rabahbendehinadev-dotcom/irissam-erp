import { CheckCircle2, Clock, AlertCircle, Download, FilePen } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConsentStatus = 'signe' | 'en_attente' | 'refuse' | 'expire';

interface ConsentRecord {
  id: string;
  type: string;
  category: string;
  description: string;
  dateSigned?: string;
  signatoryPatient?: string;
  signatoryDoctor?: string;
  witnessByNurse?: string;
  witnessName?: string;
  hasPdf: boolean;
  status: ConsentStatus;
  expiresAt?: string;
  notes?: string;
}

const STATUS_CFG: Record<ConsentStatus, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  signe:      { label: 'Signé',      icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-200' },
  en_attente: { label: 'En attente', icon: Clock,        color: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-200' },
  refuse:     { label: 'Refusé',     icon: AlertCircle,  color: 'text-red-700',   bg: 'bg-red-50',    border: 'border-red-200' },
  expire:     { label: 'Expiré',     icon: AlertCircle,  color: 'text-gray-600',  bg: 'bg-gray-100',  border: 'border-gray-200' },
};

const MOCK_CONSENTS: ConsentRecord[] = [
  {
    id: 'c-1',
    type: 'Consentement opératoire',
    category: 'Chirurgie',
    description: 'Consentement éclairé pour intervention chirurgicale. Le patient a été informé des risques, bénéfices et alternatives.',
    dateSigned: '2026-01-20T14:30:00',
    signatoryPatient: 'Patient (signature manuscrite)',
    signatoryDoctor: 'Dr. Meziane Farid',
    witnessName: 'Inf. Saïdi Meriem',
    hasPdf: true,
    status: 'signe',
    expiresAt: '2026-07-20',
  },
  {
    id: 'c-2',
    type: 'Consentement anesthésie',
    category: 'Anesthésie',
    description: 'Consentement pour anesthésie générale / locorégionale. Risques anesthésiques expliqués par le médecin anesthésiste.',
    dateSigned: '2026-01-20T15:00:00',
    signatoryPatient: 'Patient (signature manuscrite)',
    signatoryDoctor: 'Dr. Benali Sofiane (Anesthésiste)',
    witnessName: 'Inf. Saïdi Meriem',
    hasPdf: true,
    status: 'signe',
    expiresAt: '2026-07-20',
  },
  {
    id: 'c-3',
    type: 'Consentement transfusion sanguine',
    category: 'Transfusion',
    description: 'Autorisation de transfusion de produits sanguins labiles (PSL). Risques infectieux et immunologiques expliqués.',
    dateSigned: undefined,
    signatoryPatient: undefined,
    signatoryDoctor: undefined,
    hasPdf: false,
    status: 'en_attente',
    notes: 'En attente de signature — prévu avant l\'intervention du 15/09/2026',
  },
  {
    id: 'c-4',
    type: 'Consentement RGPD / Protection des données',
    category: 'RGPD',
    description: 'Autorisation de traitement des données de santé à caractère personnel, conformément au RGPD et à la loi 18-07 algérienne.',
    dateSigned: '2024-01-10T08:45:00',
    signatoryPatient: 'Patient (signature électronique)',
    signatoryDoctor: undefined,
    witnessName: 'Réception Amira',
    hasPdf: true,
    status: 'signe',
    expiresAt: '2028-01-10',
  },
  {
    id: 'c-5',
    type: 'Consentement imagerie avec injection',
    category: 'Imagerie',
    description: 'Consentement pour injection de produit de contraste iodé lors du scanner / IRM. Risques allergiques expliqués.',
    dateSigned: '2026-07-10T09:15:00',
    signatoryPatient: 'Patient (signature manuscrite)',
    signatoryDoctor: 'Dr. Kadri Mouloud (Radiologue)',
    hasPdf: true,
    status: 'signe',
  },
  {
    id: 'c-6',
    type: 'Consentement participation étude clinique',
    category: 'Recherche',
    description: 'Participation à l\'étude CARDIO-DZ 2025. Données anonymisées — révocable à tout moment.',
    dateSigned: undefined,
    signatoryPatient: undefined,
    signatoryDoctor: undefined,
    hasPdf: false,
    status: 'refuse',
    notes: 'Patient a refusé le 12/06/2026 — décision documentée dans le dossier',
  },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Chirurgie:  { bg: 'bg-purple-50',  text: 'text-purple-700' },
  Anesthésie: { bg: 'bg-indigo-50',  text: 'text-indigo-700' },
  Transfusion:{ bg: 'bg-red-50',     text: 'text-red-700' },
  RGPD:       { bg: 'bg-blue-50',    text: 'text-blue-700' },
  Imagerie:   { bg: 'bg-cyan-50',    text: 'text-cyan-700' },
  Recherche:  { bg: 'bg-orange-50',  text: 'text-orange-700' },
};

function fmt(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtFull(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isExpired(d?: string) {
  if (!d) return false;
  return new Date(d) < new Date();
}

export function PatientConsentsTab() {
  const stats = {
    total:      MOCK_CONSENTS.length,
    signes:     MOCK_CONSENTS.filter(c => c.status === 'signe').length,
    en_attente: MOCK_CONSENTS.filter(c => c.status === 'en_attente').length,
    problemes:  MOCK_CONSENTS.filter(c => c.status === 'refuse' || c.status === 'expire').length,
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',       value: stats.total,      color: 'text-gray-800',  bg: 'bg-gray-50',   border: 'border-gray-200' },
          { label: 'Signés',      value: stats.signes,     color: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-200' },
          { label: 'En attente',  value: stats.en_attente, color: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-200' },
          { label: 'Refusés',     value: stats.problemes,  color: 'text-red-700',   bg: 'bg-red-50',    border: 'border-red-200' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border p-3 text-center', s.bg, s.border)}>
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {MOCK_CONSENTS.map(c => {
          const cfg = STATUS_CFG[c.status];
          const Icon = cfg.icon;
          const catColor = CATEGORY_COLORS[c.category] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
          const expired = isExpired(c.expiresAt);

          return (
            <div key={c.id} className={cn(
              'bg-white border rounded-xl p-4 transition-all',
              c.status === 'en_attente' ? 'border-amber-200' :
              c.status === 'refuse'     ? 'border-red-200' :
              expired                   ? 'border-orange-200' : 'border-gray-200'
            )}>
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', catColor.bg)}>
                  <FilePen size={16} className={catColor.text} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-gray-800 text-sm">{c.type}</h4>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', catColor.bg, catColor.text)}>
                          {c.category}
                        </span>
                        <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium', cfg.color, cfg.bg, cfg.border)}>
                          <Icon size={10} />
                          {cfg.label}
                        </span>
                        {expired && c.status === 'signe' && (
                          <span className="text-xs text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                            Expiré
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 max-w-2xl">{c.description}</p>
                    </div>

                    {/* PDF download */}
                    {c.hasPdf ? (
                      <span className="flex items-center gap-1.5 text-xs text-gray-400 border border-gray-200 px-2.5 py-1.5 rounded-lg flex-shrink-0 cursor-not-allowed">
                        <Download size={12} /> PDF
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 px-2 py-1.5">Pas de PDF</span>
                    )}
                  </div>

                  {/* Signature details */}
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1 text-xs">
                    <div>
                      <span className="text-gray-400 uppercase tracking-wide">Signé le</span>
                      <p className="text-gray-700 font-medium">{fmtFull(c.dateSigned)}</p>
                    </div>
                    <div>
                      <span className="text-gray-400 uppercase tracking-wide">Signataire (patient)</span>
                      <p className="text-gray-700 font-medium">{c.signatoryPatient ?? '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400 uppercase tracking-wide">Médecin validateur</span>
                      <p className="text-gray-700 font-medium">{c.signatoryDoctor ?? '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400 uppercase tracking-wide">Validité</span>
                      <p className={cn('font-medium', expired ? 'text-red-600' : 'text-gray-700')}>
                        {c.expiresAt ? `Jusqu'au ${fmt(c.expiresAt)}` : 'Indéfinie'}
                      </p>
                    </div>
                  </div>

                  {/* Witness & Notes */}
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                    {c.witnessName && (
                      <span className="text-gray-500">Témoin : <span className="text-gray-700">{c.witnessName}</span></span>
                    )}
                    {c.notes && (
                      <span className={cn('font-medium', c.status === 'refuse' ? 'text-red-600' : c.status === 'en_attente' ? 'text-amber-700' : 'text-gray-600')}>
                        ℹ {c.notes}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 text-center">Données mock — les consentements seront intégrés au GED une fois le backend connecté.</p>
    </div>
  );
}
