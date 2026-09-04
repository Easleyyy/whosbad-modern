import { useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import { useAllSalesData } from '@/hooks/useSales';
import { useReferencesStore } from '@/stores/referencesStore';
import { SaleCardSkeleton } from '@/components/ui/Skeleton';
import { getColorHex, hexToRgba, type Sale } from '@/types';

function parseTs(dateStr: string) {
  if (!dateStr) return 0;
  const [dd, mm, yy] = dateStr.split('/');
  return new Date(+yy, +mm - 1, +dd).getTime() || 0;
}

function PendingSaleCard({ sale }: { sale: Sale }) {
  const { references } = useReferencesStore();
  const ref = references.find((r) => r.name === sale.produit);
  const hex = getColorHex(ref?.color ?? 'white');

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 bg-surface-800/50 rounded-2xl border border-white/6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-sm text-white truncate">{sale.acheteur}</span>
          {sale.produit && (
            <span
              className="text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0"
              style={{
                color: hex,
                backgroundColor: hexToRgba(hex, 0.1),
                borderColor: hexToRgba(hex, 0.3),
              }}
            >
              {sale.produit}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{sale.date}</span>
          <span>·</span>
          <span>{sale.quantite > 1 ? `${sale.quantite} boîtes` : '1 boîte'}</span>
          {sale.vendeur && <><span>·</span><span>{sale.vendeur}</span></>}
        </div>
      </div>
      {sale.montant != null && (
        <span className="text-sm font-semibold text-danger-400 flex-shrink-0">
          {sale.montant.toFixed(2).replace('.', ',')} €
        </span>
      )}
    </div>
  );
}

export function PendingPage() {
  const { data: allSales = [], isLoading } = useAllSalesData();

  const pendingSales = useMemo(() => {
    return allSales
      .filter(s => s.paye === 'Non')
      .sort((a, b) => parseTs(b.date) - parseTs(a.date));
  }, [allSales]);

  const totalPending = useMemo(() => {
    return pendingSales.reduce((sum, s) => sum + (s.montant ?? 0), 0);
  }, [pendingSales]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-5 h-5 text-danger-500" />
          <h1 className="text-2xl font-bold text-white">Impayés</h1>
        </div>

        {!isLoading && (
          <div className="flex items-center justify-between px-4 py-3 bg-danger-600/15 border border-danger-600/30 rounded-2xl mb-2">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Total en attente</p>
              <p className="text-2xl font-bold text-danger-400 mt-0.5">
                {totalPending.toFixed(2).replace('.', ',')} €
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Ventes</p>
              <p className="text-xl font-bold text-white">{pendingSales.length}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SaleCardSkeleton key={i} />)
        ) : pendingSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <span className="text-4xl">✓</span>
            <p className="text-white font-semibold">Tout est réglé !</p>
            <p className="text-gray-500 text-sm">Aucun paiement en attente.</p>
          </div>
        ) : (
          pendingSales.map((sale) => (
            <PendingSaleCard key={sale.id} sale={sale} />
          ))
        )}
      </div>
    </div>
  );
}
