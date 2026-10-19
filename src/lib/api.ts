import axios from 'axios';
import type { ReassortEntry, ProductReference, ChatResponse } from '@/types';
import { AUTH_HEADERS } from '@/lib/apiSecret';

// Même origine que le frontend depuis la migration vers Netlify Functions + Postgres — plus
// de Render, plus de réveil à froid, donc plus besoin d'un timeout long pour l'absorber.
export const api = axios.create({
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
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
  // GET /api/data has no per-tab filter — it always reads every registered
  // product's sales tab in one round trip. Fetch it once (getAllData) rather
  // than once per product, which used to multiply Sheets API reads sixfold.
  getAllData: () =>
    api.get<{ success: boolean; data: Record<string, unknown[]> }>('/api/data').then((r) => r.data.data),

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
    api.post<{ success: boolean; row?: number }>('/api/add', body),

  update: (body: Record<string, unknown>) =>
    api.post<{ success: boolean }>('/api/update', body),

  delete: (tab: string, rowIndex: number) =>
    api.delete<{ success: boolean }>('/api/delete', { data: { tab, rowIndex } }),

  chat: (message: string) =>
    api.post<ChatResponse>('/api/chat', { message }),
};

// ── T-Shirts ──────────────────────────────────────────────────────
export const tshirtsApi = {
  getAll: () => api.get('/api/tshirts').then((r) => r.data),
  update: (body: Record<string, unknown>) => api.post('/api/tshirts/update', body),
  add: (body: Record<string, unknown>) => api.post('/api/tshirts/add', body),
};
