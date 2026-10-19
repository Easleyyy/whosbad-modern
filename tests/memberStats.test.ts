import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMemberIndex, searchMembers, sortMembers, isTeamName } from '@/lib/memberStats';
import type { Sale } from '@/types';

let n = 0;
const sale = (acheteur: string, produit: string, date: string, quantite = 1, paye: Sale['paye'] = 'Oui', montant = 18): Sale => ({
  id: `s${n++}`, _row: n, date, vendeur: 'Dadou', acheteur, quantite, paye, mode_paiement: '', produit, montant,
});

const sales = [
  sale('Frédéric LUBIATTO', 'CBX RED', '18/10/2026', 1, 'Non'),
  sale('Frederic LUBIATTO', 'CBX RED', '10/09/2026', 2),
  sale('Frédéric LUBIATTO', 'Victor GM', '01/06/2026', 3),
  sale('Emma DURAND', 'CBX BLUE', '15/10/2026'),
  sale('Entrainements Saint Merri', 'CBX RED', '12/10/2026', 5, '-'),
  sale('Entraînements Saint Merri', 'CBX RED', '02/10/2026', 4, '-'),
];

test('regroupe les variantes d\'orthographe d\'une même personne', () => {
  const idx = buildMemberIndex(sales);
  const f = idx.find((m) => m.key.includes('lubiatto'))!;
  assert.equal(f.salesCount, 3);
  assert.equal(f.totalBoxes, 6);
  assert.deepEqual(f.byProduct, { 'CBX RED': 3, 'Victor GM': 3 });
  assert.equal(f.name, 'Frédéric LUBIATTO'); // l'orthographe la plus utilisée
  assert.equal(f.variants.length, 2);
});

test('impayés : nombre et montant', () => {
  const f = buildMemberIndex(sales).find((m) => m.key.includes('lubiatto'))!;
  assert.equal(f.unpaidCount, 1);
  assert.equal(f.unpaidAmount, 18);
});

test('ventes triées de la plus récente à la plus ancienne, dernier achat renseigné', () => {
  const f = buildMemberIndex(sales).find((m) => m.key.includes('lubiatto'))!;
  assert.deepEqual(f.sales.map((s) => s.date), ['18/10/2026', '10/09/2026', '01/06/2026']);
  assert.equal(f.lastDate, '18/10/2026');
});

test('les équipes qui consomment en interne sont repérées, même écrites de plusieurs façons', () => {
  assert.equal(isTeamName('Entraînements Saint Merri'), true);
  assert.equal(isTeamName('ICD - Equipe 3'), true);
  assert.equal(isTeamName('Icard MARTIN'), false);
  const teams = buildMemberIndex(sales).filter((m) => m.isTeam);
  assert.equal(teams.length, 1);
  assert.equal(teams[0].totalBoxes, 9);
});

test('un adhérent de l\'annuaire sans aucune vente apparaît quand même', () => {
  const idx = buildMemberIndex(sales, ['Paul BLANC', 'Emma DURAND']);
  const p = idx.find((m) => m.name === 'Paul BLANC')!;
  assert.equal(p.totalBoxes, 0);
  assert.equal(p.inDirectory, true);
  assert.equal(idx.filter((m) => m.key.includes('emma')).length, 1);
});

test('groupe d\'entraînement retrouvé par le nom', () => {
  const idx = buildMemberIndex(sales, [], { 'Groupe 2 · Mardi - Saint Merri': [{ nom: 'Emma DURAND' }] });
  assert.deepEqual(idx.find((m) => m.key.includes('emma'))!.groups, ['Groupe 2']);
});

test('recherche insensible aux accents, à la casse, à l\'ordre des mots', () => {
  const idx = buildMemberIndex(sales);
  assert.equal(searchMembers(idx, 'frederic')[0].name, 'Frédéric LUBIATTO');
  assert.equal(searchMembers(idx, 'LUBIATTO fré')[0].name, 'Frédéric LUBIATTO');
  assert.equal(searchMembers(idx, 'zzz').length, 0);
  assert.equal(searchMembers(idx, '  ').length, idx.length);
});

test('tris : récent, alphabétique, boîtes', () => {
  const idx = buildMemberIndex(sales).filter((m) => !m.isTeam);
  assert.equal(sortMembers(idx, 'recent')[0].name, 'Frédéric LUBIATTO');
  assert.equal(sortMembers(idx, 'alpha')[0].name, 'Emma DURAND');
  assert.equal(sortMembers(idx, 'boxes')[0].name, 'Frédéric LUBIATTO');
});
