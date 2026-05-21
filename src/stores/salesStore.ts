import { create } from 'zustand';
import type { ProductTab, SaleFilters } from '@/types';

interface SalesState {
  activeTab: ProductTab;
  filters: SaleFilters;
  showAIModal: boolean;
  setActiveTab: (tab: ProductTab) => void;
  setFilters: (filters: Partial<SaleFilters>) => void;
  setShowAIModal: (show: boolean) => void;
  resetFilters: () => void;
}

const defaultFilters: SaleFilters = { status: 'all', search: '' };

export const useSalesStore = create<SalesState>((set) => ({
  activeTab: 'Victor GM',
  filters: defaultFilters,
  showAIModal: false,
  setActiveTab: (tab) => set({ activeTab: tab, filters: defaultFilters }),
  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
  setShowAIModal: (show) => set({ showAIModal: show }),
  resetFilters: () => set({ filters: defaultFilters }),
}));
