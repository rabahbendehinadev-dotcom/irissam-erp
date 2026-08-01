import { cn } from '@/lib/utils';

interface SkeletonProps { className?: string; }

function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded bg-gray-200', className)} />;
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === 0 ? 'w-3/4' : 'w-full'}`} />
      ))}
    </div>
  );
}

export { Skeleton };
