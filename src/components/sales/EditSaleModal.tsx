import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { NumberStepper } from '@/components/ui/NumberStepper';
import { cn } from '@/lib/utils';
import { useModalGestures } from '@/hooks/useModalGestures';
import type { Sale, PaymentStatus, PaymentMode } from '@/types';

const PAYMENT_MODES: (PaymentMode | '')[] = [
  '', 'Virement', 'Espèces', 'Chèque', 'CB',
  'Square', 'Assoconnect', 'PayPal', 'Wero', 'Site internet', 'Autre',
];

const PAYE_LABEL: Record<PaymentStatus, string> = { Oui: 'Payé', Non: 'En attente', '-': 'Soldé' };

interface EditSaleModalProps {
  sale: Sale;
  onSave: (updated: Partial<Sale> & { rowIndex: number; tab: string }) => void;
  onDelete: (sale: Sale) => void;
  onClose: () => void;
  loading: boolean;
}

export function EditSaleModal({ sale, onSave, onDelete, onClose, loading }: EditSaleModalProps) {
  const [date, setDate] = useState(sale.date);
  const [acheteur, setAcheteur] = useState(sale.acheteur);
  const [vendeur, setVendeur] = useState(sale.vendeur);
  const [quantite, setQuantite] = useState(sale.quantite);
  const [paye, setPaye] = useState<PaymentStatus>(sale.paye);
  const [mode, setMode] = useState<PaymentMode | ''>(sale.mode_paiement);
  const [commentaire, setCommentaire] = useState(sale.commentaire ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { y, bind } = useModalGestures(true, onClose);

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

  const fieldClass = 'w-full border-[1.5px] border-ink bg-transparent px-3 py-2.5 text-[13px] text-ink placeholder:text-ink-40 focus:outline-none';
  const labelClass = 'mb-1.5 block font-mono text-[9px] font-medium tracking-label text-ink-45';

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40" style={{ background: 'rgba(40,30,22,.35)' }} onClick={onClose} />

      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{ y }}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] lg:max-w-[560px] border-t-2 border-ink bg-paper pb-safe"
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3" {...bind()}>
          <div className="flex items-baseline justify-between">
            <div>
              <p className="font-mono text-[9px] font-medium tracking-label text-ink-45">MODIFIER LA VENTE</p>
              <p className="mt-0.5 font-serif text-[22px] text-ink">{sale.acheteur}</p>
            </div>
            <button onClick={onClose} className="font-mono text-[10px] font-medium tracking-kpi text-ink-45">
              FERMER
            </button>
          </div>
        </div>

        {/* Scrollable fields */}
        <div className="max-h-[55vh] space-y-4 overflow-y-auto px-5">

          {/* Statut paiement */}
          <div>
            <label className={labelClass}>Statut</label>
            <div className="flex gap-4 font-mono text-[11px]">
              {(['Oui', 'Non', '-'] as PaymentStatus[]).map((s) => (
                <button key={s} onClick={() => setPaye(s)}
                  className={cn('pb-1 transition-colors',
                    paye === s ? 'border-b-[1.5px] border-ink font-semibold text-ink' : 'text-ink-45')}>
                  {PAYE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Mode paiement */}
          <div>
            <label className={labelClass}>Mode de paiement</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode | '')}
              className={cn(fieldClass, 'appearance-none')}>
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m || '—'}</option>)}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className={labelClass}>Date</label>
            <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="DD/MM/YYYY"
              className={fieldClass} />
          </div>

          {/* Acheteur + Vendeur */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Acheteur</label>
              <input value={acheteur} onChange={(e) => setAcheteur(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Vendeur</label>
              <input value={vendeur} onChange={(e) => setVendeur(e.target.value)} className={fieldClass} />
            </div>
          </div>

          {/* Quantité */}
          <div>
            <label className={labelClass}>Quantité</label>
            <NumberStepper value={quantite} onChange={setQuantite} min={1} size="md" />
          </div>

          {/* Commentaire */}
          <div>
            <label className={labelClass}>Commentaire</label>
            <input value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Optionnel…"
              className={fieldClass} />
          </div>

          <div className="space-y-2.5 pb-3">
            <Button onClick={handleSave} loading={loading} className="w-full">Enregistrer</Button>
            {confirmingDelete ? (
              <div className="flex items-center justify-center gap-4 font-mono text-[10px] tracking-label">
                <span className="text-ink-55">Supprimer définitivement ?</span>
                <button onClick={() => onDelete(sale)} className="font-semibold text-alert">OUI, SUPPRIMER</button>
                <button onClick={() => setConfirmingDelete(false)} className="text-ink-45">ANNULER</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="w-full py-1 text-center font-mono text-[10px] font-medium tracking-label text-ink-45 hover:text-alert"
              >
                SUPPRIMER CETTE VENTE
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
