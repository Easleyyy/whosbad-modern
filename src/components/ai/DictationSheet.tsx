import { motion, AnimatePresence } from 'framer-motion';
import { useDictation, mmss } from '@/hooks/useDictation';
import { useModalGestures } from '@/hooks/useModalGestures';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function DictationSheet({ isOpen, onClose, onSuccess, onError }: Props) {
  const { y, bind } = useModalGestures(isOpen, onClose);
  const {
    turns, elapsed, isPending, displayValue, setText,
    isListening, isSupported, start, stop, handleSend, references,
  } = useDictation({ onSuccess, onError, onDone: onClose });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(40,30,22,.35)' }}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ y }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[80%] max-w-[480px] lg:max-w-[560px] flex-col gap-2.5 border-t-2 border-ink bg-paper px-5 pt-4 pb-safe"
          >
            <div {...bind()} className="flex touch-none items-baseline justify-between">
              <span className="font-serif text-[22px] text-ink">Dictée</span>
              <button onClick={onClose} className="font-mono text-[10px] font-medium tracking-kpi text-ink-45">
                FERMER
              </button>
            </div>

            {references.length > 0 && (
              <p className="text-[10px] leading-relaxed text-ink-45">
                {references.map((r) => `${r.name} · ${r.price} €`).join('  —  ')}
              </p>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
              {turns.map((t, i) => (
                <div key={i} className="flex gap-2.5 border-t border-ink-hairline py-2">
                  <span
                    className={`w-[34px] flex-none pt-0.5 font-mono text-[9px] font-medium tracking-wide ${t.from === 'user' ? 'text-ink-45' : 'text-alert'}`}
                  >
                    {t.from === 'user' ? 'MOI' : 'IA'}
                  </span>
                  <span className="text-[13px] leading-[1.45] text-ink">{t.text}</span>
                </div>
              ))}
            </div>

            {isListening ? (
              <button
                onClick={stop}
                className="mt-1 flex items-center gap-2.5 rounded-[14px] border-[1.5px] border-ink px-4 py-3.5"
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-alert" />
                <span className="flex-1 text-left text-[13px] text-ink-45">Écoute en cours…</span>
                <span className="font-mono text-[10px] font-medium text-ink-45">{mmss(elapsed)}</span>
              </button>
            ) : (
              <div className="mt-1 flex items-center gap-2.5 rounded-[14px] border-[1.5px] border-ink px-4 py-2.5">
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
