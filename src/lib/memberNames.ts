import { fold } from './text';

// Pure helpers for adhérent names — shared by the app and the Netlify function
// that stores the shared list (netlify/lib/adherentsApi.ts), so both sides agree
// on what "the same person" and "Prénom NOM" mean.

/** Comparison key: accent/case/hyphen-insensitive so "Jean-Pierre Dupont" = "jean pierre DUPONT". */
export function memberKey(name: string): string {
  return fold(name).replace(/-/g, ' ');
}

const capitalize = (w: string) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w);
const capitalizeHyphenated = (w: string) => w.split('-').map(capitalize).join('-');

/** True when a token is written in capitals ("MARTIN", "DE-LA-TOUR") and is more than an initial. */
const isAllCaps = (w: string) => w.length > 1 && w === w.toUpperCase() && w !== w.toLowerCase();

/**
 * Normalises a typed name to the club's "Prénom NOM" convention.
 * - If part of the input is already in capitals, that part is the family name
 *   ("Jean Pierre DUPONT" → "Jean Pierre DUPONT").
 * - Otherwise the first word is the first name, the rest the family name
 *   ("lucas martin" → "Lucas MARTIN", "emma de la tour" → "Emma DE LA TOUR").
 * Returns null unless both a first name and a family name are present.
 */
export function normalizeMemberName(raw: string): string | null {
  const words = raw.replace(/[«»"“”]/g, ' ').trim().replace(/[.,;:!?]+$/g, '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;

  const capsAt = words.findIndex((w, i) => i > 0 && isAllCaps(w));
  const split = capsAt > 0 ? capsAt : 1;
  const prenom = words.slice(0, split).map(capitalizeHyphenated).join(' ');
  const nom = words.slice(split).map((w) => w.toUpperCase()).join(' ');
  return `${prenom} ${nom}`;
}

/** Splits "Lucas MARTIN, Emma DURAND et Paul BLANC" into one entry per person. */
export function splitNames(list: string): string[] {
  return list
    .split(/\s*(?:,|;|\s+et\s+|\s+&\s+|\n)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Detects "ajoute l'adhérent Lucas MARTIN", "nouvel adhérent : Lucas MARTIN",
 * "ajoute Lucas MARTIN aux adhérents", "inscris Lucas MARTIN comme adhérent"…
 * Returns the raw names typed (possibly several) or null if it isn't such a command.
 */
export function parseAddMembers(msg: string): string[] | null {
  const M = String.raw`(?:adh[ée]rent(?:e)?s?|membres?)`;
  const VERB = String.raw`(?:ajoute[rz]?|rajoute[rz]?|cr[ée]{1,2}[rz]?|enregistre[rz]?|inscri(?:s|re|t|vez)|rentre[rz]?|int[èe]gre[rz]?)`;
  // Anchored at the start: "2 Victor GM pour le nouvel adhérent Lucas MARTIN" is a SALE to a
  // new member and must reach the sales chatbot, not be swallowed here.
  const START = String.raw`^\s*(?:(?:peux|pourrais)[- ]tu\s+|stp\s+|svp\s+|s['’]il\s+te\s+pla[iî]t\s+)?`;
  const patterns = [
    // "nouvel adhérent Lucas MARTIN" / "nouvelle adhérente : Emma DURAND"
    new RegExp(String.raw`${START}nouvel(?:le)?s?\s+${M}\s*[:\-–]?\s*(.+)$`, 'i'),
    // "ajoute (l'|un(e) |le |la |les |des )(nouvel(le) )adhérent(e)(s) Lucas MARTIN"
    new RegExp(String.raw`${START}${VERB}\s+(?:l['’]\s*|un(?:e)?\s+|le\s+|la\s+|les\s+|des\s+)?(?:nouvel(?:le)?s?\s+)?${M}\s*[:\-–]?\s*(.+)$`, 'i'),
    // "ajoute Lucas MARTIN aux adhérents / à la liste des adhérents / comme adhérent"
    new RegExp(String.raw`${START}${VERB}\s+(.+?)\s+(?:aux\s+${M}|(?:à|a|dans)\s+(?:la\s+)?liste(?:\s+des\s+${M})?|(?:comme|en\s+tant\s+que)\s+${M}|dans\s+les\s+${M})\s*$`, 'i'),
    // "adhérent : Lucas MARTIN"
    new RegExp(String.raw`^\s*${M}\s*:\s*(.+)$`, 'i'),
  ];
  for (const p of patterns) {
    const m = msg.match(p);
    if (!m) continue;
    const names = splitNames(m[1]);
    if (names.length) return names;
  }
  return null;
}

/** Merges several name sources into one deduplicated, sorted directory. The first
 *  source to spell a name wins — pass the sales sheet first so the spelling matches
 *  the rows the backend later has to find again when updating a payment. */
export function mergeMembers(...sources: (string | undefined | null)[][]): string[] {
  const seen = new Map<string, string>();
  for (const src of sources) {
    for (const raw of src) {
      const name = raw?.trim();
      if (!name || name === '-') continue;
      const key = memberKey(name);
      if (!seen.has(key)) seen.set(key, name);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'fr'));
}

/** Buyer names carried by a chatbot reply (sales rows, or Square payment links). */
export function extractBuyers(result: { data?: unknown; squareLinks?: unknown }): string[] {
  const out: string[] = [];
  for (const list of [result.data, result.squareLinks]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const a = (item as { acheteur?: unknown })?.acheteur;
      if (typeof a === 'string' && a.trim()) out.push(a.trim());
    }
  }
  return [...new Set(out)];
}

/**
 * Detects "supprime l'adhérent Lucas MARTIN", "retire Lucas MARTIN des adhérents".
 * Needs the word adhérent/membre, so "retire 2 maillots…" is never mistaken for it.
 */
export function parseRemoveMembers(msg: string): string[] | null {
  const M = String.raw`(?:adh[ée]rent(?:e)?s?|membres?)`;
  const VERB = String.raw`(?:supprime[rz]?|retire[rz]?|enl[èe]ve[rz]?|efface[rz]?|d[ée]sinscri(?:s|re|t|vez)|vire[rz]?)`;
  const START = String.raw`^\s*(?:(?:peux|pourrais)[- ]tu\s+|stp\s+|svp\s+|s['’]il\s+te\s+pla[iî]t\s+)?`;
  const patterns = [
    new RegExp(String.raw`${START}${VERB}\s+(?:l['’]\s*|un(?:e)?\s+|le\s+|la\s+|les\s+|des\s+)?${M}\s*[:\-–]?\s*(.+)$`, 'i'),
    new RegExp(String.raw`${START}${VERB}\s+(.+?)\s+(?:des\s+${M}|de\s+la\s+liste(?:\s+des\s+${M})?|des\s+membres)\s*$`, 'i'),
  ];
  for (const p of patterns) {
    const m = msg.match(p);
    if (!m) continue;
    const names = splitNames(m[1]);
    if (names.length) return names;
  }
  return null;
}
