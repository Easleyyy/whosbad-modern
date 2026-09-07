import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entrainementsApi } from '@/lib/api';
import type { TrainingPlayer } from '@/types';

type PayStatus = 'pending' | 'paid' | 'unpaid';

interface EntrainementsData {
  success: boolean;
  groups: Record<string, TrainingPlayer[]>;
  groupOrder: string[];
}

// localStorage used as optimistic / offline cache
const STORAGE_KEY = 'ent-payments';

function getPayments(): Record<string, Record<string, PayStatus>> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { return {}; }
}

function setPaymentLocal(groupe: string, nom: string, status: PayStatus) {
  const p = getPayments();
  if (!p[groupe]) p[groupe] = {};
  p[groupe][nom] = status;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

/**
 * Returns pay status: server data (from query cache) takes priority,
 * falls back to localStorage for optimistic / offline values.
 */
export function getPayStatus(groupe: string, nom: string, serverStatus?: PayStatus): PayStatus {
  if (serverStatus && serverStatus !== 'pending') return serverStatus;
  return getPayments()[groupe]?.[nom] ?? serverStatus ?? 'pending';
}

export function cyclePayStatus(groupe: string, nom: string, current: PayStatus): PayStatus {
  const cycle: PayStatus[] = ['pending', 'paid', 'unpaid'];
  const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];
  setPaymentLocal(groupe, nom, next);
  return next;
}

export function useEntrainements() {
  return useQuery({
    queryKey: ['entrainements'],
    queryFn: () => entrainementsApi.getAll() as Promise<EntrainementsData>,
    staleTime: 60_000,
  });
}

export function useAddPlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { groupe: string; nom: string; commentaire?: string }) =>
      entrainementsApi.addPlayer(body as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entrainements'] }),
  });
}

export function useDeletePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { groupe: string; nom: string }) =>
      entrainementsApi.deletePlayer(body as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entrainements'] }),
  });
}

export function useSetPaiement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { groupe: string; nom: string; statut: string }) =>
      entrainementsApi.setPaiement(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entrainements'] }),
  });
}
