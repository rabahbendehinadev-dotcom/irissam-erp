import { Card, CardContent } from "@/components/ui/card";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] w-full flex items-center justify-center">
      <Card className="w-full max-w-md mx-4 shadow-sm border-border/60 text-center py-10">
        <CardContent className="space-y-4 flex flex-col items-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-2">
            <FileQuestion className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Page introuvable</h1>
          <p className="text-muted-foreground mb-6">
            La page que vous recherchez n'existe pas ou a été déplacée.
          </p>
          <Button asChild>
            <Link href="/">Retour à l'accueil</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
