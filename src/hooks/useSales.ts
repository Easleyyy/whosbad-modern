import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '@/lib/api';
import { useSalesStore } from '@/stores/salesStore';
import { useReferencesStore } from '@/stores/referencesStore';
import { withCatalogueContext } from '@/lib/aiContext';
import type { Sale } from '@/types';

function mapRow(row: Record<string, unknown>, produit: string, idx: number, price: number): Sale {
  return {
    id: `${produit}-${idx}`,
    _row: row._row as number,
    date: (row.date as string) ?? '',
    vendeur: (row.vendeur as string) ?? '',
    acheteur: (row.acheteur as string) ?? '',
    quantite: Number(row.quantite) || 1,
    paye: (row.paye as Sale['paye']) ?? 'Non',
    mode_paiement: (row.mode_paiement as Sale['mode_paiement']) ?? '',
    commentaire: (row.commentaire as string) ?? '',
    produit,
    montant: Number(row.quantite) * price,
  };
}

export function useSalesData() {
  const { activeTab } = useSalesStore();
  const { references } = useReferencesStore();
  return useQuery({
    queryKey: ['sales', activeTab],
    queryFn: async () => {
      if (!activeTab) return [];
      const price = references.find((r) => r.name === activeTab)?.price ?? 22;
      try {
        const rows = await salesApi.getAll(activeTab);
        return rows.map((r, i) => mapRow(r, activeTab, i, price));
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });
}

export function useAllSalesData() {
  const { references } = useReferencesStore();
  const refKey = references.map((r) => r.name).join('|');
  return useQuery({
    queryKey: ['sales', 'all', refKey],
    queryFn: async () => {
      // Parallel fetching for all products
      const settled = await Promise.allSettled(
        references.map(async (ref) => {
          const rows = await salesApi.getAll(ref.name);
          return rows.map((r, i) => mapRow(r, ref.name, i, ref.price));
        })
      );
      return settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    },
    staleTime: 60_000,
  });
}

export function useAchats() {
  return useQuery({
    queryKey: ['achats'],
    queryFn: () => salesApi.getAchats(),
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
}

export function useDeleteSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rowIndex, tab }: { rowIndex: number; tab: string }) =>
      salesApi.delete(tab, rowIndex),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales'] }),
  });
}

export function useUpdateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => salesApi.update(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales'] }),
  });
}

export function useAIChat() {
  const qc = useQueryClient();
  const { references } = useReferencesStore();
  return useMutation({
    mutationFn: (message: string) =>
      salesApi.chat(withCatalogueContext(message, references)).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['achats'] });
    },
  });
}

export function useStockUpdate() {
  const qc = useQueryClient();
  const { references } = useReferencesStore();
  return useMutation({
    mutationFn: ({ product, qty }: { product: string; qty: number }) =>
      salesApi
        .chat(withCatalogueContext(`J'ai reçu ${qty} boites de ${product}`, references))
        .then((r) => r.data),
    onSuccess: (_, { product, qty }) => {
      qc.setQueryData<Record<string, number>>(['achats'], (old = {}) => ({
        ...old,
        [product]: (old[product] ?? 0) + qty,
      }));
      qc.invalidateQueries({ queryKey: ['sales'] });
    },
  });
}
