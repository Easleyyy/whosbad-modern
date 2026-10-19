import { useMemo } from 'react';
import { useAchats, useAllSalesData, useReferences } from '@/hooks/useSales';
import { computeCoverage, type Coverage } from '@/lib/stockCoverage';
import type { ProductReference } from '@/types';

export interface InventoryItem extends ProductReference {
  stock: number;
  coverage: Coverage;
}

/** Stock per reference (bought − sold, floored at 0 for display) plus the estimated days left at
 *  the recent sales pace. One place for it: the registre, the sale sheet and the chat all use it. */
export function useInventory() {
  const { data: references = [] as ProductReference[] } = useReferences();
  const { data: achats = {} } = useAchats();
  const { data: sales = [], isLoading } = useAllSalesData();

  const items = useMemo<InventoryItem[]>(() => {
    const sold: Record<string, number> = {};
    for (const s of sales) if (s.produit) sold[s.produit] = (sold[s.produit] ?? 0) + s.quantite;
    const today = new Date();
    return references.map((ref) => {
      const stock = Math.max(0, (achats[ref.name] ?? 0) - (sold[ref.name] ?? 0));
      return { ...ref, stock, coverage: computeCoverage(sales, ref.name, stock, today) };
    });
  }, [references, achats, sales]);

  return { items, sales, isLoading };
}
