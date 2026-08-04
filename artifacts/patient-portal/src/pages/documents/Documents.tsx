import { useGetDocuments } from "@/hooks/use-portal-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { FileText, Download, Loader2 } from "lucide-react";

export default function Documents() {
  const { data, isLoading } = useGetDocuments();

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const documents = data?.documents || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">Certificats médicaux, correspondances et autres documents.</p>
      </div>

      {documents.length === 0 ? (
        <div className="text-center p-12 border border-dashed rounded-xl bg-muted/20">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium">Aucun document</h3>
          <p className="text-muted-foreground">Vous n'avez aucun document dans votre dossier.</p>
        </div>
      ) : (
        <div className="grid gap-3 max-w-3xl">
          {documents.map((doc) => (
            <Card key={doc.id} className="shadow-sm border-border/60 hover:bg-muted/10 transition-colors">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{doc.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {format(parseISO(doc.createdAt), "d MMMM yyyy", { locale: fr })} • {doc.category}
                    </p>
                    {doc.description && (
                      <p className="text-xs text-muted-foreground mt-1">{doc.description}</p>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" title="Télécharger">
                  <Download className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}