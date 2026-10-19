import type { Db } from './db';
import { requireAuth } from './auth';
import { json, ok, fail, readBody } from './http';
import { toISODate } from './dates';

// Replaces /api/achats, /api/achats/add, /api/achats/log, /api/achats/update, /api/achats/delete
// (never seen in source — contract from src/lib/api.ts). "achats" (stock bought) per product is
// SUM(qty) over stock_movements; the old Reassort-log endpoints and the old flat ACHATS total
// are the same table now, not two things kept in sync by hand.

async function totalFor(db: Db, produit: string): Promise<number> {
  const rows = await db.query<{ total: string | null }>('select sum(qty)::text as total from stock_movements where produit = $1', [produit]);
  return Number(rows[0]?.total ?? 0);
}

export async function handleAchats(req: Request, db: Db, sub: string): Promise<Response> {
  if (sub === '' && req.method === 'GET') {
    // No {success} envelope here — src/lib/api.ts's getAchats() reads the body as the map itself.
    const rows = await db.query<{ produit: string; total: string | null }>(
      'select produit, sum(qty)::text as total from stock_movements group by produit'
    );
    const map: Record<string, number> = {};
    for (const r of rows) map[r.produit] = Number(r.total ?? 0);
    return json(map);
  }

  if (sub === 'log' && req.method === 'GET') {
    const produit = new URL(req.url).searchParams.get('produit');
    const rows = await db.query<{ id: number; date: string; produit: string; qty: number; commentaire: string }>(
      produit
        ? 'select id, to_char(date, \'DD/MM/YYYY\') as date, produit, qty, commentaire from stock_movements where produit = $1 order by date desc, id desc'
        : 'select id, to_char(date, \'DD/MM/YYYY\') as date, produit, qty, commentaire from stock_movements order by date desc, id desc',
      produit ? [produit] : []
    );
    // `_row` was a literal Google Sheet row number, now the movement's id — kept as `_row`
    // so ReassortEntry (src/types/index.ts) and every consumer of it need no change.
    return ok({ log: rows.map((r) => ({ _row: r.id, date: r.date, produit: r.produit, qty: r.qty, commentaire: r.commentaire })) });
  }

  if (req.method !== 'POST') return fail('Méthode non supportée', 405);
  const body = await readBody<Record<string, unknown>>(req);
  if (!body) return fail('Corps JSON invalide');
  const auth = requireAuth(req);
  if (auth) return auth;

  if (sub === 'add') {
    const produit = String(body.produit ?? '').trim();
    const qty = Number(body.qty);
    if (!produit) return fail('Produit requis');
    if (!Number.isFinite(qty) || qty === 0) return fail('Quantité invalide');
    const known = await db.query('select 1 from product_references where name = $1', [produit]);
    if (!known.length) return fail(`Produit inconnu : ${produit}`);
    await db.query('insert into stock_movements (produit, date, qty, commentaire) values ($1, $2, $3, $4)', [
      produit, toISODate(body.date), qty, String(body.commentaire ?? ''),
    ]);
    return ok({ produit, achats: await totalFor(db, produit) });
  }

  if (sub === 'update') {
    const rowIndex = Number(body.rowIndex);
    const produit = String(body.produit ?? '').trim();
    const qty = Number(body.qty);
    if (!rowIndex) return fail('rowIndex requis');
    if (!Number.isFinite(qty)) return fail('Quantité invalide');
    const updated = await db.query<{ produit: string }>('update stock_movements set qty = $1 where id = $2 returning produit', [qty, rowIndex]);
    if (!updated.length) return fail('Mouvement introuvable', 404);
    return ok({ produit: produit || updated[0].produit, achats: await totalFor(db, produit || updated[0].produit) });
  }

  if (sub === 'delete') {
    const rowIndex = Number(body.rowIndex);
    const produit = String(body.produit ?? '').trim();
    if (!rowIndex) return fail('rowIndex requis');
    const deleted = await db.query<{ produit: string }>('delete from stock_movements where id = $1 returning produit', [rowIndex]);
    if (!deleted.length) return fail('Mouvement introuvable', 404);
    return ok({ produit: produit || deleted[0].produit, achats: await totalFor(db, produit || deleted[0].produit) });
  }

  return json({ success: false, error: 'Route inconnue' }, 404);
}
