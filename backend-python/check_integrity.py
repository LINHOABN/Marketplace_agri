from database import engine
from sqlalchemy import text

def check_integrity():
    with engine.connect() as conn:
        print("Checking product/shop integrity...")
        
        # Products without shop_id
        r = conn.execute(text("SELECT id, name FROM products WHERE shop_id IS NULL")).mappings().all()
        print(f"Products without shop_id: {len(r)}")
        for p in r:
            print(f"  - {p['name']} ({p['id']})")
        
        # Products with shop_id that don't exist in shops
        r = conn.execute(text("""
            SELECT p.id, p.name, p.shop_id 
            FROM products p 
            LEFT JOIN shops s ON p.shop_id = s.id 
            WHERE s.id IS NULL AND p.shop_id IS NOT NULL
        """)).mappings().all()
        print(f"Products with orphan shop_id: {len(r)}")
        for p in r:
            print(f"  - {p['name']} (Product ID: {p['id']}, Shop ID: {p['shop_id']})")

        # Check a sample product
        r = conn.execute(text("SELECT * FROM products LIMIT 1")).mappings().first()
        if r:
            print("\nSample Product:")
            print(dict(r))
            
            # Check shop for this product
            if r['shop_id']:
                s = conn.execute(text("SELECT * FROM shops WHERE id = :sid"), {"sid": r['shop_id']}).mappings().first()
                if s:
                    print("\nAssociated Shop:")
                    print(dict(s))
                else:
                    print(f"\nShop {r['shop_id']} NOT FOUND for product {r['id']}")

if __name__ == "__main__":
    check_integrity()
