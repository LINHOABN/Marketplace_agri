from database import engine
from sqlalchemy import text

def check():
    tables = ['conversations', 'messages', 'products', 'shops', 'users']
    with engine.connect() as conn:
        for table in tables:
            print(f"\nTABLE: {table}")
            r = conn.execute(text(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table}'"))
            for i in r:
                print(i)

if __name__ == "__main__":
    check()
