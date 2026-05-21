import { cn } from '@/lib/utils';

type FilterStatus = 'all' | 'paid' | 'pending' | 'dash';

const FILTERS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'paid', label: 'Payés' },
  { key: 'pending', label: 'Attente' },
  { key: 'dash', label: '—' },
];

interface FilterPillsProps {
  active: FilterStatus;
  onChange: (f: FilterStatus) => void;
  counts?: Partial<Record<FilterStatus, number>>;
}

export function FilterPills({ active, onChange, counts }: FilterPillsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      {FILTERS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all',
            active === key
              ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
              : 'bg-surface-800 text-gray-400 border border-white/8'
          )}
        >
          {label}
          {counts?.[key] != null && (
            <span className={cn('ml-1.5 text-xs', active === key ? 'opacity-80' : 'text-gray-500')}>
              {counts[key]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
