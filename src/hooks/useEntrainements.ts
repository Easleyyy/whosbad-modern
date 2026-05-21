import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entrainementsApi } from '@/lib/api';
import type { TrainingPlayer } from '@/types';

type PayStatus = 'pending' | 'paid' | 'unpaid';

interface EntrainementsData {
  success: boolean;
  groups: Record<string, TrainingPlayer[]>;
  groupOrder: string[];
}

// Payment status stored in localStorage
const STORAGE_KEY = 'ent-payments';

function getPayments(): Record<string, Record<string, PayStatus>> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { return {}; }
}

function setPayment(groupe: string, nom: string, status: PayStatus) {
  const p = getPayments();
  if (!p[groupe]) p[groupe] = {};
  p[groupe][nom] = status;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function getPayStatus(groupe: string, nom: string): PayStatus {
  return getPayments()[groupe]?.[nom] ?? 'pending';
}

export function cyclePayStatus(groupe: string, nom: string): PayStatus {
  const cycle: PayStatus[] = ['pending', 'paid', 'unpaid'];
  const cur = getPayStatus(groupe, nom);
  const next = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
  setPayment(groupe, nom, next);
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
