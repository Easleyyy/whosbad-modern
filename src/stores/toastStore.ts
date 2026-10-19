import { create } from 'zustand';
import type { Toast, ToastType } from '@/hooks/useToast';

// Toasts raised from outside any one page (the sale editor and the delete-with-undo flow live at
// the app shell, because they can be opened from several pages). Pages keep their own local
// `useToast` for page-specific messages.

interface ToastState {
  toasts: Toast[];
  add: (message: string, type?: ToastType) => void;
  addUndo: (message: string, onUndo: () => void) => void;
  remove: (id: string) => void;
}

const uid = () => Math.random().toString(36).slice(2);

export const useGlobalToasts = create<ToastState>((set, get) => ({
  toasts: [],
  add: (message, type = 'info') => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().remove(id), 3500);
  },
  addUndo: (message, onUndo) => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts, { id, message, type: 'info', undoAction: onUndo }] }));
    setTimeout(() => get().remove(id), 5000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
