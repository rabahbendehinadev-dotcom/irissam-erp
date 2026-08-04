import { useGetPrescriptions } from "@/hooks/use-portal-api";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Pill, ChevronRight, Loader2, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Prescriptions() {
  const { data, isLoading } = useGetPrescriptions();
  
  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const prescriptions = data?.prescriptions || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ordonnances</h1>
        <p className="text-muted-foreground">Consultez vos prescriptions médicales.</p>
      </div>

      {prescriptions.length === 0 ? (
        <div className="text-center p-12 border border-dashed rounded-xl bg-muted/20">
          <Pill className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium">Aucune ordonnance</h3>
          <p className="text-muted-foreground">Vous n'avez aucune ordonnance récente.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {prescriptions.map((px) => (
            <Card key={px.id} className="shadow-sm border-border/60 flex flex-col">
              <div className="bg-muted/30 px-5 py-3 border-b flex justify-between items-center">
                <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {format(parseISO(px.prescribedAt), "dd/MM/yyyy")}
                </div>
                {px.prescribedByName && <span className="text-xs font-semibold">{px.prescribedByName}</span>}
              </div>
              <CardContent className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-lg text-primary">{px.drug}</h3>
                  <div className="mt-4 space-y-2 text-sm">
                    {px.dosage && (
                      <div className="flex justify-between border-b border-border/50 pb-1">
                        <span className="text-muted-foreground">Dosage</span>
                        <span className="font-medium">{px.dosage}</span>
                      </div>
                    )}
                    {px.frequency && (
                      <div className="flex justify-between border-b border-border/50 pb-1">
                        <span className="text-muted-foreground">Fréquence</span>
                        <span className="font-medium">{px.frequency}</span>
                      </div>
                    )}
                    {px.duration && (
                      <div className="flex justify-between border-b border-border/50 pb-1">
                        <span className="text-muted-foreground">Durée</span>
                        <span className="font-medium">{px.duration}</span>
                      </div>
                    )}
                  </div>
                </div>
                {px.instructions && (
                  <div className="mt-4 bg-muted/30 p-3 rounded-lg text-xs">
                    <span className="font-semibold block mb-1">Instructions:</span>
                    {px.instructions}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
