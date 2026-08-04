import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCreateAppointmentRequest } from "@/hooks/use-portal-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function AppointmentRequest() {
  const [, setLocation] = useLocation();
  const createRequest = useCreateAppointmentRequest();
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    requestType: "consultation",
    specialtyRequested: "",
    preferredDate: "",
    preferredTime: "morning",
    reason: ""
  });

  const handleNext = () => setStep(s => s + 1);
  const handlePrev = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    try {
      await createRequest.mutateAsync(formData);
      setStep(4); // Success step
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la demande");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 md:pb-0">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="-ml-2" asChild>
          <Link href="/appointments">
            <ChevronLeft className="w-5 h-5"/>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Demande de rendez-vous</h1>
          <p className="text-muted-foreground text-sm">Nous traiterons votre demande dans les plus brefs délais.</p>
        </div>
      </div>

      {step < 4 && (
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map(i => (
            <div key={i} className={`h-2 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>
      )}

      <Card className="shadow-sm">
        <CardContent className="p-6">
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
              <h2 className="text-xl font-semibold">1. Type de consultation</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Spécialité souhaitée</label>
                  <Select value={formData.specialtyRequested} onValueChange={(v) => setFormData({...formData, specialtyRequested: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez une spécialité" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cardiologie">Cardiologie</SelectItem>
                      <SelectItem value="dermatologie">Dermatologie</SelectItem>
                      <SelectItem value="gastroenterologie">Gastro-entérologie</SelectItem>
                      <SelectItem value="general">Médecine générale</SelectItem>
                      <SelectItem value="pediatrie">Pédiatrie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Motif de la demande</label>
                  <Textarea 
                    placeholder="Décrivez brièvement vos symptômes ou la raison de la consultation..." 
                    className="h-32"
                    value={formData.reason}
                    onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={handleNext} disabled={!formData.specialtyRequested || !formData.reason}>
                  Suivant
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
              <h2 className="text-xl font-semibold">2. Préférences de date</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date souhaitée (optionnel)</label>
                  <Input 
                    type="date" 
                    value={formData.preferredDate}
                    onChange={(e) => setFormData({...formData, preferredDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Créneau horaire préféré</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div 
                      className={`border rounded-lg p-4 cursor-pointer text-center transition-colors ${formData.preferredTime === 'morning' ? 'bg-primary/10 border-primary text-primary' : 'hover:bg-muted'}`}
                      onClick={() => setFormData({...formData, preferredTime: 'morning'})}
                    >
                      Matin (8h-12h)
                    </div>
                    <div 
                      className={`border rounded-lg p-4 cursor-pointer text-center transition-colors ${formData.preferredTime === 'afternoon' ? 'bg-primary/10 border-primary text-primary' : 'hover:bg-muted'}`}
                      onClick={() => setFormData({...formData, preferredTime: 'afternoon'})}
                    >
                      Après-midi (13h-17h)
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={handlePrev}>Retour</Button>
                <Button onClick={handleNext}>Suivant</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
              <h2 className="text-xl font-semibold">3. Confirmation</h2>
              <div className="bg-muted/50 rounded-xl p-5 space-y-4 border border-border/50">
                <div className="grid grid-cols-3 gap-2 border-b pb-3">
                  <span className="text-muted-foreground text-sm col-span-1">Spécialité</span>
                  <span className="font-medium col-span-2 capitalize">{formData.specialtyRequested}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 border-b pb-3">
                  <span className="text-muted-foreground text-sm col-span-1">Date prèf.</span>
                  <span className="font-medium col-span-2">{formData.preferredDate || "Dès que possible"}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 border-b pb-3">
                  <span className="text-muted-foreground text-sm col-span-1">Créneau</span>
                  <span className="font-medium col-span-2">{formData.preferredTime === 'morning' ? 'Matin' : 'Après-midi'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-muted-foreground text-sm col-span-1">Motif</span>
                  <span className="font-medium col-span-2 whitespace-pre-wrap text-sm">{formData.reason}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground bg-primary/5 p-3 rounded-lg border border-primary/10">
                Un agent vous contactera par téléphone ou vous recevrez une notification pour confirmer la date exacte de votre rendez-vous selon nos disponibilités.
              </p>
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={handlePrev} disabled={createRequest.isPending}>Retour</Button>
                <Button onClick={handleSubmit} disabled={createRequest.isPending}>
                  {createRequest.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}
                  Envoyer la demande
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center py-8 space-y-4 animate-in zoom-in-95 fade-in">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold">Demande envoyée !</h2>
              <p className="text-muted-foreground">Votre demande de rendez-vous a bien été enregistrée. Nous vous contacterons très prochainement pour confirmer la date exacte.</p>
              <div className="pt-6">
                <Button className="w-full" asChild>
                  <Link href="/appointments">Retour à mes rendez-vous</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
