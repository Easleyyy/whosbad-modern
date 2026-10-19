import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { salesApi } from '@/lib/api';
import { withChatContext, type ChatContext } from '@/lib/aiContext';
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

// Sales across every reference — ONE read of /api/data (which already
// returns every product's tab at once) instead of one request per product.
export function useAllSalesData() {
  const { data: references = [] as ProductReference[] } = useReferences();
  const refKey = references.map((r) => r.name).join('|');
  return useQuery({
    queryKey: ['sales', 'all', refKey],
    queryFn: async () => {
      const data = await salesApi.getAllData();
      return references.flatMap((ref) => {
        const rows = data[ref.name] ?? [];
        return rows.map((row, i) => mapRow(row as Record<string, unknown>, ref.name, i, ref.price));
      });
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

/** Fields a sale edit can change (same names as the API body). */
export interface SaleUpdate {
  rowIndex: number;
  tab: string;
  date?: string;
  new_acheteur?: string;
  vendeur?: string;
  quantite?: number;
  paye?: Sale['paye'];
  mode_paiement?: string;
  commentaire?: string;
}

/** Applies an edit to every cached copy of the sales list, so the ledger moves the instant a
 *  field changes instead of after the server round-trip (and a rollback snapshot is returned). */
function patchSalesCache(qc: QueryClient, v: SaleUpdate) {
  const prices = new Map((qc.getQueryData<ProductReference[]>(['references']) ?? []).map((r) => [r.name, r.price]));
  const snapshots = qc.getQueriesData<Sale[]>({ queryKey: ['sales', 'all'] });
  qc.setQueriesData<Sale[]>({ queryKey: ['sales', 'all'] }, (old) =>
    old?.map((s) => {
      if (s._row !== v.rowIndex || s.produit !== v.tab) return s;
      const quantite = v.quantite ?? s.quantite;
      return {
        ...s,
        ...(v.date !== undefined && { date: v.date }),
        ...(v.new_acheteur !== undefined && { acheteur: v.new_acheteur }),
        ...(v.vendeur !== undefined && { vendeur: v.vendeur }),
        ...(v.paye !== undefined && { paye: v.paye }),
        ...(v.mode_paiement !== undefined && { mode_paiement: v.mode_paiement as Sale['mode_paiement'] }),
        ...(v.commentaire !== undefined && { commentaire: v.commentaire }),
        quantite,
        montant: quantite * (prices.get(v.tab) ?? (s.quantite ? (s.montant ?? 0) / s.quantite : 0)),
      };
    })
  );
  return snapshots;
}

export function useUpdateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['sale-update'],
    mutationFn: (v: SaleUpdate) => salesApi.update(v as unknown as Record<string, unknown>),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['sales'] });
      return { snapshots: patchSalesCache(qc, v) };
    },
    onError: (_e, _v, ctx) => ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data)),
    // Several quick edits in a row: only refetch once the last one has settled, otherwise a
    // refetch carrying a half-applied state would flicker over the optimistic one.
    onSettled: () => {
      if (qc.isMutating({ mutationKey: ['sale-update'] }) <= 1) qc.invalidateQueries({ queryKey: ['sales'] });
    },
  });
}

export interface NewSale {
  tab: string;
  acheteur: string;
  quantite?: number;
  paye?: Sale['paye'];
  mode_paiement?: string;
  vendeur?: string;
  commentaire?: string;
  date?: string;
}

/** Creates a sale and returns its id, so the editor can carry on with the row just created. */
export function useAddSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: NewSale) => {
      const res = await salesApi.add(body as unknown as Record<string, unknown>);
      const row = (res.data as { row?: number }).row;
      if (!res.data.success || !row) throw new Error('La vente n\'a pas pu être créée');
      return row;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales'] }),
  });
}

export function useAIChat() {
  const qc = useQueryClient();
  const { data: references = [] as ProductReference[] } = useReferences();
  return useMutation({
    mutationFn: ({ message, ...ctx }: { message: string } & Omit<ChatContext, 'refs'>) =>
      salesApi.chat(withChatContext(message, { refs: references, ...ctx })).then((r) => r.data),
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
      qc.invalidateQueries({ queryKey: ['reassort'] });
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

// Réassort log across every reference — a SINGLE unfiltered read (the backend
// already returns the whole log when no `produit` is given), not one request
// per product: fanning this out like useAllSalesData() does for per-product
// sales tabs multiplied the Google Sheets API read load enough to trip its
// per-minute quota, since every product's log lives in the same 'Reassort'
// sheet anyway (unlike sales, which really are separate tabs per product).
export function useAllReassortLog() {
  return useQuery({
    queryKey: ['reassort', 'all'],
    queryFn: () => salesApi.getReassortLog(),
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
      qc.invalidateQueries({ queryKey: ['reassort'] });
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
      qc.invalidateQueries({ queryKey: ['reassort'] });
    },
  });
}
