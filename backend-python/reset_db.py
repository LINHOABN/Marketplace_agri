import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def reset_database():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Erreur: DATABASE_URL non trouvée dans le fichier .env")
        return

    engine = create_engine(db_url)
    
    # Liste des tables à vider (ordre respectant les clés étrangères)
    tables = [
        "audit_logs",
        "invoices",
        "disputes",
        "notifications",
        "messages",
        "conversations",
        "negotiations",
        "transactions",
        "platform_fees",
        "wallets",
        "orders",
        "post_comments",
        "post_likes",
        "posts",
        "product_reviews",
        "reviews",
        "products",
        "shops",
        "user_roles",
        "refresh_tokens",
        "users",
        "search_catalog",
        "categories"
    ]

    print("--- DEBUT DU NETTOYAGE DE LA BASE DE DONNEES ---")
    
    with engine.connect() as conn:
        transaction = conn.begin()
        try:
            # Désactive temporairement les contraintes de clés étrangères
            conn.execute(text("SET session_replication_role = 'replica';"))
            
            for table in tables:
                print(f"Nettoyage de la table: {table}...")
                conn.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE;"))
            
            # Réactive les contraintes
            conn.execute(text("SET session_replication_role = 'origin';"))
            
            transaction.commit()
            print("\nBase de données vidée avec succès !")
        except Exception as e:
            transaction.rollback()
            print(f"\nErreur lors du nettoyage : {e}")

if __name__ == "__main__":
    reset_database()
