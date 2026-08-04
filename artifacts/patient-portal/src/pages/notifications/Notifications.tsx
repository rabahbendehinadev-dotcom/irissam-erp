import { useGetNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from "@/hooks/use-portal-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Bell, Loader2, Check, CheckCircle2, Info } from "lucide-react";

export default function Notifications() {
  const { data, isLoading } = useGetNotifications(false);
  const markAllRead = useMarkAllNotificationsRead();
  const markRead = useMarkNotificationRead();

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const notifications = data?.notifications || [];
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    await markAllRead.mutateAsync();
  };

  const handleMarkRead = async (id: string, isRead: boolean) => {
    if (isRead) return;
    await markRead.mutateAsync(id);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Suivez l'activité de votre dossier médical.</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={markAllRead.isPending}>
            <CheckCircle2 className="w-4 h-4 mr-2" /> Tout marquer comme lu
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center p-12 border border-dashed rounded-xl bg-muted/20">
          <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">Vous n'avez aucune notification.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card 
              key={n.id} 
              className={`shadow-sm border-border/60 transition-colors cursor-pointer ${!n.isRead ? 'bg-primary/5 border-primary/20' : 'hover:bg-muted/30'}`}
              onClick={() => handleMarkRead(n.id, n.isRead)}
            >
              <CardContent className="p-4 flex gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-1 ${!n.isRead ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  <Info className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className={`font-semibold text-sm ${!n.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>{n.title}</h3>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(parseISO(n.createdAt), { addSuffix: true, locale: fr })}
                    </span>
                  </div>
                  <p className={`text-sm mt-1 ${!n.isRead ? 'text-foreground/90' : 'text-muted-foreground'}`}>{n.body}</p>
                </div>
                {!n.isRead && (
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0"></div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}