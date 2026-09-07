interface Kpi {
  label: string;
  value: number | string;
  alert?: boolean;
}

interface Props {
  title: string;
  /** small Archivo line under the title (T-Shirts / secondary screens) */
  caption?: string;
  /** four-cell KPI row under the title (Volants screen) */
  kpis?: Kpi[];
  /** ledger page number shown top-right; omit to hide */
  folio?: string;
  /** right-aligned mono text action links, shown under the title */
  actions?: { label: string; onClick: () => void }[];
}

/** Status line + serif title + optional KPI row, closed by the 2px ink rule. */
export function LedgerHeader({ title, caption, kpis, folio, actions }: Props) {
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <header className="flex-none">
      <div className="flex justify-between px-[22px] pt-4 font-mono text-[11px] font-medium text-ink-40">
        <span>{time}</span>
        {folio && <span>{folio}</span>}
      </div>

      <div className="border-b-2 border-ink px-[22px] pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-serif text-[34px] leading-none text-ink">{title}</h1>
          {actions && actions.length > 0 && (
            <div className="flex flex-shrink-0 gap-3 pt-1.5">
              {actions.map((a) => (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  className="font-mono text-[9px] font-medium tracking-label text-ink-45 hover:text-ink"
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {caption && <p className="mt-1.5 text-[11px] text-ink-55">{caption}</p>}

        {kpis && (
          <div className="mt-3 flex gap-5">
            {kpis.map((k, i) => (
              <div key={k.label} className={i > 0 ? 'border-l border-ink-rule pl-5' : undefined}>
                <div className="font-mono text-[9px] font-medium tracking-kpi text-ink-45">{k.label}</div>
                <div className="stat-value font-serif text-[26px]" style={{ color: k.alert ? 'oklch(0.55 0.16 28)' : '#281E16' }}>
                  {k.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
