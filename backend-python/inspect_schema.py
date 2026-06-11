from database import engine
from sqlalchemy import text

def check_table(table_name):
    print(f"\n=== {table_name.upper()} COLUMNS ===")
    with engine.connect() as conn:
        r = conn.execute(text(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table_name}'")).mappings().all()
        for row in r:
            print(f"{row['column_name']}: {row['data_type']}")

check_table('users')
check_table('user_roles')
check_table('role_requests')
