import os
import uuid
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Charge les variables d'environnement
load_dotenv()

def promote():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Erreur : DATABASE_URL non trouvée dans le .env")
        return

    email = "negoabbaabed923@gmail.com"  # Votre email
    engine = create_engine(db_url)

    print(f"Connexion à la base de données...")
    with engine.connect() as conn:
        transaction = conn.begin()
        try:
            # 1. Trouver l'ID de l'utilisateur
            user = conn.execute(
                text("SELECT id FROM users WHERE email = :email"), 
                {"email": email}
            ).mappings().first()

            if not user:
                print(f"Utilisateur {email} non trouvé !")
                return

            user_id = user["id"]
            print(f"ID trouvé : {user_id}")

            # 2. Supprimer les anciens rôles (pour éviter les doublons)
            conn.execute(
                text("DELETE FROM user_roles WHERE user_id = :uid"), 
                {"uid": user_id}
            )

            # 3. Créer le rôle Admin
            new_role_id = str(uuid.uuid4())
            conn.execute(
                text("""
                    INSERT INTO user_roles (id, user_id, role, created_at)
                    VALUES (:id, :uid, 'admin', NOW())
                """), 
                {"id": new_role_id, "uid": user_id}
            )

            transaction.commit()
            print(f"SUCCÈS : {email} est maintenant ADMINISTRATEUR !")
            print("Vous pouvez maintenant vous connecter sur /admin")
            
        except Exception as e:
            transaction.rollback()
            print(f"Erreur lors de la promotion : {e}")

if __name__ == "__main__":
    promote()
