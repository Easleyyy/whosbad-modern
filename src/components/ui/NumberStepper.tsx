import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface NumberStepperProps {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  size?: 'lg' | 'md' | 'sm';
  className?: string;
}

/** Quantity control that's both clickable (−/+) and directly typeable —
 *  clicking + or − nine times to reach a number was the actual complaint. */
export function NumberStepper({ value, onChange, min = 0, size = 'lg', className }: NumberStepperProps) {
  const [text, setText] = useState(String(value));

  useEffect(() => { setText(String(value)); }, [value]);

  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    const clamped = isNaN(n) ? min : Math.max(min, n);
    onChange(clamped);
    setText(String(clamped));
  };

  const btnClass = {
    lg: 'h-12 w-12 flex-shrink-0 border-[1.5px] border-ink text-xl text-ink',
    md: 'h-10 w-10 flex-shrink-0 border-[1.5px] border-ink text-lg text-ink',
    sm: 'h-6 w-6 flex-shrink-0 border-[1.5px] border-ink text-sm text-ink',
  }[size];
  const inputClass = {
    lg: 'w-20 border-b border-ink bg-transparent text-center font-serif text-[44px] tabular-nums text-ink focus:outline-none',
    md: 'w-12 border-b border-ink bg-transparent text-center font-serif text-[22px] tabular-nums text-ink focus:outline-none',
    sm: 'w-10 border-b border-ink bg-transparent text-center font-mono text-[12px] tabular-nums text-ink focus:outline-none',
  }[size];
  const gapClass = { lg: 'gap-7', md: 'gap-5', sm: 'gap-2' }[size];

  return (
    <div className={cn('flex items-center', gapClass, className)}>
      <button
        type="button"
        onClick={() => commit(String(Math.max(min, value - 1)))}
        aria-label="Retirer"
        className={btnClass}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={text}
        min={min}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className={inputClass}
      />
      <button
        type="button"
        onClick={() => commit(String(value + 1))}
        aria-label="Ajouter"
        className={btnClass}
      >
        +
      </button>
    </div>
  );
}
