from database import SessionLocal
from sqlalchemy import text

def check_users_schema():
    db = SessionLocal()
    try:
        res = db.execute(text("SELECT * FROM users LIMIT 1")).mappings().first()
        if res:
            print("USERS KEYS:", res.keys())
        else:
            print("USERS TABLE IS EMPTY")
    finally:
        db.close()

if __name__ == "__main__":
    check_users_schema()
