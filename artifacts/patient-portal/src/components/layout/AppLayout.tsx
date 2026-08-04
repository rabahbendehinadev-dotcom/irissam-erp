import React, { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useGetDashboard } from "@/hooks/use-portal-api";
import { 
  Home, Calendar, FileText, Receipt, User, 
  Bell, Menu, LogOut, FileSearch, Pill, Stethoscope, Briefcase, ShieldAlert, FileClock, Shield, Laptop, MessageSquare
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { patient, isAuthenticated, isLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { data: dashboardData } = useGetDashboard();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (patient?.preferredLanguage === "ar") {
      document.documentElement.dir = "rtl";
      document.documentElement.lang = "ar";
    } else {
      document.documentElement.dir = "ltr";
      document.documentElement.lang = patient?.preferredLanguage || "fr";
    }
  }, [patient?.preferredLanguage]);

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
  }

  const unreadCount = dashboardData?.unreadNotifications || 0;

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <div className="flex flex-col gap-1 w-full">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-4 px-3">Principal</div>
      <NavLink href="/" icon={Home} label="Tableau de bord" onClick={onClick} />
      <NavLink href="/appointments" icon={Calendar} label="Rendez-vous" onClick={onClick} />
      <NavLink href="/lab-results" icon={FileSearch} label="Analyses" onClick={onClick} />
      <NavLink href="/imaging" icon={FileClock} label="Imagerie" onClick={onClick} />
      <NavLink href="/prescriptions" icon={Pill} label="Ordonnances" onClick={onClick} />
      
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-6 px-3">Dossier Médical</div>
      <NavLink href="/hospitalizations" icon={Stethoscope} label="Hospitalisations" onClick={onClick} />
      <NavLink href="/documents" icon={FileText} label="Documents" onClick={onClick} />
      <NavLink href="/consents" icon={ShieldAlert} label="Consentements" onClick={onClick} />
      
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-6 px-3">Administratif</div>
      <NavLink href="/invoices" icon={Receipt} label="Factures & Paiements" onClick={onClick} />
      <NavLink href="/insurance" icon={Briefcase} label="Assurances" onClick={onClick} />
      
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-6 px-3">Compte</div>
      <NavLink href="/messages" icon={MessageSquare} label="Messages" onClick={onClick} />
      <NavLink href="/profile" icon={User} label="Profil & Préférences" onClick={onClick} />
      <NavLink href="/sessions" icon={Laptop} label="Appareils" onClick={onClick} />
      <NavLink href="/privacy" icon={Shield} label="Confidentialité" onClick={onClick} />
    </div>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-card border-e border-border h-screen sticky top-0 z-20">
        <div className="p-6 pb-2">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl group-hover:scale-105 transition-transform shadow-sm">
              I
            </div>
            <div>
              <h1 className="font-bold text-xl leading-none text-card-foreground">IRISSAM</h1>
              <p className="text-xs text-muted-foreground font-medium mt-1">Portail Patient</p>
            </div>
          </Link>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 py-4 no-scrollbar">
          <NavLinks />
        </div>

        <div className="p-4 border-t border-border bg-card/50">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="w-10 h-10 border border-border">
              <AvatarImage src="" />
              <AvatarFallback className="bg-primary/10 text-primary">{patient?.firstName?.[0]}{patient?.lastName?.[0]}</AvatarFallback>
            </Avatar>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-medium text-card-foreground truncate">{patient?.firstName} {patient?.lastName}</p>
              <p className="text-xs text-muted-foreground truncate">{patient?.mrn}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-[100dvh] md:min-h-screen relative w-full overflow-x-hidden">
        {/* Topbar (Mobile & Desktop) */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border h-16 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3 md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 flex flex-col">
                <SheetHeader className="p-6 pb-2 text-left border-b border-border">
                  <SheetTitle className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      I
                    </div>
                    <div>
                      <span className="font-bold text-lg">IRISSAM</span>
                      <span className="text-xs text-muted-foreground block font-normal">Portail Patient</span>
                    </div>
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <NavLinks />
                </div>
              </SheetContent>
            </Sheet>
            
            <div className="font-bold text-lg text-primary md:hidden">IRISSAM</div>
          </div>
          
          <div className="hidden md:flex flex-col">
            <span className="text-sm font-medium text-foreground">Bonjour, {patient?.firstName} {patient?.lastName}</span>
            <span className="text-xs text-muted-foreground">Bienvenue sur votre espace patient</span>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/notifications" className="relative p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border-2 border-background" />
              )}
            </Link>
            
            <Link href="/profile" className="md:hidden">
              <div className="rounded-full overflow-hidden border border-border w-8 h-8 flex items-center justify-center bg-primary/10 text-primary text-xs font-medium">
                {patient?.firstName?.[0]}
              </div>
            </Link>
          </div>
        </header>

        {/* Content wrapper */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          <div className="max-w-5xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border pb-safe z-20 flex justify-around items-center h-16 px-2 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
        <BottomNavItem href="/" icon={Home} label="Accueil" />
        <BottomNavItem href="/appointments" icon={Calendar} label="RDV" />
        <BottomNavItem href="/lab-results" icon={FileSearch} label="Résultats" />
        <BottomNavItem href="/invoices" icon={Receipt} label="Factures" />
        <BottomNavItem href="/profile" icon={User} label="Profil" />
      </nav>
    </div>
  );
}

function NavLink({ href, icon: Icon, label, onClick }: { href: string; icon: any; label: string; onClick?: () => void }) {
  const [location] = useLocation();
  const isActive = location === href || (href !== "/" && location.startsWith(href));

  return (
    <Link href={href} onClick={onClick}>
      <span className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
        isActive 
          ? "bg-primary/10 text-primary" 
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}>
        <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
        {label}
      </span>
    </Link>
  );
}

function BottomNavItem({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  const [location] = useLocation();
  const isActive = location === href || (href !== "/" && location.startsWith(href));

  return (
    <Link href={href}>
      <span className="flex flex-col items-center justify-center w-16 h-full gap-1 active:scale-95 transition-transform">
        <div className={`p-1.5 rounded-full transition-colors ${isActive ? 'bg-primary/15' : 'bg-transparent'}`}>
          <Icon className={`w-5 h-5 ${isActive ? "text-primary fill-primary/20" : "text-muted-foreground"}`} />
        </div>
        <span className={`text-[10px] font-medium leading-none ${isActive ? "text-primary" : "text-muted-foreground"}`}>
          {label}
        </span>
      </span>
    </Link>
  );
}
