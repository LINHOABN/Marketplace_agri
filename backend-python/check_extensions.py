from database import engine
from sqlalchemy import text

def check_extension():
    with engine.connect() as conn:
        print("EXTENSIONS:")
        r = conn.execute(text("SELECT extname FROM pg_extension")).mappings().all()
        for i in r:
            print(f"  {i['extname']}")

if __name__ == "__main__":
    check_extension()
