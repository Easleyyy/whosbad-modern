import { fold } from '@/lib/text';
import type { TShirtItem } from '@/types';

// Chat commands on the t-shirt ("maillots") stock: receive, remove, set, or ask.
// Kept pure (no React, no network) — useDictation fetches the live data and
// applies whatever plan comes out of here.

export type TshirtMode = 'add' | 'remove' | 'set' | 'query';

export interface TshirtIntent {
  mode: TshirtMode;
  qty?: number;
  marque?: string;
  sexe?: string;
  taille?: string;
}

export interface TshirtData {
  marques: string[];
  items: TShirtItem[];
}

export type TshirtPlan =
  /** Missing/ambiguous field — keep the conversation open with a partial intent. */
  | { kind: 'ask'; message: string; intent: TshirtIntent }
  | { kind: 'fail'; message: string }
  | { kind: 'answer'; message: string }
  | { kind: 'write'; marque: string; sexe: string; taille: string; from: number; to: number; exists: boolean; message: string };

const KEYWORD = /\b(?:maillots?|t-?shirts?|tee-?shirts?)\b/;
export const isTshirtMessage = (msg: string) => KEYWORD.test(fold(msg));

const NUMBER_WORDS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, quinze: 15, vingt: 20, trente: 30,
};

const STOPWORDS = new Set(['de', 'du', 'des', 'd', 'la', 'le', 'les', 'l', 'en', 'au', 'aux', 'pour']);
const ALIASES: Record<string, string> = { blue: 'bleu', white: 'blanc', red: 'rouge', black: 'noir' };

