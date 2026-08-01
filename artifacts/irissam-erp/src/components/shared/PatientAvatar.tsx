import { cn } from '@/lib/utils';
import { getInitials } from '@/utils';

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-teal-500',
  'bg-orange-500', 'bg-green-500', 'bg-pink-500',
  'bg-indigo-500', 'bg-red-500',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export interface PatientAvatarProps {
  firstName?: string;
  lastName?: string;
  /** Convenience: pass a full "LastName FirstName" string instead of firstName+lastName */
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
};

export function PatientAvatar({ firstName, lastName, name, size = 'sm', className }: PatientAvatarProps) {
  const parts = name ? name.split(' ') : [];
  const resolvedFirst = firstName ?? parts[1] ?? '';
  const resolvedLast  = lastName  ?? parts[0] ?? '';
  const initials = getInitials(resolvedFirst, resolvedLast) || (name?.slice(0, 2).toUpperCase() ?? '?');
  const colorClass = getAvatarColor(name ?? (resolvedFirst + resolvedLast));
  return (
    <div className={cn(
      'rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0',
      SIZE_CLASSES[size],
      colorClass,
      className
    )}>
      {initials}
    </div>
  );
}
