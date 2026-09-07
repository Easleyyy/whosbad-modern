import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { formatShortDate } from '@/lib/utils';
import type { Sale } from '@/types';

interface SaleCardProps {
  sale: Sale;
  index: number;
  onDelete?: (sale: Sale) => void;
  onEdit?: (sale: Sale) => void;
}

const CHIP: Record<Sale['paye'], { label: string; color: string }> = {
  Oui: { label: 'PAYÉ', color: 'oklch(0.4 0.1 145)' },
  Non: { label: 'ATTENTE', color: 'oklch(0.55 0.16 28)' },
  '-': { label: 'SOLDÉ', color: 'rgba(40,30,22,.45)' },
};

export const SaleCard = ({ sale, index, onDelete, onEdit }: SaleCardProps) => {
  const chip = CHIP[sale.paye] ?? CHIP['-'];

  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-100, -40], [1, 0]);

  const isTouchDevice = typeof window !== 'undefined' &&
    window.matchMedia('(pointer: coarse)').matches;

  const bind = useDrag(({ movement: [mx], last, cancel }) => {
    if (mx > 0) { cancel?.(); return; }
    if (last) {
      if (mx < -80) onDelete?.(sale);
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
    } else {
      x.set(mx);
    }
  }, { filterTaps: true, pointer: { touch: true } });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gestureHandlers = isTouchDevice ? (bind() as any) : {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.03, duration: 0.15 }}
      className="relative overflow-hidden"
    >
      <motion.div
        style={{ opacity: deleteOpacity }}
        className="absolute inset-0 flex items-center justify-end pr-1"
      >
        <span className="font-mono text-[9px] font-semibold tracking-kpi text-alert">SUPPRIMER</span>
      </motion.div>

      <div {...gestureHandlers} style={{ touchAction: 'pan-y' }}>
        <motion.button
          style={{ x }}
          onClick={() => onEdit?.(sale)}
          className="flex w-full items-baseline gap-2.5 border-b border-ink-hairline bg-paper py-1.5 text-left"
        >
          <span className="w-11 flex-shrink-0 whitespace-nowrap font-mono text-[10px] font-medium text-ink-45">
            {formatShortDate(sale.date)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">
            {sale.acheteur}
          </span>
          <span className="max-w-[84px] flex-shrink-0 truncate text-[10px] text-ink-55">
            {sale.quantite} × {sale.produit}
          </span>
          <span
            className="flex-shrink-0 border-b-[1.5px] font-mono text-[9px] font-semibold"
            style={{ color: chip.color, borderColor: chip.color }}
          >
            {chip.label}
          </span>
        </motion.button>
      </div>
    </motion.div>
  );
};
