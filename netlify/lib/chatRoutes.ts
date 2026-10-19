import type { Db } from './db';
import type { SquareGateway } from './squareClient';
import { requireAuth } from './auth';
import { ok, fail, readBody } from './http';
import { toISODate } from './dates';
import { createPayment } from './squareRoutes';

// Replaces /api/chat (server.js:367-690, local source — see chatSystemPrompt.ts for what's
// reconstructed vs. known). Unlike the old backend, this never queries Sheets/DB for "known
// buyers" to build the prompt: the frontend already embeds the live catalogue and adhérents
// list in the message itself (withChatContext, src/lib/aiContext.ts) before it ever gets here.

export interface ChatDeps {
  askClaude(message: string, today: string): Promise<string>;
  square: SquareGateway | null;
}

interface VenteRow {
  produit: string; acheteur: string; quantite: number; date?: string; vendeur?: string;
  paye?: string; mode_paiement?: string; commentaire?: string;
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = (fenced ? fenced[1] : raw).trim();
  return JSON.parse(text);
}

const box = (n: number, singular: string) => `${n > 1 ? n + ' boîtes' : '1 boîte'} de ${singular}`;

export async function handleChat(req: Request, db: Db, deps: ChatDeps): Promise<Response> {
  if (req.method !== 'POST') return fail('Méthode non supportée', 405);
  const body = await readBody<{ message?: string }>(req);
  if (!body?.message) return fail('message requis');
  const auth = requireAuth(req);
  if (auth) return auth;

  const today = new Date().toLocaleDateString('fr-FR');
  const raw = await deps.askClaude(body.message, today);

  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    return ok({ action: 'conversation', message: raw.trim() });
  }

  const obj = parsed as Record<string, unknown>;
  if (obj && !Array.isArray(obj) && obj.action === 'conversation') {
    return ok({ action: 'conversation', message: String(obj.message ?? '') });
  }
  if (obj && !Array.isArray(obj) && obj.action === 'produit_inconnu') {
    return ok({ action: 'produit_inconnu', produit: String(obj.produit ?? ''), message: obj.message ? String(obj.message) : undefined });
  }
  if (obj && !Array.isArray(obj) && obj.action === 'modifier') {
    return handleModifier(db, obj);
  }

  return handleVentes(db, deps.square, Array.isArray(parsed) ? (parsed as VenteRow[]) : [parsed as VenteRow]);
}

async function handleModifier(db: Db, m: Record<string, unknown>): Promise<Response> {
  const acheteur = String(m.acheteur ?? '');
  const produit = typeof m.produit === 'string' && m.produit !== 'null' ? m.produit : null;
  const dateRef = typeof m.date === 'string' && m.date !== 'null' ? toISODate(m.date) : null;
  const nouveauPaye = typeof m.nouveau_paye === 'string' && m.nouveau_paye !== 'null' ? m.nouveau_paye : null;
  const nouveauMode = typeof m.nouveau_mode_paiement === 'string' && m.nouveau_mode_paiement !== 'null' ? m.nouveau_mode_paiement : null;
  const nbWanted = m.nb_ventes === 'all' || m.nb_ventes === 'toutes' ? Infinity : parseInt(String(m.nb_ventes ?? 1), 10) || 1;

  const conditions = ['lower(acheteur) = lower($1)'];
  const params: unknown[] = [acheteur];
  if (produit) { params.push(produit); conditions.push(`produit = $${params.length}`); }
  if (dateRef) { params.push(dateRef); conditions.push(`date = $${params.length}`); }

  const rows = await db.query<{ id: number; paye: string }>(
    `select id, paye from sales where ${conditions.join(' and ')} order by date desc, id desc`,
    params
  );
  const candidates = rows.filter((r) => {
    if (nouveauPaye === 'Oui' && r.paye === 'Oui') return false;
    if (nouveauPaye === '-' && r.paye === '-') return false;
    if (nouveauPaye === 'Non' && r.paye === 'Non') return false;
    return true;
  });
  if (!candidates.length) {
    return ok({ action: 'conversation', message: `Aucune vente non payée trouvée pour "${acheteur}"${produit ? ' dans ' + produit : ''}` });
  }

  const toUpdate = candidates.slice(0, nbWanted === Infinity ? candidates.length : nbWanted);
  const ids = toUpdate.map((r) => r.id);
  if (nouveauPaye) await db.query(`update sales set paye = $1 where id = any($2)`, [nouveauPaye, ids]);
  if (nouveauMode) await db.query(`update sales set mode_paiement = $1 where id = any($2)`, [nouveauMode, ids]);

  const n = toUpdate.length;
  const modeStr = nouveauMode ? ` / ${nouveauMode}` : '';
  const message = n === 1
    ? `Vente de ${acheteur} mise à jour → payé : ${nouveauPaye}${modeStr}`
    : `${n} ventes de ${acheteur} mises à jour → payé : ${nouveauPaye}${modeStr}`;
  return ok({ action: 'modifier', triggerSmash: (nouveauPaye ?? '').toLowerCase() === 'oui', message, data: toUpdate });
}

