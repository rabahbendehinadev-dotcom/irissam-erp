import { useGetImaging } from "@/hooks/use-portal-api";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { FileClock, ChevronRight, Loader2 } from "lucide-react";

export default function Imaging() {
  const { data, isLoading } = useGetImaging();
  
  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const results = data?.imagingResults || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Imagerie médicale</h1>
        <p className="text-muted-foreground">Consultez vos comptes-rendus d'examens (Radiologie, IRM, Scanner, etc).</p>
      </div>

      {results.length === 0 ? (
        <div className="text-center p-12 border border-dashed rounded-xl bg-muted/20">
          <FileClock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium">Aucun examen</h3>
          <p className="text-muted-foreground">Vous n'avez aucune imagerie médicale publiée pour le moment.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((res) => (
            <Link key={res.id} href={`/imaging/${res.id}`}>
              <Card className="shadow-sm border-border/60 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group h-full">
                <CardContent className="p-5 flex flex-col h-full justify-between">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <FileClock className="w-6 h-6" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">{res.studyType}</h3>
                    <div className="flex flex-col gap-1 mt-2 text-sm text-muted-foreground">
                      <span>N° {res.orderNumber}</span>
                      <span>{format(parseISO(res.publishedAt), "d MMMM yyyy", { locale: fr })}</span>
                      {res.requestingDoctorName && <span className="truncate">Dr. {res.requestingDoctorName}</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
