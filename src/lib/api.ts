import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? 'https://whosbad-backend.onrender.com';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
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

  add: (body: Record<string, unknown>) =>
    api.post<{ success: boolean }>('/api/add', body),

  update: (body: Record<string, unknown>) =>
    api.post<{ success: boolean }>('/api/update', body),

  delete: (tab: string, rowIndex: number) =>
    api.delete<{ success: boolean }>('/api/delete', { data: { tab, rowIndex } }),

  chat: (message: string) =>
    api.post<{ success: boolean; action: string; message: string; data?: unknown[] }>('/api/chat', { message }),
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
};
