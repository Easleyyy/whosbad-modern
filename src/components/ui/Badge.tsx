import { cn, getStatusColor, getStatusLabel } from '@/lib/utils';
import type { PaymentStatus } from '@/types';

interface BadgeProps {
  status: PaymentStatus;
  size?: 'sm' | 'md';
}

export function Badge({ status, size = 'md' }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 font-medium rounded-full',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs',
      getStatusColor(status)
    )}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {getStatusLabel(status)}
    </span>
  );
}
