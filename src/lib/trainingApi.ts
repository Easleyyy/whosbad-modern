import type { PayStatus, TrainingPlayer } from '@/types';
import { AUTH_HEADERS } from '@/lib/apiSecret';

// Entraînements live in Postgres (training_groups/training_players) behind
// netlify/functions/api.mts — see netlify/lib/trainingRoutes.ts. The season Google Sheet is
// no longer read here; groups and players are managed entirely through the app now.

export interface TrainingData {
  success: boolean;
  groups: Record<string, TrainingPlayer[]>;
  groupOrder: string[];
}

const ENDPOINT = '/api/training';

async function call(init?: RequestInit): Promise<TrainingData> {
  const res = await fetch(ENDPOINT, { ...init, headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS, ...init?.headers } });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.groups || !Array.isArray(json.groupOrder)) {
    throw new Error(json?.error ?? `Liste des entraînements indisponible (${res.status})`);
  }
  return json as TrainingData;
}

const post = (body: Record<string, unknown>) => call({ method: 'POST', body: JSON.stringify(body) });

export const trainingApi = {
  getAll: () => call(),
  setPaiement: (groupe: string, id: string, statut: PayStatus) => post({ action: 'paiement', groupe, id, statut }),
  addPlayer: (groupe: string, nom: string, commentaire?: string) => post({ action: 'add', groupe, nom, commentaire }),
  deletePlayer: (groupe: string, id: string) => post({ action: 'delete', groupe, id }),
};
