import { fold } from '@/lib/text';
import { memberKey } from '@/lib/memberNames';
import { parseDMY } from '@/lib/stockCoverage';
import type { Sale } from '@/types';

// Fiche adhérent : tout ce qu'on sait d'une personne, déduit des ventes. Une même personne écrite
// de plusieurs façons (« Frédéric » / « Frederic ») est regroupée par `memberKey`, comme partout ailleurs.

export interface MemberSummary {
  key: string;
  /** Orthographe affichée : la plus utilisée dans les ventes (sinon celle de l'annuaire). */
  name: string;
  variants: string[];
  /** Équipe ou groupe consommant du stock en interne (« Entraînements Saint Merri », « ICD - Equipe 3 »). */
  isTeam: boolean;
  inDirectory: boolean;
  groups: string[];
  totalBoxes: number;
  byProduct: Record<string, number>;
  salesCount: number;
  unpaidCount: number;
  unpaidAmount: number;
  /** Ventes, la plus récente d'abord. */
  sales: Sale[];
  lastTs: number;
  lastDate: string;
}

const TEAM = /^(entrainements?|ic[dr]?\b|equipe)/;
export const isTeamName = (name: string) => TEAM.test(fold(name));

export function buildMemberIndex(
  sales: Sale[],
  directory: string[] = [],
  trainingGroups: Record<string, { nom: string }[]> = {}
): MemberSummary[] {
  const spellings = new Map<string, Map<string, number>>();
  const bucket = new Map<string, Sale[]>();

  for (const s of sales) {
    const name = s.acheteur?.trim();
    if (!name || name === '-') continue;
    const key = memberKey(name);
    (bucket.get(key) ?? bucket.set(key, []).get(key)!).push(s);
    const sp = spellings.get(key) ?? spellings.set(key, new Map()).get(key)!;
    sp.set(name, (sp.get(name) ?? 0) + 1);
  }

  const dir = new Map<string, string>();
  for (const n of directory) if (n?.trim()) dir.set(memberKey(n), dir.get(memberKey(n)) ?? n.trim());
  for (const key of dir.keys()) if (!bucket.has(key)) bucket.set(key, []);

  const groupsByKey = new Map<string, string[]>();
  for (const [label, players] of Object.entries(trainingGroups)) {
    for (const p of players) {
      const k = memberKey(p.nom);
      groupsByKey.set(k, [...(groupsByKey.get(k) ?? []), label.split(' · ')[0]]);
    }
  }

  const out: MemberSummary[] = [];
  for (const [key, list] of bucket) {
    const sp = [...(spellings.get(key)?.entries() ?? [])].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'));
    const name = sp[0]?.[0] ?? dir.get(key) ?? key;
    const sorted = [...list].sort((a, b) => parseDMY(b.date) - parseDMY(a.date) || (b._row ?? 0) - (a._row ?? 0));
    const byProduct: Record<string, number> = {};
    let totalBoxes = 0;
    let unpaidCount = 0;
    let unpaidAmount = 0;
    for (const s of list) {
      totalBoxes += s.quantite;
      if (s.produit) byProduct[s.produit] = (byProduct[s.produit] ?? 0) + s.quantite;
      if (s.paye === 'Non') { unpaidCount += 1; unpaidAmount += s.montant ?? 0; }
    }
    out.push({
      key,
      name,
      variants: sp.map(([n]) => n),
      isTeam: isTeamName(name),
      inDirectory: dir.has(key),
      groups: groupsByKey.get(key) ?? [],
      totalBoxes,
      byProduct,
      salesCount: list.length,
      unpaidCount,
      unpaidAmount,
      sales: sorted,
      lastTs: sorted[0] ? parseDMY(sorted[0].date) : 0,
      lastDate: sorted[0]?.date ?? '',
    });
  }
  return out;
}

export type MemberSort = 'recent' | 'alpha' | 'boxes';

export function sortMembers(list: MemberSummary[], by: MemberSort): MemberSummary[] {
  const copy = [...list];
  if (by === 'alpha') return copy.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  if (by === 'boxes') return copy.sort((a, b) => b.totalBoxes - a.totalBoxes || a.name.localeCompare(b.name, 'fr'));
  return copy.sort((a, b) => b.lastTs - a.lastTs || a.name.localeCompare(b.name, 'fr'));
}

/** Recherche tolérante : accents, casse, trait d'union et ordre des mots n'ont pas d'importance. */
export function searchMembers(list: MemberSummary[], query: string): MemberSummary[] {
  const tokens = memberKey(query).split(' ').filter(Boolean);
  if (!tokens.length) return list;
  return list
    .filter((m) => tokens.every((t) => m.key.includes(t)))
    .sort((a, b) => Number(b.key.startsWith(tokens[0])) - Number(a.key.startsWith(tokens[0])) || a.name.localeCompare(b.name, 'fr'));
}
