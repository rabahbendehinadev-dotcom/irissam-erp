import { useGetLabResult } from "@/hooks/use-portal-api";
import { Link, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, Loader2, TestTube2, Download, Printer, AlertTriangle } from "lucide-react";

export default function LabResultDetail() {
  const params = useParams();
  const id = params.id || "";
  const { data, isLoading } = useGetLabResult(id);

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!data?.labResult) return <div>Résultat introuvable</div>;

  const res = data.labResult;
  // Type assertion for mock results
  const resultsData = res.results as Array<{name: string, value: string, unit: string, range: string, flag?: string}>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="-ml-2" asChild>
            <Link href="/lab-results">
              <ChevronLeft className="w-5 h-5"/>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{res.testType}</h1>
            <p className="text-muted-foreground text-sm">N° {res.orderNumber} • Publié le {format(parseISO(res.publishedAt), "dd/MM/yyyy")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Printer className="w-4 h-4 mr-2" /> Imprimer</Button>
          <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" /> PDF</Button>
        </div>
      </div>

      {res.patientVisibleNote && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex gap-3 text-primary-foreground">
          <p className="text-sm">{res.patientVisibleNote}</p>
        </div>
      )}

      <Card className="shadow-sm border-border/60 overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/50">
          <CardTitle className="text-base flex items-center gap-2">
            <TestTube2 className="w-5 h-5 text-blue-500" /> Détail des analyses
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/10 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium">Analyse</th>
                  <th className="px-6 py-4 font-medium">Résultat</th>
                  <th className="px-6 py-4 font-medium">Valeurs de référence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {Array.isArray(resultsData) ? resultsData.map((item, i) => (
                  <tr key={i} className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-4 font-medium">{item.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${item.flag ? 'text-destructive' : ''}`}>
                          {item.value} {item.unit}
                        </span>
                        {item.flag && (
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{item.range} {item.unit}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} className="px-6 py-4">Détails non disponibles sous format tabulaire.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {res.resultSummary && (
        <Card className="shadow-sm border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Conclusion / Synthèse</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{res.resultSummary}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
