import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';
import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'wouter';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('space-y-1', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-xs text-gray-400 mb-2">
          <Link href="/">
            <Home className="w-3 h-3 hover:text-blue-500 transition-colors" />
          </Link>
          {breadcrumbs.map((item, idx) => (
            <span key={idx} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3" />
              {item.href ? (
                <Link href={item.href} className="hover:text-blue-500 transition-colors">{item.label}</Link>
              ) : (
                <span className="text-gray-600 font-medium">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
