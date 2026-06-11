from database import engine
from sqlalchemy import text

def check_seller_orphans():
    with engine.connect() as conn:
        print("Checking for shops without matching sellers...")
        query = text("""
            SELECT s.id as sid, s.name, s.seller_id, u.id as uid 
            FROM shops s 
            LEFT JOIN users u ON s.seller_id = u.id 
            WHERE u.id IS NULL
        """)
        r = conn.execute(query).mappings().all()
        print(f"Found {len(r)} orphan shops.")
        for row in r:
            print(f"Shop ID: {row['sid']} Name: {row['name']} Seller ID: {row['seller_id']}")

if __name__ == "__main__":
    check_seller_orphans()
