# Who's Bad Logistic

Gestion des volants, t-shirts, entraînements et ventes de badminton — frontend React + backend
Netlify Functions + Postgres (Neon), un seul dépôt.

## Stack
- Frontend : React 18 + TypeScript + Vite, TailwindCSS + Framer Motion, Zustand + React Query, PWA
- Backend : Netlify Functions (`netlify/functions/api.mts`, une seule fonction qui distribue
  toutes les routes `/api/*` — voir `netlify/lib/`), Postgres (Neon)
- Intégrations : Anthropic (chatbot de saisie en langage naturel), Square (paiements)

## Démarrage
```bash
npm install
cp .env.example .env   # renseigne DATABASE_URL (Neon), API_SECRET, VITE_API_SECRET
npm run dev             # netlify dev : frontend + fonctions ensemble
```

## Build
```bash
npm run build
```

## Déploiement, schéma de base et migration
Voir [DEPLOYMENT.md](DEPLOYMENT.md).
