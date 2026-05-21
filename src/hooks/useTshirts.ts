import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tshirtsApi } from '@/lib/api';
import type { TShirtItem } from '@/types';

interface TshirtsData {
  success: boolean;
  marques: string[];
  items: TShirtItem[];
}

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
