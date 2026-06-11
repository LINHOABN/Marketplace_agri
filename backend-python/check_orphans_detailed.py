from database import engine
from sqlalchemy import text

def check_orphans():
    with engine.connect() as conn:
        print("Checking for products without matching shops...")
        query = text("""
            SELECT p.id as pid, p.name, p.shop_id, s.id as sid 
            FROM products p 
            LEFT JOIN shops s ON p.shop_id = s.id 
            WHERE s.id IS NULL
        """)
        r = conn.execute(query).mappings().all()
        print(f"Found {len(r)} orphan products.")
        for row in r:
            print(f"Product ID: {row['pid']} Name: {row['name']} Shop ID: {row['shop_id']}")

if __name__ == "__main__":
    check_orphans()
