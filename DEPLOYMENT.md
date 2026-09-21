# Déploiement Netlify

## Prérequis
- Compte Netlify
- Repo GitHub avec ce projet

## Étapes
1. Connecter le repo sur netlify.com
2. Build command : `npm run build`
3. Publish directory : `dist`
4. Variables d'env : `VITE_API_URL=https://whosbad-backend.onrender.com`

## Configuration Netlify (netlify.toml à la racine)
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Liste des adhérents partagée (Netlify Function + Blobs)
La liste des adhérents ajoutés via le chatbot est stockée côté serveur pour être identique
sur mobile et desktop : `netlify/functions/adherents.mts` (route `/api/adherents`, cf. la
règle de redirection dans `netlify.toml`, qui doit rester AVANT le `/*` de la SPA).

- Aucune variable d'environnement : Netlify Blobs est activé automatiquement sur le site.
- Les fonctions sont déployées avec le site (push sur GitHub → build Netlify).
- `npm run dev` sert la même route depuis un fichier local `.dev-data/adherents.json`
  (ignoré par git) : la liste de dev est donc distincte de la vraie liste.
- Les adhérents déjà présents dans les ventes ou les groupes d'entraînement sont repris
  automatiquement ; seuls les noms ajoutés à la main passent par cette liste.
