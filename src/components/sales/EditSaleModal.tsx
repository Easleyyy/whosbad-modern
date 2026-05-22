import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { Sale, PaymentStatus, PaymentMode } from '@/types';

const PAYMENT_MODES: (PaymentMode | '')[] = [
  '', 'Virement', 'Espèces', 'Chèque', 'CB',
  'Square', 'Assoconnect', 'PayPal', 'Wero', 'Site internet', 'Autre',
];

interface EditSaleModalProps {
  sale: Sale;
  onSave: (updated: Partial<Sale> & { rowIndex: number; tab: string }) => void;
  onClose: () => void;
  loading: boolean;
}

export function EditSaleModal({ sale, onSave, onClose, loading }: EditSaleModalProps) {
  const [date, setDate] = useState(sale.date);
  const [acheteur, setAcheteur] = useState(sale.acheteur);
  const [vendeur, setVendeur] = useState(sale.vendeur);
  const [quantite, setQuantite] = useState(sale.quantite);
  const [paye, setPaye] = useState<PaymentStatus>(sale.paye);
  const [mode, setMode] = useState<PaymentMode | ''>(sale.mode_paiement);
  const [commentaire, setCommentaire] = useState(sale.commentaire ?? '');

  const handleSave = () => {
    if (!sale._row || !sale.produit) return;
    onSave({
      rowIndex: sale._row,
      tab: sale.produit,
      date,
      new_acheteur: acheteur,
      vendeur,
      quantite,
      paye,
      mode_paiement: mode,
      commentaire,
    } as Partial<Sale> & { rowIndex: number; tab: string });
  };

  const payeStyles: Record<PaymentStatus, string> = {
    Oui: 'bg-success-100 text-success-600 border-success-600/40',
    Non: 'bg-danger-100 text-danger-600 border-danger-600/40',
    '-': 'bg-surface-800 text-gray-400 border-white/15',
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-surface-900 rounded-t-3xl border-t border-white/10"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)' }}
      >
        {/* Handle + header */}
        <div className="px-5 pt-3 pb-4">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Modifier la vente</p>
              <p className="font-semibold text-white mt-0.5">{sale.acheteur}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable fields */}
        <div className="px-5 space-y-4 overflow-y-auto max-h-[55vh]">

          {/* Statut paiement */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Statut</label>
            <div className="flex gap-2">
              {(['Oui', 'Non', '-'] as PaymentStatus[]).map((s) => (
                <button key={s} onClick={() => setPaye(s)}
                  className={cn('flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all',
                    paye === s ? payeStyles[s] : 'bg-surface-800 text-gray-500 border-white/8')}>
                  {s === 'Oui' ? '✓ Payé' : s === 'Non' ? '✗ En attente' : '— Soldé'}
                </button>
              ))}
            </div>
          </div>

          {/* Mode paiement */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block">Mode de paiement</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode | '')}
              className="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/40">
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m || '—'}</option>)}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block">Date</label>
            <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="DD/MM/YYYY"
              className="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-3 text-white text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-600/40" />
          </div>

          {/* Acheteur + Vendeur */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block">Acheteur</label>
              <input value={acheteur} onChange={(e) => setAcheteur(e.target.value)}
                className="w-full bg-surface-800 border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/40" />
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block">Vendeur</label>
              <input value={vendeur} onChange={(e) => setVendeur(e.target.value)}
                className="w-full bg-surface-800 border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/40" />
            </div>
          </div>

          {/* Quantité */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block">Quantité</label>
            <div className="flex items-center gap-4">
              <button onClick={() => setQuantite(Math.max(1, quantite - 1))}
                className="w-10 h-10 rounded-full bg-surface-800 border border-white/10 text-white text-xl flex items-center justify-center">−</button>
              <span className="text-2xl font-bold text-white tabular-nums w-8 text-center">{quantite}</span>
              <button onClick={() => setQuantite(quantite + 1)}
                className="w-10 h-10 rounded-full bg-surface-800 border border-white/10 text-white text-xl flex items-center justify-center">+</button>
            </div>
          </div>

          {/* Commentaire */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block">Commentaire</label>
            <input value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Optionnel…"
              className="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-3 text-white text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-600/40" />
          </div>

          <div className="pb-2">
            <Button onClick={handleSave} loading={loading} className="w-full">Enregistrer</Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
