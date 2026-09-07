import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProductReference } from '@/types';

export const DEFAULT_REFERENCES: ProductReference[] = [
  { id: 'victor-gm', name: 'Victor GM', price: 22, color: 'amber',  isDefault: true },
  { id: 'victor-pc', name: 'Victor PC', price: 22, color: 'teal',   isDefault: true },
  { id: 'cbx-red',   name: 'CBX RED',   price: 18, color: 'red',    isDefault: true },
  { id: 'cbx-blue',  name: 'CBX BLUE',  price: 18, color: 'blue',   isDefault: true },
];

interface ReferencesState {
  references: ProductReference[];
  addReference: (ref: Omit<ProductReference, 'id' | 'isDefault'>) => void;
  updateReference: (id: string, updates: Partial<Omit<ProductReference, 'id' | 'isDefault'>>) => void;
  deleteReference: (id: string) => void;
  reorderReferences: (refs: ProductReference[]) => void;
}

export const useReferencesStore = create<ReferencesState>()(
  persist(
    (set) => ({
      references: DEFAULT_REFERENCES,
      addReference: (ref) =>
        set((s) => ({
          references: [...s.references, { ...ref, id: `custom-${Date.now()}` }],
        })),
      updateReference: (id, updates) =>
        set((s) => ({
          references: s.references.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),
      deleteReference: (id) =>
        set((s) => ({ references: s.references.filter((r) => r.id !== id) })),
      reorderReferences: (refs) => set({ references: refs }),
    }),
    { name: 'wb-references' }
  )
);
