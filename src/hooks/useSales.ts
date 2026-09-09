import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '@/lib/api';
import { useSalesStore } from '@/stores/salesStore';
import { withCatalogueContext } from '@/lib/aiContext';
import type { Sale, ProductReference } from '@/types';

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

// Références produit — désormais lues depuis le serveur (voir GET /api/references)
// au lieu du localStorage, pour que desktop et mobile voient toujours le même
// catalogue sans avoir à ajouter/renommer une référence sur chaque appareil.
export function useReferences() {
  return useQuery({
    queryKey: ['references'],
    queryFn: () => salesApi.getReferences(),
    staleTime: 60_000,
  });
}

export function useAddReference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, price, color }: { name: string; price: number; color?: string }) => {
      const result = await salesApi.addReference(name, price, color);
      if (!result.success) throw new Error(result.error ?? 'Échec de la création');
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['references'] }),
  });
}

export function useUpdateReference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, newName, newPrice, newColor }: { name: string; newName?: string; newPrice?: number; newColor?: string }) => {
      const result = await salesApi.updateReference(name, { newName, newPrice, newColor });
      if (!result.success) throw new Error(result.error ?? 'Échec de la mise à jour');
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['references'] }),
  });
}

export function useDeleteReference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const result = await salesApi.deleteReference(name);
      if (!result.success) throw new Error(result.error ?? 'Échec de la suppression');
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['references'] }),
  });
}

export function useSalesData() {
  const { activeTab } = useSalesStore();
  const { data: references = [] as ProductReference[] } = useReferences();
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
  const { data: references = [] as ProductReference[] } = useReferences();
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
  const { data: references = [] as ProductReference[] } = useReferences();
  return useMutation({
    mutationFn: (message: string) =>
      salesApi.chat(withCatalogueContext(message, references)).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['achats'] });
      qc.invalidateQueries({ queryKey: ['reassort'] });
    },
  });
}

export function useStockUpdate() {
  const qc = useQueryClient();
  return useMutation({
    // Calls the dedicated /api/achats/add route directly — the chat endpoint
    // has no real concept of "stock movement" (it can only record sales), so
    // routing reappro through it was unreliable and could misfire into a
    // fake sale. This writes straight to the persisted Stock sheet.
    mutationFn: async ({ product, qty }: { product: string; qty: number }) => {
      const result = await salesApi.addStock(product, qty);
      if (!result.success) throw new Error(result.error ?? 'Échec de la mise à jour du stock');
      return result;
    },
    onSuccess: (result) => {
      qc.setQueryData<Record<string, number>>(['achats'], (old = {}) => ({
        ...old,
        [result.produit]: result.achats,
      }));
      qc.invalidateQueries({ queryKey: ['reassort', result.produit] });
    },
  });
}

export function useReassortLog(produit: string | null) {
  return useQuery({
    queryKey: ['reassort', produit],
    queryFn: () => salesApi.getReassortLog(produit as string),
    enabled: !!produit,
    staleTime: 30_000,
  });
}

// Réassort log across every reference — same fan-out pattern as
// useAllSalesData(), so the movements list can show stock-in entries
// alongside sales instead of only inside the per-product Réassort modal.
export function useAllReassortLog() {
  const { data: references = [] as ProductReference[] } = useReferences();
  const refKey = references.map((r) => r.name).join('|');
  return useQuery({
    queryKey: ['reassort', 'all', refKey],
    queryFn: async () => {
      const settled = await Promise.allSettled(
        references.map((ref) => salesApi.getReassortLog(ref.name))
      );
      return settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    },
    staleTime: 30_000,
  });
}

export function useUpdateReassort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rowIndex, produit, qty }: { rowIndex: number; produit: string; qty: number }) => {
      const result = await salesApi.updateReassort(rowIndex, produit, qty);
      if (!result.success) throw new Error(result.error ?? 'Échec de la mise à jour');
      return result;
    },
    onSuccess: (result) => {
      qc.setQueryData<Record<string, number>>(['achats'], (old = {}) => ({ ...old, [result.produit]: result.achats }));
      qc.invalidateQueries({ queryKey: ['reassort', result.produit] });
    },
  });
}

export function useDeleteReassort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rowIndex, produit }: { rowIndex: number; produit: string }) => {
      const result = await salesApi.deleteReassort(rowIndex, produit);
      if (!result.success) throw new Error(result.error ?? 'Échec de la suppression');
      return result;
    },
    onSuccess: (result) => {
      qc.setQueryData<Record<string, number>>(['achats'], (old = {}) => ({ ...old, [result.produit]: result.achats }));
      qc.invalidateQueries({ queryKey: ['reassort', result.produit] });
    },
  });
}
