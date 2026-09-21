import { create } from 'zustand';
import type { SaleFilters } from '@/types';
import type { DatePreset } from '@/lib/utils';

/** Which kind of rows the movements ledger shows: everything, sales only, or restocks only. */
export type MovementKind = 'all' | 'vente' | 'reassort';

interface SalesState {
  /** Selected model filter for the movements ledger. `null` = show all products. */
  activeTab: string | null;
  filters: SaleFilters;
  datePreset: DatePreset;
  movementKind: MovementKind;
  setActiveTab: (tab: string | null) => void;
  setFilters: (filters: Partial<SaleFilters>) => void;
  setDatePreset: (preset: DatePreset) => void;
  setMovementKind: (kind: MovementKind) => void;
  resetFilters: () => void;
}

const defaultFilters: SaleFilters = { status: 'all', search: '' };

export const useSalesStore = create<SalesState>((set) => ({
  activeTab: null,
  filters: defaultFilters,
  datePreset: 'all',
  movementKind: 'all',
  setActiveTab: (tab) => set({ activeTab: tab }),
  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
  setDatePreset: (preset) => set({ datePreset: preset }),
  setMovementKind: (kind) => set({ movementKind: kind }),
  resetFilters: () => set({ filters: defaultFilters, datePreset: 'all', movementKind: 'all' }),
}));
