import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded bg-ink/8', className)} />
  );
}

export function SaleCardSkeleton() {
  return (
    <div className="flex items-center gap-2.5 border-b border-ink-hairline py-1.5">
      <Skeleton className="h-2.5 w-10 flex-shrink-0" />
      <Skeleton className="h-3 flex-1" />
      <Skeleton className="h-2.5 w-14 flex-shrink-0" />
    </div>
  );
}
