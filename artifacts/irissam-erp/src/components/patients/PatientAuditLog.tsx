import { Shield, Eye, Pencil, Trash2, FilePlus, FileText, UserCheck, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { formatDate, formatTime } from '@/utils/format';

type AuditAction =
  | 'view' | 'create' | 'update' | 'delete'
  | 'add_document' | 'view_sensitive' | 'view_audit'
  | 'login' | 'logout' | 'archive' | 'add_consultation'
  | 'validate_analysis' | 'prescription';

interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: AuditAction;
  actionLabel: string;
  target: string;
  date: string;
  ip: string;
  device: string;
  department: string;
}

const ACTION_CONFIG: Record<AuditAction, { icon: React.ElementType; color: string; bg: string }> = {
  view:             { icon: Eye,         color: 'text-blue-600',   bg: 'bg-blue-50' },
  create:           { icon: FilePlus,    color: 'text-green-600',  bg: 'bg-green-50' },
  update:           { icon: Pencil,      color: 'text-yellow-600', bg: 'bg-yellow-50' },
  delete:           { icon: Trash2,      color: 'text-red-600',    bg: 'bg-red-50' },
  add_document:     { icon: FilePlus,    color: 'text-purple-600', bg: 'bg-purple-50' },
  view_sensitive:   { icon: Shield,      color: 'text-orange-600', bg: 'bg-orange-50' },
  view_audit:       { icon: FileText,    color: 'text-gray-600',   bg: 'bg-gray-100' },
  login:            { icon: LogIn,       color: 'text-green-600',  bg: 'bg-green-50' },
  logout:           { icon: LogOut,      color: 'text-gray-600',   bg: 'bg-gray-100' },
  archive:          { icon: Trash2,      color: 'text-red-600',    bg: 'bg-red-50' },
  add_consultation: { icon: UserCheck,   color: 'text-indigo-600', bg: 'bg-indigo-50' },
  validate_analysis:{ icon: RefreshCw,   color: 'text-teal-600',   bg: 'bg-teal-50' },
  prescription:     { icon: FileText,    color: 'text-blue-600',   bg: 'bg-blue-50' },
};

const MOCK_AUDIT: AuditEntry[] = [
  { id: 'a-1',  userId: 'u-1', userName: 'Dr Karim Benamara',  userRole: 'Médecin',          action: 'add_consultation', actionLabel: 'a ajouté une consultation',      target: 'Consultation du 01/08/2026', date: '2026-08-01T09:14:00', ip: '192.168.1.12', device: 'Chrome / Windows',   department: 'Médecine interne' },
  { id: 'a-2',  userId: 'u-3', userName: 'Admin Hachichi',      userRole: 'Administrateur',   action: 'update',           actionLabel: 'a modifié l\'adresse',           target: 'Champ adresse',             date: '2026-07-28T14:32:00', ip: '10.0.0.5',     device: 'Firefox / Ubuntu',   department: 'Administration' },
  { id: 'a-3',  userId: 'u-5', userName: 'Lab. Bensouna',       userRole: 'Laborantin',       action: 'validate_analysis',actionLabel: 'a validé une analyse',           target: 'NFS + CRP',                 date: '2026-07-25T11:08:00', ip: '192.168.1.30', device: 'Chrome / Windows',   department: 'Laboratoire' },
  { id: 'a-4',  userId: 'u-2', userName: 'Inf. Meriem Saïdi',   userRole: 'Infirmière',       action: 'add_document',     actionLabel: 'a ajouté un document',           target: 'Ordonnance PDF',            date: '2026-07-22T10:45:00', ip: '192.168.1.18', device: 'Safari / macOS',     department: 'Soins' },
  { id: 'a-5',  userId: 'u-4', userName: 'Réception Djamel',    userRole: 'Réceptionniste',   action: 'view',             actionLabel: 'a consulté le dossier',          target: 'Dossier complet',           date: '2026-07-20T08:30:00', ip: '192.168.1.8',  device: 'Edge / Windows',     department: 'Accueil' },
  { id: 'a-6',  userId: 'u-1', userName: 'Dr Karim Benamara',  userRole: 'Médecin',          action: 'prescription',     actionLabel: 'a créé une ordonnance',          target: 'Ordonnance #2026-0441',     date: '2026-07-15T16:20:00', ip: '192.168.1.12', device: 'Chrome / Windows',   department: 'Médecine interne' },
  { id: 'a-7',  userId: 'u-3', userName: 'Admin Hachichi',      userRole: 'Administrateur',   action: 'view_sensitive',   actionLabel: 'a consulté les données sensibles',target: 'N° CNI / Sécurité sociale', date: '2026-06-30T09:05:00', ip: '10.0.0.5',     device: 'Firefox / Ubuntu',   department: 'Administration' },
  { id: 'a-8',  userId: 'u-6', userName: 'Imagerie Kadri',      userRole: 'Radiologue',       action: 'add_document',     actionLabel: 'a ajouté un résultat imagerie',  target: 'Radio thorax PDF',          date: '2026-06-20T13:55:00', ip: '192.168.2.44', device: 'Chrome / Windows',   department: 'Imagerie médicale' },
  { id: 'a-9',  userId: 'u-1', userName: 'Dr Karim Benamara',  userRole: 'Médecin',          action: 'view',             actionLabel: 'a consulté le dossier',          target: 'Onglet Antécédents',        date: '2026-05-18T10:00:00', ip: '192.168.1.12', device: 'Chrome / Windows',   department: 'Médecine interne' },
  { id: 'a-10', userId: 'u-7', userName: 'Réception Amira',     userRole: 'Réceptionniste',   action: 'create',           actionLabel: 'a créé le dossier patient',      target: 'Dossier MPI',               date: '2024-01-10T08:30:00', ip: '192.168.1.9',  device: 'Chrome / Windows',   department: 'Accueil' },
];

export function PatientAuditLog() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">Journal des actions</h3>
          <p className="text-xs text-gray-500 mt-0.5">Toutes les opérations effectuées sur ce dossier</p>
        </div>
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{MOCK_AUDIT.length} entrées</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Utilisateur</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Rôle</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Opération</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Heure</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Adresse IP</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Appareil</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Service</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {MOCK_AUDIT.map(entry => {
                const cfg = ACTION_CONFIG[entry.action];
                const Icon = cfg.icon;
                return (
                  <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon size={13} className={cfg.color} />
                        </div>
                        <span className="font-medium text-gray-800 whitespace-nowrap">{entry.userName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">{entry.userRole}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-gray-700 whitespace-nowrap">{entry.actionLabel}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{entry.target}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">{formatDate(entry.date)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">{formatTime(entry.date)}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">{entry.ip}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{entry.device}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">{entry.department}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">Les entrées d'audit seront synchronisées depuis le backend une fois l'authentification connectée.</p>
    </div>
  );
}
