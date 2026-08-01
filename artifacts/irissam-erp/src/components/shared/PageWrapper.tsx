import { cn } from '@/lib/utils';

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function PageWrapper({ children, className }: PageWrapperProps) {
  return (
    <div className={cn('space-y-6 pb-8', className)}>
      {children}
    </div>
  );
}
