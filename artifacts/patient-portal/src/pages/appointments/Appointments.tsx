import { useState } from "react";
import { Link } from "wouter";
import { useGetAppointments, useCancelAppointment } from "@/hooks/use-portal-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Clock, MapPin, User, Loader2, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function Appointments() {
  const [filter, setFilter] = useState("upcoming");
  const { data, isLoading } = useGetAppointments(filter);
  const cancelAppt = useCancelAppointment();
  
  const appointments = data?.appointments || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rendez-vous</h1>
          <p className="text-muted-foreground">Gérez vos consultations à venir et passez en revue votre historique.</p>
        </div>
        <Button className="w-full sm:w-auto shadow-sm" asChild>
          <Link href="/appointments/request">
            <Plus className="w-4 h-4 mr-2" /> Demander un RDV
          </Link>
        </Button>
      </div>

      <Tabs value={filter} onValueChange={setFilter} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="upcoming">À venir</TabsTrigger>
          <TabsTrigger value="past">Passés</TabsTrigger>
          <TabsTrigger value="cancelled">Annulés</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : appointments.length === 0 ? (
            <div className="text-center p-12 border border-dashed rounded-xl bg-muted/20">
              <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium">Aucun rendez-vous</h3>
              <p className="text-muted-foreground">Vous n'avez aucun rendez-vous dans cette catégorie.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
              {appointments.map((apt) => (
                <AppointmentCard key={apt.id} apt={apt} cancelAppt={cancelAppt} isUpcoming={filter === "upcoming"} />
              ))}
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}

function AppointmentCard({ apt, cancelAppt, isUpcoming }: { apt: any, cancelAppt: any, isUpcoming: boolean }) {
  const date = parseISO(apt.scheduledAt);
  const [open, setOpen] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled": return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Confirmé</Badge>;
      case "completed": return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Terminé</Badge>;
      case "cancelled": return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Annulé</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCancel = async () => {
    await cancelAppt.mutateAsync(apt.id);
    setOpen(false);
  };

  return (
    <Card className="shadow-sm border-border/60 hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      <div className="bg-muted/30 px-5 py-3 border-b flex justify-between items-center">
        <div className="font-semibold text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          {format(date, "EEEE d MMMM yyyy", { locale: fr })}
        </div>
        {getStatusBadge(apt.status)}
      </div>
      <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-lg leading-none">{format(date, "HH:mm")}</p>
              <p className="text-sm text-muted-foreground mt-1">Durée: {apt.duration} min</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{apt.doctorName}</p>
              <p className="text-sm text-muted-foreground">{apt.departmentName}</p>
            </div>
          </div>
          {apt.reason && (
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-sm italic text-muted-foreground">{apt.reason}</p>
            </div>
          )}
        </div>
        
        {isUpcoming && apt.status === "scheduled" && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive mt-4">
                Annuler
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Annuler ce rendez-vous ?</DialogTitle>
                <DialogDescription>
                  Êtes-vous sûr de vouloir annuler votre rendez-vous du {format(date, "d MMMM à HH:mm")} avec {apt.doctorName} ? Cette action est irréversible.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setOpen(false)}>Fermer</Button>
                <Button variant="destructive" onClick={handleCancel} disabled={cancelAppt.isPending}>
                  {cancelAppt.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : null}
                  Confirmer l'annulation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}

// Just importing FileText here since we used it
import { FileText } from "lucide-react";
