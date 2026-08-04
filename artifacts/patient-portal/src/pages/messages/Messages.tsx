import { useGetMessages, useSendMessage, useCloseMessage } from "@/hooks/use-portal-api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { MessageSquare, Plus, Loader2, CheckCircle2, Send } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Messages() {
  const { data, isLoading } = useGetMessages();
  const sendMsg = useSendMessage();
  const closeMsg = useCloseMessage();
  const { isPreview } = useAuth();

  const [openCompose, setOpenCompose] = useState(false);
  const [formData, setFormData] = useState({ type: "medical", subject: "", body: "" });

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const messages = data?.messages || [];

  const handleSend = async () => {
    if (!formData.subject || !formData.body) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    try {
      await sendMsg.mutateAsync(formData);
      toast.success("Message envoyé");
      setOpenCompose(false);
      setFormData({ type: "medical", subject: "", body: "" });
    } catch (e: any) {
      toast.error(e.message || "Erreur d'envoi");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Messagerie Sécurisée</h1>
          <p className="text-muted-foreground">Échangez avec l'équipe médicale et administrative.</p>
        </div>
        <Button onClick={() => setOpenCompose(true)} disabled={isPreview}>
          <Plus className="w-4 h-4 mr-2" /> Nouveau message
        </Button>
        {isPreview && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-md">Mode aperçu — lecture seule</p>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="text-center p-12 border border-dashed rounded-xl bg-muted/20">
          <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium">Aucun message</h3>
          <p className="text-muted-foreground">Votre messagerie est vide.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map(msg => (
            <Card key={msg.id} className="shadow-sm border-border/60">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{msg.subject || "Sans objet"}</h3>
                    <p className="text-sm text-muted-foreground flex gap-2 items-center">
                      <span>{msg.type === "medical" ? "Médical" : "Administratif"}</span>
                      •
                      <span>{format(parseISO(msg.createdAt), "dd/MM/yyyy HH:mm")}</span>
                    </p>
                  </div>
                  {msg.status === "open" ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200" variant="outline">En cours</Badge>
                  ) : (
                    <Badge variant="outline">Clôturé</Badge>
                  )}
                </div>

                <div className="bg-muted/30 p-4 rounded-lg text-sm whitespace-pre-wrap">
                  {msg.body}
                </div>

                {msg.staffReply && (
                  <div className="mt-4 bg-primary/5 border border-primary/20 p-4 rounded-lg text-sm">
                    <p className="font-semibold text-primary mb-1 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Réponse de l'équipe
                    </p>
                    <p className="whitespace-pre-wrap">{msg.staffReply}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {msg.repliedAt && format(parseISO(msg.repliedAt), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                )}

                {msg.status === "open" && (
                  <div className="mt-4 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => closeMsg.mutate(msg.id)} disabled={isPreview}>
                      Clôturer la conversation
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={openCompose} onOpenChange={setOpenCompose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Service concerné</label>
              <Select value={formData.type} onValueChange={v => setFormData({...formData, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="medical">Équipe Médicale (Médecins/Infirmiers)</SelectItem>
                  <SelectItem value="administrative">Administration (Facturation/Accueil)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Sujet</label>
              <Input value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} placeholder="Ex: Question sur mon traitement" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea value={formData.body} onChange={e => setFormData({...formData, body: e.target.value})} className="h-32" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCompose(false)}>Annuler</Button>
            <Button onClick={handleSend} disabled={sendMsg.isPending || isPreview}>
              {sendMsg.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Send className="w-4 h-4 mr-2" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}