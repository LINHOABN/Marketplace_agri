
from sqlalchemy import text
from database import engine

def check():
    with engine.connect() as conn:
        print("Checking users table columns...")
        result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"))
        columns = [row[0] for row in result]
        print(f"Columns: {columns}")
        
        if 'avatar_url' in columns:
            print("avatar_url EXISTS")
        else:
            print("avatar_url MISSING")

if __name__ == "__main__":
    check()
