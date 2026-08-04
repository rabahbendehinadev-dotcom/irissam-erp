import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  token: z.string().min(1, "Le token est requis"),
  otp: z.string().min(1, "Le code de sécurité est requis"),
  newPassword: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

export default function ResetPassword() {
  const [location, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  
  // Extract token from URL if present
  const searchParams = new URLSearchParams(window.location.search);
  const initialToken = searchParams.get("token") || "";

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { token: initialToken, otp: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setIsLoading(true);
    try {
      await api.post("/auth/reset-password", {
        token: values.token,
        otp: values.otp,
        newPassword: values.newPassword
      });
      toast.success("Mot de passe réinitialisé avec succès");
      setLocation("/login");
    } catch (err: any) {
      toast.error(err.message || "Échec de la réinitialisation");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center items-center bg-background p-4 relative">
      <div className="w-full max-w-md bg-card border border-border/50 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Nouveau mot de passe</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Veuillez entrer le code de sécurité reçu et choisir un nouveau mot de passe.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!initialToken && (
              <FormField
                control={form.control}
                name="token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token de réinitialisation</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <FormField
              control={form.control}
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
            
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nouveau mot de passe</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmer le mot de passe</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full h-12 mt-6" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Enregistrer le mot de passe"}
            </Button>
          </form>
        </Form>
        
        <div className="mt-6 text-center text-sm">
          <Link href="/login">
            <span className="text-muted-foreground hover:text-foreground cursor-pointer">
              Retour à la connexion
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
