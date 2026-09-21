import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { memberKey } from '@/lib/memberNames';

export * from '@/lib/memberNames';

// ─── Shared list client ─────────────────────────────────────────────────────
// The list lives on the server (Netlify Function + Blobs, see netlify/), so a name
// added from the phone shows up on the desktop and vice-versa. Same-origin, so no
// CORS and no dependency on the Render backend.

const ENDPOINT = '/api/adherents';

async function call(init?: RequestInit): Promise<string[]> {
  const res = await fetch(ENDPOINT, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  // A static host answers unknown paths with index.html (200) — treat anything that
  // isn't our JSON shape as "endpoint not there", so callers can fall back cleanly.
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || !Array.isArray(json.adherents)) {
    throw new Error(json?.error ?? `Liste des adhérents indisponible (${res.status})`);
  }
  return json.adherents as string[];
}

export const adherentsApi = {
  list: () => call(),
  add: (name: string) => call({ method: 'POST', body: JSON.stringify({ name }) }),
  remove: (name: string) => call({ method: 'DELETE', body: JSON.stringify({ name }) }),
};

// ─── Offline queue ──────────────────────────────────────────────────────────
// A name typed while the server is unreachable is kept on this device and pushed
// the next time the shared list loads, so nothing typed is lost.

interface UnsyncedState {
  names: string[];
  push: (name: string) => void;
  drop: (name: string) => void;
}

export const useUnsyncedMembers = create<UnsyncedState>()(
  persist(
    (set) => ({
      names: [],
      push: (name) =>
        set((s) => (s.names.some((n) => memberKey(n) === memberKey(name)) ? s : { names: [...s.names, name] })),
      drop: (name) => set((s) => ({ names: s.names.filter((n) => memberKey(n) !== memberKey(name)) })),
    }),
    { name: 'wb-members-unsynced' }
  )
);
