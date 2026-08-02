import { Search, Building, Building2, Layers, LayoutGrid, Wifi, RefreshCcw, Bell, Mail, ChevronDown, Menu, Globe, LogOut, User } from "lucide-react";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/store/AuthContext";
import { useDashboardRefresh } from "@/store/DashboardRefreshContext";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import type { UserRole } from "@/types";

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin:    "Super Administrateur",
  administrator:  "Administrateur",
  director:       "Directeur",
  doctor:         "Médecin",
  nurse:          "Infirmier",
  pharmacist:     "Pharmacien",
  laboratory:     "Laboratoire",
  radiology:      "Radiologie",
  administrateur: "Administrateur",
  directeur: "Directeur",
  medecin: "Médecin",
  infirmier: "Infirmier",
  reception: "Réception",
  laboratoire: "Laboratoire",
  radiologie: "Radiologie",
  pharmacie: "Pharmacie",
  finance: "Caissier / Finance",
  rh: "Ressources Humaines",
};

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin:    "bg-red-100 text-red-700",
  administrator:  "bg-blue-100 text-blue-700",
  director:       "bg-indigo-100 text-indigo-700",
  doctor:         "bg-emerald-100 text-emerald-700",
  nurse:          "bg-teal-100 text-teal-700",
  pharmacist:     "bg-yellow-100 text-yellow-700",
  laboratory:     "bg-purple-100 text-purple-700",
  radiology:      "bg-pink-100 text-pink-700",
  administrateur: "bg-blue-100 text-blue-700",
  directeur: "bg-indigo-100 text-indigo-700",
  medecin: "bg-emerald-100 text-emerald-700",
  infirmier: "bg-teal-100 text-teal-700",
  reception: "bg-orange-100 text-orange-700",
  laboratoire: "bg-purple-100 text-purple-700",
  radiologie: "bg-pink-100 text-pink-700",
  pharmacie: "bg-yellow-100 text-yellow-700",
  finance: "bg-violet-100 text-violet-700",
  rh: "bg-gray-100 text-gray-700",
};

const AVATAR_BG: Record<UserRole, string> = {
  super_admin:    "bg-red-600",
  administrator:  "bg-blue-600",
  director:       "bg-indigo-600",
  doctor:         "bg-emerald-600",
  nurse:          "bg-teal-600",
  pharmacist:     "bg-yellow-500",
  laboratory:     "bg-purple-600",
  radiology:      "bg-pink-600",
  administrateur: "bg-blue-600",
  directeur: "bg-indigo-600",
  medecin: "bg-emerald-600",
  infirmier: "bg-teal-600",
  reception: "bg-orange-600",
  laboratoire: "bg-purple-600",
  radiologie: "bg-pink-600",
  pharmacie: "bg-yellow-500",
  finance: "bg-violet-600",
  rh: "bg-gray-600",
};

function fmtSyncTime(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function Topbar({ collapsed, setCollapsed }: { collapsed: boolean, setCollapsed: (val: boolean) => void }) {
  const { t, isRTL, lang, setLang } = useLanguage();
  const { user, logout } = useAuth();
  const { lastSyncAt, isRefreshing, refreshAll } = useDashboardRefresh();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : "?";
  const displayName = user ? `${user.firstName} ${user.lastName}` : "";
  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role) : "";
  const avatarBg = user ? (AVATAR_BG[user.role] ?? "bg-blue-600") : "bg-gray-400";
  const roleBadge = user ? (ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-700") : "";

  return (
    <header
      className={cn(
        "h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 fixed top-0 z-10 transition-all duration-300",
        isRTL ? (collapsed ? "right-16" : "right-[220px]") : (collapsed ? "left-16" : "left-[220px]"),
        isRTL ? "left-0" : "right-0"
      )}
    >
      <div className="flex items-center gap-4 flex-1">
        <button
          className="md:hidden text-gray-500"
          onClick={() => setCollapsed(!collapsed)}
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full max-w-md hidden sm:block">
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

      <div className="flex items-center gap-6">
        {/* Filters */}
        <div className="hidden lg:flex items-center gap-4 text-sm text-gray-600">
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

        <div className="w-px h-6 bg-gray-200 hidden lg:block" />

        {/* Right side items */}
        <div className="flex items-center gap-4">
          {/* Online + last sync + manual refresh */}
          <div className="hidden md:flex items-center gap-2 text-xs">
            <Wifi className="w-3.5 h-3.5 text-green-500" />
            <span className="text-green-500 font-medium">{t("topbar.online")}</span>
            <span className="text-gray-400 mx-1">|</span>
            <span className="text-gray-400">{t("topbar.last_sync")}</span>
            <span className="text-gray-500 font-medium tabular-nums">{fmtSyncTime(lastSyncAt)}</span>
            <button
              onClick={refreshAll}
              disabled={isRefreshing}
              title="Actualiser maintenant"
              className={cn(
                "text-gray-400 hover:text-blue-500 ml-1 transition-colors",
                isRefreshing && "text-blue-400 cursor-not-allowed"
              )}
            >
              <RefreshCcw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative text-gray-500 hover:text-gray-700">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full text-[8px] text-white flex items-center justify-center font-bold">
                1
              </span>
            </button>
            <button className="relative text-gray-500 hover:text-gray-700">
              <Mail className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full text-[8px] text-white flex items-center justify-center font-bold">
                2
              </span>
            </button>
          </div>

          <div className="w-px h-6 bg-gray-200 hidden sm:block" />

          {/* Language Switcher */}
          <div className="relative group hidden sm:block">
            <button className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900">
              <Globe className="w-4 h-4 text-gray-500" />
              <span className="font-medium">{t(`topbar.lang.${lang}` as any)}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg hidden group-hover:block overflow-hidden z-50">
              <button onClick={() => setLang('fr')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-gray-400" /> {t('topbar.lang.fr')}
              </button>
              <button onClick={() => setLang('en')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-gray-400" /> {t('topbar.lang.en')}
              </button>
              <button onClick={() => setLang('ar')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-gray-400" /> {t('topbar.lang.ar')}
              </button>
            </div>
          </div>

          {/* User Profile with dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(prev => !prev)}
              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
            >
              <div className={cn("w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-sm flex-shrink-0", avatarBg)}>
                {initials}
              </div>
              <div className="hidden sm:block leading-tight text-left">
                <div className="text-sm font-bold text-gray-900">{displayName || "…"}</div>
                <div className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block", roleBadge)}>
                  {roleLabel}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                {/* User info header */}
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

                {/* Menu items */}
                <div className="py-1">
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <User className="w-4 h-4 text-gray-400" />
                    Mon profil
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => { setProfileOpen(false); void logout(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Se déconnecter
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
