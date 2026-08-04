import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageWrapper } from '@/components/shared/PageWrapper';
import { apiClient } from '@/services/api/client';
import { toast } from 'sonner';
import {
  Users, UserCheck, UserX, Clock, Search, Filter,
  MoreVertical, ShieldAlert, Key, Ban, Unlock, ShieldCheck, Mail, Eye,
  Copy, Printer, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { printOtpSlip } from '@/lib/otpPrintSlip';

type AccountStatus = 'active' | 'pending_activation' | 'suspended' | 'locked';

interface PortalAccount {
  id: string;
  patient_id?: string;
  patientId?: string;
  first_name?: string;
  last_name?: string;
  patientName?: string;
  mpi_id?: string;
  mrn?: string;
  email: string;
  phone: string;
  status: AccountStatus;
  last_login_at?: string | null;
  lastLoginAt?: string | null;
  active_sessions?: number;
  activeSessions?: number;
  published_results?: number;
  publishedResults?: number;
  published_documents?: number;
  publishedDocuments?: number;
  has_active_otp?: boolean;
  otp_expires_at?: string | null;
}

interface PortalStats {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  locked: number;
  logged_in_today?: number;
  loggedInToday?: number;
}

interface OtpData {
  otp: string;
  otpExpiresAt: string;
  patientName?: string;
  mrn?: string;
}

// Helpers to handle both snake_case (real API) and camelCase (mock) shapes
const accName = (a: PortalAccount) =>
  a.patientName ?? (a.first_name ? `${a.last_name}, ${a.first_name}` : '—');
const accMrn = (a: PortalAccount) => a.mrn ?? a.mpi_id ?? '—';
const accSessions = (a: PortalAccount) => a.active_sessions ?? a.activeSessions ?? 0;
const accResults = (a: PortalAccount) => a.published_results ?? a.publishedResults ?? 0;
const accDocs = (a: PortalAccount) => a.published_documents ?? a.publishedDocuments ?? 0;
const accLogin = (a: PortalAccount) => a.last_login_at ?? a.lastLoginAt ?? null;

export default function PatientPortalAdmin() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts'>('dashboard');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals state
  const [suspendId, setSuspendId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [otpData, setOtpData] = useState<OtpData | null>(null);
  const [confirmRegenId, setConfirmRegenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPatientId, setCreatePatientId] = useState('');
  const [previewAccountId, setPreviewAccountId] = useState<string | null>(null);

  // Queries
  const { data: stats } = useQuery<PortalStats>({
    queryKey: ['portal-admin', 'stats'],
    queryFn: () => apiClient.get<PortalStats>('/patient-portal-admin/accounts/stats').catch(() => ({
      total: 0, active: 0, pending: 0, suspended: 0, locked: 0, loggedInToday: 0,
    })),
  });

  const { data: accounts, isLoading } = useQuery<PortalAccount[]>({
    queryKey: ['portal-admin', 'accounts', search, statusFilter],
    queryFn: () =>
      apiClient.get<any>(`/patient-portal-admin/accounts?search=${search}&status=${statusFilter === 'all' ? '' : statusFilter}`)
        .then(r => Array.isArray(r) ? r : r.accounts ?? [])
        .catch(() => []),
  });

  // Mutations
  const actionMutation = useMutation({
    mutationFn: async ({ id, action, data }: { id: string; action: string; data?: any }) =>
      apiClient.post<any>(`/patient-portal-admin/accounts/${id}/${action}`, data ?? {}),
    onSuccess: (_data, { action }) => {
      qc.invalidateQueries({ queryKey: ['portal-admin'] });
      if (action !== 'generate-otp') toast.success('Action effectuée avec succès');
      setSuspendId(null);
      setSuspendReason('');
    },
    onError: (err: any) => toast.error(err.message || "Erreur lors de l'action"),
  });

  const generateOtpMutation = useMutation({
    mutationFn: async ({ id, acc }: { id: string; acc: PortalAccount }) =>
      apiClient.post<any>(`/patient-portal-admin/accounts/${id}/generate-otp`, {}),
    onSuccess: (data, { acc }) => {
      qc.invalidateQueries({ queryKey: ['portal-admin', 'accounts'] });
      setConfirmRegenId(null);
      setOtpData({
        otp: data.otp,
        otpExpiresAt: data.otpExpiresAt ?? new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        patientName: accName(acc),
        mrn: accMrn(acc),
      });
    },
    onError: (err: any) => toast.error(err.message || 'Erreur génération code'),
  });

  const createAccountMutation = useMutation({
    mutationFn: async () =>
      apiClient.post<any>('/patient-portal-admin/accounts', { patientId: createPatientId, email: createEmail }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['portal-admin'] });
      setCreateOpen(false);
      setOtpData({
        otp: data.otp,
        otpExpiresAt: data.otpExpiresAt ?? new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
      toast.success('Compte créé avec succès');
    },
    onError: (err: any) => toast.error(err.message || 'Erreur création compte'),
  });

  const previewMutation = useMutation({
    mutationFn: async (accountId: string) =>
      apiClient.post<{ token: string }>(`/patient-portal-admin/accounts/${accountId}/preview-token`, {}),
    onSuccess: (data, accountId) => {
      window.open('/patient-portal/preview?token=' + data.token + '&account_id=' + accountId, '_blank');
      toast.success('Aperçu ouvert');
      setPreviewAccountId(null);
    },
    onError: (err: any) => toast.error(err.message || "Erreur ouverture aperçu"),
  });

  // Generate OTP with confirmation when code is already active
  const handleGenerateOtp = (acc: PortalAccount) => {
    if (acc.has_active_otp) {
      setConfirmRegenId(acc.id);
    } else {
      generateOtpMutation.mutate({ id: acc.id, acc });
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

  const getOtpBadge = (acc: PortalAccount) => {
    if (acc.status === 'active' && !acc.has_active_otp) return null;
    if (acc.has_active_otp) return (
      <Badge className="bg-emerald-100 text-emerald-800 text-[10px] py-0">
        <Key className="w-2.5 h-2.5 mr-0.5" />Code actif
      </Badge>
    );
    return null;
  };

  const totalStat = stats?.total ?? 0;
  const activeStat = stats?.active ?? 0;
  const pendingStat = stats?.pending ?? 0;
  const suspendedStat = stats?.suspended ?? 0;
  const lockedStat = stats?.locked ?? 0;
  const todayStat = stats?.logged_in_today ?? stats?.loggedInToday ?? 0;

  // Find account by confirmRegenId for mutation
  const confirmAcc = accounts?.find(a => a.id === confirmRegenId);

  return (
    <DashboardLayout>
      <PageWrapper>
        <PageHeader
          title="Administration Portail Patient"
          subtitle="Gérez les accès et les comptes des patients au portail"
        />

        <div className="flex gap-4 border-b border-gray-200 mb-6">
          {(['dashboard', 'accounts'] as const).map(tab => (
            <button key={tab}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab(tab)}>
              {tab === 'dashboard' ? 'Tableau de bord' : 'Comptes portail'}
            </button>
          ))}
        </div>

        {/* Dashboard tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {[
                { icon: Users, color: 'blue', val: totalStat, label: 'Comptes totaux' },
                { icon: UserCheck, color: 'green', val: activeStat, label: 'Actifs' },
                { icon: Clock, color: 'yellow', val: pendingStat, label: 'En attente' },
                { icon: UserX, color: 'red', val: suspendedStat, label: 'Suspendus' },
                { icon: ShieldAlert, color: 'orange', val: lockedStat, label: 'Verrouillés' },
                { icon: ShieldCheck, color: 'indigo', val: todayStat, label: 'Connectés auj.' },
              ].map(({ icon: Icon, color, val, label }) => (
                <div key={label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                  <Icon className={`w-6 h-6 text-${color}-600 mb-2`} />
                  <p className="text-2xl font-bold text-gray-900">{val}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-3">Politique OTP — Manuel</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>• Les codes d'activation sont générés <strong>exclusivement par le personnel</strong> depuis ce panneau.</p>
                <p>• Chaque code est valable <strong>30 minutes</strong>, à usage unique, et stocké sous forme de hash HMAC-SHA256.</p>
                <p>• En cas de code oublié, le patient doit se présenter à l'accueil pour un nouveau code.</p>
                <p>• Aucun envoi automatique (SMS / Email) n'est configuré.</p>
              </div>
            </div>
          </div>
        )}

        {/* Accounts tab */}
        {activeTab === 'accounts' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex flex-1 w-full gap-3 items-center">
                <div className="relative max-w-sm w-full flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input className="pl-9" placeholder="Nom, MRN, email..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select className="text-sm border border-gray-200 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="all">Tous</option>
                    <option value="active">Actifs</option>
                    <option value="pending_activation">En attente</option>
                    <option value="suspended">Suspendus</option>
                    <option value="locked">Verrouillés</option>
                  </select>
                </div>
              </div>
              <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto">
                <UserCheck className="w-4 h-4 mr-2" />Créer un compte
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
                          <p className="font-semibold text-gray-900">{accName(acc)}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <p className="text-xs text-gray-500 font-mono">{accMrn(acc)}</p>
                            {getOtpBadge(acc)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-800 flex items-center gap-1"><Mail className="w-3 h-3" /> {acc.email}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{acc.phone}</p>
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(acc.status)}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {accLogin(acc) ? new Date(accLogin(acc)!).toLocaleString('fr-FR') : 'Jamais'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {accSessions(acc) > 0
                            ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{accSessions(acc)}</span>
                            : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-500">
                          {accResults(acc)} rés., {accDocs(acc)} doc.
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <span className="sr-only">Menu</span>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel>Actions du compte</DropdownMenuLabel>
                              <DropdownMenuSeparator />

                              {(acc.status === 'active' || acc.status === 'pending_activation') && (
                                <DropdownMenuItem onClick={() => { setPreviewAccountId(acc.id); previewMutation.mutate(acc.id); }}>
                                  <Eye className="w-4 h-4 mr-2" />Voir comme patient
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuItem onClick={() => handleGenerateOtp(acc)}>
                                <Key className="w-4 h-4 mr-2" />
                                {acc.has_active_otp ? 'Régénérer code' : 'Générer code activation'}
                              </DropdownMenuItem>

                              <DropdownMenuItem onClick={() => actionMutation.mutate({ id: acc.id, action: 'audit' })}>
                                <Clock className="w-4 h-4 mr-2" />Journal d'accès
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />

                              {acc.status === 'active' && (
                                <DropdownMenuItem className="text-orange-600" onClick={() => setSuspendId(acc.id)}>
                                  <Ban className="w-4 h-4 mr-2" />Suspendre
                                </DropdownMenuItem>
                              )}
                              {acc.status === 'suspended' && (
                                <DropdownMenuItem className="text-green-600" onClick={() => actionMutation.mutate({ id: acc.id, action: 'reactivate' })}>
                                  <UserCheck className="w-4 h-4 mr-2" />Réactiver
                                </DropdownMenuItem>
                              )}
                              {acc.status === 'locked' && (
                                <DropdownMenuItem className="text-green-600" onClick={() => actionMutation.mutate({ id: acc.id, action: 'unlock' })}>
                                  <Unlock className="w-4 h-4 mr-2" />Déverrouiller
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-red-600" onClick={() => actionMutation.mutate({ id: acc.id, action: 'revoke-sessions' })}>
                                <UserX className="w-4 h-4 mr-2" />Révoquer sessions
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-orange-600" onClick={() => actionMutation.mutate({ id: acc.id, action: 'force-password-change' })}>
                                <ShieldAlert className="w-4 h-4 mr-2" />Forcer mdp.
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

        {/* Suspend dialog */}
        <Dialog open={!!suspendId} onOpenChange={(o) => !o && setSuspendId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Suspendre le compte</DialogTitle>
              <DialogDescription>Le patient ne pourra plus se connecter jusqu'à réactivation.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium mb-1 block">Raison de la suspension</label>
              <Input value={suspendReason} onChange={e => setSuspendReason(e.target.value)} placeholder="Ex: Demande du patient..." />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuspendId(null)}>Annuler</Button>
              <Button variant="destructive" disabled={actionMutation.isPending}
                onClick={() => suspendId && actionMutation.mutate({ id: suspendId, action: 'suspend', data: { reason: suspendReason } })}>
                Confirmer la suspension
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm regen dialog */}
        <Dialog open={!!confirmRegenId} onOpenChange={(o) => !o && setConfirmRegenId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Régénérer le code d'activation ?
              </DialogTitle>
              <DialogDescription>
                Le code d'activation actuel sera <strong>immédiatement invalidé</strong>.
                Le patient devra utiliser le nouveau code pour activer son compte.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmRegenId(null)}>Annuler</Button>
              <Button
                disabled={generateOtpMutation.isPending}
                onClick={() => confirmAcc && generateOtpMutation.mutate({ id: confirmAcc.id, acc: confirmAcc })}>
                {generateOtpMutation.isPending ? 'Génération...' : 'Générer un nouveau code'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* OTP display dialog */}
        <OtpDialog otpData={otpData} onClose={() => setOtpData(null)} />

        {/* Create account dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un compte portail</DialogTitle>
              <DialogDescription>Un code d'activation sera généré automatiquement.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">ID Patient</label>
                <Input value={createPatientId} onChange={e => setCreatePatientId(e.target.value)} placeholder="UUID du patient" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Adresse email</label>
                <Input type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} placeholder="patient@email.com" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
              <Button disabled={!createEmail || !createPatientId || createAccountMutation.isPending}
                onClick={() => createAccountMutation.mutate()}>
                Créer le compte
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </PageWrapper>
    </DashboardLayout>
  );
}

/* ── Shared OTP display dialog ──────────────────────────────────────── */
function OtpDialog({ otpData, onClose }: { otpData: OtpData | null; onClose: () => void }) {
  if (!otpData) return null;
  const expiresStr = new Date(otpData.otpExpiresAt).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  return (
    <Dialog open={!!otpData} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Code d'activation généré</DialogTitle>
          <DialogDescription className="text-center">
            Ce code est à <strong>usage unique</strong> — il ne sera plus affiché après fermeture.
            Communiquez-le au patient ou imprimez le bon d'activation.
          </DialogDescription>
        </DialogHeader>
        <div className="py-6 bg-gray-50 rounded-xl border border-gray-200 text-center my-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Code d'activation</p>
          <p className="text-5xl font-mono font-bold tracking-[.3em] text-blue-600 select-all">{otpData.otp}</p>
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600 -mt-2 mb-2">
          <Clock className="w-4 h-4 text-amber-500" />
          <span>Expire le <strong>{expiresStr}</strong></span>
        </div>
        <DialogFooter className="sm:justify-center flex-wrap gap-2 mt-2">
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(otpData.otp); toast.success('Code copié'); }}>
            <Copy className="w-4 h-4 mr-2" />Copier
          </Button>
          <Button variant="outline" onClick={() => printOtpSlip(otpData)}>
            <Printer className="w-4 h-4 mr-2" />Imprimer
          </Button>
          <Button onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
