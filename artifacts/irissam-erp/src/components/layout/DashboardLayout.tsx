import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

export function DashboardLayout({ children, noPadding = false }: { children: React.ReactNode; noPadding?: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const { isRTL } = useLanguage();

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col font-sans">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <Topbar collapsed={collapsed} setCollapsed={setCollapsed} />
      
      <main 
        className={cn(
          "flex-1 transition-all duration-300 pt-14",
          isRTL ? (collapsed ? "mr-16" : "mr-[220px]") : (collapsed ? "ml-16" : "ml-[220px]")
        )}
      >
        <div className={noPadding ? 'h-full' : 'p-6 h-full'}>
          {children}
        </div>
      </main>
    </div>
  );
}