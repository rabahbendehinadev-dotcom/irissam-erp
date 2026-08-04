import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api, setAccessToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, Loader2, HeartPulse, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const tokenSchema = z.object({
  token: z.string().min(5, "Le code est requis"),
});

const infoSchema = z.object({
  mrn: z.string().min(1, "Le numéro de dossier est requis"),
  dateOfBirth: z.string().min(1, "La date de naissance est requise"),
  phone: z.string().min(1, "Le numéro de téléphone est requis"),
  otp: z.string().min(1, "Le code OTP est requis"),
});

export default function Activate() {
  const [, setLocation] = useLocation();
  const { refreshMe } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const tokenForm = useForm<z.infer<typeof tokenSchema>>({
    resolver: zodResolver(tokenSchema),
    defaultValues: { token: "" },
  });

  const infoForm = useForm<z.infer<typeof infoSchema>>({
    resolver: zodResolver(infoSchema),
    defaultValues: { mrn: "", dateOfBirth: "", phone: "", otp: "" },
  });

  async function activateAccount(payload: any) {
    setIsLoading(true);
    try {
      const res = await api.post<{ accessToken: string }>("/auth/activate", payload);
      setAccessToken(res.accessToken);
      await refreshMe();
      toast.success("Compte activé avec succès");
      setLocation("/");
    } catch (err: any) {
      toast.error(err.message || "Impossible d'activer le compte");
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
          <p className="text-muted-foreground mt-2">Choisissez votre méthode d'activation</p>
        </div>

        <Tabs defaultValue="token" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="token">J'ai un code d'invitation</TabsTrigger>
            <TabsTrigger value="info">J'ai mon N° de dossier</TabsTrigger>
          </TabsList>
          
          <TabsContent value="token">
            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
              <Form {...tokenForm}>
                <form onSubmit={tokenForm.handleSubmit((v) => activateAccount(v))} className="space-y-4">
                  <FormField
                    control={tokenForm.control}
                    name="token"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code d'invitation (reçu par email ou SMS)</FormLabel>
                        <FormControl>
                          <Input placeholder="ex: ABCD-1234" className="h-12 uppercase" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-12 mt-2" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Activer le compte"}
                  </Button>
                </form>
              </Form>
            </div>
          </TabsContent>
          
          <TabsContent value="info">
            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
              <Form {...infoForm}>
                <form onSubmit={infoForm.handleSubmit((v) => activateAccount(v))} className="space-y-4">
                  <FormField
                    control={infoForm.control}
                    name="mrn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>N° de dossier (IPP)</FormLabel>
                        <FormControl>
                          <Input placeholder="ex: 12345678" {...field} />
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
                          <Input type="date" {...field} />
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
                          <Input type="tel" placeholder="05..." {...field} />
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
                        <FormLabel>Code de sécurité (OTP)</FormLabel>
                        <FormControl>
                          <Input placeholder="Reçu par SMS" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-12 mt-2" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Vérifier et Activer"}
                  </Button>
                </form>
              </Form>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
