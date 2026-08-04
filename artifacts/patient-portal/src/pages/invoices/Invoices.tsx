import { useGetInvoices } from "@/hooks/use-portal-api";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Receipt, Loader2, Download, CreditCard, ChevronRight } from "lucide-react";

export default function Invoices() {
  const { data, isLoading } = useGetInvoices();

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const invoices = data?.invoices || [];
  const totalDue = data?.totalDue || "0.00";
  const totalPaid = data?.totalPaid || "0.00";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Factures & Paiements</h1>
        <p className="text-muted-foreground">Consultez vos factures et suivez vos paiements.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">Reste à payer</p>
            <p className="text-3xl font-bold text-amber-900 dark:text-amber-100">{totalDue} DZD</p>
            {parseFloat(totalDue) > 0 && (
              <Button className="mt-4 w-full bg-amber-600 hover:bg-amber-700 text-white">
                <CreditCard className="w-4 h-4 mr-2" /> Payer en ligne
              </Button>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground mb-1">Total réglé cette année</p>
            <p className="text-3xl font-bold">{totalPaid} DZD</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-lg font-semibold mt-8 mb-4">Historique des factures</h2>
      
      {invoices.length === 0 ? (
        <div className="text-center p-12 border border-dashed rounded-xl bg-muted/20">
          <Receipt className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">Aucune facture trouvée.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {invoices.map((inv) => (
            <Card key={inv.id} className="shadow-sm border-border/60 hover:border-primary/30 transition-colors">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                    <Receipt className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">Facture {inv.invoiceNumber}</h3>
                      {inv.status === "paid" && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Payée</Badge>}
                      {inv.status === "partial" && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Partielle</Badge>}
                      {inv.status === "unpaid" && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Impayée</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Émise le {format(parseISO(inv.issuedAt), "dd/MM/yyyy")}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-1/3">
                  <div className="text-right">
                    <p className="font-bold">{inv.patientShare} DZD</p>
                    <p className="text-xs text-muted-foreground">Total: {inv.totalAmount} DZD</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" title="Télécharger">
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
