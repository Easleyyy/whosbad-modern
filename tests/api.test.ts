import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { makeTestDb } from '../netlify/lib/testDb';
import { handleSales } from '../netlify/lib/salesRoutes';
import { handleAdherents } from '../netlify/lib/adherentsRoutes';
import { handleAchats } from '../netlify/lib/achatsRoutes';
import type { Db } from '../netlify/lib/db';

// Real Postgres (pglite), the same handlers the Netlify Function runs — no mocks of SQL.
let db: Db;
const SECRET = 'secret';
const AUTH = { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const req = (method: string, body?: unknown, headers: Record<string, string> = AUTH) =>
  new Request('http://x/api', { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
const call = async (r: Promise<Response>) => { const res = await r; return { status: res.status, json: (await res.json()) as any }; };

before(async () => {
  process.env.API_SECRET = SECRET;
  db = await makeTestDb();
  await db.query("insert into product_references (name, price, color) values ('Victor GM', 22, 'amber'), ('CBX RED', 18, 'red')");
});

test('ajouter une vente renvoie son identifiant (l\'éditeur continue sur la ligne créée)', async () => {
  const { status, json } = await call(handleSales(req('POST', { tab: 'Victor GM', acheteur: 'Lucas MARTIN', quantite: 2, paye: 'Non' }), db, 'add'));
  assert.equal(status, 200);
  assert.equal(typeof json.row, 'number');
  const data = await call(handleSales(req('GET'), db, 'data'));
  const row = data.json.data['Victor GM'][0];
  assert.equal(row._row, json.row);
  assert.equal(row.quantite, 2);
});

test('la date peut être donnée en JJ/MM/AAAA, sinon c\'est aujourd\'hui', async () => {
  await call(handleSales(req('POST', { tab: 'CBX RED', acheteur: 'Emma DURAND', date: '05/09/2026' }), db, 'add'));
  const row = (await call(handleSales(req('GET'), db, 'data'))).json.data['CBX RED'][0];
  assert.equal(row.date, '05/09/2026');
});

test('produit inconnu refusé, quantité forcée à 1 minimum', async () => {
  assert.equal((await call(handleSales(req('POST', { tab: 'Inconnu', acheteur: 'X' }), db, 'add'))).status, 400);
  await call(handleSales(req('POST', { tab: 'CBX RED', acheteur: 'Zéro QUANTITE', quantite: 0 }), db, 'add'));
  const rows = (await call(handleSales(req('GET'), db, 'data'))).json.data['CBX RED'];
  assert.equal(rows.find((r: any) => r.acheteur === 'Zéro QUANTITE').quantite, 1);
});

test('modifier statut + mode de paiement, puis supprimer', async () => {
  const id = (await call(handleSales(req('POST', { tab: 'Victor GM', acheteur: 'Paul BLANC' }), db, 'add'))).json.row;
  const upd = await call(handleSales(req('POST', { tab: 'Victor GM', rowIndex: id, paye: 'Oui', mode_paiement: 'Virement' }), db, 'update'));
  assert.equal(upd.json.success, true);
  let row = (await call(handleSales(req('GET'), db, 'data'))).json.data['Victor GM'].find((r: any) => r._row === id);
  assert.equal(row.paye, 'Oui');
  assert.equal(row.mode_paiement, 'Virement');
  assert.equal((await call(handleSales(req('DELETE', { tab: 'Victor GM', rowIndex: id }), db, 'delete'))).status, 200);
  row = (await call(handleSales(req('GET'), db, 'data'))).json.data['Victor GM'].find((r: any) => r._row === id);
  assert.equal(row, undefined);
});

test('les écritures exigent le secret partagé, les lectures non', async () => {
  const noAuth = { 'Content-Type': 'application/json' };
  assert.equal((await call(handleSales(req('POST', { tab: 'Victor GM', acheteur: 'X' }, noAuth), db, 'add'))).status, 401);
  assert.equal((await call(handleSales(req('GET', undefined, noAuth), db, 'data'))).status, 200);
});

test('adhérents : ajout dédoublonné (casse/accents), suppression, secret requis', async () => {
  const noAuth = { 'Content-Type': 'application/json' };
  assert.equal((await call(handleAdherents(req('POST', { name: 'Lucas MARTIN' }, noAuth), db))).status, 401);
  assert.equal((await call(handleAdherents(req('POST', { name: 'lucas martin' }), db))).json.added, true);
  assert.equal((await call(handleAdherents(req('POST', { name: 'LUCAS martin' }), db))).json.added, false);
  assert.equal((await call(handleAdherents(req('POST', { name: 'Lucas' }), db))).status, 400); // il faut prénom ET nom
  assert.deepEqual((await call(handleAdherents(req('DELETE', { name: 'Lucas MARTIN' }), db))).json.adherents, []);
});

test('stock acheté = somme des mouvements ; supprimer un mouvement le retire du total', async () => {
  const add = (qty: number) => call(handleAchats(req('POST', { produit: 'CBX RED', qty }), db, 'add'));
  await add(100);
  const second = await add(50);
  assert.equal(second.json.achats, 150);
  const log = (await call(handleAchats(req('GET'), db, 'log'))).json.log;
  const last = log.find((e: any) => e.qty === 50);
  const del = await call(handleAchats(req('POST', { rowIndex: last._row, produit: 'CBX RED' }), db, 'delete'));
  assert.equal(del.json.achats, 100);
});
