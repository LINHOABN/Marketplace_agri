from database import engine
from sqlalchemy import text

def check_users():
    with engine.connect() as conn:
        r = conn.execute(text("SELECT count(*) FROM users WHERE full_name IS NULL")).scalar()
        print(f"{r} users with NULL full_name")

if __name__ == "__main__":
    check_users()
