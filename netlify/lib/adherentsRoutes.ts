import type { Db } from './db';
import { memberKey, normalizeMemberName } from '../../src/lib/memberNames';
import { requireAuth } from './auth';
import { json, ok, fail, readBody } from './http';

// Replaces the Blobs-backed netlify/functions/adherents.mts. Reads stay open; adding/removing a
// name requires the shared secret like every other write (see auth.ts).
//
// Dedup uses `memberKey` (accent/case/hyphen-insensitive — "Jean-Pierre Dupont" == "jean pierre
// DUPONT"), same as the app always has, which the plain unique constraint on `members.name`
// can't express in SQL. So existence is checked in JS against the small full list (a club has
// at most a few hundred adhérents) before inserting; the unique constraint is only a backstop
// for the exact-string case. A genuine race between two simultaneous first-time adds of
// differently-cased spellings of the same name is possible but harmless (a look-alike
// duplicate row, not data loss) and vanishingly unlikely at this scale.

async function list(db: Db) {
  const rows = await db.query<{ name: string }>('select name from members order by name');
  return rows.map((r) => r.name);
}

export async function handleAdherents(req: Request, db: Db): Promise<Response> {
  if (req.method === 'GET') return ok({ adherents: await list(db) });

  if (req.method !== 'POST' && req.method !== 'DELETE') return fail('Méthode non supportée', 405);
  const auth = requireAuth(req);
  if (auth) return auth;
  const body = await readBody<{ name?: string }>(req);
  const raw = typeof body?.name === 'string' ? body.name : '';
  if (!raw || raw.length > 80) return fail('Nom invalide');
  const name = normalizeMemberName(raw);
  if (!name) return fail('Il faut un prénom et un nom (ex : Lucas MARTIN)');
  const key = memberKey(name);

  if (req.method === 'POST') {
    const existing = await list(db);
    const already = existing.find((n) => memberKey(n) === key);
    if (!already) await db.query('insert into members (name) values ($1) on conflict (name) do nothing', [name]);
    return ok({ added: !already, adherents: already ? existing : await list(db) });
  }

  const existing = await list(db);
  const match = existing.find((n) => memberKey(n) === key);
  if (match) await db.query('delete from members where name = $1', [match]);
  return json({ success: true, removed: !!match, adherents: match ? await list(db) : existing });
}
