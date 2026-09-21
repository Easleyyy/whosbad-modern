import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tshirtsApi } from '@/lib/api';
import type { TShirtItem } from '@/types';

interface TshirtsData {
  success: boolean;
  marques: string[];
  items: TShirtItem[];
}

export type { TshirtsData };

export function useTshirts() {
  return useQuery({
    queryKey: ['tshirts'],
    queryFn: () => tshirtsApi.getAll() as Promise<TshirtsData>,
    staleTime: 60_000,
  });
}

export function useUpdateTshirt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { marque: string; sexe: string; taille: string; nouvelle_quantite: number }) =>
      tshirtsApi.update(body as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tshirts'] }),
  });
}

export function useAddTshirt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { marque: string; sexe: string; taille: string; quantite: number }) =>
      tshirtsApi.add(body as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tshirts'] }),
  });
}

/** Reads the t-shirt sheet on demand (the chat needs it only when a maillot command is typed),
 *  so pages hosting the chatbot don't pay an extra Sheets read on every mount. `fresh` skips
 *  the cache — required before a write, since add/remove are computed from the current quantity. */
export function useTshirtsLoader() {
  const qc = useQueryClient();
  return (fresh = false) =>
    qc.fetchQuery({
      queryKey: ['tshirts'],
      queryFn: () => tshirtsApi.getAll() as Promise<TshirtsData>,
      staleTime: fresh ? 0 : 60_000,
    });
}
