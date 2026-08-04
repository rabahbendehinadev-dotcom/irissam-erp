import { useGetInsurance } from "@/hooks/use-portal-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Briefcase, Loader2, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";

export default function Insurance() {
  const { data, isLoading } = useGetInsurance();

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const insurance = data?.insurance;
  const claims = data?.claims || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assurances</h1>
        <p className="text-muted-foreground">Vos informations de couverture et le suivi de vos prises en charge.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border/60 bg-gradient-to-br from-card to-card/50 h-fit">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" /> Couverture Principale
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insurance ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Organisme payeur</p>
                  <p className="text-xl font-bold">{insurance.insurerName}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                  <div>
                    <p className="text-sm text-muted-foreground">Statut</p>
                    {insurance.active ? (
                      <Badge className="bg-emerald-500 hover:bg-emerald-600 mt-1">Active</Badge>
                    ) : (
                      <Badge variant="destructive" className="mt-1">Inspirée</Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Taux de couverture</p>
                    <p className="font-semibold text-lg">{insurance.coveragePercent}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                  <div>
                    <p className="text-sm text-muted-foreground">N° d'adhérent</p>
                    <p className="font-mono text-sm mt-1">{insurance.memberNumberMasked}</p>
                  </div>
                  {insurance.expiryDate && (
                    <div>
                      <p className="text-sm text-muted-foreground">Date d'expiration</p>
                      <p className="text-sm mt-1">{format(parseISO(insurance.expiryDate), "dd/MM/yyyy")}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground py-4 text-center">Aucune assurance enregistrée. Veuillez vous présenter au bureau des admissions.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Dernières prises en charge (Prise en Charge)</h2>
          {claims.length === 0 ? (
            <div className="text-center p-8 border border-dashed rounded-xl bg-muted/20">
              <Briefcase className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Aucune demande de prise en charge récente.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {claims.map(claim => (
                <Card key={claim.id} className="shadow-sm border-border/60">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Demande N° {claim.claimNumber}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{format(parseISO(claim.createdAt), "dd/MM/yyyy")}</p>
                      <p className="text-sm font-semibold mt-2">{claim.totalAmount} DZD</p>
                    </div>
                    <div className="text-right">
                      {claim.status === "approved" && (
                        <div className="flex flex-col items-end gap-1">
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200" variant="outline">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Approuvée
                          </Badge>
                          <span className="text-xs text-muted-foreground mt-1">Couvert: {claim.coveredAmount}</span>
                        </div>
                      )}
                      {claim.status === "pending" && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">En attente</Badge>
                      )}
                      {claim.status === "rejected" && (
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                            <XCircle className="w-3 h-3 mr-1" /> Rejetée
                          </Badge>
                          {claim.rejectionReason && <span className="text-[10px] text-destructive max-w-[120px] truncate" title={claim.rejectionReason}>{claim.rejectionReason}</span>}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}