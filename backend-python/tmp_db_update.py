import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def run():
    db_url = os.getenv("DATABASE_URL")
    engine = create_engine(db_url)
    with engine.connect() as conn:
        print("--- USER COLUMNS ---")
        res = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'")).mappings().all()
        for r in res:
            print(f"{r['column_name']}: {r['data_type']}")
        
        print("\n--- CREATING seller_driver_links TABLE (IF NOT EXISTS) ---")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS seller_driver_links (
                seller_id uuid REFERENCES users(id) ON DELETE CASCADE,
                deliverer_id uuid REFERENCES users(id) ON DELETE CASCADE,
                created_at timestamp DEFAULT NOW(),
                PRIMARY KEY (seller_id, deliverer_id)
            )
        """))
        
        print("--- UPDATING orders TABLE FOR DYNAMIC FEES (IF MISSING) ---")
        # Check if deliverer_share exists in orders
        cols = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'orders'")).mappings().all()
        col_names = [c['column_name'] for c in cols]
        
        if 'delivery_fee' not in col_names:
            conn.execute(text("ALTER TABLE orders ADD COLUMN delivery_fee decimal DEFAULT 0"))
        if 'commission_amount' not in col_names:
            conn.execute(text("ALTER TABLE orders ADD COLUMN commission_amount decimal DEFAULT 0"))
        if 'seller_amount' not in col_names:
            conn.execute(text("ALTER TABLE orders ADD COLUMN seller_amount decimal DEFAULT 0"))
            
        conn.commit()
    print("Done.")

if __name__ == "__main__":
    run()
