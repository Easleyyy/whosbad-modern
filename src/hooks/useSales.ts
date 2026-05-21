import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '@/lib/api';
import { useSalesStore } from '@/stores/salesStore';
import type { Sale } from '@/types';

const PRODUCTS = ['Victor GM', 'Victor PC', 'CBX RED', 'CBX BLUE'] as const;
const PRICES: Record<string, number> = {
  'Victor GM': 22, 'Victor PC': 22, 'CBX RED': 18, 'CBX BLUE': 18,
};

function mapRow(row: Record<string, unknown>, produit: string, idx: number): Sale {
  return {
    id: `${produit}-${idx}`,
    _row: row._row as number,
    date: row.date as string ?? '',
    vendeur: row.vendeur as string ?? '',
    acheteur: row.acheteur as string ?? '',
    quantite: Number(row.quantite) || 1,
    paye: (row.paye as Sale['paye']) ?? 'Non',
    mode_paiement: (row.mode_paiement as Sale['mode_paiement']) ?? '',
    commentaire: row.commentaire as string ?? '',
    produit: produit as Sale['produit'],
    montant: Number(row.quantite) * (PRICES[produit] ?? 22),
  };
}

export function useSalesData() {
  const { activeTab } = useSalesStore();
  return useQuery({
    queryKey: ['sales', activeTab],
    queryFn: async () => {
      const rows = await salesApi.getAll(activeTab);
      return rows.map((r, i) => mapRow(r, activeTab, i));
    },
    staleTime: 30_000,
  });
}

export function useAllSalesData() {
  return useQuery({
    queryKey: ['sales', 'all'],
    queryFn: async () => {
      const results: Sale[] = [];
      for (const tab of PRODUCTS) {
        const rows = await salesApi.getAll(tab);
        results.push(...rows.map((r, i) => mapRow(r, tab, i)));
      }
      return results;
    },
    staleTime: 30_000,
  });
}

export function useAchats() {
  return useQuery({
    queryKey: ['achats'],
    queryFn: () => salesApi.getAchats(),
    staleTime: 60_000,
  });
}

export function useDeleteSale() {
  const qc = useQueryClient();
  const { activeTab } = useSalesStore();
  return useMutation({
    mutationFn: ({ rowIndex }: { rowIndex: number }) =>
      salesApi.delete(activeTab, rowIndex),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales', activeTab] }),
  });
}

export function useAIChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => salesApi.chat(message).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales'] }),
  });
}
