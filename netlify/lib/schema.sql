-- Who's Bad Logistic — schéma Postgres (Neon).
-- Source unique : appliqué tel quel sur la vraie base (Neon SQL editor / migration
-- script) et sur la base pglite éphémère utilisée par les tests (netlify/lib/*.test.ts).

create table if not exists product_references (
  name text primary key,
  price numeric(10,2) not null check (price > 0),
  color text not null,
  -- € par boîte facturés en plus par Square. Par défaut 0,35 (Victor GM/PC) ;
  -- CBX RED/BLUE, Victor C1 et NCS Pro sont à 0,25 (voir migration).
  frais_square numeric(10,2) not null default 0.35 check (frais_square >= 0)
);

create table if not exists sales (
  id bigint generated always as identity primary key,
  produit text not null references product_references(name),
  date date not null,
  vendeur text not null default '',
  acheteur text not null,
  quantite int not null check (quantite > 0),
  paye text not null check (paye in ('Oui', 'Non', '-')),
  mode_paiement text not null default '',
  commentaire text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists sales_produit_idx on sales (produit);
create index if not exists sales_acheteur_idx on sales (lower(acheteur));

-- Remplace à la fois l'ancien total "achats" codé en dur et le journal Reassort
-- séparé du système précédent : le stock acheté d'un produit = SUM(qty) ici.
create table if not exists stock_movements (
  id bigint generated always as identity primary key,
  produit text not null references product_references(name),
  date date not null,
  qty int not null,
  commentaire text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_produit_idx on stock_movements (produit);

create table if not exists tshirt_stock (
  id bigint generated always as identity primary key,
  marque text not null,
  sexe text not null,
  taille text not null,
  quantite int not null default 0 check (quantite >= 0),
  unique (marque, sexe, taille)
);

-- Annuaire des adhérents, "Prénom NOM" (voir src/lib/memberNames.ts pour la normalisation
-- côté application — la contrainte ici est volontairement permissive, la validation du
-- format se fait dans le code, pas en base).
create table if not exists members (
  name text primary key
);

create table if not exists training_groups (
  id bigint generated always as identity primary key,
  label text not null unique,
  sort_order int not null
);

create table if not exists training_players (
  id bigint generated always as identity primary key,
  group_id bigint not null references training_groups(id) on delete cascade,
  nom text not null,
  commentaire text not null default '',
  paiement text not null default 'pending' check (paiement in ('pending', 'paid', 'unpaid'))
);
create index if not exists training_players_group_idx on training_players (group_id);

-- Remplace la Map en mémoire `pendingSquare` de l'ancien serveur Express : une fonction
-- Netlify est éphémère, rien ne persiste en mémoire entre deux invocations. Le webhook
-- Square qui confirme un paiement plus tard doit retrouver la vente en attente ici.
create table if not exists square_pending_payments (
  order_id text primary key,
  produit text not null,
  quantite int not null,
  acheteur text not null,
  vendeur text not null,
  commentaire text not null default '',
  date date not null,
  checkout_url text not null,
  prix_base numeric(10,2) not null,
  frais numeric(10,2) not null,
  total numeric(10,2) not null,
  created_at timestamptz not null default now()
);
