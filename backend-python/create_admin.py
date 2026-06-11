import os, sys
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text
from database import SessionLocal
from dotenv import load_dotenv
load_dotenv()

# ─── CONFIGURATION DE L'ADMINISTRATEUR ───────────────────────
ADMIN_EMAIL     = "admin@agrimarche.cm"
ADMIN_PASSWORD  = "Admin@2024!"
ADMIN_NAME      = "Administrateur AgriMarche"
ADMIN_PHONE     = "+237600000000"
# ─────────────────────────────────────────────────────────────

from utils.security import get_password_hash

def create_admin():
    db = SessionLocal()
    try:
        # Verifier si l'admin existe deja
        existing = db.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": ADMIN_EMAIL}
        ).mappings().first()

        if existing:
            user_id = existing["id"]
            print(f"[INFO] Utilisateur {ADMIN_EMAIL} existe deja (ID: {user_id}).")
            # S'assurer que le role admin est bien attribue
            role_check = db.execute(
                text("SELECT id FROM user_roles WHERE user_id = :uid AND role = 'admin'"),
                {"uid": user_id}
            ).first()
            if not role_check:
                db.execute(
                    text("INSERT INTO user_roles (user_id, role) VALUES (:uid, 'admin') ON CONFLICT DO NOTHING"),
                    {"uid": user_id}
                )
                db.commit()
                print("[OK] Role 'admin' attribue.")
            else:
                print("[OK] Role 'admin' deja present.")
            return

        hashed = get_password_hash(ADMIN_PASSWORD)

        # 1. Creer l'utilisateur
        result = db.execute(text("""
            INSERT INTO users (email, password_hash, full_name, phone, is_active, created_at)
            VALUES (:email, :pwd, :name, :phone, TRUE, NOW())
            RETURNING id
        """), {
            "email": ADMIN_EMAIL,
            "pwd":   hashed,
            "name":  ADMIN_NAME,
            "phone": ADMIN_PHONE,
        }).mappings().first()

        user_id = result["id"]

        # 2. Attribuer le role admin
        db.execute(text("""
            INSERT INTO user_roles (user_id, role) VALUES (:uid, 'admin')
        """), {"uid": user_id})

        # 3. Creer le portefeuille
        db.execute(text("""
            INSERT INTO wallets (user_id, balance, escrow_balance)
            VALUES (:uid, 0, 0)
        """), {"uid": user_id})

        db.commit()

        print("=" * 50)
        print("[OK] Compte administrateur cree avec succes !")
        print("=" * 50)
        print(f"  Email       : {ADMIN_EMAIL}")
        print(f"  Mot de passe: {ADMIN_PASSWORD}")
        print(f"  Nom         : {ADMIN_NAME}")
        print(f"  ID          : {user_id}")
        print("=" * 50)

    except Exception as e:
        db.rollback()
        print(f"[ERREUR] : {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()
