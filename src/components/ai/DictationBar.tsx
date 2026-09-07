interface Props {
  onClick: () => void;
  hint?: string;
}

/** Ink command bar — replaces the old FAB. Sits directly above the tab bar. */
export function DictationBar({ onClick, hint = 'Dicte une vente ou un réassort…' }: Props) {
  return (
    <div className="flex-none px-[18px] pt-2">
      <button
        onClick={onClick}
        className="flex w-full items-center gap-2.5 rounded-[14px] border-[1.5px] border-ink bg-ink px-4 py-3.5 text-left text-[13px] text-paper shadow-bar transition-transform hover:-translate-y-px active:translate-y-0"
      >
        <span className="font-mono text-[10px] font-semibold tracking-kpi text-gold">IA</span>
        <span className="truncate opacity-75">{hint}</span>
        <span className="ml-auto flex-shrink-0 font-mono text-[13px] opacity-70">◉</span>
      </button>
    </div>
  );
}