async function handleVentes(db: Db, square: SquareGateway | null, ventes: VenteRow[]): Promise<Response> {
  const known = await db.query<{ name: string }>('select name from product_references');
  const knownNames = new Set(known.map((r) => r.name));

  for (const v of ventes) {
    if (v?.produit && !knownNames.has(v.produit)) {
      return ok({ action: 'produit_inconnu', produit: v.produit, message: `Je ne connais pas « ${v.produit} ». Quel est son prix ?` });
    }
  }

  const squareVentes = ventes.filter((v) => (v.mode_paiement ?? '').toLowerCase() === 'square' && knownNames.has(v.produit));
  const normalVentes = ventes.filter((v) => !squareVentes.includes(v));

  const msgs: string[] = [];
  let anyPaid = false;
  for (const v of normalVentes) {
    if (!knownNames.has(v.produit)) { msgs.push(`⚠ Produit inconnu : "${v.produit}"`); continue; }
    const paye = v.paye ?? 'Non';
    await db.query(
      `insert into sales (produit, date, vendeur, acheteur, quantite, paye, mode_paiement, commentaire) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [v.produit, toISODate(v.date), v.vendeur || 'Dadou', v.acheteur, v.quantite, paye, v.mode_paiement ?? '', v.commentaire ?? '']
    );
    if (paye.toLowerCase() === 'oui') anyPaid = true;
    msgs.push(`${box(v.quantite, v.produit)} → ${v.acheteur}${paye === 'Oui' ? ' ✓' : ''}`);
  }

  if (squareVentes.length) {
    if (!square) {
      // Square unreachable/unconfigured — same fallback as the old backend: record the sale
      // anyway as unpaid rather than lose it, instead of failing the whole request.
      for (const v of squareVentes) {
        await db.query(
          `insert into sales (produit, date, vendeur, acheteur, quantite, paye, mode_paiement, commentaire) values ($1, $2, $3, $4, $5, 'Non', 'Square', $6)`,
          [v.produit, toISODate(v.date), v.vendeur || 'Dadou', v.acheteur, v.quantite, v.commentaire ?? '']
        );
        msgs.push(`${box(v.quantite, v.produit)} → ${v.acheteur} (Square non configuré)`);
      }
    } else {
      const squareLinks: unknown[] = [];
      for (const v of squareVentes) {
        const res = await createPayment(db, square, { produit: v.produit, quantite: v.quantite, acheteur: v.acheteur, vendeur: v.vendeur, commentaire: v.commentaire, date: v.date });
        const payload = (await res.json()) as { success: boolean; error?: string } & Record<string, unknown>;
        if (payload.success) squareLinks.push({ ...v, ...payload });
        else msgs.push(`⚠ Erreur Square : ${payload.error}`);
      }
      if (squareLinks.length) {
        const baseMsg = msgs.length
          ? (msgs.length === 1 ? `Vente ajoutée : ${msgs[0]}` : `${msgs.length} ventes :\n${msgs.map((m) => '• ' + m).join('\n')}`)
          : undefined;
        return ok({ action: 'square_payment', message: baseMsg, squareLinks, triggerSmash: anyPaid, data: normalVentes.length ? normalVentes : undefined });
      }
    }
  }

  if (!msgs.length) return ok({ action: 'conversation', message: 'Aucune vente reconnue.' });
  return ok({
    action: 'vente', triggerSmash: anyPaid,
    message: msgs.length === 1 ? `Vente ajoutée : ${msgs[0]}` : `${msgs.length} ventes ajoutées :\n${msgs.map((m) => '• ' + m).join('\n')}`,
    data: normalVentes,
  });
}
