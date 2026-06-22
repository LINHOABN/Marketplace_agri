import os
import psycopg2
from dotenv import load_dotenv

# Charge les variables d'environnement
load_dotenv()
db_url = os.getenv("DATABASE_URL")

def fix_db():
    if not db_url:
        print("ERREUR : DATABASE_URL non trouvée dans le fichier .env")
        print("Assurez-vous d'avoir l'URL de votre base de données Render.")
        return
    
    try:
        print(f"Connexion à la base de données...")
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()
        
        print("Vérification/Création du type 'user_role'...")
        cur.execute("""
            DO $$ BEGIN
                CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'deliverer', 'admin');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)
        
        print("Vérification/Création du type 'order_status'...")
        cur.execute("""
            DO $$ BEGIN
                CREATE TYPE order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'completed', 'refunded');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)
        
        # Vérifier si la table user_roles existe et utilise le bon type
        print("Vérification de la table 'user_roles'...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS user_roles (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role user_role NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(user_id, role)
            );
        """)
        
        print("\n>>> SUCCÈS : La base de données est maintenant prête pour la production.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"\n>>> ERREUR LORS DE LA RÉPARATION : {e}")
        if "does not exist" in str(e):
            print("Note : Vérifiez que les tables 'users' existent déjà via votre blueprint Render.")

if __name__ == "__main__":
    fix_db()
