import type { Db } from './db';
import { requireAuth } from './auth';
import { json, ok, fail, readBody } from './http';

// Replaces /api/references, /api/references/add, /api/references/update, /api/references/delete
// from the old server.js (source never seen — this is the contract src/lib/api.ts already
// commits to). Prices/colours/frais_square live in `product_references`, the single dynamic
// catalogue every other domain (sales, chat, Square fees) reads from.

const CLEAN = (s: unknown) => (typeof s === 'string' ? s.trim() : '');

export async function handleReferences(req: Request, db: Db, sub: string): Promise<Response> {
  if (sub === '' && req.method === 'GET') {
    const references = await db.query<{ name: string; price: string; color: string }>(
      'select name, price, color from product_references order by name'
    );
    return ok({ references: references.map((r) => ({ ...r, price: Number(r.price) })) });
  }

  if (req.method !== 'POST') return fail('Méthode non supportée', 405);
  const body = await readBody<Record<string, unknown>>(req);
  if (!body) return fail('Corps JSON invalide');
  const auth = requireAuth(req);
  if (auth) return auth;

  if (sub === 'add') {
    const name = CLEAN(body.name);
    const price = Number(body.price);
    const color = CLEAN(body.color) || 'purple';
    if (!name) return fail('Nom requis');
    if (!(price > 0)) return fail('Prix invalide');
    const fraisSquare = Number.isFinite(Number(body.fraisSquare)) ? Number(body.fraisSquare) : 0.35;
    try {
      await db.query(
        'insert into product_references (name, price, color, frais_square) values ($1, $2, $3, $4)',
        [name, price, color, fraisSquare]
      );
    } catch (e) {
      if (isUniqueViolation(e)) return fail(`« ${name} » existe déjà`);
      throw e;
    }
    return ok({ produit: name, prix: price });
  }

  if (sub === 'update') {
    const name = CLEAN(body.name);
    if (!name) return fail('Nom requis');
    const existing = await db.query<{ name: string; price: string; color: string }>(
      'select name, price, color from product_references where name = $1',
      [name]
    );
    if (!existing.length) return fail(`« ${name} » introuvable`, 404);

    const newName = body.newName !== undefined ? CLEAN(body.newName) : existing[0].name;
    const newPrice = body.newPrice !== undefined ? Number(body.newPrice) : Number(existing[0].price);
    const newColor = body.newColor !== undefined ? CLEAN(body.newColor) : existing[0].color;
    if (!(newPrice > 0)) return fail('Prix invalide');

    try {
      // The name is a foreign key sales/stock_movements point at — a rename must cascade,
      // hence a transaction instead of a bare UPDATE.
      await db.transaction(async (trx) => {
        if (newName !== name) {
          await trx.query('update product_references set name = $1 where name = $2', [newName, name]);
        }
        await trx.query('update product_references set price = $1, color = $2 where name = $3', [newPrice, newColor, newName]);
      });
    } catch (e) {
      if (isUniqueViolation(e)) return fail(`« ${newName} » existe déjà`);
      throw e;
    }
    return ok({ produit: newName, prix: newPrice, couleur: newColor });
  }

  if (sub === 'delete') {
    const name = CLEAN(body.name);
    if (!name) return fail('Nom requis');
    const inUse = await db.query<{ n: string }>('select count(*)::text as n from sales where produit = $1', [name]);
    if (Number(inUse[0]?.n ?? 0) > 0) {
      return fail(`« ${name} » a des ventes enregistrées — impossible à supprimer`);
    }
    const deleted = await db.query('delete from product_references where name = $1 returning name', [name]);
    if (!deleted.length) return fail(`« ${name} » introuvable`, 404);
    return ok({ produit: name });
  }

  return json({ success: false, error: 'Route inconnue' }, 404);
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505';
}
