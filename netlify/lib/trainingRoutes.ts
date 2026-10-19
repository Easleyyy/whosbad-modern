import type { Db } from './db';
import { requireAuth } from './auth';
import { json, fail, readBody } from './http';

// Replaces netlify/functions/training.mts (Sheet CSV + Blobs overlay), now first-class tables:
// training_groups/training_players. Groups and players are managed only through the app from
// here on — the season Google Sheet is no longer read (one-time import only, see the migration
// script). GET stays open; writes require the shared secret, like every other mutation.

interface Player { id: string; nom: string; commentaire: string; paiement: string }

async function buildPayload(db: Db) {
  const groups = await db.query<{ id: number; label: string }>('select id, label from training_groups order by sort_order');
  const players = await db.query<{ id: string; group_id: number; nom: string; commentaire: string; paiement: string }>(
    'select id::text as id, group_id, nom, commentaire, paiement from training_players order by id'
  );
  const byGroup = new Map<number, Player[]>();
  for (const p of players) {
    const list = byGroup.get(p.group_id) ?? [];
    list.push({ id: p.id, nom: p.nom, commentaire: p.commentaire, paiement: p.paiement });
    byGroup.set(p.group_id, list);
  }
  return {
    success: true,
    groups: Object.fromEntries(groups.map((g) => [g.label, byGroup.get(g.id) ?? []])),
    groupOrder: groups.map((g) => g.label),
  };
}

const STATUSES = ['pending', 'paid', 'unpaid'];

export async function handleTraining(req: Request, db: Db): Promise<Response> {
  if (req.method === 'GET') return json(await buildPayload(db));
  if (req.method !== 'POST') return fail('Méthode non supportée', 405);

  const body = await readBody<Record<string, unknown>>(req);
  if (!body) return fail('Corps JSON invalide');
  const auth = requireAuth(req);
  if (auth) return auth;

  const groupe = String(body.groupe ?? '');
  const group = (await db.query<{ id: number }>('select id from training_groups where label = $1', [groupe]))[0];
  if (!group) return fail('Groupe introuvable', 404);

  if (body.action === 'paiement') {
    const id = Number(body.id);
    if (!STATUSES.includes(String(body.statut))) return fail('Statut invalide');
    const updated = await db.query('update training_players set paiement = $1 where id = $2 and group_id = $3 returning id', [body.statut, id, group.id]);
    if (!updated.length) return fail('Joueur introuvable', 404);
    return json(await buildPayload(db));
  }

  if (body.action === 'add') {
    const nom = String(body.nom ?? '').trim();
    if (!nom || nom.length > 80) return fail('Nom invalide');
    await db.query('insert into training_players (group_id, nom, commentaire) values ($1, $2, $3)', [
      group.id, nom, String(body.commentaire ?? '').trim(),
    ]);
    return json(await buildPayload(db));
  }

  if (body.action === 'delete') {
    const id = Number(body.id);
    const deleted = await db.query('delete from training_players where id = $1 and group_id = $2 returning id', [id, group.id]);
    if (!deleted.length) return fail('Joueur introuvable', 404);
    return json(await buildPayload(db));
  }

  return fail('Action inconnue');
}
