import {
  Search, Building, Building2, Layers, LayoutGrid, Wifi, RefreshCcw,
  Bell, Mail, ChevronDown, Menu, Globe, LogOut, User, Download,
  X, SlidersHorizontal, WifiOff,
} from "lucide-react";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/store/AuthContext";
import { useDashboardRefresh } from "@/store/DashboardRefreshContext";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import type { UserRole } from "@/types";

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Administrateur", administrator: "Administrateur",
  director: "Directeur", doctor: "Médecin", nurse: "Infirmier",
  pharmacist: "Pharmacien", laboratory: "Laboratoire", radiology: "Radiologie",
  administrateur: "Administrateur", directeur: "Directeur", medecin: "Médecin",
  infirmier: "Infirmier", reception: "Réception", laboratoire: "Laboratoire",
  radiologie: "Radiologie", pharmacie: "Pharmacie", finance: "Caissier / Finance",
  rh: "Ressources Humaines",
};

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: "bg-red-100 text-red-700", administrator: "bg-blue-100 text-blue-700",
  director: "bg-indigo-100 text-indigo-700", doctor: "bg-emerald-100 text-emerald-700",
  nurse: "bg-teal-100 text-teal-700", pharmacist: "bg-yellow-100 text-yellow-700",
  laboratory: "bg-purple-100 text-purple-700", radiology: "bg-pink-100 text-pink-700",
  administrateur: "bg-blue-100 text-blue-700", directeur: "bg-indigo-100 text-indigo-700",
  medecin: "bg-emerald-100 text-emerald-700", infirmier: "bg-teal-100 text-teal-700",
  reception: "bg-orange-100 text-orange-700", laboratoire: "bg-purple-100 text-purple-700",
  radiologie: "bg-pink-100 text-pink-700", pharmacie: "bg-yellow-100 text-yellow-700",
  finance: "bg-violet-100 text-violet-700", rh: "bg-gray-100 text-gray-700",
};

const AVATAR_BG: Record<UserRole, string> = {
  super_admin: "bg-red-600", administrator: "bg-blue-600", director: "bg-indigo-600",
  doctor: "bg-emerald-600", nurse: "bg-teal-600", pharmacist: "bg-yellow-500",
  laboratory: "bg-purple-600", radiology: "bg-pink-600", administrateur: "bg-blue-600",
  directeur: "bg-indigo-600", medecin: "bg-emerald-600", infirmier: "bg-teal-600",
  reception: "bg-orange-600", laboratoire: "bg-purple-600", radiologie: "bg-pink-600",
  pharmacie: "bg-yellow-500", finance: "bg-violet-600", rh: "bg-gray-600",
};