const tokens = (s: string) =>
  fold(s)
    .replace(/\b[a-z]'/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .map((w) => ALIASES[w] ?? w);

// ─── Field extraction ───────────────────────────────────────────────────────

const SIZE_RE = /\b(2xl|xxl|xl|xs|s|m|l|junior|jr)\b/;

function extractTaille(t: string): string | undefined {
  const m = t.match(SIZE_RE)?.[1];
  if (!m) return undefined;
  if (m === 'xxl') return '2XL';
  if (m === 'jr' || m === 'junior') return 'Junior';
  return m.toUpperCase();
}

function extractSexe(t: string): string | undefined {
  if (/\b(?:hommes?|masculins?|garcons?|mecs?|messieurs?)\b/.test(t)) return 'Homme';
  if (/\b(?:femmes?|dames?|feminins?|feminines?|filles?|nanas?)\b/.test(t)) return 'Femme';
  if (/\b(?:mixtes?|unisexes?)\b/.test(t)) return 'Mixte';
  return undefined;
}

type MarqueMatch = { found: string } | { ambiguous: string[] } | null;

function extractMarque(text: string, marques: string[]): MarqueMatch {
  const q = new Set(tokens(text));
  const scored = marques
    .map((m) => {
      const mt = tokens(m);
      const hits = mt.filter((w) => q.has(w)).length;
      return { m, hits, full: mt.length > 0 && hits === mt.length };
    })
    .filter((x) => x.hits > 0);
  if (!scored.length) return null;

  const best = Math.max(...scored.map((x) => x.hits));
  const top = scored.filter((x) => x.hits === best);
  // A model written in full ("Victor Bleu") beats a partial one ("Victor").
  const fulls = top.filter((x) => x.full);
  const pool = fulls.length ? fulls : top;
  return pool.length === 1 ? { found: pool[0].m } : { ambiguous: pool.map((x) => x.m) };
}

/** The quantity: a digit run (sizes removed first so "2XL" isn't read as 2), else a spelled-out number. */
function extractQty(t: string): number | undefined {
  const cleaned = t.replace(SIZE_RE, ' ');
  const d = cleaned.match(/(?:^|[^a-z0-9])[+-]?\s?(\d+)\b/);
  if (d) return parseInt(d[1], 10);
  for (const w of cleaned.split(/[^a-z]+/)) if (w in NUMBER_WORDS) return NUMBER_WORDS[w];
  return undefined;
}

// ─── Intent ─────────────────────────────────────────────────────────────────

const ADD_VERBS = /\b(?:ajoute[rz]?|rajoute[rz]?|recu(?:e|s|es)?|receptionne[es]?|rentre[es]?|livre[es]?|livraison|arrive[es]?|reassort|entree)\b/;
const REMOVE_VERBS = /\b(?:retire[rz]?|enleve[rz]?|sors?|sorti[es]?|vendu[es]?|vends?|donne[es]?|distribue[es]?|perdu[es]?|soustrais|decompte[rz]?|en moins)\b/;
const SET_VERBS = /(?:\b(?:mets?|mettre|passe[rz]?|fixe[rz]?|regle[rz]?|corrige[rz]?|modifie[rz]?|change[rz]?|remplace[rz]?|ajuste[rz]?)\b|=|\b(?:il y en a|il y a|il n'y a plus que|plus que|seulement|maintenant|il reste)\b)/;
const QUERY_HINTS = /\b(?:combien|quel(?:le)? stock|y a[- ]t[- ]il|reste[- ]t[- ]il|as[- ]tu|avez[- ]vous)\b|\?\s*$/;

function detectMode(t: string, hasQty: boolean): TshirtMode | null {
  if (/(?:^|\s)\+\s?\d/.test(t)) return 'add';
  if (/(?:^|\s)-\s?\d/.test(t)) return 'remove';
  if (ADD_VERBS.test(t)) return 'add';
  if (REMOVE_VERBS.test(t)) return 'remove';
  if (QUERY_HINTS.test(t)) return 'query';
  if (SET_VERBS.test(t)) return 'set';
  return hasQty ? null : 'query';
}

/** Parses a message that mentions maillots/t-shirts. `null` = mode unclear (a quantity with no verb). */
export function parseTshirtIntent(msg: string, marques: string[]): TshirtIntent | null {
  const t = fold(msg).replace(/\b[a-z]'/g, ' ');
  const qty = extractQty(t);
  const mode = detectMode(t, qty !== undefined);
  if (!mode) return null;

  const intent: TshirtIntent = { mode };
  if (qty !== undefined) intent.qty = qty;
  const marque = extractMarque(msg, marques);
  if (marque && 'found' in marque) intent.marque = marque.found;
  const sexe = extractSexe(t);
  if (sexe) intent.sexe = sexe;
  const taille = extractTaille(t);
  if (taille) intent.taille = taille;
  return intent;
}

/** Merges a free-form reply ("Victor Bleu", "femme", "M", "12") into a half-filled intent.
 *  Returns null when the reply carried nothing usable (the user moved on). */
export function fillTshirtIntent(prev: TshirtIntent, reply: string, marques: string[]): TshirtIntent | null {
  const t = fold(reply).replace(/\b[a-z]'/g, ' ');

  // A reply that is itself a command — it names maillots, carries a verb, or brings a
  // quantity when one is already set — is a NEW message, not an answer. Merging it into the
  // pending one would apply the old quantity/mode to the new target and write the wrong stock.
  if (isTshirtMessage(reply) || ADD_VERBS.test(t) || REMOVE_VERBS.test(t) || SET_VERBS.test(t)) return null;
  if (prev.qty !== undefined && extractQty(t) !== undefined) return null;

  const next: TshirtIntent = { ...prev };
  let gained = false;

  if (!next.marque) {
    const m = extractMarque(reply, marques);
    if (m && 'found' in m) { next.marque = m.found; gained = true; }
  }
  if (!next.sexe) {
    const s = extractSexe(t);
    if (s) { next.sexe = s; gained = true; }
  }
  if (!next.taille) {
    const s = extractTaille(t);
    if (s) { next.taille = s; gained = true; }
  }
  if (next.qty === undefined && next.mode !== 'query') {
    const q = extractQty(t);
    if (q !== undefined) { next.qty = q; gained = true; }
  }
  return gained ? next : null;
}

// ─── Planning ───────────────────────────────────────────────────────────────

const label = (i: { marque: string; sexe: string; taille: string }) => `${i.marque} · ${i.sexe} ${i.taille}`;
const pieces = (n: number) => `${n} pièce${n > 1 ? 's' : ''}`;
const listOr = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} ou ${xs[xs.length - 1]}` : xs[0] ?? '');

/** Turns an intent + live data into either an answer, a follow-up question, or a stock write. */
export function planTshirt(intent: TshirtIntent, data: TshirtData): TshirtPlan {
  const { items, marques } = data;
  const { mode } = intent;

  // ── Query: sum of whatever matches the fields given ──────────────────────
  if (mode === 'query') {
    const matching = items.filter(
      (i) =>
        (!intent.marque || i.marque === intent.marque) &&
        (!intent.sexe || i.sexe === intent.sexe) &&
        (!intent.taille || i.taille === intent.taille)
    );
    const what = [intent.marque, intent.sexe, intent.taille].filter(Boolean).join(' · ') || 'Tous les maillots';
    const total = matching.reduce((n, i) => n + i.quantite, 0);
    if (!matching.length) return { kind: 'answer', message: `${what} : aucune ligne en stock (0)` };
    const byMarque = new Map<string, number>();
    for (const i of matching) byMarque.set(i.marque, (byMarque.get(i.marque) ?? 0) + i.quantite);
    const detail = !intent.marque && byMarque.size > 1
      ? ` — ${[...byMarque].map(([m, n]) => `${m} ${n}`).join(', ')}`
      : '';
    return { kind: 'answer', message: `${what} : ${pieces(total)}${detail}` };
  }

  // ── Writes need a fully specified line ───────────────────────────────────
  let marque = intent.marque;
  if (!marque) {
    if (marques.length === 1) marque = marques[0];
    else return { kind: 'ask', intent, message: `Quel modèle de maillot ? ${listOr(marques)}` };
  }
  const own = items.filter((i) => i.marque === marque);

  if (!intent.taille) {
    const tailles = [...new Set(own.map((i) => i.taille))];
    return { kind: 'ask', intent: { ...intent, marque }, message: `Quelle taille pour ${marque} ?${tailles.length ? ` (${tailles.join(', ')})` : ''}` };
  }
  const taille = intent.taille;

  let sexe = intent.sexe;
  if (!sexe) {
    const sexes = [...new Set(own.filter((i) => i.taille === taille).map((i) => i.sexe))];
    if (sexes.length === 1) sexe = sexes[0];
    else return { kind: 'ask', intent: { ...intent, marque }, message: `${marque} ${taille} : ${listOr(sexes.length ? sexes : ['Homme', 'Femme'])} ?` };
  }

  if (intent.qty === undefined) {
    return { kind: 'ask', intent: { ...intent, marque, sexe }, message: `Combien de maillots ${label({ marque, sexe, taille })} ?` };
  }

  const line = { marque, sexe, taille };
  const current = own.find((i) => i.sexe === sexe && i.taille === taille);
  const from = current?.quantite ?? 0;
  const qty = intent.qty;

  let to: number;
  if (mode === 'add') to = from + qty;
  else if (mode === 'set') to = qty;
  else {
    if (!current) return { kind: 'fail', message: `Pas de ligne ${label(line)} dans le stock — rien à retirer` };
    if (qty > from) return { kind: 'fail', message: `${label(line)} : il n'y en a que ${from}, impossible d'en retirer ${qty}` };
    to = from - qty;
  }

  const delta = to - from;
  const sign = delta >= 0 ? '+' : '−';
  return {
    kind: 'write',
    ...line,
    from,
    to,
    exists: !!current,
    message: `${label(line)} : ${from} → ${to} (${sign}${Math.abs(delta)})${current ? '' : ' · nouvelle ligne'} ✓`,
  };
}
