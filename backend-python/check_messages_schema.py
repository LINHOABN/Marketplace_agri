from database import SessionLocal
from sqlalchemy import text

def check_messages_schema():
    db = SessionLocal()
    try:
        res = db.execute(text("SELECT * FROM messages LIMIT 1")).mappings().first()
        if res:
            print("MESSAGES KEYS:", res.keys())
        else:
            print("MESSAGES TABLE IS EMPTY")
            # Try to describe table
            res = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'messages'")).scalars().all()
            print("COLUMNS:", res)
    finally:
        db.close()

if __name__ == "__main__":
    check_messages_schema()
