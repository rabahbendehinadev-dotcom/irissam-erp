import { useGetActivityLog, useChangePassword, useRequestDataExport, useRequestAccountClosure } from "@/hooks/use-portal-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Shield, Key, Download, Trash2, Loader2, History } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";

const pwdSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: z.string().min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string()
}).refine(d => d.newPassword === d.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"]
});

export default function Privacy() {
  const { data: logData, isLoading: logLoading } = useGetActivityLog();
  const changePwd = useChangePassword();
  const reqExport = useRequestDataExport();
  const reqClosure = useRequestAccountClosure();
  const { logout } = useAuth();
  
  const [exporting, setExporting] = useState(false);
  const [closureOpen, setClosureOpen] = useState(false);
  const [closureReason, setClosureReason] = useState("");

  const pwdForm = useForm<z.infer<typeof pwdSchema>>({
    resolver: zodResolver(pwdSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" }
  });

  const onPwdSubmit = async (v: z.infer<typeof pwdSchema>) => {
    try {
      await changePwd.mutateAsync(v);
      toast.success("Mot de passe modifié avec succès");
      pwdForm.reset();
    } catch (e: any) {
      toast.error(e.message || "Erreur de modification");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await reqExport.mutateAsync();
      toast.success("Votre demande d'export a été envoyée. Vous recevrez un email prochainement.");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la demande");
    } finally {
      setExporting(false);
    }
  };

  const handleClosure = async () => {
    try {
      await reqClosure.mutateAsync({ reason: closureReason, confirmText: "CONFIRMER" });
      toast.success("Demande de clôture envoyée.");
      setClosureOpen(false);
      logout();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Confidentialité & Sécurité</h1>
        <p className="text-muted-foreground">Gérez la sécurité de votre compte et vos données personnelles.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Change Password */}
          <Card className="shadow-sm border-border/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="w-4 h-4 text-primary" /> Changer de mot de passe
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...pwdForm}>
                <form onSubmit={pwdForm.handleSubmit(onPwdSubmit)} className="space-y-4">
                  <FormField control={pwdForm.control} name="currentPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mot de passe actuel</FormLabel>
                      <FormControl><Input type="password" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={pwdForm.control} name="newPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nouveau mot de passe</FormLabel>
                      <FormControl><Input type="password" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={pwdForm.control} name="confirmPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmer le mot de passe</FormLabel>
                      <FormControl><Input type="password" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={changePwd.isPending}>
                    {changePwd.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Mettre à jour
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Data controls */}
          <Card className="shadow-sm border-border/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Contrôle des données
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold mb-1">Télécharger mes données</h4>
                <p className="text-sm text-muted-foreground mb-3">Obtenez une copie complète de votre dossier médical au format standard.</p>
                <Button variant="outline" onClick={handleExport} disabled={exporting}>
                  {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  Demander une archive
                </Button>
              </div>
              <div className="pt-4 border-t border-border/50">
                <h4 className="text-sm font-semibold mb-1 text-destructive">Clôturer mon compte</h4>
                <p className="text-sm text-muted-foreground mb-3">La clôture de votre compte en ligne n'efface pas votre dossier médical de l'hôpital, mais révoque votre accès portail.</p>
                <Button variant="destructive" onClick={() => setClosureOpen(true)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Demander la clôture
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Log */}
        <Card className="shadow-sm border-border/60 h-fit">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-primary" /> Journal d'activité
            </CardTitle>
            <CardDescription>Dernières connexions et actions de sécurité.</CardDescription>
          </CardHeader>
          <CardContent>
            {logLoading ? (
              <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : logData?.logs?.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune activité récente.</p>
            ) : (
              <div className="space-y-4">
                {logData?.logs?.slice(0, 5).map((log, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary/40 mt-1.5 shrink-0" />
                    <div>
                      <p className="font-medium">{log.action || "Connexion"}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.timestamp ? format(parseISO(log.timestamp), "dd/MM/yyyy HH:mm") : "-"} • {log.ipAddress || "IP masquée"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={closureOpen} onOpenChange={setClosureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clôturer le compte</DialogTitle>
            <DialogDescription>
              Cette action supprimera votre accès au portail patient. Veuillez indiquer la raison de votre départ.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input 
              placeholder="Raison (optionnelle)" 
              value={closureReason}
              onChange={e => setClosureReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosureOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleClosure} disabled={reqClosure.isPending}>
              {reqClosure.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmer la clôture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}