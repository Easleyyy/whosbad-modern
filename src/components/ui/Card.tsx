import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-surface-800/60 border border-white/8 rounded-2xl backdrop-blur-sm', className)}
      {...props}
    >
      {children}
    </div>
  );
}
