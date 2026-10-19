import type { Db } from './db';
import type { SquareGateway } from './squareClient';
import { requireAuth } from './auth';
import { json, ok, fail, readBody } from './http';
import { toISODate } from './dates';

// Replaces /api/square/create-payment, /confirm-manual, /status/:orderId, /webhook
// (server.js:834-1036). Pending payments now live in `square_pending_payments` instead of an
// in-memory Map — a Netlify Function is stateless between invocations, so the webhook that
// confirms a payment created by an earlier invocation would otherwise never find it.
//
// Dropped on purpose (confirmed with the user — aspirational, not in current use, easy to
// revisit later): the POS deep-link, the HTML redirect page (`/pos-callback`), and the SSE
// live-notification stream (`/events`) — none of it survives serverless functions unmodified
// anyway (SSE needs a long-lived process; this has none), and nothing in the app reads it.

interface Pending {
  order_id: string; produit: string; quantite: number; acheteur: string; vendeur: string;
  commentaire: string; date: string; checkout_url: string; prix_base: string; frais: string; total: string;
}

const PENDING_COLUMNS = `order_id, produit, quantite, acheteur, vendeur, commentaire,
  to_char(date, 'YYYY-MM-DD') as date, checkout_url, prix_base, frais, total`;

function fees(price: number, fraisSquare: number, qty: number) {
  const prix_base = price * qty;
  const frais = fraisSquare * qty;
  return { prix_base, frais, total: prix_base + frais };
}

async function writeConfirmedSale(db: Db, p: Pending): Promise<void> {
  await db.transaction(async (trx) => {
    const deleted = await trx.query('delete from square_pending_payments where order_id = $1 returning order_id', [p.order_id]);
    if (!deleted.length) return; // already confirmed by a previous webhook delivery — Square retries, this must be idempotent
    await trx.query(
      `insert into sales (produit, date, vendeur, acheteur, quantite, paye, mode_paiement, commentaire)
       values ($1, $2, $3, $4, $5, 'Oui', 'Square', $6)`,
      [p.produit, p.date, p.vendeur, p.acheteur, p.quantite, p.commentaire]
    );
  });
}

export async function handleSquare(req: Request, db: Db, square: SquareGateway | null, sub: string): Promise<Response> {
  if (sub === 'webhook') {
    // Always 200 — Square retries aggressively on anything else, and a config/network hiccup
    // on our side shouldn't cause it to hammer the endpoint. Errors are just logged.
    try {
      const rawBody = await req.text();
      const signature = req.headers.get('x-square-hmacsha256-signature');
      const url = process.env.SQUARE_WEBHOOK_URL || `https://${req.headers.get('host')}/api/square/webhook`;
      if (square && !(await square.verifyWebhookSignature(rawBody, signature, url))) {
        console.error('[Square webhook] signature invalide');
        return json({ ok: true }, 200);
      }
      const event = JSON.parse(rawBody);
      if (event.type === 'payment.completed' || event.type === 'payment.created') {
        const payment = event.data?.object?.payment;
        if (payment?.status === 'COMPLETED' && payment.order_id) {
          const rows = await db.query<Pending>(`select ${PENDING_COLUMNS} from square_pending_payments where order_id = $1`, [payment.order_id]);
          if (rows.length) await writeConfirmedSale(db, rows[0]);
        }
      }
    } catch (e) {
      console.error('[Square webhook]', e instanceof Error ? e.message : e);
    }
    return json({ ok: true }, 200);
  }

  if (sub.startsWith('status/') && req.method === 'GET') {
    const orderId = sub.slice('status/'.length);
    const rows = await db.query('select 1 from square_pending_payments where order_id = $1', [orderId]);
    return ok({ status: rows.length ? 'pending' : 'confirmed' });
  }

  if (req.method !== 'POST') return fail('Méthode non supportée', 405);
  const body = await readBody<Record<string, unknown>>(req);
  if (!body) return fail('Corps JSON invalide');
  const auth = requireAuth(req);
  if (auth) return auth;

  if (sub === 'create-payment') {
    return createPayment(db, square, body);
  }

  if (sub === 'confirm-manual') {
    const orderId = String(body.orderId ?? '');
    if (!orderId) return fail('orderId requis');
    const rows = await db.query<Pending>(`select ${PENDING_COLUMNS} from square_pending_payments where order_id = $1`, [orderId]);
    if (!rows.length) return fail('Paiement introuvable (déjà confirmé ?)', 404);
    await writeConfirmedSale(db, rows[0]);
    return ok({});
  }

  return json({ success: false, error: 'Route inconnue' }, 404);
}

export async function createPayment(db: Db, square: SquareGateway | null, body: Record<string, unknown>): Promise<Response> {
  const produit = String(body.produit ?? '');
  const quantite = Math.max(1, parseInt(String(body.quantite ?? 1), 10) || 1);
  const acheteur = String(body.acheteur ?? '');
  const vendeur = String(body.vendeur ?? 'Dadou');
  const commentaire = String(body.commentaire ?? '');
  const date = toISODate(body.date);

  const ref = (await db.query<{ price: string; frais_square: string }>(
    'select price, frais_square from product_references where name = $1', [produit]
  ))[0];
  if (!ref) return fail(`Produit inconnu : ${produit}`);
  if (!square) return fail('Square non configuré — ajoute SQUARE_ACCESS_TOKEN', 503);

  const calc = fees(Number(ref.price), Number(ref.frais_square), quantite);
  const { orderId, checkoutUrl } = await square.createPaymentLink(
    Math.round(calc.total * 100),
    `${produit} × ${quantite} — Who's Bad Logistic`
  );
  await db.query(
    `insert into square_pending_payments (order_id, produit, quantite, acheteur, vendeur, commentaire, date, checkout_url, prix_base, frais, total)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [orderId, produit, quantite, acheteur, vendeur, commentaire, date, checkoutUrl, calc.prix_base, calc.frais, calc.total]
  );
  return ok({ action: 'square_payment', orderId, checkout_url: checkoutUrl, ...calc });
}
