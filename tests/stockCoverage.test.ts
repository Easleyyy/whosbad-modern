import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCoverage, formatCoverage, parseDMY } from '@/lib/stockCoverage';
import type { Sale } from '@/types';

const TODAY = new Date(2026, 9, 19); // 19/10/2026
const dmy = (daysAgo: number) => {
  const d = new Date(TODAY.getTime() - daysAgo * 86_400_000);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
let n = 0;
const sale = (produit: string, daysAgo: number, quantite = 1, extra: Partial<Sale> = {}): Sale => ({
  id: `s${n++}`, _row: n, date: dmy(daysAgo), vendeur: 'Dadou', acheteur: 'X', quantite, paye: 'Oui', mode_paiement: '', produit, ...extra,
});

test('parseDMY lit JJ/MM/AAAA et renvoie 0 si illisible', () => {
  assert.equal(parseDMY('19/10/2026'), new Date(2026, 9, 19).getTime());
  assert.equal(parseDMY(''), 0);
  assert.equal(parseDMY('n/importe/quoi'), 0);
});

test('rythme sur 60 jours → jours de stock restants', () => {
  // 30 boîtes sur 60 jours = 0,5/jour ; 4 en stock = 8 jours
  const sales = [sale('GM', 70, 1), ...Array.from({ length: 30 }, (_, i) => sale('GM', i * 2))];
  const c = computeCoverage(sales, 'GM', 4, TODAY);
  assert.equal(c.days, 8);
  assert.equal(c.status, 'proche');
  assert.equal(formatCoverage(c), '≈ 8 j');
});

test('les ventes plus vieilles que la fenêtre ne comptent pas', () => {
  const sales = [sale('GM', 200, 50), sale('GM', 100, 50), sale('GM', 5, 6)];
  const c = computeCoverage(sales, 'GM', 12, TODAY);
  assert.equal(c.sold, 6);
});

test('seuils : < 14 j proche, < 30 j à prévoir, sinon ok', () => {
  const mk = (stock: number) => computeCoverage(Array.from({ length: 60 }, (_, i) => sale('P', i)), 'P', stock, TODAY); // 1/jour
  assert.equal(mk(13).status, 'proche');
  assert.equal(mk(20).status, 'prevoir');
  assert.equal(mk(45).status, 'ok');
});

test('stock à zéro = rupture, stock sans vente récente = dormant', () => {
  assert.equal(computeCoverage([sale('A', 5)], 'A', 0, TODAY).status, 'rupture');
  const dormant = computeCoverage([sale('B', 150)], 'B', 50, TODAY);
  assert.equal(dormant.status, 'dormant');
  assert.equal(dormant.days, null);
  assert.equal(formatCoverage(dormant), 'aucune vente récente');
});

test('un produit récent n\'est pas sous-estimé (fenêtre réduite à son historique, 14 j minimum)', () => {
  // 14 boîtes en 14 jours = 1/jour ; avec 60 jours de fenêtre on trouverait 0,23/jour
  const sales = Array.from({ length: 14 }, (_, i) => sale('NEW', i));
  const c = computeCoverage(sales, 'NEW', 10, TODAY);
  assert.equal(c.days, 10);
});

test('les autres produits ne comptent pas', () => {
  const c = computeCoverage([sale('A', 1, 40), sale('B', 1, 1)], 'B', 30, TODAY);
  assert.equal(c.sold, 1);
});
