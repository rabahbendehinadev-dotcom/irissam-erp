import { Search, Building, Building2, Layers, LayoutGrid, Wifi, RefreshCcw, Bell, Mail, ChevronDown, Menu, Globe } from "lucide-react";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

export function Topbar({ collapsed, setCollapsed }: { collapsed: boolean, setCollapsed: (val: boolean) => void }) {
  const { t, isRTL, lang, setLang } = useLanguage();

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

        <div className="w-px h-6 bg-gray-200 hidden lg:block"></div>

        {/* Right side items */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-xs">
            <Wifi className="w-3.5 h-3.5 text-green-500" />
            <span className="text-green-500 font-medium">{t("topbar.online")}</span>
            <span className="text-gray-400 mx-1">|</span>
            <span className="text-gray-400">{t("topbar.last_sync")}</span>
            <button className="text-gray-400 hover:text-gray-600 ml-1">
              <RefreshCcw className="w-3.5 h-3.5" />
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

          <div className="w-px h-6 bg-gray-200 hidden sm:block"></div>

          {/* Language Switcher */}
          <div className="relative group hidden sm:block">
            <button className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900">
              <Globe className="w-4 h-4 text-gray-500" />
              <span className="font-medium">{t(`topbar.lang.${lang}` as any)}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg hidden group-hover:block overflow-hidden">
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

          {/* User Profile */}
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
              H
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="text-sm font-bold text-gray-900">Hachichi</div>
              <div className="text-[11px] text-blue-500">{t("topbar.admin")}</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}