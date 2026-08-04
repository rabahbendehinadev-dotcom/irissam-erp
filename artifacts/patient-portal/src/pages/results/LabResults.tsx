import { useGetLabResults } from "@/hooks/use-portal-api";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { FileSearch, ChevronRight, Loader2, TestTube2, AlertCircle } from "lucide-react";

export default function LabResults() {
  const { data, isLoading } = useGetLabResults();
  
  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const results = data?.labResults || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Résultats d'analyses</h1>
        <p className="text-muted-foreground">Consultez vos bilans sanguins et autres examens de laboratoire.</p>
      </div>

      {results.length === 0 ? (
        <div className="text-center p-12 border border-dashed rounded-xl bg-muted/20">
          <TestTube2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium">Aucun résultat</h3>
          <p className="text-muted-foreground">Vous n'avez aucun résultat d'analyse publié pour le moment.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {results.map((res) => (
            <Link key={res.id} href={`/lab-results/${res.id}`}>
              <Card className="shadow-sm border-border/60 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
                <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className="hidden sm:flex w-12 h-12 rounded-xl bg-blue-50 text-blue-600 items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <TestTube2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">{res.testType}</h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileSearch className="w-3.5 h-3.5" /> N° {res.orderNumber}
                        </span>
                        <span>
                          Publié le {format(parseISO(res.publishedAt), "d MMMM yyyy", { locale: fr })}
                        </span>
                        {res.requestingDoctorName && (
                          <span>Prescrit par {res.requestingDoctorName}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4 flex gap-3 text-amber-800 dark:text-amber-200">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold mb-1">Interprétation des résultats</p>
          <p>Ces résultats vous sont communiqués à titre d'information. Seul votre médecin traitant est habilité à les interpréter et à poser un diagnostic. En cas de doute, veuillez le consulter.</p>
        </div>
      </div>
    </div>
  );
}
