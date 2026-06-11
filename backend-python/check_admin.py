import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def check():
    engine = create_engine(os.getenv("DATABASE_URL"))
    with engine.connect() as conn:
        users = conn.execute(text("SELECT id, email, full_name FROM users")).fetchall()
        print(f"Users found: {users}")
        roles = conn.execute(text("SELECT * FROM user_roles")).fetchall()
        print(f"Roles found: {roles}")

if __name__ == "__main__":
    check()
