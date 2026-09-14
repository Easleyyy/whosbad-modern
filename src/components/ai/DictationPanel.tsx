import { useEffect, useRef } from 'react';
import { useDictation, mmss } from '@/hooks/useDictation';

const EXAMPLES = [
  '2 Victor GM pour Lucas, payé CB',
  'la dernière vente de David est payée par virement',
  'reçu 20 boites de Victor PC',
  'supprime la vente de Manon',
];

interface Props {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onSlow?: () => void;
}

/** Persistent chat column docked beside the ledger on wide screens — unlike
 *  DictationSheet (a modal that covers the table), this stays visible at all
 *  times so the table and the AI conversation can be watched side by side. */
export function DictationPanel({ onSuccess, onError, onSlow }: Props) {
  const {
    turns, elapsed, isPending, displayValue, setText,
    isListening, isSupported, start, stop, handleSend, references,
  } = useDictation({ onSuccess, onError, onSlow, keepHistory: true });

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  return (
    <aside className="hidden xl:flex xl:w-[340px] xl:flex-shrink-0 xl:flex-col xl:border-l-[1.5px] xl:border-ink-rule xl:py-3 xl:pl-7">
      <div className="flex-none pb-3">
        <p className="font-mono text-[9px] font-medium tracking-label text-ink-45">IA · DICTÉE</p>
        {references.length > 0 && (
          <p className="mt-1.5 text-[10px] leading-relaxed text-ink-45">
            {references.map((r) => `${r.name} · ${r.price} €`).join('  —  ')}
          </p>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
        {turns.length === 0 ? (
          <div className="flex flex-col gap-2 border-t border-ink-hairline pt-3">
            <p className="font-mono text-[9px] font-medium tracking-label text-ink-45">EXEMPLES</p>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setText(ex)}
                className="w-fit text-left text-[12px] text-ink-55 underline decoration-ink-hairline decoration-1 underline-offset-4 hover:text-ink"
              >
                « {ex} »
              </button>
            ))}
          </div>
        ) : (
          turns.map((t, i) => (
            <div key={i} className="flex gap-2 border-t border-ink-hairline py-2">
              <span
                className={`w-[28px] flex-none pt-0.5 font-mono text-[9px] font-medium tracking-wide ${t.from === 'user' ? 'text-ink-45' : 'text-alert'}`}
              >
                {t.from === 'user' ? 'MOI' : 'IA'}
              </span>
              <span className="text-[12.5px] leading-[1.5] text-ink">{t.text}</span>
            </div>
          ))
        )}
      </div>

      <div className="flex-none pt-3">
        {isListening ? (
          <button
            onClick={stop}
            className="flex w-full items-center gap-2.5 rounded-[14px] border-[1.5px] border-ink bg-paper px-3.5 py-3 shadow-bar"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-alert" />
            <span className="flex-1 text-left text-[12.5px] text-ink-45">Écoute en cours…</span>
            <span className="font-mono text-[10px] font-medium text-ink-45">{mmss(elapsed)}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-[14px] border-[1.5px] border-ink bg-paper px-3.5 py-3 shadow-bar">
            <input
              value={displayValue}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Écris ou dicte…"
              className="min-w-0 flex-1 bg-transparent py-1 text-[12.5px] text-ink placeholder:text-ink-45 focus:outline-none"
            />
            {isSupported && (
              <button onClick={start} aria-label="Dicter" className="flex-shrink-0 font-mono text-[13px] text-ink-45">
                ◉
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={isPending || !displayValue.trim()}
              aria-label="Envoyer"
              className="flex-shrink-0 font-mono text-[13px] text-ink disabled:opacity-30"
            >
              ↑
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
