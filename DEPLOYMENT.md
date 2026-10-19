# Déploiement Netlify

## Architecture

Un seul backend, une seule base :
- **Frontend + backend** sur Netlify. Le backend est une Netlify Function unique
  (`netlify/functions/api.mts`) qui distribue en interne toutes les routes `/api/*` — voir
  `netlify/lib/` pour la logique de chaque domaine (ventes, stock, t-shirts, entraînements,
  adhérents, chatbot IA, Square).
- **Neon Postgres** (plan gratuit) comme unique base de données. Schéma dans
  `netlify/lib/schema.sql`. Google Sheets n'est plus utilisé en fonctionnement normal — il n'a
  servi qu'à la bascule initiale (voir plus bas).
- Render (`whosbad-backend.onrender.com`, ancien backend Express + Sheets) n'est plus utilisé
  après la bascule. Garde-le allumé quelques jours comme filet de sécurité, puis coupe-le.

## Mise en place (une seule fois)

1. **Créer un projet Neon** (neon.tech, gratuit) avec deux branches : `main` (production) et
   `dev` (développement local — jamais les vraies données).
2. **Appliquer le schéma** sur chaque branche : ouvre le SQL Editor de Neon, colle le contenu
   de `netlify/lib/schema.sql`, exécute.
3. **Migrer les données existantes** vers la branche `main` :
   ```bash
   DATABASE_URL="<connection string Neon, branche main>" \
   SOURCE_SITE_URL="https://<ton-site>.netlify.app" \
   npm run migrate
   ```
   Le script (`scripts/migrate.mjs`) lit le backend Render actuel (encore en ligne) et le Sheet
   de saison des entraînements, et vérifie à la fin que les totaux de stock correspondent
   exactement à ceux de la source. `SOURCE_SITE_URL` est ton site Netlify actuel (celui qui sert
   encore l'ancienne route `/api/adherents` basée sur Blobs) — omets-le si tu ne l'as pas sous
   la main, seuls les adhérents pas déjà vus dans une vente ou un groupe seront alors absents.
4. **Variables d'environnement Netlify** (Site settings → Environment variables) :
   - `DATABASE_URL` — connection string Neon, branche `main`
   - `API_SECRET` — un secret généré (`openssl rand -hex 32`) ; voir la note de sécurité plus bas
   - `ANTHROPIC_API_KEY`, `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_APP_ID`,
     `SQUARE_ENV`, `SQUARE_WEBHOOK_SIGNATURE_KEY`, `SQUARE_WEBHOOK_URL` — recopiés depuis le
     dashboard Render (Environment)
   - `VITE_API_SECRET` — même valeur que `API_SECRET` (injectée dans le frontend au build)
5. **Mettre à jour le webhook Square** dans le dashboard Square (Developer → Webhooks) :
   l'URL doit pointer vers `https://<ton-site>.netlify.app/api/square/webhook` au lieu de
   `onrender.com`. Seul toi peux faire ce changement (accès à ton compte Square).
6. **Déployer** (push sur GitHub → build Netlify automatique), puis vérifier `/api/achats`
   sur le nouveau site contre l'ancien avant de couper Render.

## Développement local

```bash
cp .env.example .env   # renseigne DATABASE_URL (branche Neon "dev"), API_SECRET, VITE_API_SECRET
npm run dev             # = netlify dev : sert le frontend Vite ET les fonctions, un seul port
```

`netlify dev` fait tourner les vraies fonctions (`netlify/functions/api.mts`) en local, contre
la base de données indiquée par `DATABASE_URL` — jamais un simulacre. Utilise la branche `dev`
de Neon, pas `main`, pour ne jamais risquer les vraies données pendant les tests. `npm run
dev:vite` reste disponible pour ne lancer que le frontend (sans `/api/*`).

## Sécurité de `API_SECRET`

Exigé sur toutes les routes qui écrivent (`Authorization: Bearer <secret>`). Comme le frontend
est une application publique (SPA), ce secret est visible dans le bundle JS par quiconque ouvre
les DevTools de son navigateur — il arrête les bots et les scans automatiques, ce n'est **pas**
une vraie authentification. Une vraie protection demanderait un système de comptes.

## Migration des données passées

`scripts/migrate.mjs` est un script à usage unique (voir l'étape 3 ci-dessus) — à relancer
seulement en cas de nouvelle tentative sur une base vide (relancer sur une base déjà migrée
duplique les lignes de ventes/mouvements). Il peut être supprimé une fois la bascule confirmée
stable.
