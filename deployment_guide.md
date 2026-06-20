# Guide de Déploiement AgriMarché 🚀

Ce guide vous explique comment mettre en ligne votre plateforme AgriMarché.

## 1. Déploiement du Backend (Render)

Il y a deux façons de faire. La plus simple est d'utiliser le **Blueprint** que j'ai créé.

### Méthode A : Utiliser le Blueprint (Recommandé - Simple)
1. Allez sur le [Dashboard Render](https://dashboard.render.com).
2. Cliquez sur **New** > **Blueprint**.
3. Connectez votre dépôt GitHub.
4. Render va détecter le fichier `render.yaml`. Il va configurer automatiquement :
   - Le service web (API).
   - La base de données PostgreSQL.
   - Les variables d'environnement de base.
5. Il vous suffira de remplir manuellement `BLOB_READ_WRITE_TOKEN` (depuis Vercel) et de vérifier `ALLOWED_ORIGINS`.

---

### Méthode B : Configuration Manuelle (Si la Méthode A échoue)

#### A. Créer la Base de Données
1. Allez sur [Render.com](https://dashboard.render.com).
2. Cliquez sur **New** > **PostgreSQL**.
3. Donnez-lui un nom (ex: `agrimarche-db`).
4. Une fois créée, copiez l'**Internal Database URL** (pour Render à Render) ou **External Database URL** (pour y accéder depuis votre PC).

### B. Créer le Web Service (API)
1. Cliquez sur **New** > **Web Service**.
2. Connectez votre dépôt GitHub.
3. **Name** : `agrimarche-api`.
4. **Environment** : `Docker`.
5. **Docker Command** : Laisser vide (il utilisera le `backend-python/Dockerfile`).
6. **Docker Context** : `./backend-python` (Important).
7. Cliquez sur **Advanced** pour ajouter les variables d'environnement :
   - `DATABASE_URL` : L'URL de votre base PostgreSQL (Internal URL).
   - `JWT_SECRET` : Une longue phrase secrète aléatoire.
   - `ALLOWED_ORIGINS` : L'URL finale de votre frontend sur Vercel (ex: `https://agrimarche.vercel.app`).
   - `PORT` : `8000`.
   - `BLOB_READ_WRITE_TOKEN` : Votre token Vercel Blob (voir section 3).

## 2. Déploiement du Frontend (Vercel)

Vercel est parfait pour l'interface React.

1. Allez sur [Vercel.com](https://vercel.com).
2. Cliquez sur **Add New** > **Project**.
3. Importez votre dépôt GitHub.
4. **Root Directory** : `frontend`.
5. **Build Command** : `npm run build`.
6. **Output Directory** : `dist`.
7. **Environment Variables** :
   - `VITE_API_URL` : L'URL de votre backend Render suivie de `/api` (ex: `https://agrimarche-api.onrender.com/api`).
   - `VITE_SOCKET_URL` : L'URL de votre backend Render sans le `/api` (ex: `https://agrimarche-api.onrender.com`).

## 3. Stockage des Médias (Vercel Blob)

Pour que les utilisateurs puissent envoyer des images (avatars, produits) :

1. Dans votre projet Vercel, allez dans l'onglet **Storage**.
2. Cliquez sur **Create Database** > **Blob**.
3. Une fois créé, allez dans **Settings** > **Environment Variables**.
4. Copiez la valeur de `BLOB_READ_WRITE_TOKEN`.
5. Ajoutez cette variable dans les paramètres de votre service **Render**.

## 4. Finalisation

Une fois le frontend déployé, n'oubliez pas de retourner sur Render pour mettre à jour la variable `ALLOWED_ORIGINS` avec l'URL réelle fournie par Vercel.

---
**Note sur les WebSockets :** Sur Render (formule gratuite), le serveur peut mettre quelques secondes à "se réveiller". Le chat mettra un peu de temps à se connecter lors de la première visite.
