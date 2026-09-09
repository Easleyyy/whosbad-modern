import axios from 'axios';
import type { ReassortEntry, ProductReference } from '@/types';

const API_URL = import.meta.env.VITE_API_URL ?? 'https://whosbad-backend.onrender.com';

// Le backend gratuit (Render) s'endort après 15 min d'inactivité — un premier
// appel peut prendre 30 à 50s le temps qu'il se réveille. Un timeout court ferait
// échouer une vente/ajout qui aurait fini par passer. 60s laisse la marge.
export const api = axios.create({
  baseURL: API_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// Intercepteur pour logs en dev
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (import.meta.env.DEV) console.error('[API Error]', err.response?.data ?? err.message);
    return Promise.reject(err);
  }
);

// ── Sales ─────────────────────────────────────────────────────────
export const salesApi = {
  getAll: (tab: string) =>
    api.get<{ success: boolean; data: Record<string, unknown[]> }>('/api/data').then((r) => {
      const raw = r.data.data[tab] ?? [];
      return raw.map((row) => row as Record<string, unknown>);
    }),

  getAchats: () =>
    api.get<Record<string, number>>('/api/achats').then((r) => r.data),

  addStock: (produit: string, qty: number) =>
    api.post<{ success: boolean; produit: string; achats: number; error?: string }>('/api/achats/add', { produit, qty }).then((r) => r.data),

  getReassortLog: (produit?: string) =>
    api.get<{ success: boolean; log: ReassortEntry[] }>('/api/achats/log', { params: produit ? { produit } : {} }).then((r) => r.data.log),

  updateReassort: (rowIndex: number, produit: string, qty: number) =>
    api.post<{ success: boolean; produit: string; achats: number; error?: string }>('/api/achats/update', { rowIndex, produit, qty }).then((r) => r.data),

  deleteReassort: (rowIndex: number, produit: string) =>
    api.post<{ success: boolean; produit: string; achats: number; error?: string }>('/api/achats/delete', { rowIndex, produit }).then((r) => r.data),

  getReferences: () =>
    api.get<{ success: boolean; references: Pick<ProductReference, 'name' | 'price' | 'color'>[] }>('/api/references').then((r) => r.data.references),

  addReference: (name: string, price: number, color?: string) =>
    api.post<{ success: boolean; produit: string; prix: number; error?: string }>('/api/references/add', { name, price, color }).then((r) => r.data),

  updateReference: (name: string, updates: { newName?: string; newPrice?: number; newColor?: string }) =>
    api.post<{ success: boolean; produit: string; prix: number; couleur: string; error?: string }>('/api/references/update', { name, ...updates }).then((r) => r.data),

  deleteReference: (name: string) =>
    api.post<{ success: boolean; produit: string; error?: string }>('/api/references/delete', { name }).then((r) => r.data),

  add: (body: Record<string, unknown>) =>
    api.post<{ success: boolean }>('/api/add', body),

  update: (body: Record<string, unknown>) =>
    api.post<{ success: boolean }>('/api/update', body),

  delete: (tab: string, rowIndex: number) =>
    api.delete<{ success: boolean }>('/api/delete', { data: { tab, rowIndex } }),

  chat: (message: string) =>
    api.post<{ success: boolean; action: string; message: string; produit?: string; achats?: number; data?: unknown[] }>('/api/chat', { message }),
};

// ── T-Shirts ──────────────────────────────────────────────────────
export const tshirtsApi = {
  getAll: () => api.get('/api/tshirts').then((r) => r.data),
  update: (body: Record<string, unknown>) => api.post('/api/tshirts/update', body),
  add: (body: Record<string, unknown>) => api.post('/api/tshirts/add', body),
};

// ── Entraînements ─────────────────────────────────────────────────
export const entrainementsApi = {
  getAll: () => api.get('/api/entrainements').then((r) => r.data),
  addPlayer: (body: Record<string, unknown>) => api.post('/api/entrainements/add', body),
  updatePlayer: (body: Record<string, unknown>) => api.post('/api/entrainements/update', body),
  deletePlayer: (body: Record<string, unknown>) => api.post('/api/entrainements/delete', body),
  setPaiement: (body: { groupe: string; nom: string; statut: string }) =>
    api.post('/api/entrainements/paiement', body),
};
