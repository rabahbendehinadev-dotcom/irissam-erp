import { Link, useLocation } from "wouter";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import logoPath from "@assets/9e2f711d-0744-437b-a151-78a356a73edf_1785616056682.png";
import { useEffect, useRef, useCallback } from "react";
import {
  LayoutDashboard, Users, Calendar, ClipboardList, AlertTriangle,
  Stethoscope, Bed, Scissors, HeartPulse, Baby, FlaskConical, Scan,
  Pill, Droplets, Package, Microscope, UserCheck, Users2, DollarSign,
  Truck, FolderOpen, BarChart3, Settings, ChevronLeft, Bell, Shield,
  ShieldCheck, BarChart2, FolderArchive
} from "lucide-react";

/** sessionStorage key — kept separate from page scroll keys */
const SIDEBAR_SCROLL_KEY = "irissam_sidebarScrollTop";

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
  /** Mobile only — whether the drawer is open */
  mobileOpen?: boolean;
  /** Mobile only — called to close the drawer */
  onMobileClose?: () => void;
}

export function Sidebar({ collapsed, setCollapsed, mobileOpen = false, onMobileClose }: SidebarProps) {
  const { t, isRTL } = useLanguage();
  const [location] = useLocation();
  const navRef = useRef<HTMLDivElement>(null);

  // ── Scroll persistence ───────────────────────────────────────────────────
  // Restore saved scroll position on every mount (Sidebar remounts on each
  // page navigation because each page renders its own DashboardLayout).
  // If no saved position exists, scroll the active item into view instead.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const saved = sessionStorage.getItem(SIDEBAR_SCROLL_KEY);
    if (saved !== null) {
      el.scrollTop = parseInt(saved, 10);
      // Safety: if the active item ended up off-screen despite the restored
      // position (e.g. list changed), bring it into view without jumping.
      requestAnimationFrame(() => {
        const active = el.querySelector<HTMLElement>('[data-sidebar-active="true"]');
        if (active) {
          const elRect     = el.getBoundingClientRect();
          const itemRect   = active.getBoundingClientRect();
          const isVisible  = itemRect.top >= elRect.top && itemRect.bottom <= elRect.bottom;
          if (!isVisible) active.scrollIntoView({ block: "nearest" });
        }
      });
    } else {
      // First visit — scroll active item into view without snapping to top
      requestAnimationFrame(() => {
        const active = el.querySelector<HTMLElement>('[data-sidebar-active="true"]');
        active?.scrollIntoView({ block: "nearest" });
      });
    }
  }, []); // run once on mount only

  // Save scroll position whenever the user scrolls
  const handleNavScroll = useCallback(() => {
    if (navRef.current) {
      sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(navRef.current.scrollTop));
    }
  }, []);

  // Also save on unmount (catches the case where the user never scrolled)
  useEffect(() => {
    return () => {
      if (navRef.current) {
        sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(navRef.current.scrollTop));
      }
    };
  }, []);
  // ────────────────────────────────────────────────────────────────────────

  // Close on navigation (mobile) — intentionally does NOT reset scroll
  useEffect(() => {
    if (onMobileClose) onMobileClose();
  }, [location]); // eslint-disable-line react-hooks/exhaustive-deps

  const navGroups = [
    {
      label: "nav.group.patient",
      items: [
        { path: "/",               icon: LayoutDashboard, label: "nav.dashboard" },
        { path: "/patients",       icon: Users,           label: "nav.patients" },
        { path: "/appointments",   icon: Calendar,        label: "nav.appointments" },
        { path: "/admissions",     icon: ClipboardList,   label: "nav.admissions" },
        { path: "/emergencies",    icon: AlertTriangle,   label: "nav.emergencies" },
        { path: "/alerts",         icon: Bell,            label: "nav.alerts" },
        { path: "/consultations",  icon: Stethoscope,     label: "nav.consultations" },
        { path: "/hospitalization",icon: Bed,             label: "nav.hospitalization" },
      ]
    },
    {
      label: "nav.group.clinical",
      items: [
        { path: "/operating-room", icon: Scissors,   label: "nav.operating_room" },
        { path: "/resuscitation",  icon: HeartPulse, label: "nav.resuscitation" },
        { path: "/maternity",      icon: Baby,       label: "nav.maternity" },
      ]
    },
    {
      label: "nav.group.medtech",
      items: [
        { path: "/laboratory",    icon: FlaskConical, label: "nav.laboratory" },
        { path: "/imaging",       icon: Scan,         label: "nav.imaging" },
        { path: "/pharmacy",      icon: Pill,         label: "nav.pharmacy" },
        { path: "/blood-bank",    icon: Droplets,     label: "nav.blood_bank" },
        { path: "/medical-stock", icon: Package,      label: "nav.medical_stock" },
        { path: "/biomedical",    icon: Microscope,   label: "nav.biomedical" },
      ]
    },
    {
      label: "nav.group.documents",
      items: [
        { path: "/documents", icon: FolderArchive, label: "nav.documents" },
      ]
    },
    {
      label: "nav.group.executive",
      items: [
        { path: "/executive-dashboard", icon: BarChart2,   label: "nav.executive" },
      ]
    },
    {
      label: "nav.group.quality",
      items: [
        { path: "/quality", icon: ShieldCheck, label: "nav.quality" },
      ]
    },
    {
      label: "nav.group.insurance",
      items: [
        { path: "/insurance", icon: Shield, label: "nav.insurance" },
      ]
    },
    {
      label: "nav.group.admin",
      items: [
        { path: "/doctors",   icon: UserCheck, label: "nav.doctors" },
        { path: "/hr",        icon: Users2,    label: "nav.hr" },
        { path: "/finance",   icon: DollarSign,label: "nav.finance" },
        { path: "/ambulances",icon: Truck,     label: "nav.ambulances" },
        { path: "/archives",  icon: FolderOpen,label: "nav.archives" },
        { path: "/reports",   icon: BarChart3, label: "nav.reports" },
        { path: "/settings",  icon: Settings,  label: "nav.settings" },
      ]
    }
  ];

  return (
    <aside
      className={cn(
        "fixed inset-y-0 z-40 flex flex-col bg-[#1B2A4A] text-white transition-transform duration-300",
        collapsed ? "lg:w-16" : "lg:w-[220px]",
        "w-[min(85vw,320px)] sm:w-[300px]",
        isRTL ? "right-0" : "left-0",
        // Mobile: slide in/out. Desktop: always visible.
        !isRTL && (mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"),
        isRTL  && (mobileOpen ? "translate-x-0" :  "translate-x-full lg:translate-x-0"),
      )}
      // Sidebar spans full height including behind status bar; header pushes content down
      style={{ touchAction: "pan-y" }}
    >
      {/* Header — padded for iOS status bar / Dynamic Island */}
      <div
        className="flex items-center justify-between px-3 border-b border-white/10 shrink-0"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          minHeight: "calc(3.5rem + env(safe-area-inset-top))",
        }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <img src={logoPath} alt="Logo" className="w-8 h-8 rounded shrink-0 object-contain bg-white p-0.5" />
          {/* Always show name on mobile (not collapsed), hide when collapsed on desktop */}
          <span className={cn(
            "font-bold text-xs uppercase leading-tight text-white whitespace-nowrap",
            collapsed && "lg:hidden"
          )}>
            IRISSAM HOSPITAL<br />ERP
          </span>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "text-white/70 hover:text-white shrink-0 hidden lg:block",
            collapsed && "mx-auto"
          )}
        >
          <ChevronLeft className={cn("w-5 h-5 transition-transform", collapsed && (isRTL ? "-rotate-180" : "rotate-180"))} />
        </button>
      </div>

      {/* Nav — iOS-safe scrollable container
          - overflowY: scroll (not auto) : more reliable on iOS Safari
          - WebkitOverflowScrolling: touch : momentum scroll on iPhone
          - overscrollBehavior: contain : stops scroll bleeding to background page
          - paddingBottom: safe-area-inset-bottom : clears home indicator bar
      */}
      <div
        ref={navRef}
        onScroll={handleNavScroll}
        className="flex-1 py-4 scrollbar-hide"
        style={{
          overflowY: "scroll",
          WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
          overscrollBehavior: "contain",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        {navGroups.map((group, i) => (
          <div key={i} className="mb-6">
            {!collapsed && (
              <h3 className="px-4 mb-2 text-[10px] font-bold text-white/50 uppercase tracking-wider lg:block">
                {t(group.label as any)}
              </h3>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item, j) => {
                const isActive = location === item.path ||
                  (item.path !== "/" && location.startsWith(item.path));
                return (
                  <li key={j}>
                    <Link href={item.path}>
                      <span
                        data-sidebar-active={isActive ? "true" : undefined}
                        className={cn(
                        "flex items-center gap-3 px-4 py-2.5 lg:py-2 text-sm transition-colors relative min-h-[44px] lg:min-h-0",
                        collapsed ? "lg:justify-center" : "justify-start",
                        isActive
                          ? "bg-blue-600 text-white font-medium"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      )}>
                        {isActive && (
                          <span className={cn(
                            "absolute top-0 bottom-0 w-1 bg-white",
                            isRTL ? "right-0" : "left-0",
                            collapsed && "lg:hidden"
                          )} />
                        )}
                        <item.icon className="w-[18px] h-[18px] shrink-0" />
                        <span className={cn("truncate", collapsed && "lg:hidden")}>
                          {t(item.label as any)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer collapse button (desktop only) */}
      <div className="p-3 border-t border-white/10 shrink-0 hidden lg:block">
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
