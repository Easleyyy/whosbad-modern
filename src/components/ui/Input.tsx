import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>}
      <input
        ref={ref}
        className={cn(
          'w-full px-4 py-3 bg-surface-800 border border-white/10 rounded-xl text-white placeholder-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-primary-600/50 focus:border-primary-600/50',
          'text-base', // 16px prevents iOS zoom
          error && 'border-danger-600',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-danger-500">{error}</p>}
    </div>
  )
);
Input.displayName = 'Input';
