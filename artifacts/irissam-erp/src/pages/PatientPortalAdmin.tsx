import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageWrapper } from '@/components/shared/PageWrapper';
import { apiClient } from '@/services/api/client';
import { toast } from 'sonner';
import { 
  Users, UserCheck, UserX, Clock, Search, Filter,
  MoreVertical, ShieldAlert, Key, Ban, Unlock, ShieldCheck, Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

// MOCK TYPES until API is ready
type AccountStatus = 'active' | 'pending_activation' | 'suspended' | 'locked';

interface PortalAccount {
  id: string;
  patientId: string;
  patientName: string;
  mrn: string;
  email: string;
  phone: string;
  status: AccountStatus;
  lastLoginAt: string | null;
  activeSessions: number;
  publishedResults: number;
  publishedDocuments: number;
}

interface PortalStats {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  locked: number;
  loggedInToday: number;
}

export default function PatientPortalAdmin() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts'>('dashboard');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modals state
  const [suspendId, setSuspendId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [otpData, setOtpData] = useState<{ otp: string, patientName: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPatientId, setCreatePatientId] = useState('');

  // Queries
  const { data: stats } = useQuery<PortalStats>({
    queryKey: ['portal-admin', 'stats'],
    queryFn: () => apiClient.get<PortalStats>('/patient-portal-admin/accounts/stats').catch(() => ({
      total: 1250, active: 850, pending: 300, suspended: 45, locked: 55, loggedInToday: 120
    })) // fallback mock
  });

  const { data: accounts, isLoading } = useQuery<PortalAccount[]>({
    queryKey: ['portal-admin', 'accounts', search, statusFilter],
    queryFn: () => apiClient.get<PortalAccount[]>(`/patient-portal-admin/accounts?search=${search}&status=${statusFilter}`).catch(() => [
      { id: 'acc-1', patientId: 'p-1', patientName: 'Dubois, Marie', mrn: 'MRN-2023-001', email: 'marie.dubois@email.com', phone: '+33 6 12 34 56 78', status: 'active', lastLoginAt: new Date().toISOString(), activeSessions: 1, publishedResults: 4, publishedDocuments: 2 },
      { id: 'acc-2', patientId: 'p-2', patientName: 'Martin, Paul', mrn: 'MRN-2023-002', email: 'paul.martin@email.com', phone: '+33 6 98 76 54 32', status: 'pending_activation', lastLoginAt: null, activeSessions: 0, publishedResults: 0, publishedDocuments: 0 },
      { id: 'acc-3', patientId: 'p-3', patientName: 'Bernard, Sophie', mrn: 'MRN-2023-003', email: 'sophie.b@email.com', phone: '+33 6 11 22 33 44', status: 'suspended', lastLoginAt: new Date(Date.now() - 86400000).toISOString(), activeSessions: 0, publishedResults: 12, publishedDocuments: 5 },
      { id: 'acc-4', patientId: 'p-4', patientName: 'Petit, Luc', mrn: 'MRN-2023-004', email: 'luc.petit@email.com', phone: '+33 6 55 44 33 22', status: 'locked', lastLoginAt: new Date(Date.now() - 86400000 * 5).toISOString(), activeSessions: 0, publishedResults: 1, publishedDocuments: 1 },
    ])
  });

  // Mutations
  const actionMutation = useMutation({
    mutationFn: async ({ id, action, data }: { id: string, action: string, data?: any }) => {
      return apiClient.post<any>(`/patient-portal-admin/accounts/${id}/${action}`, data || {});
    },
    onSuccess: (data, { action }) => {
      qc.invalidateQueries({ queryKey: ['portal-admin', 'accounts'] });
      qc.invalidateQueries({ queryKey: ['portal-admin', 'stats'] });
      if (action === 'generate-otp') {
        setOtpData({ otp: data.otp || '123456', patientName: 'Patient' }); // fallback mock
      } else {
        toast.success(`Action ${action} effectuée avec succès`);
      }
      setSuspendId(null);
      setSuspendReason('');
    },
    onError: (err: any) => toast.error(err.message || "Erreur lors de l'action")
  });

  const createAccountMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post<any>(`/patient-portal-admin/accounts`, { patientId: createPatientId, email: createEmail });
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['portal-admin'] });
      setCreateOpen(false);
      setOtpData({ otp: data.otp || '123456', patientName: 'Nouveau compte' });
      toast.success('Compte créé avec succès');
    },
    onError: (err: any) => toast.error(err.message || "Erreur création compte")
  });

  const handleAction = (id: string, action: string) => {
    if (action === 'suspend') {
      setSuspendId(id);
    } else {
      actionMutation.mutate({ id, action });
    }
  };

  const getStatusBadge = (status: AccountStatus) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Actif</Badge>;
      case 'pending_activation': return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">En attente</Badge>;
      case 'suspended': return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Suspendu</Badge>;
      case 'locked': return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Verrouillé</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <PageWrapper>
        <PageHeader 
          title="Administration Portail Patient" 
          subtitle="Gérez les accès et les comptes des patients au portail"
        />

        <div className="flex gap-4 border-b border-gray-200 mb-6">
          <button 
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'dashboard' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Tableau de bord
          </button>
          <button 
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'accounts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('accounts')}
          >
            Comptes portail
          </button>
        </div>

        {activeTab === 'dashboard' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                <Users className="w-6 h-6 text-blue-600 mb-2" />
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Comptes totaux</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                <UserCheck className="w-6 h-6 text-green-600 mb-2" />
                <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Actifs</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                <Clock className="w-6 h-6 text-yellow-600 mb-2" />
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide">En attente</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                <UserX className="w-6 h-6 text-red-600 mb-2" />
                <p className="text-2xl font-bold text-gray-900">{stats.suspended}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Suspendus</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                <ShieldAlert className="w-6 h-6 text-orange-600 mb-2" />
                <p className="text-2xl font-bold text-gray-900">{stats.locked}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Verrouillés</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                <ShieldCheck className="w-6 h-6 text-indigo-600 mb-2" />
                <p className="text-2xl font-bold text-gray-900">{stats.loggedInToday}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Connectés auj.</p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Informations</h3>
              <p className="text-sm text-gray-600">Le portail patient permet aux patients de consulter leurs résultats de laboratoire, leurs imageries, leurs ordonnances et leurs documents médicaux partagés par l'équipe soignante.</p>
            </div>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex flex-1 w-full gap-3 items-center">
                <div className="relative max-w-sm w-full flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input 
                    className="pl-9" 
                    placeholder="Chercher par nom, MRN, email..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select 
                    className="text-sm border-gray-200 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="active">Actifs</option>
                    <option value="pending_activation">En attente</option>
                    <option value="suspended">Suspendus</option>
                    <option value="locked">Verrouillés</option>
                  </select>
                </div>
              </div>
              <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto">
                <UserCheck className="w-4 h-4 mr-2" />
                Créer un compte
              </Button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 font-medium">
                    <tr>
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3">Dernière connexion</th>
                      <th className="px-4 py-3 text-center">Sessions</th>
                      <th className="px-4 py-3 text-center">Contenu publié</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoading ? (
                      <tr><td colSpan={7} className="p-8 text-center text-gray-400">Chargement...</td></tr>
                    ) : !accounts?.length ? (
                      <tr><td colSpan={7} className="p-8 text-center text-gray-400">Aucun compte trouvé</td></tr>
                    ) : accounts.map((acc: PortalAccount) => (
                      <tr key={acc.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900">{acc.patientName}</p>
                          <p className="text-xs text-gray-500 font-mono">{acc.mrn}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-800 flex items-center gap-1"><Mail className="w-3 h-3"/> {acc.email}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{acc.phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(acc.status)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {acc.lastLoginAt ? new Date(acc.lastLoginAt).toLocaleString('fr-FR') : 'Jamais'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {acc.activeSessions > 0 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{acc.activeSessions}</span>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-500">
                          {acc.publishedResults} rés., {acc.publishedDocuments} doc.
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <span className="sr-only">Menu actions</span>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel>Actions du compte</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleAction(acc.id, 'generate-otp')}>
                                <Key className="w-4 h-4 mr-2" /> Générer OTP
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction(acc.id, 'audit')}>
                                <Clock className="w-4 h-4 mr-2" /> Journal d'accès
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator />
                              
                              {acc.status === 'active' && (
                                <DropdownMenuItem className="text-orange-600" onClick={() => handleAction(acc.id, 'suspend')}>
                                  <Ban className="w-4 h-4 mr-2" /> Suspendre
                                </DropdownMenuItem>
                              )}
                              
                              {acc.status === 'suspended' && (
                                <DropdownMenuItem className="text-green-600" onClick={() => handleAction(acc.id, 'reactivate')}>
                                  <UserCheck className="w-4 h-4 mr-2" /> Réactiver
                                </DropdownMenuItem>
                              )}

                              {acc.status === 'locked' && (
                                <DropdownMenuItem className="text-green-600" onClick={() => handleAction(acc.id, 'unlock')}>
                                  <Unlock className="w-4 h-4 mr-2" /> Déverrouiller
                                </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuItem className="text-red-600" onClick={() => handleAction(acc.id, 'revoke-sessions')}>
                                <UserX className="w-4 h-4 mr-2" /> Révoquer sessions
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-orange-600" onClick={() => handleAction(acc.id, 'force-password-change')}>
                                <ShieldAlert className="w-4 h-4 mr-2" /> Forcer mdp.
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Suspend Modal */}
        <Dialog open={!!suspendId} onOpenChange={(o) => !o && setSuspendId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Suspendre le compte</DialogTitle>
              <DialogDescription>
                Le patient ne pourra plus se connecter au portail jusqu'à ce que son compte soit réactivé.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium mb-1 block">Raison de la suspension</label>
              <Input 
                value={suspendReason} 
                onChange={e => setSuspendReason(e.target.value)} 
                placeholder="Ex: Demande du patient, suspicion de piratage..." 
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuspendId(null)}>Annuler</Button>
              <Button 
                variant="destructive" 
                disabled={actionMutation.isPending}
                onClick={() => suspendId && actionMutation.mutate({ id: suspendId, action: 'suspend', data: { reason: suspendReason } })}
              >
                Confirmer la suspension
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* OTP Modal */}
        <Dialog open={!!otpData} onOpenChange={(o) => !o && setOtpData(null)}>
          <DialogContent className="sm:max-w-md text-center">
            <DialogHeader>
              <DialogTitle className="text-center">Code d'activation généré</DialogTitle>
              <DialogDescription className="text-center">
                Ce code est à usage unique. Communiquez-le au patient.
              </DialogDescription>
            </DialogHeader>
            <div className="py-8 bg-gray-50 rounded-xl my-4 border border-gray-200">
              <p className="text-4xl font-mono font-bold tracking-widest text-blue-600">{otpData?.otp}</p>
            </div>
            <DialogFooter className="sm:justify-center flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  navigator.clipboard.writeText(otpData?.otp || '');
                  toast.success('Code copié');
                }}
              >
                Copier
              </Button>
              <Button onClick={() => setOtpData(null)}>Terminer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Account Modal */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un compte portail</DialogTitle>
              <DialogDescription>
                Créez un accès au portail pour un patient existant.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">ID Patient (Mock pour l'instant)</label>
                <Input value={createPatientId} onChange={e => setCreatePatientId(e.target.value)} placeholder="p-1" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Adresse email</label>
                <Input type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} placeholder="patient@email.com" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
              <Button 
                disabled={!createEmail || !createPatientId || createAccountMutation.isPending}
                onClick={() => createAccountMutation.mutate()}
              >
                Créer le compte
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </PageWrapper>
    </DashboardLayout>
  );
}