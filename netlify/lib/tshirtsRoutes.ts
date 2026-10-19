import type { Db } from './db';
import { requireAuth } from './auth';
import { json, ok, fail, readBody } from './http';

// Replaces /api/tshirts, /api/tshirts/update, /api/tshirts/add (server.js:691-833).
// One row per (marque, sexe, taille) in tshirt_stock, unique constraint enforced in SQL —
// `add` now upserts instead of blindly appending, so a second "+ LIGNE" on the same cell
// can no longer create a silent duplicate row (a latent bug in the old Sheet-append version).

export async function handleTshirts(req: Request, db: Db, sub: string): Promise<Response> {
  if (sub === '' && req.method === 'GET') {
    const items = await db.query<{ id: number; marque: string; sexe: string; taille: string; quantite: number }>(
      'select id, marque, sexe, taille, quantite from tshirt_stock order by id'
    );
    const marques: string[] = [];
    for (const i of items) if (!marques.includes(i.marque)) marques.push(i.marque);
    return ok({ marques, items: items.map(({ id: _id, ...rest }) => rest) });
  }

  if (req.method !== 'POST') return fail('Méthode non supportée', 405);
  const body = await readBody<{ marque?: string; sexe?: string; taille?: string; quantite?: number; nouvelle_quantite?: number }>(req);
  if (!body) return fail('Corps JSON invalide');
  const auth = requireAuth(req);
  if (auth) return auth;

  const marque = String(body.marque ?? '').trim();
  const sexe = String(body.sexe ?? '').trim();
  const taille = String(body.taille ?? '').trim();
  if (!marque || !sexe || !taille) return fail('Marque, sexe et taille requis');

  if (sub === 'update' || sub === 'add') {
    const qty = Math.max(0, parseInt(String(body.nouvelle_quantite ?? body.quantite ?? 0), 10) || 0);
    await db.query(
      `insert into tshirt_stock (marque, sexe, taille, quantite) values ($1, $2, $3, $4)
       on conflict (marque, sexe, taille) do update set quantite = excluded.quantite`,
      [marque, sexe, taille, qty]
    );
    return ok({});
  }

  return json({ success: false, error: 'Route inconnue' }, 404);
}
