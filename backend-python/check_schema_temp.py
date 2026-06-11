from database import engine
from sqlalchemy import text

def check_schema():
    with engine.connect() as conn:
        for table in ['products', 'users', 'shops', 'categories']:
            print(f"\n=== {table.upper()} COLUMNS ===")
            query = text(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table}'")
            try:
                r = conn.execute(query).mappings().all()
                for row in r:
                    print(f"{row['column_name']}: {row['data_type']}")
            except Exception as e:
                print(f"Error checking {table}: {e}")

if __name__ == "__main__":
    check_schema()
