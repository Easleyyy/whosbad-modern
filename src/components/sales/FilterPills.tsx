import { cn } from '@/lib/utils';

type FilterStatus = 'all' | 'paid' | 'pending' | 'dash';

const FILTERS: { key: FilterStatus; label: string }[] = [
  { key: 'all',     label: 'Tous' },
  { key: 'paid',    label: 'Payés' },
  { key: 'pending', label: 'Attente' },
  { key: 'dash',    label: 'Soldé' },
];

interface FilterPillsProps {
  active: FilterStatus;
  onChange: (f: FilterStatus) => void;
  counts?: Partial<Record<FilterStatus, number>>;
}

export function FilterPills({ active, onChange, counts }: FilterPillsProps) {
  return (
    <div className="flex gap-4 overflow-x-auto no-scrollbar font-mono text-[10px]">
      {FILTERS.map(({ key, label }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              'flex-shrink-0 flex items-baseline gap-1 pb-1 transition-colors',
              isActive
                ? 'border-b-[1.5px] border-ink font-semibold text-ink'
                : 'text-ink-45 hover:text-ink-55'
            )}
          >
            {label}
            {counts?.[key] != null && <span className="text-[9px] opacity-70">{counts[key]}</span>}
          </button>
        );
      })}
    </div>
  );
}
