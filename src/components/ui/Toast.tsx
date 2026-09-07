import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { Toast, ToastType } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

const MARK: Record<ToastType, string> = {
  success: '✓',
  error: '✗',
  info: 'i',
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed bottom-24 left-1/2 z-50 flex w-full max-w-[440px] -translate-x-1/2 flex-col gap-2 px-[18px] pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            className={cn(
              'flex items-center gap-3 rounded-[14px] border-2 border-ink bg-paper px-4 py-3 text-[13px] font-medium text-ink pointer-events-auto',
              'shadow-bar'
            )}
          >
            <span
              className={cn(
                'font-mono text-[11px] font-semibold',
                t.type === 'error' ? 'text-alert' : t.type === 'success' ? 'text-ok' : 'text-ink-45'
              )}
            >
              {MARK[t.type]}
            </span>
            <span className="flex-1">{t.message}</span>
            {t.undoAction && (
              <button
                onClick={() => { t.undoAction?.(); onRemove(t.id); }}
                className="font-mono text-[10px] font-semibold tracking-kpi text-ink underline decoration-ink/40 underline-offset-2"
              >
                ANNULER
              </button>
            )}
            <button onClick={() => onRemove(t.id)} className="text-ink-45 hover:text-ink">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
