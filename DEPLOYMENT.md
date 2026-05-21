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
