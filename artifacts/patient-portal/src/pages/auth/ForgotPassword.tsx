import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ChevronLeft, Loader2, KeyRound, CheckCircle2 } from "lucide-react";

const schema = z.object({
  email: z.string().email("Adresse email invalide"),
});

export default function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setIsLoading(true);
    try {
      await api.post("/auth/forgot-password", values);
      setIsSent(true);
    } catch (err: any) {
      // In a real app we might not show an error if email doesn't exist for security
      setIsSent(true);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center items-center bg-background p-4 relative">
      <div className="absolute top-4 left-4">
        <Button variant="ghost" className="text-muted-foreground hover:text-foreground" asChild>
          <Link href="/login">
            <ChevronLeft className="mr-2 h-4 w-4" /> Retour
          </Link>
        </Button>
      </div>

      <div className="w-full max-w-md bg-card border border-border/50 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
            {isSent ? <CheckCircle2 className="w-6 h-6" /> : <KeyRound className="w-6 h-6" />}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Mot de passe oublié</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {isSent 
              ? "Si cette adresse existe, un email contenant un lien de réinitialisation vous a été envoyé."
              : "Entrez votre adresse email pour recevoir un lien de réinitialisation."}
          </p>
        </div>

        {!isSent ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse email</FormLabel>
                    <FormControl>
                      <Input placeholder="nom@exemple.com" className="h-12" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full h-12 mt-2" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Envoyer le lien"}
              </Button>
            </form>
          </Form>
        ) : (
          <Button className="w-full h-12" variant="outline" asChild>
            <Link href="/login">
              Retour à la connexion
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
