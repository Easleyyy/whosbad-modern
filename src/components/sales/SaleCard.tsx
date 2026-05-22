import { motion } from 'framer-motion';
import { Trash2, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn, formatDate, getInitials, getAvatarColor } from '@/lib/utils';
import type { Sale } from '@/types';

interface SaleCardProps {
  sale: Sale;
  index: number;
  onDelete?: (sale: Sale) => void;
  onEdit?: (sale: Sale) => void;
}

export const SaleCard = ({ sale, index, onDelete, onEdit }: SaleCardProps) => {
  const initials = getInitials(sale.acheteur);
  const avatarColor = getAvatarColor(sale.acheteur);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      onClick={() => onEdit?.(sale)}
      className={cn(
        'flex items-center gap-3 px-4 py-3.5 bg-surface-800/50 rounded-2xl border border-white/6 transition-all',
        onEdit && 'cursor-pointer active:scale-[0.98] active:bg-surface-800'
      )}
    >
      {/* Avatar */}
      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0', avatarColor)}>
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-sm text-white truncate">{sale.acheteur}</span>
          <Badge status={sale.paye} size="sm" />
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{formatDate(sale.date)}</span>
          <span>·</span>
          <span>{sale.quantite > 1 ? `${sale.quantite} boîtes` : '1 boîte'}</span>
          {sale.mode_paiement && <><span>·</span><span>{sale.mode_paiement}</span></>}
        </div>
      </div>

      {/* Montant + actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {sale.montant != null && (
          <span className="text-sm font-semibold text-white mr-1">{sale.montant.toFixed(2).replace('.', ',')} €</span>
        )}
        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(sale); }}
            className="p-1.5 rounded-lg text-gray-500 hover:text-primary-400 hover:bg-primary-600/10 transition-colors"
            aria-label="Modifier la vente"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(sale); }}
            className="p-1.5 rounded-lg text-gray-500 hover:text-danger-500 hover:bg-danger-100/10 transition-colors"
            aria-label="Supprimer la vente"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
};
