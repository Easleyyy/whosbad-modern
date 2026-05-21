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
    <div className="flex gap-2">
      {PRESETS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
            active === key
              ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30'
              : 'bg-surface-800 text-gray-400 border border-white/8'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
