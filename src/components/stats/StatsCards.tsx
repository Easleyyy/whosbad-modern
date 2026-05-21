import { TrendingUp, Package, Clock } from 'lucide-react';
import type { Sale } from '@/types';

const PRICES: Record<string, number> = {
  'Victor GM': 22, 'Victor PC': 22, 'CBX RED': 18, 'CBX BLUE': 18,
};

interface StatsCardsProps {
  sales: Sale[];
  stockTotal: number;
  soldTotal: number;
}

export function StatsCards({ sales, stockTotal, soldTotal }: StatsCardsProps) {
  const paid = sales.filter((s) => s.paye === 'Oui');
  const pending = sales.filter((s) => s.paye === 'Non');
  const caTotal = paid.reduce((sum, s) => sum + (s.montant ?? 0), 0);
  const pendingAmount = pending.reduce((sum, s) => sum + ((PRICES[s.produit ?? ''] ?? 22) * s.quantite), 0);

  const cards = [
    { icon: Package, label: 'Stock restant', value: `${stockTotal - soldTotal}`, sub: `${soldTotal}/${stockTotal} vendues`, color: 'text-teal-400' },
    { icon: TrendingUp, label: 'CA encaissé', value: `${caTotal.toFixed(0)} €`, sub: `${paid.length} ventes payées`, color: 'text-success-600' },
    { icon: Clock, label: 'En attente', value: `${pendingAmount.toFixed(0)} €`, sub: `${pending.length} ventes`, color: 'text-warning-600' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {cards.map(({ icon: Icon, label, value, sub, color }) => (
        <div key={label} className="bg-surface-800/50 rounded-2xl p-3 border border-white/6">
          <Icon className={`w-4 h-4 ${color} mb-2`} />
          <p className="text-base font-bold text-white leading-tight">{value}</p>
          <p className="text-xs text-gray-400 mt-0.5 leading-tight">{label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
        </div>
      ))}
    </div>
  );
}
