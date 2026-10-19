import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingApi, type TrainingData } from '@/lib/trainingApi';
import type { PayStatus } from '@/types';

const KEY = ['entrainements'];

export function useEntrainements() {
  return useQuery({
    queryKey: KEY,
    queryFn: trainingApi.getAll,
    staleTime: 30_000, // also refetched when the app regains focus, so the other device's edits show up
  });
}

export const nextPayStatus = (s: PayStatus): PayStatus => (s === 'pending' ? 'paid' : s === 'paid' ? 'unpaid' : 'pending');

export function useAddPlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { groupe: string; nom: string; commentaire?: string }) => trainingApi.addPlayer(b.groupe, b.nom, b.commentaire),
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}

export function useDeletePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { groupe: string; id: string }) => trainingApi.deletePlayer(b.groupe, b.id),
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}

/** Payment status: applied instantly in the cache, rolled back if the server refuses. */
export function useSetPaiement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { groupe: string; id: string; statut: PayStatus }) => trainingApi.setPaiement(b.groupe, b.id, b.statut),
    onMutate: async ({ groupe, id, statut }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<TrainingData>(KEY);
      if (previous) {
        qc.setQueryData<TrainingData>(KEY, {
          ...previous,
          groups: {
            ...previous.groups,
            [groupe]: (previous.groups[groupe] ?? []).map((p) => (p.id === id ? { ...p, paiement: statut } : p)),
          },
        });
      }
      return { previous };
    },
    onError: (_e, _b, ctx) => { if (ctx?.previous) qc.setQueryData(KEY, ctx.previous); },
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}
