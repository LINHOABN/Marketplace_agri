from database import engine
from sqlalchemy import text
import uuid

def test_insert():
    # Use existing product and users from my previous checks
    p_id = 'ab1a2ce7-a0bc-46ba-8cfb-6a4ab9369bfb' # Porc local
    u1 = 'ed4f954c-48e9-43b9-a5b2-8900a81fe91c' # Nego Abba Abed (seller)
    # I need another user for U2. I'll search for one.
    with engine.connect() as conn:
        u2_row = conn.execute(text("SELECT id FROM users WHERE id != :u1 LIMIT 1"), {"u1": u1}).mappings().first()
        if not u2_row:
            print("Need another user to test.")
            return
        u2 = str(u2_row['id'])
        
        print(f"Testing insert for P:{p_id}, U1:{u1}, U2:{u2}")
        try:
            res = conn.execute(text("""
                INSERT INTO conversations (user1_id, user2_id, product_id)
                VALUES (CAST(:u1 AS uuid), CAST(:u2 AS uuid), CAST(:p_id AS uuid))
                RETURNING id
            """), {"u1": u1, "u2": u2, "p_id": p_id}).mappings().first()
            conn.commit()
            print(f"Success! Created conversation ID: {res['id']}")
        except Exception as e:
            print(f"Failed: {e}")

if __name__ == "__main__":
    test_insert()
