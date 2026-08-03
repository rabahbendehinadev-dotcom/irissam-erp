import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import { DashboardRefreshProvider } from "@/store/DashboardRefreshContext";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";

export function DashboardLayout({ children, noPadding = false }: { children: React.ReactNode; noPadding?: boolean }) {
  const [collapsed, setCollapsed]       = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { isRTL } = useLanguage();

  // Close sidebar on route change (handled inside Sidebar via onClose callback)

  // iOS-safe scroll lock:
  // Setting overflow:hidden on <body> freezes ALL touch scrolling on iOS,
  // including inside fixed elements like the sidebar drawer.
  // Instead, we use position:fixed + top offset which freezes the background
  // page WITHOUT touching fixed-position children's scroll.
  useEffect(() => {
    if (mobileSidebarOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflowY = "scroll"; // keep scrollbar width stable
      document.body.dataset.lockedScrollY = String(scrollY);
    } else {
      const scrollY = parseInt(document.body.dataset.lockedScrollY ?? "0", 10);
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflowY = "";
      delete document.body.dataset.lockedScrollY;
      window.scrollTo(0, scrollY);
    }
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflowY = "";
      delete document.body.dataset.lockedScrollY;
    };
  }, [mobileSidebarOpen]);

  return (
    <DashboardRefreshProvider>
      <div className="min-h-[100dvh] bg-[#F1F5F9] flex flex-col font-sans">
        {/* Sidebar — always rendered; drawer on mobile, fixed on desktop */}
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        {/* Overlay — mobile only, behind sidebar */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Topbar */}
        <Topbar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          onMobileMenuToggle={() => setMobileSidebarOpen(prev => !prev)}
        />

        {/* Main content — full width on mobile, offset on desktop */}
        <main
          className={cn(
            "flex-1 transition-all duration-300",
            // Desktop only: offset by sidebar width
            isRTL
              ? (collapsed ? "lg:mr-16" : "lg:mr-[220px]")
              : (collapsed ? "lg:ml-16" : "lg:ml-[220px]")
          )}
          // paddingTop = 56px (h-14) + iOS safe-area-inset-top
          // On desktop/Android, env() resolves to 0 → stays exactly 56px
          style={{ paddingTop: "calc(3.5rem + env(safe-area-inset-top))" }}
        >
          <OfflineBanner />
          <div className={noPadding ? "h-full" : "p-3 sm:p-4 lg:p-6 h-full"}>
            {children}
          </div>
        </main>
      </div>
    </DashboardRefreshProvider>
  );
}
