#!/usr/bin/env node
// One-time migration: Google Sheets (via the live Render backend) + the season Sheet CSV +
// the currently-deployed Blobs-backed /api/adherents → Postgres (Neon). Meant to be run once,
// at cutover, then thrown away — see the "Bascule en production" section of the migration plan
// and DEPLOYMENT.md. Idempotent-ish for sales/movements (safe to re-run against an EMPTY
// database; re-running against one already migrated will duplicate rows — wipe the target
// tables first if you need a second attempt).
//
// Required: DATABASE_URL (the Neon branch to migrate INTO).
// Optional: SOURCE_BACKEND_URL (default: the current Render backend),
//           SOURCE_SITE_URL (your live Netlify site, to read its /api/adherents before this
//           migration replaces that function — omit to skip adhérents not already implied by
//           sales/training data).
import pg from 'pg';

const DATABASE_URL = requireEnv('DATABASE_URL');
const SOURCE_BACKEND_URL = process.env.SOURCE_BACKEND_URL || 'https://whosbad-backend.onrender.com';
const SOURCE_SITE_URL = process.env.SOURCE_SITE_URL || '';
const TRAINING_SHEET_ID = '1toIE_fXtom_jAV4hAas-2mpinxE6_gNA1SH3-uGUUTE';
const TRAINING_SHEET_GID = '1648715405'; // "Entrainement 2026.2027"

// Fees confirmed with the user 2026-09-24: Victor GM/PC keep the old 0.35€, everything else
// (CBX RED/BLUE, Victor C1, NCS Pro) is 0.25€.
const REDUCED_FEE_PRODUCTS = new Set(['CBX RED', 'CBX BLUE', 'Victor C1', 'NCS Pro']);

