import type { Db } from './db';
import { requireAuth } from './auth';
import { json, ok, fail, readBody } from './http';
import { todayISO, toISODate } from './dates';

// Replaces /api/data, /api/add, /api/update, /api/delete (server.js:235-365, local source —
// the deployed version differs at least in which products it accepts, see referencesRoutes).
// `tab` in the old contract is the product name; rows come from one relational table instead
// of one Google Sheet tab per product.

function toRow(r: {
  id: number; date: string; vendeur: string; acheteur: string; quantite: number; paye: string; mode_paiement: string; commentaire: string;
}) {
  const { id, ...rest } = r;
  return { _row: id, ...rest };
}

export async function handleSales(req: Request, db: Db, sub: string): Promise<Response> {
  if (sub === 'data' && req.method === 'GET') {
    const rows = await db.query<{ id: number; produit: string; date: string; vendeur: string; acheteur: string; quantite: number; paye: string; mode_paiement: string; commentaire: string }>(
      `select id, produit, to_char(date, 'DD/MM/YYYY') as date, vendeur, acheteur, quantite, paye, mode_paiement, commentaire
       from sales order by produit, id`
    );
    const data: Record<string, unknown[]> = {};
    const products = await db.query<{ name: string }>('select name from product_references');
    for (const p of products) data[p.name] = []; // every known product gets a key, even with zero sales
    for (const r of rows) {
      const { produit, ...rest } = r;
      (data[produit] ??= []).push(toRow(rest));
    }
    return ok({ data });
  }

  if (req.method === 'DELETE' || (req.method === 'POST' && sub === 'delete')) {
    const body = await readBody<{ tab?: string; rowIndex?: number }>(req);
    if (!body) return fail('Corps JSON invalide');
    const auth = requireAuth(req);
    if (auth) return auth;
    if (!body.tab) return fail('Onglet invalide');
    if (!body.rowIndex) return fail('rowIndex requis');
    const deleted = await db.query('delete from sales where id = $1 and produit = $2 returning id', [body.rowIndex, body.tab]);
    if (!deleted.length) return fail('Vente introuvable', 404);
    return ok({});
  }

  if (req.method !== 'POST') return fail('Méthode non supportée', 405);
  const body = await readBody<Record<string, unknown>>(req);
  if (!body) return fail('Corps JSON invalide');
  const auth = requireAuth(req);
  if (auth) return auth;

  if (sub === 'add') {
    const tab = String(body.tab ?? '');
    const known = await db.query('select 1 from product_references where name = $1', [tab]);
    if (!known.length) return fail('Onglet invalide');
    const quantite = Math.max(1, Math.floor(Number(body.quantite ?? 1)) || 1);
    // `date` optional (DD/MM/YYYY or ISO) — defaults to today, as before. The new row's id comes
    // back so the app can keep editing the sale it just created.
    const created = await db.query<{ id: number }>(
      `insert into sales (produit, date, vendeur, acheteur, quantite, paye, mode_paiement, commentaire)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [tab, body.date ? toISODate(body.date) : todayISO(), String(body.vendeur ?? ''), String(body.acheteur ?? ''), quantite, String(body.paye ?? 'Non'), String(body.mode_paiement ?? ''), String(body.commentaire ?? '')]
    );
    return ok({ row: created[0].id });
  }

  if (sub === 'update') {
    const tab = String(body.tab ?? '');
    const known = await db.query('select 1 from product_references where name = $1', [tab]);
    if (!known.length) return fail('Onglet invalide');

    let targetRow = Number(body.rowIndex) || undefined;
    if (!targetRow && body.acheteur) {
      const found = await db.query<{ id: number }>(
        'select id from sales where produit = $1 and lower(acheteur) = lower($2) order by id limit 1',
        [tab, String(body.acheteur)]
      );
      if (!found.length) return fail(`Acheteur '${body.acheteur}' introuvable`, 404);
      targetRow = found[0].id;
    }
    if (!targetRow) return fail('rowIndex ou acheteur requis');

    const sets: string[] = [];
    const params: unknown[] = [];
    const set = (col: string, val: unknown) => { params.push(val); sets.push(`${col} = $${params.length}`); };
    if (body.date !== undefined) set('date', toISODate(body.date));
    if (body.vendeur !== undefined) set('vendeur', body.vendeur);
    if (body.new_acheteur !== undefined) set('acheteur', body.new_acheteur);
    if (body.quantite !== undefined) set('quantite', Number(body.quantite));
    if (body.paye !== undefined) set('paye', body.paye);
    if (body.mode_paiement !== undefined) set('mode_paiement', body.mode_paiement);
    if (body.commentaire !== undefined) set('commentaire', body.commentaire);

    if (sets.length) {
      params.push(targetRow);
      const updated = await db.query(`update sales set ${sets.join(', ')} where id = $${params.length} returning id`, params);
      if (!updated.length) return fail('Vente introuvable', 404);
    }
    return ok({ row: targetRow });
  }

  return json({ success: false, error: 'Route inconnue' }, 404);
}
