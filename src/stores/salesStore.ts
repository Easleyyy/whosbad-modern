import { create } from 'zustand';
import type { ProductTab, SaleFilters } from '@/types';
import type { DatePreset } from '@/lib/utils';

interface SalesState {
  activeTab: ProductTab;
  filters: SaleFilters;
  datePreset: DatePreset;
  showAIModal: boolean;
  setActiveTab: (tab: ProductTab) => void;
  setFilters: (filters: Partial<SaleFilters>) => void;
  setDatePreset: (preset: DatePreset) => void;
  setShowAIModal: (show: boolean) => void;
  resetFilters: () => void;
}

const defaultFilters: SaleFilters = { status: 'all', search: '' };

export const useSalesStore = create<SalesState>((set) => ({
  activeTab: 'Victor GM',
  filters: defaultFilters,
  datePreset: 'all',
  showAIModal: false,
  setActiveTab: (tab) => set({ activeTab: tab, filters: defaultFilters, datePreset: 'all' }),
  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
  setDatePreset: (preset) => set({ datePreset: preset }),
  setShowAIModal: (show) => set({ showAIModal: show }),
  resetFilters: () => set({ filters: defaultFilters, datePreset: 'all' }),
}));
