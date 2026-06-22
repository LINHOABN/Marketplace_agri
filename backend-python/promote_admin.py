import os
import uuid
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def promote(email):
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Erreur : DATABASE_URL non trouvee dans le .env")
        return

    engine = create_engine(db_url)

    print(f"Promotion de {email}...")
    with engine.connect() as conn:
        transaction = conn.begin()
        try:
            user = conn.execute(
                text("SELECT id FROM users WHERE email = :email"), 
                {"email": email}
            ).mappings().first()

            if not user:
                print(f"  -> Utilisateur {email} non trouve !")
                transaction.rollback()
                return

            user_id = user["id"]

            # Supprimer les anciens roles
            conn.execute(
                text("DELETE FROM user_roles WHERE user_id = :uid"), 
                {"uid": user_id}
            )

            # Creer le role Admin
            new_role_id = str(uuid.uuid4())
            conn.execute(
                text("""
                    INSERT INTO user_roles (id, user_id, role, created_at)
                    VALUES (:id, :uid, 'admin', NOW())
                """), 
                {"id": new_role_id, "uid": user_id}
            )

            transaction.commit()
            print(f"  -> SUCCES : {email} est maintenant ADMINISTRATEUR !")
            
        except Exception as e:
            transaction.rollback()
            print(f"  -> Erreur : {e}")

if __name__ == "__main__":
    promote("negoabbaabed23@gmail.com")
    promote("negoabbaabed@gmail.com")
    print("\nVous pouvez maintenant vous connecter sur /admin")
