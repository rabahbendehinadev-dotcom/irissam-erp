import { useGetConsents, useSignConsent, useRefuseConsent } from "@/hooks/use-portal-api";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ShieldAlert, Loader2, Check, X, ScrollText } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export default function Consents() {
  const { data, isLoading } = useGetConsents();
  const signConsent = useSignConsent();
  const refuseConsent = useRefuseConsent();
  
  const [selectedConsent, setSelectedConsent] = useState<any>(null);
  const [action, setAction] = useState<"sign"|"refuse"|null>(null);

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const consents = data?.consents || [];
  const pendingConsents = consents.filter(c => c.status === "pending");
  const pastConsents = consents.filter(c => c.status !== "pending");

  const handleAction = async () => {
    if (!selectedConsent || !action) return;
    try {
      if (action === "sign") await signConsent.mutateAsync(selectedConsent.id);
      else await refuseConsent.mutateAsync(selectedConsent.id);
      setSelectedConsent(null);
      setAction(null);
    } catch (e) {}
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Consentements</h1>
        <p className="text-muted-foreground">Examinez et gérez vos consentements médicaux et administratifs.</p>
      </div>

      {pendingConsents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-amber-600 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" /> En attente de votre décision
          </h2>
          <div className="grid gap-4">
            {pendingConsents.map(c => (
              <Card key={c.id} className="border-amber-200 bg-amber-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{c.consentType}</CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="h-24 overflow-y-auto text-sm text-muted-foreground bg-background p-3 rounded border border-border/50">
                    {c.contentText}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 pt-0">
                  <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => { setSelectedConsent(c); setAction("refuse"); }}>Refuser</Button>
                  <Button onClick={() => { setSelectedConsent(c); setAction("sign"); }}>Accepter et Signer</Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4">Historique des consentements</h2>
        {pastConsents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun historique disponible.</p>
        ) : (
          <div className="grid gap-3">
            {pastConsents.map(c => (
              <Card key={c.id} className="shadow-sm border-border/60">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <ScrollText className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-sm">{c.consentType}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {c.status === "signed" 
                          ? `Signé le ${format(parseISO(c.signedAt!), "dd/MM/yyyy HH:mm")}`
                          : `Refusé le ${format(parseISO(c.refusedAt!), "dd/MM/yyyy HH:mm")}`
                        }
                      </p>
                    </div>
                  </div>
                  {c.status === "signed" ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0"><Check className="w-3 h-3 mr-1"/> Signé</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 shrink-0"><X className="w-3 h-3 mr-1"/> Refusé</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedConsent} onOpenChange={(open) => !open && setSelectedConsent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action === "sign" ? "Confirmer la signature" : "Confirmer le refus"}</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir {action === "sign" ? "accepter" : "refuser"} ce consentement : "{selectedConsent?.consentType}" ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedConsent(null)}>Annuler</Button>
            <Button 
              variant={action === "sign" ? "default" : "destructive"} 
              onClick={handleAction}
              disabled={signConsent.isPending || refuseConsent.isPending}
            >
              {(signConsent.isPending || refuseConsent.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}