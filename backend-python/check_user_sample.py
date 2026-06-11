from database import engine
from sqlalchemy import text

def check_user():
    with engine.connect() as conn:
        r = conn.execute(text("SELECT id, full_name, email FROM users WHERE id = 'ed4f954c-48e9-43b9-a5b2-8900a81fe91c'")).mappings().first()
        if r:
            print(dict(r))
        else:
            print("User not found.")

if __name__ == "__main__":
    check_user()
