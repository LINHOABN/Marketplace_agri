from sqlalchemy import text
from database import SessionLocal

def dump_all_convs():
    db = SessionLocal()
    try:
        query = text("""
            SELECT 
                c.id as conv_id,
                c.user1_id,
                u1.full_name as u1_name,
                c.user2_id,
                u2.full_name as u2_name,
                c.product_id,
                p.name as product_name
            FROM conversations c
            LEFT JOIN users u1 ON c.user1_id = u1.id
            LEFT JOIN users u2 ON c.user2_id = u2.id
            LEFT JOIN products p ON c.product_id = p.id
        """)
        res = db.execute(query).mappings().all()
        for r in res:
            print(f"CONV: {r['conv_id']}")
            print(f"  User1: {r['user1_id']} ({r['u1_name']})")
            print(f"  User2: {r['user2_id']} ({r['u2_name']})")
            print(f"  Product: {r['product_id']} ({r['product_name']})")
            print("-" * 20)
            
    finally:
        db.close()

if __name__ == "__main__":
    dump_all_convs()
