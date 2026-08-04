import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api, setAccessToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { ChevronLeft, Loader2, UserCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const infoSchema = z.object({
  mrn: z.string().min(1, "Le numéro de dossier est requis"),
  dateOfBirth: z.string().min(1, "La date de naissance est requise"),
  phone: z.string().min(1, "Le numéro de téléphone est requis"),
  otp: z.string().length(6, "Le code est composé de 6 chiffres"),
});

export default function Activate() {
  const [, setLocation] = useLocation();
  const { refreshMe } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const infoForm = useForm<z.infer<typeof infoSchema>>({
    resolver: zodResolver(infoSchema),
    defaultValues: { mrn: "", dateOfBirth: "", phone: "", otp: "" },
  });

  async function activateAccount(payload: z.infer<typeof infoSchema>) {
    setIsLoading(true);
    try {
      const res = await api.post<{ accessToken: string }>("/auth/activate", payload);
      setAccessToken(res.accessToken);
      await refreshMe();
      toast.success("Compte activé avec succès");
      setLocation("/");
    } catch (err: any) {
      toast.error(err.message || "Code invalide ou expiré. Contactez l'accueil.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center items-center bg-background p-4 relative">
      <div className="absolute top-4 left-4">
        <Button variant="ghost" className="text-muted-foreground hover:text-foreground" asChild>
          <Link href="/login">
            <ChevronLeft className="mr-2 h-4 w-4" /> Retour à la connexion
          </Link>
        </Button>
      </div>

      <div className="w-full max-w-md relative z-10 mt-12 mb-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserCircle className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Activer mon espace patient</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Saisissez vos informations et le code remis par l'accueil
          </p>
        </div>

        {/* Reception notice */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <Phone className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Code d'activation</p>
            <p className="text-sm text-blue-700 mt-0.5">
              Votre code d'activation à 6 chiffres vous est remis en main propre par l'accueil d'IRISSAM Hospital.
              Pour obtenir ou renouveler un code, veuillez vous présenter ou appeler l'accueil.
            </p>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <Form {...infoForm}>
            <form onSubmit={infoForm.handleSubmit(activateAccount)} className="space-y-4">
              <FormField
                control={infoForm.control}
                name="mrn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>N° de dossier (IPP / MRN)</FormLabel>
                    <FormControl>
                      <Input placeholder="ex: 12345678" autoComplete="off" {...field} />
                    </FormControl>
                    <FormDescription>Présent sur vos ordonnances et factures IRISSAM</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={infoForm.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de naissance</FormLabel>
                    <FormControl>
                      <Input type="date" autoComplete="bday" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={infoForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro de téléphone</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="05xxxxxxxx" autoComplete="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={infoForm.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code d'activation (6 chiffres)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="000000"
                        maxLength={6}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        className="tracking-widest text-center text-lg font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Remis par l'accueil — valable 30 minutes, usage unique
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-12 mt-2" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Vérifier et activer"}
              </Button>
            </form>
          </Form>
        </div>

        {/* Help text — no resend/SMS link */}
        <p className="text-center text-xs text-muted-foreground mt-6 px-4">
          Code oublié ou expiré ?{" "}
          <span className="font-medium text-foreground">
            Présentez-vous à l'accueil d'IRISSAM Hospital pour obtenir un nouveau code.
          </span>
        </p>
      </div>
    </div>
  );
}
