import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Globe, UserCheck, ShieldAlert, Key, Ban, UserX,
  Clock, Unlock, Mail, Eye, Copy, Printer, AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { printOtpSlip } from '@/lib/otpPrintSlip';

interface OtpData {
  otp: string;
  otpExpiresAt: string;
  patientName?: string;
  mrn?: string;
}

export function PatientPortalTab({ patientId, patientEmail }: { patientId: string; patientEmail?: string }) {
  const qc = useQueryClient();
  const [createEmail, setCreateEmail] = useState(patientEmail || '');
  const [createOpen, setCreateOpen] = useState(false);
  const [otpData, setOtpData] = useState<OtpData | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmRegenOpen, setConfirmRegenOpen] = useState(false);

  const { data: account, isLoading } = useQuery({
    queryKey: ['portal-admin', 'by-patient', patientId],
    queryFn: () =>
      apiClient.get<any>(`/patient-portal-admin/by-patient/${patientId}`).then(r => r.account).catch((err) => {
        if (err.status === 404) return null;
        throw err;
      }),
    retry: false,
  });

  const generateOtpMutation = useMutation({
    mutationFn: () => apiClient.post<any>(`/patient-portal-admin/accounts/${account?.id}/generate-otp`, {}),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['portal-admin', 'by-patient', patientId] });
      setConfirmRegenOpen(false);
      setOtpData({
        otp: data.otp,
        otpExpiresAt: data.otpExpiresAt ?? new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
    },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la génération du code'),
  });

  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      if (!account?.id) throw new Error('Pas de compte');
      return apiClient.post<any>(`/patient-portal-admin/accounts/${account.id}/${action}`, {});
    },
    onSuccess: (_data, action) => {
      qc.invalidateQueries({ queryKey: ['portal-admin', 'by-patient', patientId] });
      toast.success('Action effectuée avec succès');
      if (action === 'revoke-sessions') toast.success('Sessions révoquées');
    },
    onError: (err: any) => toast.error(err.message || "Erreur lors de l'action"),
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!account?.id) throw new Error('Pas de compte');
      return apiClient.post<{ token: string }>(`/patient-portal-admin/accounts/${account.id}/preview-token`, {});
    },
    onSuccess: (data) => {
      window.open('/patient-portal/preview?token=' + data.token + '&account_id=' + account.id, '_blank');
      toast.success('Aperçu ouvert dans un nouvel onglet');
      setPreviewOpen(false);
    },
    onError: () => toast.error("Erreur lors de l'ouverture de l'aperçu"),
  });

  const createAccountMutation = useMutation({
    mutationFn: async () =>
      apiClient.post<any>(`/patient-portal-admin/accounts`, { patientId, email: createEmail }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['portal-admin', 'by-patient', patientId] });
      setCreateOpen(false);
      setOtpData({
        otp: data.otp,
        otpExpiresAt: data.otpExpiresAt ?? new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
      toast.success('Compte créé avec succès');
    },
    onError: (err: any) => toast.error(err.message || 'Erreur création compte'),
  });

  /* ── helpers ── */
  const handleGenerateOtp = () => {
    if (account?.has_active_otp) {
      setConfirmRegenOpen(true);
    } else {
      generateOtpMutation.mutate();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-800">Actif</Badge>;
      case 'pending_activation': return <Badge className="bg-yellow-100 text-yellow-800">En attente d'activation</Badge>;
      case 'suspended': return <Badge className="bg-red-100 text-red-800">Suspendu</Badge>;
      case 'locked': return <Badge className="bg-orange-100 text-orange-800">Verrouillé</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getOtpStatusBadge = () => {
    if (!account) return null;
    if (account.status === 'active') {
      return <Badge className="bg-blue-100 text-blue-800"><UserCheck className="w-3 h-3 mr-1" />Compte activé</Badge>;
    }
    if (account.has_active_otp) {
      const exp = account.otp_expires_at ? new Date(account.otp_expires_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
      return (
        <Badge className="bg-emerald-100 text-emerald-800">
          <Key className="w-3 h-3 mr-1" />Code actif{exp ? ` · exp. ${exp}` : ''}
        </Badge>
      );
    }
    if (account.status === 'pending_activation') {
      return <Badge className="bg-gray-100 text-gray-600"><Key className="w-3 h-3 mr-1" />Aucun code actif</Badge>;
    }
    return null;
  };

  if (isLoading) return (
    <div className="p-8 text-center text-gray-500">Chargement des informations du portail...</div>
  );

  /* ── No account yet ── */
  if (!account) return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl border border-gray-200">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Globe className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun compte portail</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-md">
        Ce patient ne possède pas encore de compte pour accéder au Portail Patient.
      </p>
      <Button onClick={() => setCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
        <UserCheck className="w-4 h-4 mr-2" />Créer le compte
      </Button>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un compte portail</DialogTitle>
            <DialogDescription>
              Un code d'activation à 6 chiffres sera généré. Communiquez-le au patient.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-1 block">Adresse email</label>
            <Input type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} placeholder="patient@email.com" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button disabled={!createEmail || createAccountMutation.isPending} onClick={() => createAccountMutation.mutate()}>
              Créer le compte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OTP dialog also needed here for post-create */}
      <OtpDialog otpData={otpData} onClose={() => setOtpData(null)} />
    </div>
  );

  /* ── Account exists ── */
  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-gray-200">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-gray-900">Accès Portail Patient</h3>
            {getStatusBadge(account.status)}
            {getOtpStatusBadge()}
          </div>
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <Mail className="w-4 h-4" /> {account.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(account.status === 'pending_activation' || account.status === 'active') && (
            <Button
              variant="outline"
              onClick={handleGenerateOtp}
              disabled={generateOtpMutation.isPending}
            >
              <Key className="w-4 h-4 mr-2" />
              {account.has_active_otp ? 'Régénérer code' : 'Générer code activation'}
            </Button>
          )}

          {account.status === 'active' && (
            <Button variant="outline" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200"
              onClick={() => actionMutation.mutate('suspend')} disabled={actionMutation.isPending}>
              <Ban className="w-4 h-4 mr-2" />Suspendre
            </Button>
          )}
          {account.status === 'suspended' && (
            <Button variant="outline" className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
              onClick={() => actionMutation.mutate('reactivate')} disabled={actionMutation.isPending}>
              <UserCheck className="w-4 h-4 mr-2" />Réactiver
            </Button>
          )}
          {account.status === 'locked' && (
            <Button variant="outline" className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
              onClick={() => actionMutation.mutate('unlock')} disabled={actionMutation.isPending}>
              <Unlock className="w-4 h-4 mr-2" />Déverrouiller
            </Button>
          )}
          <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            onClick={() => actionMutation.mutate('revoke-sessions')} disabled={actionMutation.isPending}>
            <UserX className="w-4 h-4 mr-2" />Révoquer sessions
          </Button>
          <Button variant="outline" onClick={() => setPreviewOpen(true)} className="gap-2">
            <Eye className="w-4 h-4" />Voir comme patient
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
          <Globe className="w-5 h-5 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{account.active_sessions ?? account.activeSessions ?? 0}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Sessions actives</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
          <Clock className="w-5 h-5 text-indigo-500 mb-2" />
          <p className="text-sm font-bold text-gray-900 mt-2 truncate w-full">
            {account.last_login_at ?? account.lastLoginAt
              ? new Date(account.last_login_at ?? account.lastLoginAt).toLocaleString('fr-FR')
              : 'Jamais'}
          </p>
          <p className="text-xs text-gray-500 uppercase tracking-wide mt-1">Dernière connexion</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
          <ShieldAlert className="w-5 h-5 text-green-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{account.published_results ?? account.publishedResults ?? 0}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Résultats publiés</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
          <ShieldAlert className="w-5 h-5 text-purple-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{account.published_documents ?? account.publishedDocuments ?? 0}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Documents publiés</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="link" className="text-blue-600" onClick={() => window.open('/patient-portal-admin', '_blank')}>
          Ouvrir la gestion avancée du portail
        </Button>
      </div>

      {/* Confirm regen dialog */}
      <Dialog open={confirmRegenOpen} onOpenChange={setConfirmRegenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Régénérer le code d'activation ?
            </DialogTitle>
            <DialogDescription>
              Le code d'activation actuel sera immédiatement invalidé. Le patient devra utiliser le nouveau code.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRegenOpen(false)}>Annuler</Button>
            <Button onClick={() => generateOtpMutation.mutate()} disabled={generateOtpMutation.isPending}>
              {generateOtpMutation.isPending ? 'Génération...' : 'Générer un nouveau code'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview confirm dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Voir comme patient</DialogTitle>
            <DialogDescription>
              Accès au portail en mode lecture seule. Toutes les modifications sont bloquées et l'accès est enregistré dans l'audit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm font-medium text-gray-700">Actions interdites :</p>
            <ul className="text-sm text-gray-600 space-y-1 ml-4">
              <li>❌ Modification des données patient</li>
              <li>❌ Envoi de messages</li>
              <li>❌ Signature de consentements</li>
              <li>❌ Demande de rendez-vous</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Annuler</Button>
            <Button onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
              {previewMutation.isPending ? 'Ouverture...' : "Ouvrir l'aperçu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OTP dialog */}
      <OtpDialog otpData={otpData} onClose={() => setOtpData(null)} />
    </div>
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
            Ce code est à <strong>usage unique</strong>. Il ne sera plus affiché après fermeture.
            Communiquez-le au patient ou imprimez ce bon.
          </DialogDescription>
        </DialogHeader>

        {/* OTP display */}
        <div className="py-6 bg-gray-50 rounded-xl border border-gray-200 text-center my-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Code d'activation</p>
          <p className="text-5xl font-mono font-bold tracking-[.3em] text-blue-600 select-all">
            {otpData.otp}
          </p>
        </div>

        {/* Expiry */}
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600 -mt-2 mb-2">
          <Clock className="w-4 h-4 text-amber-500" />
          <span>Expire le <strong>{expiresStr}</strong></span>
        </div>

        <DialogFooter className="sm:justify-center flex-wrap gap-2 mt-2">
          <Button variant="outline" onClick={() => {
            navigator.clipboard.writeText(otpData.otp);
            toast.success('Code copié dans le presse-papiers');
          }}>
            <Copy className="w-4 h-4 mr-2" />Copier
          </Button>
          <Button variant="outline" onClick={() => printOtpSlip(otpData)}>
            <Printer className="w-4 h-4 mr-2" />Imprimer
          </Button>
          <Button onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
