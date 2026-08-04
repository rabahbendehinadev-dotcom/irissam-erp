import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { apiClient } from '@/services/api/client';
import { toast } from 'sonner';
import { Globe, ShieldOff, AlertCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';

export interface PublishToPortalButtonProps {
  entityType: "lab-orders" | "imaging" | "prescriptions" | "documents";
  entityId: string;
  isPublished: boolean;
  publishedAt?: string | null;
  publishedByName?: string | null;
  status: string;
  onSuccess?: () => void;
}

export function PublishToPortalButton({
  entityType,
  entityId,
  isPublished,
  publishedAt,
  publishedByName,
  status,
  onSuccess,
}: PublishToPortalButtonProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');

  const isValidStatus = () => {
    switch (entityType) {
      case 'lab-orders': return status === 'validee' || status === 'critique';
      case 'imaging': return status === 'interpretee' || status === 'validee';
      case 'prescriptions': return status === 'validee' || status === 'delivre';
      case 'documents': return status === 'valide' || status === 'finalise';
      default: return false;
    }
  };

  const publishMutation = useMutation({
    mutationFn: async (data: { note?: string }) => {
      return apiClient.post(`/patient-portal-admin/${entityType}/${entityId}/publish`, data);
    },
    onSuccess: () => {
      toast.success('Publié au portail patient avec succès');
      setOpen(false);
      setNote('');
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erreur lors de la publication');
    }
  });

  const unpublishMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post(`/patient-portal-admin/${entityType}/${entityId}/unpublish`, {});
    },
    onSuccess: () => {
      toast.success('Retiré du portail patient');
      setOpen(false);
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erreur lors du retrait');
    }
  });

  const handlePublish = () => {
    publishMutation.mutate({ note: note.trim() || undefined });
  };

  const handleUnpublish = () => {
    unpublishMutation.mutate();
  };

  const isInvalid = !isValidStatus();

  if (isPublished) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="flex items-center gap-2 cursor-pointer">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              Publié
            </Badge>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Portail Patient</h4>
            <div className="text-sm text-gray-500 space-y-1">
              <p>Ce résultat est visible par le patient.</p>
              {publishedAt && <p>Date: {new Date(publishedAt).toLocaleString('fr-FR')}</p>}
              {publishedByName && <p>Par: {publishedByName}</p>}
            </div>
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleUnpublish}
              disabled={unpublishMutation.isPending}
            >
              <ShieldOff className="w-4 h-4 mr-2" />
              Retirer du portail
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  const triggerBtn = (
    <Button
      variant="outline"
      size="sm"
      className="text-xs flex items-center gap-1"
      disabled={isInvalid}
      onClick={() => !isInvalid && setOpen(true)}
    >
      <Globe className="w-3 h-3 text-blue-600" />
      Publier
    </Button>
  );

  return (
    <>
      {isInvalid ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-block opacity-50 cursor-not-allowed">
                {triggerBtn}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="flex items-center gap-1 text-xs">
                <AlertCircle className="w-3 h-3" /> Résultat non validé
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        triggerBtn
      )}

      <Dialog open={open && !isInvalid} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publier au portail patient</DialogTitle>
            <DialogDescription>
              Le patient recevra une notification et pourra consulter ce document depuis son espace personnel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Note pour le patient (optionnel)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                placeholder="Ex: Vos résultats sont normaux..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={publishMutation.isPending}>
              Annuler
            </Button>
            <Button onClick={handlePublish} disabled={publishMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              Confirmer la publication
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
