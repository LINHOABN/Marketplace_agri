import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv(dotenv_path="backend-python/.env")

def seed_categories():
    db_url = os.getenv("DATABASE_URL")
    engine = create_engine(db_url)
    
    categories = [
        "Céréales", "Légumes", "Fruits", "Élevage Bovin", 
        "Aviculture", "Aquaculture", "Matériel Agricole",
        "Engrais & Semences"
    ]

    print("Insertion des catégories par défaut...")
    
    with engine.connect() as conn:
        transaction = conn.begin()
        try:
            for cat in categories:
                conn.execute(text("INSERT INTO categories (name) VALUES (:name) ON CONFLICT (name) DO NOTHING;"), {"name": cat})
            transaction.commit()
            print("Catégories insérées !")
        except Exception as e:
            transaction.rollback()
            print(f"Erreur : {e}")

if __name__ == "__main__":
    seed_categories()
