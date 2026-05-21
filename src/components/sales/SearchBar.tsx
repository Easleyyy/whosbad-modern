import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Rechercher…' }: SearchBarProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full pl-10 pr-10 py-3 bg-surface-800 border border-white/8 rounded-xl',
          'text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-600/40',
          'text-base' // prevent iOS zoom
        )}
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
