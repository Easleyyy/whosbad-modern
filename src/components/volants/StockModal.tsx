import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useReferencesStore } from '@/stores/referencesStore';
import { useStockUpdate } from '@/hooks/useSales';
import { useModalGestures } from '@/hooks/useModalGestures';
import { getColorHex } from '@/types';
import { cn } from '@/lib/utils';

interface StockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  initialProduct?: string;
}

export function StockModal({ isOpen, onClose, onSuccess, onError, initialProduct }: StockModalProps) {
  const { references } = useReferencesStore();
  const { y, bind } = useModalGestures(isOpen, onClose);
  const { mutateAsync: updateStock, isPending } = useStockUpdate();

  const firstId = references[0]?.id ?? '';
  const [selectedId, setSelectedId] = useState(
    initialProduct ? (references.find((r) => r.name === initialProduct)?.id ?? firstId) : firstId
  );
  const [qty, setQty] = useState(12);

  // Sync selected product when modal opens on a different tab
  useEffect(() => {
    if (isOpen && initialProduct) {
      const ref = references.find((r) => r.name === initialProduct);
      if (ref) setSelectedId(ref.id);
    }
  }, [isOpen, initialProduct, references]);

  const ref = references.find((r) => r.id === selectedId);

  const changeQty = (delta: number) => setQty((q) => Math.max(1, q + delta));

  const handleSubmit = async () => {
    if (!ref) return;
    try {
      const result = await updateStock({ product: ref.name, qty });
      if (result.success) {
        onSuccess(result.message || `+${qty} boîte${qty > 1 ? 's' : ''} de ${ref.name} ajouté${qty > 1 ? 'es' : ''} ✓`);
        onClose();
      } else {
        onError('Erreur lors de la mise à jour du stock');
      }
    } catch {
      onError('Erreur réseau');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ y }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface-900 rounded-t-3xl border-t border-white/10 p-6 pb-safe"
          >
            {/* Handle */}
            <div {...bind()} className="touch-none">
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <PackagePlus className="w-4 h-4 text-teal-400" />
                <h3 className="font-semibold text-white text-sm">Réapprovisionner le stock</h3>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Product selector */}
            <div className="mb-5">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Produit</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {references.map((r) => {
                  const hex = getColorHex(r.color);
                  const isSelected = selectedId === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={cn(
                        'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all border',
                        isSelected
                          ? 'bg-surface-800 border-white/20 text-white'
                          : 'border-transparent text-gray-400 hover:text-gray-200'
                      )}
                    >
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: hex }}
                      />
                      {r.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity */}
            <div className="mb-5">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Quantité reçue (boîtes)</p>
              <div className="flex items-center gap-5 justify-center">
                <button
                  onClick={() => changeQty(-1)}
                  className="w-12 h-12 rounded-2xl bg-surface-800 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-4xl font-bold text-white w-16 text-center tabular-nums">{qty}</span>
                <button
                  onClick={() => changeQty(1)}
                  className="w-12 h-12 rounded-2xl bg-surface-800 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Summary */}
            {ref && (
              <div className="bg-surface-800/50 rounded-2xl px-4 py-3 mb-5 border border-white/6">
                <p className="text-xs text-gray-400 text-center">
                  {qty} boîte{qty > 1 ? 's' : ''} de <span className="text-white font-medium">{ref.name}</span>
                  {' '}&rarr; valeur de réappro : <span className="text-white font-medium">{(qty * ref.price).toFixed(0)} €</span>
                </p>
              </div>
            )}

            <Button onClick={handleSubmit} loading={isPending} disabled={!ref} className="w-full">
              Confirmer la réception
            </Button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
