import { useEffect, useRef } from 'react';
import { useDictation, mmss } from '@/hooks/useDictation';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';

const EXAMPLES = [
  '2 Victor GM pour Lucas, payé CB',
  'combien de CBX RED ?',
  'reçu 20 boites de Victor PC',
  'prix de Victor GM',
];

export function ChatHomePage() {
  const { toasts, addToast, removeToast } = useToast();
  const {
    turns, elapsed, isPending, displayValue, setText,
    isListening, isSupported, start, stop, handleSend,
  } = useDictation({
    onSuccess: (msg) => addToast(msg, 'success'),
    onError: (msg) => addToast(msg, 'error'),
    keepHistory: true,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-paper">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="duotone-ink">
          <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0" />
          <feComponentTransfer>
            <feFuncR type="table" tableValues="0.157 0.984" />
            <feFuncG type="table" tableValues="0.118 0.969" />
            <feFuncB type="table" tableValues="0.086 0.937" />
          </feComponentTransfer>
        </filter>
      </svg>

      <img
        src="/badminton-hero.jpg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[50%_20%]"
        style={{ filter: 'grayscale(1) contrast(1.15) url(#duotone-ink)', opacity: 0.16 }}
      />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-[480px] flex-col lg:max-w-[720px]">
        <div className="flex-none px-[22px] pt-8 pb-6">
          <p className="font-mono text-[9px] font-medium tracking-label text-ink-45">WHO&apos;S BAD · LOGISTIQUE</p>
          <h1 className="mt-1 font-serif text-[40px] leading-none text-ink">Dictée</h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-55">
            Dicte ou écris une vente, un réassort, une question de stock — je m&apos;occupe du reste.
          </p>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-[22px]">
          {turns.length === 0 ? (
            <div className="flex flex-col gap-2 border-t border-ink-hairline pt-4">
              <p className="font-mono text-[9px] font-medium tracking-label text-ink-45">EXEMPLES</p>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setText(ex)}
                  className="w-fit text-left text-[13px] text-ink-55 underline decoration-ink-hairline decoration-1 underline-offset-4 hover:text-ink"
                >
                  « {ex} »
                </button>
              ))}
            </div>
          ) : (
            turns.map((t, i) => (
              <div key={i} className="flex gap-2.5 border-t border-ink-hairline py-2.5">
                <span
                  className={`w-[34px] flex-none pt-0.5 font-mono text-[9px] font-medium tracking-wide ${t.from === 'user' ? 'text-ink-45' : 'text-alert'}`}
                >
                  {t.from === 'user' ? 'MOI' : 'IA'}
                </span>
                <span className="text-[13.5px] leading-[1.5] text-ink">{t.text}</span>
              </div>
            ))
          )}
        </div>

        <div className="flex-none px-[22px] pb-safe pt-3">
          {isListening ? (
            <button
              onClick={stop}
              className="flex w-full items-center gap-2.5 rounded-[14px] border-[1.5px] border-ink bg-paper px-4 py-3.5 shadow-bar"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-alert" />
              <span className="flex-1 text-left text-[13px] text-ink-45">Écoute en cours…</span>
              <span className="font-mono text-[10px] font-medium text-ink-45">{mmss(elapsed)}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2.5 rounded-[14px] border-[1.5px] border-ink bg-paper px-4 py-3.5 shadow-bar">
              <input
                value={displayValue}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Écris ou dicte…"
                className="min-w-0 flex-1 bg-transparent py-1 text-[13px] text-ink placeholder:text-ink-45 focus:outline-none"
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
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
