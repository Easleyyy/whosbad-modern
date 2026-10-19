import { useMemo } from 'react';
import { useAllSalesData, useUpdateSale } from '@/hooks/useSales';
import { useSaleEditor } from '@/stores/saleEditorStore';
import { useGlobalToasts } from '@/stores/toastStore';
import { LedgerHeader } from '@/components/ledger/LedgerHeader';
import { SaleCardSkeleton } from '@/components/ui/Skeleton';
import { formatShortDate } from '@/lib/utils';
import type { Sale } from '@/types';

function parseTs(dateStr: string) {
  if (!dateStr) return 0;
  const [dd, mm, yy] = dateStr.split('/');
  return new Date(+yy, +mm - 1, +dd).getTime() || 0;
}

function ageDays(dateStr: string) {
  const t = parseTs(dateStr);
  return t ? Math.floor((Date.now() - t) / 86_400_000) : 0;
}

function PendingRow({ sale, onPaid }: { sale: Sale; onPaid: (sale: Sale) => void }) {
  const openEditor = useSaleEditor((st) => st.openEditor);
  const age = ageDays(sale.date);
  return (
    <div className="flex items-center gap-1 border-b border-ink-hairline">
      <button onClick={() => openEditor(sale)} className="flex min-h-[52px] min-w-0 flex-1 items-baseline gap-2.5 py-1.5 text-left" aria-label={`Modifier la vente de ${sale.acheteur}`}>
        <span className="w-11 flex-shrink-0 whitespace-nowrap font-mono text-[10px] font-medium text-ink-55">
          {formatShortDate(sale.date)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">{sale.acheteur}</span>
          <span className="block truncate font-mono text-[10.5px] text-ink-55">
            {sale.quantite} × {sale.produit}
            {age >= 14 && <span className="ml-2 font-semibold text-alert">depuis {age} j</span>}
          </span>
        </span>
        <span className="flex-shrink-0 font-mono text-[12.5px] font-semibold text-alert">{(sale.montant ?? 0).toFixed(0)} €</span>
      </button>
      <button
        onClick={() => onPaid(sale)}
        className="min-h-[44px] flex-shrink-0 border-[1.5px] border-ink px-3 font-mono text-[10.5px] font-semibold tracking-label text-ink hover:bg-ink hover:text-paper"
      >
        PAYÉ
      </button>
    </div>
  );
}

export function PendingPage() {
  const { data: allSales = [], isLoading } = useAllSalesData();
  const { mutate: updateSale } = useUpdateSale();
  const { add, addUndo } = useGlobalToasts();

  // One tap = paid, saved immediately; the toast lets you take it back (or open the sale to give the payment mode).
  const markPaid = (sale: Sale) => {
    if (!sale._row || !sale.produit) return;
    const base = { rowIndex: sale._row, tab: sale.produit };
    updateSale({ ...base, paye: 'Oui' }, { onError: () => add('Échec de l’enregistrement', 'error') });
    addUndo(`${sale.acheteur} · payé ✓`, () => updateSale({ ...base, paye: 'Non' }));
  };

  const pendingSales = useMemo(() =>
    allSales.filter((s) => s.paye === 'Non').sort((a, b) => parseTs(b.date) - parseTs(a.date))
  , [allSales]);

  const totalPending = useMemo(() =>
    pendingSales.reduce((sum, s) => sum + (s.montant ?? 0), 0)
  , [pendingSales]);

  return (
    <div className="mx-auto flex h-full w-full max-w-[720px] flex-col bg-paper">
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
          pendingSales.map((sale) => <PendingRow key={sale.id} sale={sale} onPaid={markPaid} />)
        )}
      </div>
    </div>
  );
}
