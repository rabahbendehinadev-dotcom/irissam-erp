import { Link, useLocation } from "wouter";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import logoPath from "@assets/9e2f711d-0744-437b-a151-78a356a73edf_1785616056682.png";
import { 
  LayoutDashboard, Users, Calendar, ClipboardList, AlertTriangle, 
  Stethoscope, Bed, Scissors, HeartPulse, Baby, FlaskConical, Scan, 
  Pill, Droplets, Package, Microscope, UserCheck, Users2, DollarSign, 
  Truck, FolderOpen, BarChart3, Settings, ChevronLeft, Bell
} from "lucide-react";

export function Sidebar({ collapsed, setCollapsed }: { collapsed: boolean, setCollapsed: (val: boolean) => void }) {
  const { t, isRTL } = useLanguage();
  const [location] = useLocation();

  const navGroups = [
    {
      label: "nav.group.patient",
      items: [
        { path: "/", icon: LayoutDashboard, label: "nav.dashboard" },
        { path: "/patients", icon: Users, label: "nav.patients" },
        { path: "/appointments", icon: Calendar, label: "nav.appointments" },
        { path: "/admissions", icon: ClipboardList, label: "nav.admissions" },
        { path: "/emergencies", icon: AlertTriangle, label: "nav.emergencies" },
        { path: "/alerts", icon: Bell, label: "nav.alerts" },
        { path: "/consultations", icon: Stethoscope, label: "nav.consultations" },
        { path: "/hospitalization", icon: Bed, label: "nav.hospitalization" },
      ]
    },
    {
      label: "nav.group.clinical",
      items: [
        { path: "/operating-room", icon: Scissors, label: "nav.operating_room" },
        { path: "/resuscitation", icon: HeartPulse, label: "nav.resuscitation" },
        { path: "/maternity", icon: Baby, label: "nav.maternity" },
      ]
    },
    {
      label: "nav.group.medtech",
      items: [
        { path: "/laboratory", icon: FlaskConical, label: "nav.laboratory" },
        { path: "/imaging", icon: Scan, label: "nav.imaging" },
        { path: "/pharmacy", icon: Pill, label: "nav.pharmacy" },
        { path: "/blood-bank", icon: Droplets, label: "nav.blood_bank" },
        { path: "/medical-stock", icon: Package, label: "nav.medical_stock" },
        { path: "/biomedical", icon: Microscope, label: "nav.biomedical" },
      ]
    },
    {
      label: "nav.group.admin",
      items: [
        { path: "/doctors", icon: UserCheck, label: "nav.doctors" },
        { path: "/hr", icon: Users2, label: "nav.hr" },
        { path: "/finance", icon: DollarSign, label: "nav.finance" },
        { path: "/ambulances", icon: Truck, label: "nav.ambulances" },
        { path: "/archives", icon: FolderOpen, label: "nav.archives" },
        { path: "/reports", icon: BarChart3, label: "nav.reports" },
        { path: "/settings", icon: Settings, label: "nav.settings" },
      ]
    }
  ];

  return (
    <aside 
      className={cn(
        "fixed inset-y-0 z-20 flex flex-col bg-[#1B2A4A] text-white transition-all duration-300",
        collapsed ? "w-16" : "w-[220px]",
        isRTL ? "right-0" : "left-0"
      )}
    >
      <div className="flex h-14 items-center justify-between px-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <img src={logoPath} alt="Logo" className="w-8 h-8 rounded shrink-0 object-contain bg-white p-0.5" />
          {!collapsed && (
            <span className="font-bold text-xs uppercase leading-tight text-white whitespace-nowrap">
              IRISSAM HOSPITAL<br/>ERP
            </span>
          )}
        </div>
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "text-white/70 hover:text-white shrink-0 hidden md:block",
            collapsed && "mx-auto"
          )}
        >
          <ChevronLeft className={cn("w-5 h-5 transition-transform", collapsed && (isRTL ? "-rotate-180" : "rotate-180"))} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
        {navGroups.map((group, i) => (
          <div key={i} className="mb-6">
            {!collapsed && (
              <h3 className="px-4 mb-2 text-[10px] font-bold text-white/50 uppercase tracking-wider">
                {t(group.label as any)}
              </h3>
            )}
            <ul className="space-y-1">
              {group.items.map((item, j) => {
                const isActive = location === item.path;
                return (
                  <li key={j}>
                    <Link href={item.path}>
                      <span className={cn(
                        "flex items-center gap-3 px-4 py-2 text-sm transition-colors relative",
                        collapsed ? "justify-center" : "justify-start",
                        isActive 
                          ? "bg-blue-600 text-white font-medium" 
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      )}>
                        {isActive && !collapsed && (
                          <span className={cn(
                            "absolute top-0 bottom-0 w-1 bg-white",
                            isRTL ? "right-0" : "left-0"
                          )} />
                        )}
                        <item.icon className="w-[18px] h-[18px] shrink-0" />
                        {!collapsed && <span className="truncate">{t(item.label as any)}</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-white/10 shrink-0">
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center gap-3 w-full py-2 text-sm text-white/70 hover:text-white transition-colors",
            collapsed ? "justify-center" : "px-1"
          )}
        >
          <ChevronLeft className={cn("w-5 h-5", collapsed && "rotate-180")} />
          {!collapsed && <span>{t("nav.collapse")}</span>}
        </button>
      </div>
    </aside>
  );
}