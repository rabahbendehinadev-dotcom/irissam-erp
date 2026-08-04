import { useGetDashboard } from "@/hooks/use-portal-api";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileSearch, Pill, FileClock, Receipt, Bell, Shield, ArrowRight, Loader2, Activity } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

function formatDate(iso: string) {
  try {
    return format(parseISO(iso), "d MMMM yyyy 'à' HH:mm", { locale: fr });
  } catch (e) {
    return iso;
  }
}

function formatShortDate(iso: string) {
  try {
    return format(parseISO(iso), "d MMM yyyy", { locale: fr });
  } catch (e) {
    return iso;
  }
}

export default function Dashboard() {
  const { data, isLoading, error } = useGetDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-destructive/10 text-destructive rounded-xl border border-destructive/20">
        <h3 className="font-semibold">Erreur de chargement</h3>
        <p className="text-sm">Impossible de charger le tableau de bord. Veuillez réessayer.</p>
      </div>
    );
  }

  const d = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Next Appointment */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-1 shadow-sm border-border/60 hover:border-primary/30 transition-colors">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Calendar className="w-5 h-5" />
              </div>
              Prochain Rendez-vous
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d?.nextAppointment ? (
              <div className="space-y-4">
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {format(parseISO(d.nextAppointment.scheduledAt), "d MMMM", { locale: fr })}
                  </p>
                  <p className="text-muted-foreground font-medium">
                    {format(parseISO(d.nextAppointment.scheduledAt), "HH:mm", { locale: fr })}
                  </p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg border border-border/50">
                  <p className="font-semibold text-sm">{d.nextAppointment.doctorName}</p>
                  <p className="text-sm text-muted-foreground">{d.nextAppointment.departmentName}</p>
                </div>
                <Button variant="outline" className="w-full text-primary border-primary/20 hover:bg-primary/5" asChild>
                  <Link href="/appointments">Gérer mes RDV</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm">Aucun rendez-vous à venir</p>
                <Button className="w-full" asChild>
                  <Link href="/appointments/request">Prendre un RDV</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Last Results (Lab & Imaging) */}
        <div className="flex flex-col gap-4 col-span-1 md:col-span-2 lg:col-span-1">
          <Card className="flex-1 shadow-sm border-border/60">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/10 rounded-md text-blue-600 dark:text-blue-400">
                  <FileSearch className="w-4 h-4" />
                </div>
                Dernier Bilan
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d?.lastLabResult ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{d.lastLabResult.testType}</p>
                    <p className="text-xs text-muted-foreground mt-1">Publié le {formatShortDate(d.lastLabResult.publishedAt)}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" asChild>
                    <Link href={`/lab-results/${d.lastLabResult.id}`}>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">Aucun bilan récent</p>
              )}
            </CardContent>
          </Card>

          <Card className="flex-1 shadow-sm border-border/60">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <div className="p-1.5 bg-indigo-500/10 rounded-md text-indigo-600 dark:text-indigo-400">
                  <FileClock className="w-4 h-4" />
                </div>
                Dernière Imagerie
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d?.lastImaging ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{d.lastImaging.studyType}</p>
                    <p className="text-xs text-muted-foreground mt-1">Publié le {formatShortDate(d.lastImaging.publishedAt)}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" asChild>
                    <Link href={`/imaging/${d.lastImaging.id}`}>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">Aucune imagerie récente</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Finance / Admin summary */}
        <div className="flex flex-col gap-4 col-span-1 lg:col-span-1">
          <Card className="shadow-sm border-border/60 bg-gradient-to-br from-card to-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <div className="p-1.5 bg-amber-500/10 rounded-md text-amber-600 dark:text-amber-400">
                  <Receipt className="w-4 h-4" />
                </div>
                Solde à régler
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-3xl font-bold">{d?.balance.balance}</span>
                <span className="text-muted-foreground mb-1 font-medium">DZD</span>
              </div>
              {parseFloat(d?.balance.balance || "0") > 0 ? (
                <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-700 text-white" asChild>
                  <Link href="/invoices">Voir les factures impayées</Link>
                </Button>
              ) : (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <Activity className="w-4 h-4" /> Vous êtes à jour
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/10 rounded-md text-emerald-600 dark:text-emerald-400">
                  <Shield className="w-4 h-4" />
                </div>
                Assurance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d?.insurance?.active ? (
                <div>
                  <p className="font-medium text-sm">{d.insurance.insurerName}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-emerald-600 border-emerald-600/20 bg-emerald-500/5">{d.insurance.coveragePercent}% Couvert</Badge>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune assurance active enregistrée.</p>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
      
      {/* Recent Activity / Prescriptions Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {d?.lastPrescription && (
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <div className="p-1.5 bg-rose-500/10 rounded-md text-rose-600 dark:text-rose-400">
                  <Pill className="w-4 h-4" />
                </div>
                Dernière Ordonnance
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="font-medium">{d.lastPrescription.drug}</p>
                <p className="text-xs text-muted-foreground mt-1">Prescrit le {formatShortDate(d.lastPrescription.prescribedAt)}</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/prescriptions/${d.lastPrescription.id}`}>Consulter</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

    </div>
  );
}
