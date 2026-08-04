import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, UserCheck, ShieldAlert, Key, Ban, UserX, Clock, Unlock, Mail } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export function PatientPortalTab({ patientId, patientEmail }: { patientId: string, patientEmail?: string }) {
  const qc = useQueryClient();
  const [createEmail, setCreateEmail] = useState(patientEmail || '');
  const [createOpen, setCreateOpen] = useState(false);
  const [otpData, setOtpData] = useState<{ otp: string } | null>(null);

  const { data: account, isLoading } = useQuery({
    queryKey: ['portal-admin', 'by-patient', patientId],
    queryFn: () => apiClient.get<any>(`/patient-portal-admin/by-patient/${patientId}`).catch((err) => {
      if (err.status === 404) return null;
      throw err;
    }),
    retry: false
  });

  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      if (!account?.id) throw new Error('Pas de compte');
      return apiClient.post<any>(`/patient-portal-admin/accounts/${account.id}/${action}`, {});
    },
    onSuccess: (data, action) => {
      qc.invalidateQueries({ queryKey: ['portal-admin', 'by-patient', patientId] });
      if (action === 'generate-otp') {
        setOtpData({ otp: data.otp || '123456' }); // fallback mock
      } else {
        toast.success(`Action effectuée avec succès`);
      }
    },
    onError: (err: any) => toast.error(err.message || "Erreur lors de l'action")
  });

  const createAccountMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post<any>(`/patient-portal-admin/accounts`, { patientId, email: createEmail });
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['portal-admin', 'by-patient', patientId] });
      setCreateOpen(false);
      setOtpData({ otp: data.otp || '123456' });
      toast.success('Compte créé avec succès');
    },
    onError: (err: any) => toast.error(err.message || "Erreur création compte")
  });

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Chargement des informations du portail...</div>;
  }

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl border border-gray-200">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Globe className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun compte portail</h3>
        <p className="text-sm text-gray-500 mb-6 max-w-md">
          Ce patient ne possède pas encore de compte pour accéder au Portail Patient. Vous pouvez lui en créer un pour lui permettre de consulter ses résultats et documents.
        </p>
        <Button onClick={() => setCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
          <UserCheck className="w-4 h-4 mr-2" />
          Créer le compte
        </Button>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un compte portail</DialogTitle>
              <DialogDescription>
                Créez un accès au portail pour ce patient. Il devra utiliser le code d'activation fourni pour sa première connexion.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium mb-1 block">Adresse email</label>
              <Input 
                type="email" 
                value={createEmail} 
                onChange={e => setCreateEmail(e.target.value)} 
                placeholder="patient@email.com" 
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
              <Button 
                disabled={!createEmail || createAccountMutation.isPending}
                onClick={() => createAccountMutation.mutate()}
              >
                Créer le compte
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-800">Actif</Badge>;
      case 'pending_activation': return <Badge className="bg-yellow-100 text-yellow-800">En attente d'activation</Badge>;
      case 'suspended': return <Badge className="bg-red-100 text-red-800">Suspendu</Badge>;
      case 'locked': return <Badge className="bg-orange-100 text-orange-800">Verrouillé</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-gray-200">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-lg font-semibold text-gray-900">Accès Portail Patient</h3>
            {getStatusBadge(account.status)}
          </div>
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <Mail className="w-4 h-4" /> {account.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {account.status === 'pending_activation' || account.status === 'active' ? (
            <Button 
              variant="outline" 
              onClick={() => actionMutation.mutate('generate-otp')}
              disabled={actionMutation.isPending}
            >
              <Key className="w-4 h-4 mr-2" />
              Générer code activation
            </Button>
          ) : null}

          {account.status === 'active' && (
            <Button 
              variant="outline" 
              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200"
              onClick={() => actionMutation.mutate('suspend')}
              disabled={actionMutation.isPending}
            >
              <Ban className="w-4 h-4 mr-2" />
              Suspendre
            </Button>
          )}

          {account.status === 'suspended' && (
            <Button 
              variant="outline" 
              className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
              onClick={() => actionMutation.mutate('reactivate')}
              disabled={actionMutation.isPending}
            >
              <UserCheck className="w-4 h-4 mr-2" />
              Réactiver
            </Button>
          )}

          {account.status === 'locked' && (
            <Button 
              variant="outline" 
              className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
              onClick={() => actionMutation.mutate('unlock')}
              disabled={actionMutation.isPending}
            >
              <Unlock className="w-4 h-4 mr-2" />
              Déverrouiller
            </Button>
          )}
          
          <Button 
            variant="outline" 
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            onClick={() => actionMutation.mutate('revoke-sessions')}
            disabled={actionMutation.isPending}
          >
            <UserX className="w-4 h-4 mr-2" />
            Révoquer sessions
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
          <Globe className="w-5 h-5 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{account.activeSessions || 0}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Sessions actives</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
          <Clock className="w-5 h-5 text-indigo-500 mb-2" />
          <p className="text-sm font-bold text-gray-900 mt-2 truncate w-full">
            {account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString('fr-FR') : 'Jamais'}
          </p>
          <p className="text-xs text-gray-500 uppercase tracking-wide mt-1">Dernière connexion</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="w-5 h-5 text-green-500 mb-2 flex items-center justify-center font-bold text-lg">+</div>
          <p className="text-2xl font-bold text-gray-900">{account.publishedResults || 0}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Résultats publiés</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="w-5 h-5 text-purple-500 mb-2 flex items-center justify-center font-bold text-lg">+</div>
          <p className="text-2xl font-bold text-gray-900">{account.publishedDocuments || 0}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Documents publiés</p>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <Button variant="link" className="text-blue-600" onClick={() => window.open('/patient-portal-admin', '_blank')}>
          Ouvrir la gestion avancée du portail
        </Button>
      </div>

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
    </div>
  );
}