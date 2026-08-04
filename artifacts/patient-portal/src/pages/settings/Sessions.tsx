import { useGetSessions, useRevokeSession } from "@/hooks/use-portal-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Laptop, Smartphone, Globe, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Sessions() {
  const { data, isLoading } = useGetSessions();
  const revoke = useRevokeSession();

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const sessions = data?.sessions || [];

  const handleRevoke = async (id: string) => {
    try {
      await revoke.mutateAsync(id);
      toast.success("Session révoquée");
    } catch (e: any) {
      toast.error(e.message || "Erreur de révocation");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Appareils connectés</h1>
        <p className="text-muted-foreground">Gérez les appareils qui ont actuellement accès à votre compte.</p>
      </div>

      <div className="space-y-3">
        {sessions.map(s => {
          const isMobile = s.os?.toLowerCase().includes("ios") || s.os?.toLowerCase().includes("android");
          return (
            <Card key={s.id} className="shadow-sm border-border/60">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    {isMobile ? <Smartphone className="w-5 h-5 text-muted-foreground" /> : <Laptop className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{s.deviceName || s.os || "Appareil inconnu"}</p>
                      {s.isCurrent && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Cet appareil</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Globe className="w-3 h-3" /> {s.browser || "Navigateur inconnu"} • {s.ipAddress}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Dernière activité : {format(parseISO(s.lastSeen), "d MMMM à HH:mm", { locale: fr })}
                    </p>
                  </div>
                </div>
                {!s.isCurrent && (
                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleRevoke(s.id)} disabled={revoke.isPending}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}