function requireEnv(name) {
  const v = process.env[name];
  if (!v) { console.error(`Variable d'environnement manquante : ${name}`); process.exit(1); }
  return v;
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

function toISO(ddmmyyyy) {
  const m = String(ddmmyyyy || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return new Date().toISOString().slice(0, 10);
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// ─── Training sheet CSV (read-only, once) ───────────────────────────────────
// Same parsing the app used for a few days (netlify/lib/trainingApi.ts, now retired since
// entraînements are fully in Postgres going forward) — kept here only for this one-time import.
function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
function parseTrainingSheet(csv) {
  const groups = []; let current = null;
  for (const row of parseCsv(csv)) {
    const [a, b, c] = [clean(row[0]), clean(row[1]), clean(row[2])];
    if (/^groupe\s+\S+/i.test(a)) { current = { label: b ? `${a} · ${b}` : a, players: [] }; groups.push(current); continue; }
    if (!current || (!a && !b)) continue;
    const nom = clean(`${a} ${b}`);
    const commentaire = c && !/^oui$/i.test(c) && !/^demande/i.test(c) ? c : '';
    current.players.push({ nom, commentaire });
  }
  return groups;
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('Connecté à', DATABASE_URL.replace(/:[^:@]+@/, ':***@'));

  // ── References ──────────────────────────────────────────────────────────
  const { references } = await getJson(`${SOURCE_BACKEND_URL}/api/references`);
  for (const r of references) {
    const frais = REDUCED_FEE_PRODUCTS.has(r.name) ? 0.25 : 0.35;
    await client.query(
      'insert into product_references (name, price, color, frais_square) values ($1, $2, $3, $4) on conflict (name) do nothing',
      [r.name, r.price, r.color, frais]
    );
  }
  console.log(`✓ ${references.length} références`);

  // ── Sales ────────────────────────────────────────────────────────────────
  const { data } = await getJson(`${SOURCE_BACKEND_URL}/api/data`);
  let salesCount = 0;
  for (const [produit, rows] of Object.entries(data)) {
    for (const row of rows) {
      await client.query(
        `insert into sales (produit, date, vendeur, acheteur, quantite, paye, mode_paiement, commentaire)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [produit, toISO(row.date), row.vendeur || '', row.acheteur || '', Number(row.quantite) || 1, row.paye || 'Non', row.mode_paiement || '', row.commentaire || '']
      );
      salesCount++;
    }
  }
  console.log(`✓ ${salesCount} ventes`);

  // ── Stock movements (+ correction rows so totals match exactly) ─────────
  const [{ log }, achats] = await Promise.all([getJson(`${SOURCE_BACKEND_URL}/api/achats/log`), getJson(`${SOURCE_BACKEND_URL}/api/achats`)]);
  const summed = {};
  for (const e of log) {
    await client.query('insert into stock_movements (produit, date, qty, commentaire) values ($1, $2, $3, $4)', [
      e.produit, toISO(e.date), e.qty, e.commentaire || '',
    ]);
    summed[e.produit] = (summed[e.produit] ?? 0) + e.qty;
  }
  for (const [produit, total] of Object.entries(achats)) {
    const diff = total - (summed[produit] ?? 0);
    if (diff !== 0) {
      await client.query('insert into stock_movements (produit, date, qty, commentaire) values ($1, current_date, $2, $3)', [
        produit, diff, 'Solde initial (migration)',
      ]);
      console.log(`  ↳ correction ${produit} : ${diff > 0 ? '+' : ''}${diff} (le journal ne totalisait pas ${total})`);
    }
  }
  console.log(`✓ ${log.length} mouvements de stock`);

  // ── T-shirts ─────────────────────────────────────────────────────────────
  const { items } = await getJson(`${SOURCE_BACKEND_URL}/api/tshirts`);
  for (const i of items) {
    await client.query(
      'insert into tshirt_stock (marque, sexe, taille, quantite) values ($1, $2, $3, $4) on conflict (marque, sexe, taille) do nothing',
      [i.marque, i.sexe, i.taille, i.quantite]
    );
  }
  console.log(`✓ ${items.length} lignes de maillots`);

  // ── Training groups/players (one-time import from the season Sheet CSV) ──
  const csv = await (await fetch(`https://docs.google.com/spreadsheets/d/${TRAINING_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${TRAINING_SHEET_GID}`)).text();
  const groups = parseTrainingSheet(csv);
  let playerCount = 0;
  for (const [i, g] of groups.entries()) {
    const { rows } = await client.query(
      'insert into training_groups (label, sort_order) values ($1, $2) on conflict (label) do update set label = excluded.label returning id',
      [g.label, i]
    );
    for (const p of g.players) {
      await client.query('insert into training_players (group_id, nom, commentaire) values ($1, $2, $3)', [rows[0].id, p.nom, p.commentaire]);
      playerCount++;
    }
  }
  console.log(`✓ ${groups.length} groupes, ${playerCount} joueurs`);

  // ── Members: sales buyers + training players (+ the live adherents list if reachable) ────
  const names = new Set();
  for (const rows of Object.values(data)) for (const r of rows) if (r.acheteur) names.add(r.acheteur.trim());
  for (const g of groups) for (const p of g.players) names.add(p.nom.trim());
  if (SOURCE_SITE_URL) {
    try {
      const { adherents } = await getJson(`${SOURCE_SITE_URL}/api/adherents`);
      adherents.forEach((n) => names.add(n));
    } catch (e) {
      console.warn('  ⚠ /api/adherents source injoignable, ignoré :', e.message);
    }
  }
  // Same notion of "same person" as the app (src/lib/memberNames.ts memberKey): accents, case and
  // hyphens ignored, first spelling wins — otherwise "Anna CARDI" and "Anna Cardi" both land in the table.
  const keyOf = (n) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  const seen = new Map();
  for (const name of [...names].sort()) {
    if (!name || name === '-') continue;
    if (!seen.has(keyOf(name))) seen.set(keyOf(name), name);
  }
  for (const name of seen.values()) {
    await client.query('insert into members (name) values ($1) on conflict (name) do nothing', [name]);
  }
  console.log(`✓ ${seen.size} adhérents (${names.size - seen.size} variantes d'orthographe fusionnées)`);

  // ── Verification: totals must match the live backend exactly ────────────
  const { rows: totals } = await client.query('select produit, sum(qty)::int as total from stock_movements group by produit');
  const totalsByProduct = Object.fromEntries(totals.map((r) => [r.produit, r.total]));
  let mismatch = false;
  for (const [produit, expected] of Object.entries(achats)) {
    if (totalsByProduct[produit] !== expected) {
      mismatch = true;
      console.error(`  ✗ ${produit} : Postgres=${totalsByProduct[produit] ?? 0} ≠ live=${expected}`);
    }
  }
  console.log(mismatch ? '✗ Des totaux de stock ne correspondent pas — à vérifier avant de basculer.' : '✓ Totaux de stock vérifiés, identiques à la source.');

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
