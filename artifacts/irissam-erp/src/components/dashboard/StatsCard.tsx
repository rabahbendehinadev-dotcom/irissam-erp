import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown } from "lucide-react";
import { ReactNode } from "react";

interface StatsCardProps {
  icon: ReactNode;
  iconBgColor: string;
  iconColor: string;
  title: string;
  value: string | number;
  trend: number;
  trendText: string;
}

export function StatsCard({ icon, iconBgColor, iconColor, title, value, trend, trendText }: StatsCardProps) {
  const isPositive = trend >= 0;
  
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0", iconBgColor, iconColor)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs text-gray-500 mb-1 truncate">{title}</h4>
        <div className="text-xl font-bold text-gray-900 mb-1 leading-none">{value}</div>
        <div className="flex items-center gap-1 text-[10px] sm:text-xs whitespace-nowrap">
          <span className={cn("flex items-center font-medium", isPositive ? "text-green-500" : "text-red-500")}>
            {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
          <span className="text-gray-400 truncate">{trendText}</span>
        </div>
      </div>
    </div>
  );
}