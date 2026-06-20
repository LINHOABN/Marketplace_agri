from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    # Check users columns
    print("=== USERS COLUMNS ===")
    r = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'")).mappings().all()
    for row in r:
        print(f"{row['column_name']}: {row['data_type']}")
    
    # Check user_roles columns
    print("\n=== USER_ROLES COLUMNS ===")
    r = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_roles'")).mappings().all()
    for row in r:
        print(f"{row['column_name']}: {row['data_type']}")
