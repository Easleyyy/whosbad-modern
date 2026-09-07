import { cn } from '@/lib/utils';
import type { DatePreset } from '@/lib/utils';

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'all',   label: 'Tout' },
  { key: 'today', label: "Auj." },
  { key: 'week',  label: 'Semaine' },
  { key: 'month', label: 'Mois' },
];

interface DatePresetPillsProps {
  active: DatePreset;
  onChange: (p: DatePreset) => void;
}

export function DatePresetPills({ active, onChange }: DatePresetPillsProps) {
  return (
    <div className="flex gap-4 overflow-x-auto no-scrollbar font-mono text-[10px]">
      {PRESETS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'flex-shrink-0 pb-1 transition-colors',
            active === key
              ? 'border-b-[1.5px] border-ink font-semibold text-ink'
              : 'text-ink-45 hover:text-ink-55'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
