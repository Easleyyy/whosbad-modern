import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDeleteSale } from '@/hooks/useSales';
import { useGlobalToasts } from '@/stores/toastStore';
import type { Sale } from '@/types';

const UNDO_WINDOW_MS = 5000;

/** Delete with a 5 s "Annuler" window. The sale disappears from the ledger immediately; the
 *  server only hears about it once the window closes, so undoing is just putting the row back. */
export function useSaleDeletion() {
  const qc = useQueryClient();
  const { mutate: deleteSale } = useDeleteSale();
  const addUndo = useGlobalToasts((s) => s.addUndo);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  return useCallback((sale: Sale) => {
    if (!sale._row || !sale.produit) return;
    const { _row: rowIndex, produit: tab } = sale;
    const key = `${tab}-${rowIndex}`;

    qc.setQueriesData<Sale[]>({ queryKey: ['sales', 'all'] }, (old) => old?.filter((s) => !(s._row === rowIndex && s.produit === tab)));

    addUndo(`${sale.acheteur} supprimé`, () => {
      const t = timers.current.get(key);
      if (t) { clearTimeout(t); timers.current.delete(key); }
      qc.invalidateQueries({ queryKey: ['sales'] }); // still on the server: refetch brings it back
    });
    timers.current.set(key, setTimeout(() => {
      deleteSale({ rowIndex, tab });
      timers.current.delete(key);
    }, UNDO_WINDOW_MS));
  }, [qc, deleteSale, addUndo]);
}
