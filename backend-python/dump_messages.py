from database import engine
from sqlalchemy import text
import sys

def dump_messages(conv_id):
    with engine.connect() as conn:
        print(f"Messages for conversation {conv_id}:")
        r = conn.execute(text("SELECT id, type, content, offer_price, offer_quantity, offer_status FROM messages WHERE conversation_id = CAST(:c_id AS uuid) ORDER BY created_at ASC"), {"c_id": conv_id}).mappings().all()
        for i in r:
            print(f"  ID: {i['id']} | Type: {i['type']} | Content: {i['content']}")
            print(f"    Price: {i['offer_price']} | Qty: {i['offer_quantity']} | Status: {i['offer_status']}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        dump_messages(sys.argv[1])
    else:
        print("Usage: python dump_messages.py <conv_id>")
