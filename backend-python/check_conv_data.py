from database import engine
from sqlalchemy import text

def check_conversations():
    with engine.connect() as conn:
        print("CONVERSATIONS DATA:")
        r = conn.execute(text("SELECT * FROM conversations")).mappings().all()
        print(f"Total: {len(r)}")
        for i in r:
            print(f"  ID: {i['id']}, U1: {i['user1_id']}, U2: {i['user2_id']}, P: {i['product_id']}")

if __name__ == "__main__":
    check_conversations()
