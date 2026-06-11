import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def check_schema():
    db_url = os.getenv("DATABASE_URL")
    engine = create_engine(db_url)
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'product_reviews'
        """))
        print("Columns in product_reviews:")
        for row in result:
            print(f"- {row[0]}")

if __name__ == "__main__":
    check_schema()
