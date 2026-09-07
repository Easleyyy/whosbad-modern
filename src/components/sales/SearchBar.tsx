import { X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Rechercher…' }: SearchBarProps) {
  return (
    <div className="flex items-center gap-2 border-b border-ink-hairline py-1.5">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent font-mono text-[10px] text-ink placeholder:text-ink-40 focus:outline-none"
      />
      {value && (
        <button onClick={() => onChange('')} className="flex-shrink-0 text-ink-45 hover:text-ink">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
