import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { HeartPulse, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setIsLoading(true);
    try {
      await login(values.email, values.password);
      toast.success("Connexion réussie");
      setLocation("/");
    } catch (err: any) {
      toast.error(err.message || "Identifiants incorrects");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center items-center bg-background p-4 relative overflow-hidden">
      {/* Decorative background shapes */}
      <div className="absolute top-[-10%] right-[-5%] w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/20">
            <HeartPulse className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">IRISSAM</h1>
          <p className="text-muted-foreground mt-2 text-lg">Votre santé, entre vos mains</p>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-6 sm:p-8 shadow-xl shadow-black/5">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email ou Identifiant</FormLabel>
                    <FormControl>
                      <Input placeholder="nom@exemple.com" className="h-12 bg-muted/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Mot de passe</FormLabel>
                      <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline cursor-pointer">
                        Oublié ?
                      </Link>
                    </div>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" className="h-12 bg-muted/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button type="submit" className="w-full h-12 text-base font-semibold mt-2" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Se connecter
                {!isLoading && <ArrowRight className="ml-2 w-4 h-4" />}
              </Button>
            </form>
          </Form>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          Nouveau patient ?{" "}
          <Link href="/activate">
            <span className="font-semibold text-primary hover:underline cursor-pointer">
              Activer mon compte
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
