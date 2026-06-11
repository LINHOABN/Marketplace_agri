# AgriMarché

Marketplace agricole (FastAPI + React/TypeScript).

## Lancer l'application

### Windows (recommandé)

Double-cliquez sur **`LANCER.bat`** à la racine du projet.

Ou en ligne de commande :

```powershell
python launch.py
```

### Options du lanceur

| Commande | Action |
|----------|--------|
| `python launch.py` | Backend + frontend |
| `python launch.py --install` | Installe les dépendances uniquement |
| `python launch.py --check` | Vérifie Python, Node, ports |
| `python launch.py --backend` | API seule (port 8000) |
| `python launch.py --frontend` | Interface seule (port 5173) |
| `python launch.py --stop` | Arrête les processus |

### URLs après démarrage

- **Application** : http://localhost:5173
- **API** : http://127.0.0.1:8000
- **Documentation API** : http://127.0.0.1:8000/docs

### Erreur `ECONNREFUSED 127.0.0.1:8000` (proxy Vite)

Le frontend tourne mais **le backend n’est pas démarré**. Solutions :

1. Utilisez **`LANCER.bat`** ou `python launch.py` (démarre les deux).
2. Ou lancez le backend seul dans un terminal :
   ```powershell
   cd backend-python
   ..\.venv\Scripts\activate
   python main.py
   ```
3. Vérifiez `backend-python\.env` (`DATABASE_URL`, PostgreSQL allumé).
4. Test rapide : ouvrez http://127.0.0.1:8000/ — vous devez voir `{"status":"online",...}`.

## Configuration

1. Copiez `backend-python\.env.example` vers `backend-python\.env` et renseignez la base PostgreSQL.
2. Copiez `frontend\.env.example` vers `frontend\.env` si besoin (URL de l'API).

Migration base de données (une fois) :

```powershell
cd backend-python
python migrations\001_non_destructive_schema.py
```

## Structure du projet

```
├── LANCER.bat          # Double-clic pour démarrer (Windows)
├── launch.py           # Lanceur Python (backend + frontend)
├── backend-python/     # API FastAPI
├── frontend/           # Interface React (Vite)
└── .venv/              # Environnement Python (créé au premier lancement)
```

## Prérequis

- Python 3.10+
- Node.js 18+
- PostgreSQL (base configurée dans `.env`)