function fmtSyncTime(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

interface TopbarProps {
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
  onMobileMenuToggle: () => void;
}

export function Topbar({ collapsed, setCollapsed, onMobileMenuToggle }: TopbarProps) {
  const { t, isRTL, lang, setLang } = useLanguage();
  const { user, logout } = useAuth();
  const { lastSyncAt, isRefreshing, refreshAll } = useDashboardRefresh();
  const { canInstall, install, isStandalone } = usePWAInstall();

  const [profileOpen,   setProfileOpen]   = useState(false);
  const [searchOpen,    setSearchOpen]     = useState(false);
  const [filtersOpen,   setFiltersOpen]    = useState(false);
  const [isOnline,      setIsOnline]       = useState(navigator.onLine);

  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Track online/offline
  useEffect(() => {
    const off = () => setIsOnline(false);
    const on  = () => setIsOnline(true);
    window.addEventListener("offline", off);
    window.addEventListener("online",  on);
    return () => { window.removeEventListener("offline", off); window.removeEventListener("online", on); };
  }, []);

  // Focus search input when overlay opens
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [searchOpen]);

  const initials    = user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() : "?";
  const displayName = user ? `${user.firstName} ${user.lastName}` : "";
  const roleLabel   = user ? (ROLE_LABELS[user.role] ?? user.role) : "";
  const avatarBg    = user ? (AVATAR_BG[user.role] ?? "bg-blue-600") : "bg-gray-400";
  const roleBadge   = user ? (ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-700") : "";

  return (
    <>
      {/* ── Main topbar ────────────────────────────────────────────────── */}
      <header
        className={cn(
          "h-14 bg-white border-b border-gray-200 flex items-center justify-between px-3 sm:px-4 fixed top-0 z-20 transition-all duration-300",
          // Left edge on desktop: offset by sidebar
          isRTL
            ? (collapsed ? "lg:right-16" : "lg:right-[220px]")
            : (collapsed ? "lg:left-16" : "lg:left-[220px]"),
          isRTL ? "left-0 right-0 lg:right-auto" : "left-0 right-0 lg:left-auto"
        )}
      >
        {/* Left: hamburger (mobile) + search (desktop) */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Hamburger — mobile/tablet only */}
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700 p-2 -ml-2 rounded-lg touch-target"
            onClick={onMobileMenuToggle}
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search bar — desktop only */}
          <div className="relative w-full max-w-xs hidden lg:block">
            <Search className={cn("w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2", isRTL ? "right-3" : "left-3")} />
            <input
              type="text"
              placeholder={t("topbar.search")}
              className={cn(
                "w-full h-9 bg-gray-50 border border-gray-200 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500",
                isRTL ? "pr-9 pl-12" : "pl-9 pr-12"
              )}
            />
            <div className={cn("absolute top-1/2 -translate-y-1/2 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[10px] text-gray-400 font-medium", isRTL ? "left-2" : "right-2")}>
              ⌘K
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Search icon — mobile only */}
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700 p-2 rounded-lg touch-target"
            onClick={() => setSearchOpen(true)}
            aria-label="Rechercher"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Desktop filters */}
          <div className="hidden lg:flex items-center gap-3 text-sm text-gray-600 mr-2">
            <button className="flex items-center gap-1.5 hover:text-gray-900">
              <Building className="w-4 h-4" />
              <span className="font-medium">{t("topbar.site")}</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>
            <button className="flex items-center gap-1.5 hover:text-gray-900">
              <Building2 className="w-4 h-4" />
              <span>{t("topbar.building")}</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>
            <button className="flex items-center gap-1.5 hover:text-gray-900">
              <Layers className="w-4 h-4" />
              <span>{t("topbar.floor")}</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>
            <button className="flex items-center gap-1.5 hover:text-gray-900">
              <LayoutGrid className="w-4 h-4" />
              <span>{t("topbar.departments")}</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>
          </div>

          {/* Filters icon — tablet only */}
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700 p-2 rounded-lg touch-target hidden sm:flex"
            onClick={() => setFiltersOpen(true)}
            aria-label="Filtres"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>

          <div className="hidden lg:block w-px h-6 bg-gray-200 mx-1" />

          {/* Online status + sync — desktop only */}
          <div className="hidden lg:flex items-center gap-2 text-xs">
            {isOnline
              ? <Wifi className="w-3.5 h-3.5 text-green-500" />
              : <WifiOff className="w-3.5 h-3.5 text-red-500" />}
            <span className={isOnline ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
              {isOnline ? t("topbar.online") : "Hors ligne"}
            </span>
            {isOnline && (
              <>
                <span className="text-gray-400 mx-0.5">|</span>
                <span className="text-gray-400">{t("topbar.last_sync")}</span>
                <span className="text-gray-500 font-medium tabular-nums">{fmtSyncTime(lastSyncAt)}</span>
                <button
                  onClick={refreshAll} disabled={isRefreshing}
                  className={cn("text-gray-400 hover:text-blue-500 ml-0.5", isRefreshing && "text-blue-400 cursor-not-allowed")}
                >
                  <RefreshCcw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
                </button>
              </>
            )}
          </div>

          {/* Install App button — Android/Desktop */}
          {canInstall && !isStandalone && (
            <button
              onClick={install}
              className="hidden sm:flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors touch-target"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Installer</span>
            </button>
          )}

          {/* Notifications */}
          <button className="relative text-gray-500 hover:text-gray-700 p-2 rounded-lg touch-target">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 border border-white rounded-full" />
          </button>
          <button className="relative text-gray-500 hover:text-gray-700 p-2 rounded-lg touch-target hidden sm:flex">
            <Mail className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 border border-white rounded-full" />
          </button>

          {/* Language — desktop only */}
          <div className="relative group hidden lg:block">
            <button className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 p-2">
              <Globe className="w-4 h-4 text-gray-500" />
              <span className="font-medium">{t(`topbar.lang.${lang}` as any)}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg hidden group-hover:block overflow-hidden z-50">
              <button onClick={() => setLang('fr')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">🇫🇷 Français</button>
              <button onClick={() => setLang('en')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">🇬🇧 English</button>
              <button onClick={() => setLang('ar')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">🇩🇿 عربية</button>
            </div>
          </div>

          {/* User profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(prev => !prev)}
              className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors touch-target"
            >
              <div className={cn("w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-sm flex-shrink-0", avatarBg)}>
                {initials}
              </div>
              <div className="hidden sm:block leading-tight text-left">
                <div className="text-sm font-bold text-gray-900 max-w-[120px] truncate">{displayName || "…"}</div>
                <div className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block", roleBadge)}>
                  {roleLabel}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-60 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                {/* User info */}
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm flex-shrink-0", avatarBg)}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block mt-0.5", roleBadge)}>
                        {roleLabel}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="py-1">
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <User className="w-4 h-4 text-gray-400" /> Mon profil
                  </button>

                  {/* Language — mobile only inside menu */}
                  <div className="lg:hidden border-t border-gray-100 mt-1 pt-1">
                    <p className="px-4 py-1.5 text-xs text-gray-400 font-medium uppercase tracking-wide">Langue</p>
                    <button onClick={() => { setLang('fr'); setProfileOpen(false); }} className={cn("w-full text-left px-4 py-2 text-sm", lang === 'fr' && "font-semibold text-blue-600")}>🇫🇷 Français</button>
                    <button onClick={() => { setLang('en'); setProfileOpen(false); }} className={cn("w-full text-left px-4 py-2 text-sm", lang === 'en' && "font-semibold text-blue-600")}>🇬🇧 English</button>
                    <button onClick={() => { setLang('ar'); setProfileOpen(false); }} className={cn("w-full text-left px-4 py-2 text-sm", lang === 'ar' && "font-semibold text-blue-600")}>🇩🇿 عربية</button>
                  </div>

                  {/* Install — mobile inside menu */}
                  {canInstall && !isStandalone && (
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button
                        onClick={() => { void install(); setProfileOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50"
                      >
                        <Download className="w-4 h-4" /> Installer l'application
                      </button>
                    </div>
                  )}

                  <div className="border-t border-gray-100 mt-1" />
                  <button
                    onClick={() => { setProfileOpen(false); void logout(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" /> Se déconnecter
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Search overlay ─────────────────────────────────────────────── */}
      {searchOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex flex-col lg:hidden" onClick={() => setSearchOpen(false)}>
          <div className="bg-white safe-top" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 h-14 border-b">
              <Search className="w-5 h-5 text-gray-400 shrink-0" />
              <input
                ref={searchRef}
                type="search"
                placeholder="Rechercher un patient, dossier…"
                className="flex-1 h-full text-base outline-none bg-transparent"
                style={{ fontSize: "16px" }}
              />
              <button onClick={() => setSearchOpen(false)} className="p-2 text-gray-500 touch-target">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Filters bottom sheet ───────────────────────────────────────── */}
      {filtersOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end lg:hidden" onClick={() => setFiltersOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-t-2xl safe-bottom p-5 space-y-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-800">Filtres</h3>
              <button onClick={() => setFiltersOpen(false)} className="p-2 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {[
              { icon: Building, label: t("topbar.site") },
              { icon: Building2, label: t("topbar.building") },
              { icon: Layers, label: t("topbar.floor") },
              { icon: LayoutGrid, label: t("topbar.departments") },
            ].map(({ icon: Icon, label }) => (
              <button key={label} className="w-full flex items-center gap-3 px-4 py-3 border rounded-xl text-left text-sm text-gray-700 hover:bg-gray-50">
                <Icon className="w-4 h-4 text-gray-400" />
                <span>{label}</span>
                <ChevronDown className="w-4 h-4 text-gray-300 ml-auto" />
              </button>
            ))}
            {/* Sync status */}
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl text-sm">
              {isOnline ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
              <span className={isOnline ? "text-green-600" : "text-red-600"}>
                {isOnline ? `En ligne · Sync ${fmtSyncTime(lastSyncAt)}` : "Hors ligne"}
              </span>
              {isOnline && (
                <button onClick={() => { void refreshAll(); setFiltersOpen(false); }} className="ml-auto text-blue-500">
                  <RefreshCcw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
