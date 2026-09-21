import { memberKey, normalizeMemberName } from '../../src/lib/memberNames';

// The club's shared adhérents list, behind /api/adherents:
//   GET               → { success, adherents: string[] }
//   POST   { name }   → adds "Prénom NOM" (idempotent), returns the new list
//   DELETE { name }   → removes it, returns the new list
// Storage is abstracted so the same code runs on Netlify Blobs (production), a JSON
// file (`npm run dev`) and memory (tests).

export interface AdherentStore {
  read(): Promise<{ names: string[]; version?: string }>;
  /** Writes only if nobody else wrote since `version`; false = lost the race, retry. */
  write(names: string[], version?: string): Promise<boolean>;
}

const MAX_NAMES = 2000;
const MAX_NAME_LENGTH = 80;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const sorted = (names: string[]) => [...names].sort((a, b) => a.localeCompare(b, 'fr'));

/** Read-modify-write with optimistic concurrency, so two devices adding at once both land. */
async function mutate(store: AdherentStore, change: (names: string[]) => string[] | null): Promise<string[]> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { names, version } = await store.read();
    const next = change(names);
    if (next === null) return names; // nothing to change
    if (await store.write(sorted(next), version)) return sorted(next);
  }
  throw new Error('Trop de modifications simultanées, réessaie');
}

export async function handleAdherents(req: Request, store: AdherentStore): Promise<Response> {
  try {
    if (req.method === 'GET') {
      const { names } = await store.read();
      return json({ success: true, adherents: sorted(names) });
    }

    if (req.method === 'POST' || req.method === 'DELETE') {
      const body = await req.json().catch(() => null);
      const raw = typeof body?.name === 'string' ? body.name : '';
      if (!raw || raw.length > MAX_NAME_LENGTH) return json({ success: false, error: 'Nom invalide' }, 400);
      const name = normalizeMemberName(raw);
      if (!name) return json({ success: false, error: 'Il faut un prénom et un nom (ex : Lucas MARTIN)' }, 400);
      const key = memberKey(name);

      if (req.method === 'POST') {
        let added = false;
        const adherents = await mutate(store, (names) => {
          added = false; // re-evaluated on every retry
          if (names.some((n) => memberKey(n) === key)) return null;
          if (names.length >= MAX_NAMES) throw new Error('Liste pleine');
          added = true;
          return [...names, name];
        });
        return json({ success: true, added, adherents });
      }

      let removed = false;
      const adherents = await mutate(store, (names) => {
        const rest = names.filter((n) => memberKey(n) !== key);
        removed = rest.length !== names.length;
        return removed ? rest : null;
      });
      return json({ success: true, removed, adherents });
    }

    return json({ success: false, error: 'Méthode non supportée' }, 405);
  } catch (e) {
    console.error('[/api/adherents]', e instanceof Error ? e.message : e);
    return json({ success: false, error: e instanceof Error ? e.message : 'Erreur serveur' }, 500);
  }
}
