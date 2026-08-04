import { useState } from "react";
import { useGetProfile, useUpdateProfile } from "@/hooks/use-portal-api";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, User, Phone, MapPin, Globe, Bell, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

const profileSchema = z.object({
  phone: z.string().min(8, "Numéro trop court"),
  email: z.string().email("Email invalide"),
  address: z.string().optional(),
  city: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  preferredLanguage: z.string(),
  notifEmail: z.boolean(),
  notifSms: z.boolean(),
  notifPush: z.boolean(),
});

export default function Profile() {
  const { data, isLoading } = useGetProfile();
  const updateProfile = useUpdateProfile();
  const { isPreview } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      phone: "",
      email: "",
      address: "",
      city: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      preferredLanguage: "fr",
      notifEmail: true,
      notifSms: true,
      notifPush: true,
    }
  });

  // Init form when data arrives
  if (data?.profile && !form.getValues("email")) {
    const p = data.profile;
    form.reset({
      phone: p.phone,
      email: p.email,
      address: p.address || "",
      city: p.city || "",
      emergencyContactName: p.emergencyContactName || "",
      emergencyContactPhone: p.emergencyContactPhone || "",
      preferredLanguage: p.preferredLanguage,
      notifEmail: p.notifEmail,
      notifSms: p.notifSms,
      notifPush: p.notifPush,
    });
  }

  async function onSubmit(values: z.infer<typeof profileSchema>) {
    try {
      await updateProfile.mutateAsync(values);
      toast.success("Profil mis à jour");
      setIsEditing(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur de mise à jour");
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const p = data?.profile;
  if (!p) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mon Profil</h1>
        <p className="text-muted-foreground">Gérez vos informations personnelles et vos préférences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Identité (Read-only) */}
        <Card className="md:col-span-1 shadow-sm border-border/60 h-fit">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-primary" /> Identité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Nom complet</p>
              <p className="font-medium text-base">{p.firstName} {p.lastName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date de naissance</p>
              <p className="font-medium text-base">
                {p.dateOfBirth ? format(parseISO(p.dateOfBirth), "dd/MM/yyyy") : "-"} 
                <span className="text-xs text-muted-foreground ml-2">({p.gender})</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">N° de dossier (IPP)</p>
              <p className="font-mono bg-muted px-2 py-1 rounded text-sm w-fit mt-1">{p.mrn}</p>
            </div>
            {p.bloodType && (
              <div>
                <p className="text-sm text-muted-foreground">Groupe sanguin</p>
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 font-bold mt-1">
                  {p.bloodType}
                </div>
              </div>
            )}
            
            {(p.allergies?.length || p.chronicConditions?.length) ? (
              <div className="pt-4 border-t border-border mt-4">
                <p className="text-sm font-semibold flex items-center gap-2 mb-2 text-destructive"><AlertCircle className="w-4 h-4"/> Alertes médicales</p>
                {p.allergies && p.allergies.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-muted-foreground">Allergies</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.allergies.map(a => <span key={a} className="bg-red-50 text-red-600 border border-red-200 text-xs px-2 py-0.5 rounded-full">{a}</span>)}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
            
            <div className="bg-primary/5 rounded-lg p-3 text-xs text-primary/80 mt-4 flex items-start gap-2">
              <FileText className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Pour modifier ces informations d'identité, veuillez vous présenter au bureau des admissions.</p>
            </div>
          </CardContent>
        </Card>

        {/* Coordonnées & Préférences (Editable) */}
        <Card className="md:col-span-2 shadow-sm border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="w-4 h-4 text-primary" /> Coordonnées & Préférences
              </CardTitle>
              <CardDescription>Informations de contact et réglages de l'application</CardDescription>
            </div>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} disabled={isPreview}>Modifier</Button>
            )}
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input {...field} disabled={!isEditing} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Téléphone</FormLabel>
                      <FormControl><Input {...field} disabled={!isEditing} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Adresse</FormLabel>
                      <FormControl><Input {...field} disabled={!isEditing} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ville</FormLabel>
                      <FormControl><Input {...field} disabled={!isEditing} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="pt-4 border-t border-border">
                  <h3 className="text-sm font-semibold mb-4">Contact d'urgence</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="emergencyContactName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom</FormLabel>
                        <FormControl><Input {...field} disabled={!isEditing} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="emergencyContactPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone</FormLabel>
                        <FormControl><Input {...field} disabled={!isEditing} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Globe className="w-4 h-4 text-muted-foreground"/> Préférences d'application</h3>
                  <FormField control={form.control} name="preferredLanguage" render={({ field }) => (
                    <FormItem className="max-w-[200px]">
                      <FormLabel>Langue</FormLabel>
                      <Select disabled={!isEditing} onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionnez une langue" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="fr">Français</SelectItem>
                          <SelectItem value="ar">العربية (Arabe)</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="pt-4 border-t border-border">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Bell className="w-4 h-4 text-muted-foreground"/> Notifications</h3>
                  <div className="space-y-4 max-w-sm">
                    <FormField control={form.control} name="notifEmail" render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Emails</FormLabel>
                        </div>
                        <FormControl>
                          <Switch disabled={!isEditing} checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="notifSms" render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">SMS</FormLabel>
                        </div>
                        <FormControl>
                          <Switch disabled={!isEditing} checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )} />
                  </div>
                </div>

                {isEditing && (
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>Annuler</Button>
                    <Button type="submit" disabled={updateProfile.isPending}>
                      {updateProfile.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Enregistrer
                    </Button>
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
