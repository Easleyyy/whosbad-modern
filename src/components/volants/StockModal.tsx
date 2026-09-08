import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { useReferencesStore } from '@/stores/referencesStore';
import { useStockUpdate, useReassortLog, useUpdateReassort, useDeleteReassort } from '@/hooks/useSales';
import { useModalGestures } from '@/hooks/useModalGestures';
import { cn } from '@/lib/utils';
import type { ReassortEntry } from '@/types';

interface StockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onSlow?: () => void;
  initialProduct?: string | null;
}

export function StockModal({ isOpen, onClose, onSuccess, onError, onSlow, initialProduct }: StockModalProps) {
  const { references } = useReferencesStore();
  const { y, bind } = useModalGestures(isOpen, onClose);
  const { mutateAsync: updateStock, isPending } = useStockUpdate();

  const firstId = references[0]?.id ?? '';
  const [selectedId, setSelectedId] = useState(
    initialProduct ? (references.find((r) => r.name === initialProduct)?.id ?? firstId) : firstId
  );
  const [qty, setQty] = useState(12);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editQty, setEditQty] = useState(1);

  useEffect(() => {
    if (isOpen && initialProduct) {
      const ref = references.find((r) => r.name === initialProduct);
      if (ref) setSelectedId(ref.id);
    }
  }, [isOpen, initialProduct, references]);

  const ref = references.find((r) => r.id === selectedId);

  const { data: log = [], isLoading: logLoading } = useReassortLog(ref?.name ?? null);
  const { mutateAsync: updateReassort, isPending: updatingReassort } = useUpdateReassort();
  const { mutateAsync: deleteReassort, isPending: deletingReassort } = useDeleteReassort();

  useEffect(() => { setEditingRow(null); }, [selectedId]);

  const changeQty = (delta: number) => setQty((q) => Math.max(1, q + delta));

  const handleSubmit = async () => {
    if (!ref) return;
    const slowTimer = window.setTimeout(() => onSlow?.(), 3000);
    try {
      await updateStock({ product: ref.name, qty });
      onSuccess(`+${qty} boîte${qty > 1 ? 's' : ''} de ${ref.name} ajouté${qty > 1 ? 'es' : ''} ✓`);
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erreur réseau');
    } finally {
      window.clearTimeout(slowTimer);
    }
  };

  const startEditEntry = (entry: ReassortEntry) => {
    setEditingRow(entry._row);
    setEditQty(entry.qty);
  };

  const saveEditEntry = async (entry: ReassortEntry) => {
    if (!ref) return;
    try {
      await updateReassort({ rowIndex: entry._row, produit: ref.name, qty: editQty });
      onSuccess(`Réassort du ${entry.date} corrigé → ${editQty} boîte${editQty > 1 ? 's' : ''} ✓`);
      setEditingRow(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erreur réseau');
    }
  };

  const removeEntry = async (entry: ReassortEntry) => {
    if (!ref) return;
    try {
      await deleteReassort({ rowIndex: entry._row, produit: ref.name });
      onSuccess(`Réassort du ${entry.date} supprimé ✓`);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erreur réseau');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40" style={{ background: 'rgba(40,30,22,.35)' }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ y }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] max-w-[480px] lg:max-w-[560px] flex-col border-t-2 border-ink bg-paper px-5 pt-4 pb-safe"
          >
            <div {...bind()} className="touch-none flex-none">
              <div className="flex items-baseline justify-between">
                <span className="font-serif text-[22px] text-ink">Réassort</span>
                <button onClick={onClose} className="font-mono text-[10px] font-medium tracking-kpi text-ink-45">
                  FERMER
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">

            {/* Product selector */}
            <div className="mb-5 mt-4">
              <p className="mb-2 font-mono text-[9px] font-medium tracking-label text-ink-45">PRODUIT</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {references.map((r) => {
                  const isSelected = selectedId === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={cn(
                        'text-[12px] transition-colors',
                        isSelected ? 'border-b-[1.5px] border-ink font-semibold text-ink' : 'text-ink-45'
                      )}
                    >
                      {r.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity */}
            <div className="mb-5">
              <p className="mb-3 font-mono text-[9px] font-medium tracking-label text-ink-45">QUANTITÉ REÇUE (BOÎTES)</p>
              <div className="flex items-center justify-center gap-7">
                <button onClick={() => changeQty(-1)} aria-label="Retirer"
                  className="h-12 w-12 border-[1.5px] border-ink text-xl text-ink">−</button>
                <span className="w-16 text-center font-serif text-[44px] tabular-nums text-ink">{qty}</span>
                <button onClick={() => changeQty(1)} aria-label="Ajouter"
                  className="h-12 w-12 border-[1.5px] border-ink text-xl text-ink">+</button>
              </div>
            </div>

            {/* Summary */}
            {ref && (
              <p className="mb-5 text-center text-[11px] leading-relaxed text-ink-55">
                {qty} boîte{qty > 1 ? 's' : ''} de <span className="font-medium text-ink">{ref.name}</span>
                {' '}— valeur de réappro : <span className="font-medium text-ink">{(qty * ref.price).toFixed(0)} €</span>
              </p>
            )}

            <Button onClick={handleSubmit} loading={isPending} disabled={!ref} className="w-full">
              Confirmer la réception
            </Button>

            {/* Historique — corriger ou annuler un réassort déjà saisi */}
            {ref && (
              <div className="mt-6 pb-2">
                <p className="mb-2 font-mono text-[9px] font-medium tracking-label text-ink-45">
                  DERNIERS RÉASSORTS — {ref.name}
                </p>
                {logLoading ? (
                  <p className="py-2 text-[11px] text-ink-45">Chargement…</p>
                ) : log.length === 0 ? (
                  <p className="py-2 text-[11px] text-ink-45">Aucun mouvement enregistré</p>
                ) : (
                  log.map((entry) => {
                    const isEditing = editingRow === entry._row;
                    const busy = updatingReassort || deletingReassort;
                    return (
                      <div key={entry._row} className="flex items-center gap-2.5 border-b border-dotted border-ink-dot py-2">
                        <span className="w-16 flex-shrink-0 font-mono text-[10px] text-ink-45">{entry.date || '—'}</span>
                        {isEditing ? (
                          <>
                            <div className="flex flex-1 items-center gap-2">
                              <button onClick={() => setEditQty((q) => Math.max(1, q - 1))}
                                className="h-6 w-6 flex-shrink-0 border-[1.5px] border-ink text-sm text-ink">−</button>
                              <span className="w-8 text-center font-mono text-[12px] tabular-nums text-ink">{editQty}</span>
                              <button onClick={() => setEditQty((q) => q + 1)}
                                className="h-6 w-6 flex-shrink-0 border-[1.5px] border-ink text-sm text-ink">+</button>
                            </div>
                            <button onClick={() => saveEditEntry(entry)} disabled={busy}
                              className="flex-shrink-0 font-mono text-[9px] font-semibold tracking-label text-ink disabled:opacity-40">
                              OK
                            </button>
                            <button onClick={() => setEditingRow(null)} disabled={busy}
                              className="flex-shrink-0 font-mono text-[9px] tracking-label text-ink-45 disabled:opacity-40">
                              ANNULER
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-[12.5px] text-ink">
                              +{entry.qty} boîte{entry.qty > 1 ? 's' : ''}
                              {entry.commentaire && <span className="text-ink-45"> · {entry.commentaire}</span>}
                            </span>
                            <button onClick={() => startEditEntry(entry)} disabled={busy}
                              className="flex-shrink-0 font-mono text-[9px] tracking-label text-ink-45 hover:text-ink disabled:opacity-40">
                              MODIF.
                            </button>
                            <button onClick={() => removeEntry(entry)} disabled={busy}
                              className="flex-shrink-0 font-mono text-[9px] tracking-label text-ink-45 hover:text-alert disabled:opacity-40">
                              SUPPR.
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
