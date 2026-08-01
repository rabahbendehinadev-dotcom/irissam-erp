import { cn } from '@/lib/utils';
import type { BadgeVariant } from '@/types';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-700 border-green-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  danger: 'bg-red-100 text-red-700 border-red-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  neutral: 'bg-gray-100 text-gray-600 border-gray-200',
};

interface StatusBadgeProps {
  label: string;
  variant: BadgeVariant;
  className?: string;
}

export function StatusBadge({ label, variant, className }: StatusBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
      VARIANT_CLASSES[variant],
      className
    )}>
      {label}
    </span>
  );
}
