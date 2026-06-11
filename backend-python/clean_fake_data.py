import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def clean_fake_data():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Erreur: DATABASE_URL non trouvée dans le fichier .env")
        return

    engine = create_engine(db_url)
    
    # Liste des tables à vider pour supprimer le contenu "fake"
    # On garde les utilisateurs (users) et les rôles (user_roles)
    tables_to_clean = [
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
        "search_catalog"
    ]

    print("--- DEBUT DU NETTOYAGE DES DONNEES (CONTENU UNIQUEMENT) ---")
    
    with engine.connect() as conn:
        transaction = conn.begin()
        try:
            # Désactive temporairement les contraintes de clés étrangères
            conn.execute(text("SET session_replication_role = 'replica';"))
            
            for table in tables_to_clean:
                print(f"Nettoyage de la table: {table}...")
                conn.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE;"))
            
            # Réactive les contraintes
            conn.execute(text("SET session_replication_role = 'origin';"))
            
            transaction.commit()
            print("\nDonnées nettoyées avec succès ! (Utilisateurs conservés)")
        except Exception as e:
            transaction.rollback()
            print(f"\nErreur lors du nettoyage : {e}")

if __name__ == "__main__":
    clean_fake_data()
