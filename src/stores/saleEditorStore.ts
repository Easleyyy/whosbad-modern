import { create } from 'zustand';
import type { Sale } from '@/types';

// Which sale editor is open. Lives in a store (not page state) so any page — registre, impayés,
// fiche adhérent — can open the same editor, rendered once by <SaleEditorHost /> at the app shell.

interface NewSaleOptions {
  /** Adhérent already known (opened from his fiche). */
  buyer?: string;
  /** Product already chosen (opened from a product row). */
  produit?: string;
}

interface SaleEditorState {
  editing: Sale | null;
  creating: NewSaleOptions | null;
  openEditor: (sale: Sale) => void;
  openNew: (options?: NewSaleOptions) => void;
  close: () => void;
}

export const useSaleEditor = create<SaleEditorState>((set) => ({
  editing: null,
  creating: null,
  openEditor: (sale) => set({ editing: sale, creating: null }),
  openNew: (options = {}) => set({ creating: options, editing: null }),
  close: () => set({ editing: null, creating: null }),
}));
