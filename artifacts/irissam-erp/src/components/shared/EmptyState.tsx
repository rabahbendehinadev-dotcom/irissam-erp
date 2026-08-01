import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      {icon && (
        <div className="text-gray-300 mb-4">{icon}</div>
      )}
      <h3 className="text-base font-semibold text-gray-700 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-400 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
