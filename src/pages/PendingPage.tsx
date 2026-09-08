import { useMemo } from 'react';
import { useAllSalesData } from '@/hooks/useSales';
import { LedgerHeader } from '@/components/ledger/LedgerHeader';
import { SaleCardSkeleton } from '@/components/ui/Skeleton';
import { formatShortDate } from '@/lib/utils';
import type { Sale } from '@/types';

function parseTs(dateStr: string) {
  if (!dateStr) return 0;
  const [dd, mm, yy] = dateStr.split('/');
  return new Date(+yy, +mm - 1, +dd).getTime() || 0;
}

function PendingRow({ sale }: { sale: Sale }) {
  return (
    <div className="flex items-baseline gap-2.5 border-b border-ink-hairline py-1.5">
      <span className="w-11 flex-shrink-0 whitespace-nowrap font-mono text-[10px] font-medium text-ink-45">
        {formatShortDate(sale.date)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{sale.acheteur}</span>
      <span className="max-w-[84px] flex-shrink-0 truncate text-[10px] text-ink-55">
        {sale.quantite} × {sale.produit}
      </span>
      <span className="flex-shrink-0 font-mono text-[12px] font-semibold text-alert">
        {(sale.montant ?? 0).toFixed(0)} €
      </span>
    </div>
  );
}

export function PendingPage() {
  const { data: allSales = [], isLoading } = useAllSalesData();

  const pendingSales = useMemo(() =>
    allSales.filter((s) => s.paye === 'Non').sort((a, b) => parseTs(b.date) - parseTs(a.date))
  , [allSales]);

  const totalPending = useMemo(() =>
    pendingSales.reduce((sum, s) => sum + (s.montant ?? 0), 0)
  , [pendingSales]);

  return (
    <div className="mx-auto flex h-full w-full max-w-[480px] flex-col bg-paper lg:max-w-[680px]">
      <LedgerHeader
        title="Impayés"
        kpis={[
          { label: 'À ENCAISSER', value: `${totalPending.toFixed(0)} €`, alert: totalPending > 0 },
          { label: 'VENTES', value: pendingSales.length },
        ]}
      />

      <div className="flex-1 overflow-y-auto no-scrollbar px-[22px] pt-2.5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SaleCardSkeleton key={i} />)
        ) : pendingSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            <p className="font-serif text-[20px] text-ink">Tout est réglé</p>
            <p className="text-[12px] text-ink-45">Aucun paiement en attente</p>
          </div>
        ) : (
          pendingSales.map((sale) => <PendingRow key={sale.id} sale={sale} />)
        )}
      </div>
    </div>
  );
}
