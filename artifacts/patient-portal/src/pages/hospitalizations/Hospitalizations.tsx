import { useGetHospitalizations } from "@/hooks/use-portal-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Stethoscope, Loader2, Calendar, MapPin, User } from "lucide-react";

export default function Hospitalizations() {
  const { data, isLoading } = useGetHospitalizations();

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const hospitalizations = data?.hospitalizations || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hospitalisations</h1>
        <p className="text-muted-foreground">Historique de vos admissions et séjours hospitaliers.</p>
      </div>

      {hospitalizations.length === 0 ? (
        <div className="text-center p-12 border border-dashed rounded-xl bg-muted/20">
          <Stethoscope className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium">Aucun séjour</h3>
          <p className="text-muted-foreground">Vous n'avez aucune hospitalisation enregistrée.</p>
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {hospitalizations.map((hosp) => (
            <Card key={hosp.id} className="shadow-sm border-border/60 overflow-hidden">
              <div className={`px-5 py-3 border-b flex justify-between items-center ${hosp.status === 'in_progress' ? 'bg-primary/10' : 'bg-muted/30'}`}>
                <div className="font-semibold flex items-center gap-2">
                  <Stethoscope className={`w-4 h-4 ${hosp.status === 'in_progress' ? 'text-primary' : 'text-muted-foreground'}`} />
                  {hosp.encounterType}
                </div>
                {hosp.status === "in_progress" ? (
                  <Badge className="bg-primary hover:bg-primary">En cours</Badge>
                ) : (
                  <Badge variant="outline">Terminée</Badge>
                )}
              </div>
              <CardContent className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-muted-foreground">Admission</p>
                        <p className="font-medium">{format(parseISO(hosp.admittedAt), "d MMMM yyyy", { locale: fr })}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-muted-foreground">Sortie</p>
                        <p className="font-medium">{hosp.actualDischargeDate ? format(parseISO(hosp.actualDischargeDate), "d MMMM yyyy", { locale: fr }) : "-"}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-muted-foreground">Service</p>
                        <p className="font-medium">{hosp.serviceName || "Non spécifié"}</p>
                        {(hosp.roomNumber || hosp.bedNumber) && (
                          <p className="text-xs mt-1">Chambre {hosp.roomNumber} - Lit {hosp.bedNumber}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-muted-foreground">Médecin référent</p>
                        <p className="font-medium">{hosp.doctorName || "Non spécifié"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {hosp.diagnosis && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-sm font-medium mb-1">Diagnostic principal</p>
                    <p className="text-sm text-muted-foreground">{hosp.diagnosis}</p>
                  </div>
                )}
                
                {hosp.dischargeNotes && (
                  <div className="mt-4 bg-muted/30 p-3 rounded-lg border border-border/50">
                    <p className="text-sm font-medium mb-1">Résumé de sortie</p>
                    <p className="text-sm text-muted-foreground">{hosp.dischargeNotes}</p>
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
