# =============================================================================
# database.py — Connexion à la base de données PostgreSQL
# =============================================================================
#
# CE FICHIER FAIT QUOI ?
#   Il crée la connexion unique à PostgreSQL via SQLAlchemy.
#   Toutes les routes (routers) importent `get_db` pour accéder à la base.
#
# POUR MODIFIER :
#   - Changer la BDD → modifiez DATABASE_URL dans le fichier .env
#   - Passer en SQLite (tests) → remplacez create_engine(...)
#     par :  create_engine("sqlite:///./test.db")
#   - Activer le pool de connexions → ajoutez pool_size=10, max_overflow=20
#     dans create_engine(...)
# =============================================================================

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Charge les variables depuis le fichier .env (DATABASE_URL, JWT_SECRET, etc.)
load_dotenv()

# ─── URL de connexion PostgreSQL ───────────────────────────────────────────────
# Format : postgresql://utilisateur:motdepasse@hote:port/nom_base
# Exemple : postgresql://postgres:1234@localhost:5432/agrimarche
# POUR MODIFIER : changez DATABASE_URL dans backend-python/.env
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
if not SQLALCHEMY_DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL manquant. Copiez backend-python/.env.example vers .env "
        "et configurez PostgreSQL."
    )

# ─── Moteur SQLAlchemy ─────────────────────────────────────────────────────────
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# ─── Fabrique de sessions ─────────────────────────────────────────────────────
# Chaque requête HTTP obtient sa propre session isolée.
# autocommit=False → les changements ne sont PAS sauvegardés automatiquement
#   (il faut appeler db.commit() explicitement)
# autoflush=False  → les changements ne sont PAS envoyés à la BDD avant commit
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ─── Classe de base pour les modèles ORM ──────────────────────────────────────
# Si vous créez des modèles SQLAlchemy (ex: class User(Base): ...),
# ils héritent de cette Base.
# REMARQUE : Dans ce projet, on utilise des requêtes SQL brutes (text(...))
# plutôt que des modèles ORM complets.
Base = declarative_base()


# ─── Dépendance FastAPI : fournit une session à chaque requête ─────────────────
# COMMENT ÇA FONCTIONNE :
#   1. FastAPI appelle get_db() au début de chaque requête
#   2. Une session est créée et injectée dans la fonction via Depends(get_db)
#   3. Après la requête (succès ou erreur), finally: db.close() ferme la session
#      → évite les fuites de connexions
#
# UTILISATION dans un router :
#   async def ma_route(db: Session = Depends(get_db)):
#       result = db.execute(text("SELECT * FROM users")).mappings().all()
def get_db():
    db = SessionLocal()
    try:
        yield db          # la session est utilisée ici par la route
    finally:
        db.close()        # toujours fermée, même en cas d'exception
