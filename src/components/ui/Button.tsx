import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ink' | 'ink-outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'ink', size = 'md', loading, className, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-[14px] transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none';
    const variants = {
      ink: 'border-[1.5px] border-ink bg-ink text-paper shadow-bar hover:-translate-y-px',
      'ink-outline': 'border-[1.5px] border-ink bg-transparent text-ink hover:bg-ink/5',
    };
    const sizes = { sm: 'px-3 py-2 text-xs', md: 'px-4 py-3.5 text-[13px]', lg: 'px-6 py-3.5 text-[13px]' };

    return (
      <button ref={ref} disabled={disabled || loading} className={cn(base, variants[variant], sizes[size], className)} {...props}>
        {loading ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : null}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
