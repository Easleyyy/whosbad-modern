import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatShortDate } from '@/lib/utils';
import { NumberStepper } from '@/components/ui/NumberStepper';
import { useUpdateReassort, useDeleteReassort } from '@/hooks/useSales';
import type { ReassortEntry } from '@/types';

interface ReassortCardProps {
  entry: ReassortEntry;
  index: number;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

/** A stock-in row inside the main MOUVEMENTS list — visually distinct from a
 *  sale (no buyer/payment chip, just "+N boîtes"), expands inline to correct
 *  or remove the entry instead of only being reachable from the Réassort modal. */
export const ReassortCard = ({ entry, index, onSuccess, onError }: ReassortCardProps) => {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(entry.qty);
  const { mutateAsync: updateReassort, isPending: updating } = useUpdateReassort();
  const { mutateAsync: deleteReassort, isPending: deleting } = useDeleteReassort();
  const busy = updating || deleting;

  const save = async () => {
    try {
      await updateReassort({ rowIndex: entry._row, produit: entry.produit, qty });
      onSuccess(`Réassort du ${entry.date} corrigé → ${qty} boîte${qty > 1 ? 's' : ''} ✓`);
      setEditing(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erreur réseau');
    }
  };

  const remove = async () => {
    try {
      await deleteReassort({ rowIndex: entry._row, produit: entry.produit });
      onSuccess(`Réassort du ${entry.date} supprimé ✓`);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erreur réseau');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.03, duration: 0.15 }}
      className="border-b border-ink-hairline bg-paper py-1.5"
    >
      {editing ? (
        <div className="flex items-center gap-2.5">
          <span className="w-11 flex-shrink-0 whitespace-nowrap font-mono text-[10px] font-medium text-ink-45">
            {formatShortDate(entry.date)}
          </span>
          <NumberStepper value={qty} onChange={setQty} min={0} size="sm" />
          <span className="min-w-0 flex-1 truncate text-[10px] text-ink-55">{entry.produit}</span>
          <button onClick={save} disabled={busy} className="flex-shrink-0 font-mono text-[9px] font-semibold tracking-label text-ink disabled:opacity-40">
            OK
          </button>
          <button onClick={() => { setEditing(false); setQty(entry.qty); }} disabled={busy} className="flex-shrink-0 font-mono text-[9px] tracking-label text-ink-45 disabled:opacity-40">
            ANNULER
          </button>
          <button onClick={remove} disabled={busy} className="flex-shrink-0 font-mono text-[9px] tracking-label text-ink-45 hover:text-alert disabled:opacity-40">
            SUPPR.
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex w-full items-baseline gap-2.5 text-left"
        >
          <span className="w-11 flex-shrink-0 whitespace-nowrap font-mono text-[10px] font-medium text-ink-45">
            {formatShortDate(entry.date)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">
            +{entry.qty} boîte{entry.qty > 1 ? 's' : ''}
          </span>
          <span className="max-w-[110px] flex-shrink-0 truncate text-[10px] text-ink-55">
            {entry.produit}
          </span>
          <span
            className="flex-shrink-0 border-b-[1.5px] font-mono text-[9px] font-semibold"
            style={{ color: 'oklch(0.5 0.1 200)', borderColor: 'oklch(0.5 0.1 200)' }}
          >
            RÉASSORT
          </span>
        </button>
      )}
    </motion.div>
  );
};
