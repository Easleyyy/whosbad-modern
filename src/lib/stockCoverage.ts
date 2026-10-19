import type { Sale } from '@/types';

// Estimation de rupture : combien de jours tient le stock restant si les ventes continuent au
// rythme récent. Les sorties « soldées » (entraînements, équipes d'interclubs) comptent : elles
// vident le stock comme les autres.

export type CoverageStatus = 'rupture' | 'proche' | 'prevoir' | 'ok' | 'dormant';

export interface Coverage {
  /** Boîtes sorties sur la fenêtre observée. */
  sold: number;
  /** Fenêtre réellement utilisée, en jours (plus courte si le produit est récent). */
  windowDays: number;
  /** Boîtes par jour. */
  ratePerDay: number;
  /** Jours de stock restants, `null` quand il n'y a pas de ventes récentes à extrapoler. */
  days: number | null;
  status: CoverageStatus;
}

/** Fenêtre d'observation : assez longue pour lisser un week-end creux, assez courte pour suivre le pic d'automne. */
export const COVERAGE_WINDOW_DAYS = 60;
/** Sous ce nombre de jours de stock, on parle de rupture proche ; sous le suivant, « à prévoir ». */
export const COVERAGE_ALERT_DAYS = 14;
export const COVERAGE_WARN_DAYS = 30;

const DAY = 86_400_000;

/** DD/MM/YYYY → timestamp (minuit local), 0 si illisible. */
export function parseDMY(dateStr: string): number {
  const [dd, mm, yy] = (dateStr || '').split('/');
  return new Date(+yy, +mm - 1, +dd).getTime() || 0;
}

export function computeCoverage(
  sales: Sale[],
  produit: string,
  stock: number,
  today: Date = new Date(),
  windowDays: number = COVERAGE_WINDOW_DAYS
): Coverage {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() + DAY - 1;
  const mine = sales.filter((s) => s.produit === produit);

  // Un produit lancé il y a 3 semaines n'a pas 60 jours d'historique : diviser par 60 sous-estimerait son rythme.
  const first = mine.reduce((min, s) => {
    const t = parseDMY(s.date);
    return t && t < min ? t : min;
  }, Infinity);
  const observed = Number.isFinite(first) ? Math.ceil((end - first) / DAY) : windowDays;
  const win = Math.max(14, Math.min(windowDays, observed));

  const from = end - win * DAY;
  const sold = mine.reduce((n, s) => {
    const t = parseDMY(s.date);
    return t >= from && t <= end ? n + s.quantite : n;
  }, 0);

  const ratePerDay = sold / win;
  if (stock <= 0) return { sold, windowDays: win, ratePerDay, days: 0, status: 'rupture' };
  if (sold === 0) return { sold, windowDays: win, ratePerDay, days: null, status: 'dormant' };

  const days = Math.round(stock / ratePerDay);
  const status: CoverageStatus = days < COVERAGE_ALERT_DAYS ? 'proche' : days < COVERAGE_WARN_DAYS ? 'prevoir' : 'ok';
  return { sold, windowDays: win, ratePerDay, days, status };
}

/** « ≈ 7 j », « ≈ 3 mois », « > 1 an » — lisible d'un coup d'œil, pas une fausse précision. */
export function formatCoverage(c: Coverage): string {
  if (c.status === 'rupture') return 'rupture';
  if (c.days === null) return 'aucune vente récente';
  if (c.days >= 365) return '> 1 an';
  if (c.days >= 90) return `≈ ${Math.round(c.days / 30)} mois`;
  return `≈ ${Math.max(1, c.days)} j`;
}

export const COVERAGE_WORD: Record<CoverageStatus, string> = {
  rupture: 'rupture',
  proche: 'rupture proche',
  prevoir: 'à prévoir',
  ok: 'ok',
  dormant: 'dormant',
};
