from database import engine
from sqlalchemy import text

def check_schema():
    with engine.connect() as conn:
        for table in ['users', 'shops']:
            print(f"=== {table.upper()} COLUMNS ===")
            r = conn.execute(text(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table}'")).mappings().all()
            for row in r:
                print(f"{row['column_name']}: {row['data_type']}")
            print("\n")

if __name__ == "__main__":
    check_schema()
